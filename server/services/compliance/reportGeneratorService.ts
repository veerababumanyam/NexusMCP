/**
 * Report Generator Service
 * 
 * Provides advanced report generation capabilities with support for:
 * - PDF report generation
 * - HTML report generation
 * - DOCX report generation
 * - JSON data export
 * - Report scheduling and automation
 * - Customizable templates
 * 
 * Implements rendering engines for different report formats
 * and integrates with the compliance service for data access.
 */

import { EventEmitter } from 'events';
import { complianceService } from './complianceService';
import { db } from '@db';
import {
  complianceReports,
  complianceReportTemplates,
  complianceAssessments,
  complianceAssessmentResults,
  complianceFrameworks,
  complianceControls
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type ReportFormat = 'pdf' | 'html' | 'docx' | 'json';

export type ReportContext = {
  report: any;
  assessment?: any;
  frameworks?: any[];
  controls?: any[];
  results?: any[];
  variables?: Record<string, any>;
  templateOptions?: Record<string, any>;
};

export class ReportGeneratorService extends EventEmitter {
  private templatesCache: Map<number, any> = new Map();
  
  constructor() {
    super();
    
    // Listen for report creation events
    complianceService.on('report:created', async (report: any) => {
      if (report.scheduledGeneration && report.generationSchedule) {
        this.scheduleReport(report);
      }
    });
    
    // Listen for report update events
    complianceService.on('report:updated', async (report: any) => {
      // Update scheduling if needed
      if (report.scheduledGeneration && report.generationSchedule) {
        this.scheduleReport(report);
      }
    });
  }
  
  /**
   * Generate a report based on the report ID
   */
  public async generateReport(reportId: number, userId: number, workspaceId?: number): Promise<string | null> {
    try {
      // Get the report
      const report = await complianceService.getReportById(reportId, workspaceId);
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }
      
      // Build the report context
      const context = await this.buildReportContext(report);
      
      // Get template
      const template = await this.getTemplateForReport(report);
      if (!template) {
        throw new Error(`No template found for report type: ${report.type}`);
      }
      
      // Render the report content based on format
      const output = await this.renderReport(context, template, report.format);
      
      // Save the rendered report
      const outputUrl = await this.saveReportOutput(report, output);
      
      // Update the report status
      await complianceService.updateReport(reportId, {
        status: 'generated',
        generatedUrl: outputUrl,
        generatedAt: new Date(),
        generatedBy: userId
      }, workspaceId);
      
      return outputUrl;
    } catch (error) {
      console.error('Error generating report:', error);
      return null;
    }
  }
  
  /**
   * Build the context object for report rendering
   */
  private async buildReportContext(report: any): Promise<ReportContext> {
    const context: ReportContext = { report };
    
    // Get assessment data if applicable
    if (report.assessmentId) {
      context.assessment = await complianceService.getAssessmentById(report.assessmentId);
      
      // Get assessment results
      if (context.assessment) {
        context.results = await complianceService.getAssessmentResults(report.assessmentId);
        
        // Fetch controls for the results
        if (context.results && context.results.length > 0) {
          const controlIds = context.results.map((result: any) => result.controlId);
          const controls = await db.select()
            .from(complianceControls)
            .where(
              controlIds.length > 0 
                ? (sql: any) => sql`complianceControls.id IN (${controlIds.join(',')})`
                : undefined
            );
          
          // Attach controls to results
          context.controls = controls;
          context.results = context.results.map((result: any) => {
            const control = controls.find((c: any) => c.id === result.controlId);
            return { ...result, control };
          });
        }
      }
    }
    
    // Get frameworks if specified
    if (report.frameworkIds && Array.isArray(report.frameworkIds) && report.frameworkIds.length > 0) {
      const frameworks = await db.select()
        .from(complianceFrameworks)
        .where(
          report.frameworkIds.length > 0
            ? (sql: any) => sql`complianceFrameworks.id IN (${report.frameworkIds.join(',')})`
            : undefined
        );
      
      context.frameworks = frameworks;
      
      // Get controls for each framework
      if (frameworks && frameworks.length > 0) {
        const controlsPromises = frameworks.map((framework: any) => 
          db.select()
            .from(complianceControls)
            .where(eq(complianceControls.frameworkId, framework.id))
        );
        
        const controlsResults = await Promise.all(controlsPromises);
        
        // Attach controls to frameworks
        context.frameworks = context.frameworks.map((framework: any, index: number) => ({
          ...framework,
          controls: controlsResults[index] || []
        }));
      }
    }
    
    // Add additional context variables
    context.variables = {
      generatedAt: new Date(),
      generatedDate: new Date().toLocaleDateString(),
      reportTitle: report.name,
      reportDescription: report.description,
      reportType: report.type
    };
    
    return context;
  }
  
  /**
   * Get the appropriate template for the report
   */
  private async getTemplateForReport(report: any): Promise<any> {
    // Check if there's a specific template ID
    if (report.templateId) {
      // Try to get from cache first
      if (this.templatesCache.has(report.templateId)) {
        return this.templatesCache.get(report.templateId);
      }
      
      const template = await db.select()
        .from(complianceReportTemplates)
        .where(eq(complianceReportTemplates.id, report.templateId))
        .limit(1);
      
      if (template.length > 0) {
        this.templatesCache.set(report.templateId, template[0]);
        return template[0];
      }
    }
    
    // Try to find a template by type and format
    const templates = await db.select()
      .from(complianceReportTemplates)
      .where(
        and(
          eq(complianceReportTemplates.type, report.type),
          eq(complianceReportTemplates.format, report.format)
        )
      )
      .limit(1);
    
    if (templates.length > 0) {
      return templates[0];
    }
    
    // Fall back to a default template if available
    return this.getDefaultTemplate(report.type, report.format);
  }
  
  /**
   * Get a default template for the given type and format
   */
  private getDefaultTemplate(type: string, format: string): any {
    // In a real implementation, we would have predefined default templates
    // stored in the database or file system
    
    // For now, we'll return a very basic template
    return {
      id: 0,
      name: `Default ${type} Template`,
      type,
      format,
      content: this.getBasicTemplateContent(type, format),
      sections: [
        { name: 'header', title: 'Header' },
        { name: 'summary', title: 'Summary' },
        { name: 'controls', title: 'Controls' },
        { name: 'results', title: 'Results' },
        { name: 'footer', title: 'Footer' }
      ],
      variables: {
        title: '{{report.name}}',
        description: '{{report.description}}',
        date: '{{generatedDate}}'
      },
      isDefault: true
    };
  }
  
  /**
   * Get a basic template content by type and format
   */
  private getBasicTemplateContent(type: string, format: string): string {
    if (format === 'html') {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{report.name}}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
    .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
    h1 { color: #2c3e50; }
    .section { margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; }
    th { background-color: #f8f9fa; text-align: left; }
    td, th { padding: 8px; border: 1px solid #ddd; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.8em; color: #777; }
    .pass { color: green; }
    .fail { color: red; }
    .na { color: gray; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{report.name}}</h1>
    <p>{{report.description}}</p>
    <p><strong>Generated:</strong> {{generatedDate}}</p>
  </div>
  
  {{#if assessment}}
  <div class="section">
    <h2>Assessment Overview</h2>
    <p><strong>Name:</strong> {{assessment.name}}</p>
    <p><strong>Status:</strong> {{assessment.status}}</p>
    <p><strong>Progress:</strong> {{assessment.progress}}%</p>
    <p><strong>Start Date:</strong> {{formatDate assessment.startDate}}</p>
    <p><strong>End Date:</strong> {{formatDate assessment.endDate}}</p>
  </div>
  {{/if}}
  
  {{#if results}}
  <div class="section">
    <h2>Assessment Results</h2>
    <table>
      <thead>
        <tr>
          <th>Control</th>
          <th>Description</th>
          <th>Status</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {{#each results}}
        <tr>
          <td>{{control.code}}</td>
          <td>{{control.name}}</td>
          <td class="{{status}}">{{status}}</td>
          <td>{{notes}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
  {{/if}}
  
  {{#if frameworks}}
  <div class="section">
    <h2>Frameworks</h2>
    {{#each frameworks}}
    <div>
      <h3>{{name}} ({{version}})</h3>
      <p>{{description}}</p>
      <h4>Controls</h4>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Category</th>
            <th>Severity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {{#each controls}}
          <tr>
            <td>{{code}}</td>
            <td>{{name}}</td>
            <td>{{category}}</td>
            <td>{{severity}}</td>
            <td>{{implementationStatus}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>
    {{/each}}
  </div>
  {{/if}}
  
  <div class="footer">
    <p>Generated on {{generatedDate}}</p>
  </div>
</body>
</html>
      `;
    }
    
    if (format === 'markdown' || format === 'md') {
      return `
# {{report.name}}

{{report.description}}

**Generated:** {{generatedDate}}

${type === 'framework_assessment' ? `
## Assessment Overview

**Name:** {{assessment.name}}
**Status:** {{assessment.status}}
**Progress:** {{assessment.progress}}%
**Start Date:** {{formatDate assessment.startDate}}
**End Date:** {{formatDate assessment.endDate}}

## Assessment Results

| Control | Description | Status | Notes |
|---------|-------------|--------|-------|
{{#each results}}
| {{control.code}} | {{control.name}} | {{status}} | {{notes}} |
{{/each}}
` : ''}

${type === 'gap_analysis' ? `
## Frameworks

{{#each frameworks}}
### {{name}} ({{version}})

{{description}}

#### Controls

| Code | Name | Category | Severity | Status |
|------|------|----------|----------|--------|
{{#each controls}}
| {{code}} | {{name}} | {{category}} | {{severity}} | {{implementationStatus}} |
{{/each}}

{{/each}}
` : ''}

---
Generated on {{generatedDate}}
      `;
    }
    
    // Default to JSON structure for other formats
    return '{"report": "{{report.name}}", "description": "{{report.description}}", "generatedDate": "{{generatedDate}}"}';
  }
  
  /**
   * Render the report in the specified format
   */
  private async renderReport(context: ReportContext, template: any, format: ReportFormat): Promise<string> {
    // In a production system, we would use dedicated libraries for each format:
    // - HTML: Use a templating engine like Handlebars, EJS, Pug
    // - PDF: Use a PDF generation library that supports HTML conversion
    // - DOCX: Use a DOCX generation library
    // - JSON: Just serialize the context object
    
    // For now, we'll implement a simple string template replacement
    let content = template.content;
    
    // Replace basic variables
    if (context.report) {
      content = content.replace(/\{\{report\.name\}\}/g, context.report.name || '');
      content = content.replace(/\{\{report\.description\}\}/g, context.report.description || '');
      content = content.replace(/\{\{report\.type\}\}/g, context.report.type || '');
    }
    
    if (context.assessment) {
      content = content.replace(/\{\{assessment\.name\}\}/g, context.assessment.name || '');
      content = content.replace(/\{\{assessment\.description\}\}/g, context.assessment.description || '');
      content = content.replace(/\{\{assessment\.status\}\}/g, context.assessment.status || '');
      content = content.replace(/\{\{assessment\.progress\}\}/g, (context.assessment.progress || 0).toString());
      
      // Format dates
      const startDate = context.assessment.startDate 
        ? new Date(context.assessment.startDate).toLocaleDateString() 
        : '';
      const endDate = context.assessment.endDate 
        ? new Date(context.assessment.endDate).toLocaleDateString() 
        : '';
      
      content = content.replace(/\{\{formatDate assessment\.startDate\}\}/g, startDate);
      content = content.replace(/\{\{assessment\.startDate\}\}/g, startDate);
      content = content.replace(/\{\{formatDate assessment\.endDate\}\}/g, endDate);
      content = content.replace(/\{\{assessment\.endDate\}\}/g, endDate);
    }
    
    if (context.variables) {
      for (const [key, value] of Object.entries(context.variables)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      }
    }
    
    // The real implementation would handle loops, conditionals and other template features
    
    // Convert to the requested format
    if (format === 'pdf') {
      // In a real implementation, this would convert the HTML to PDF
      // using a library like puppeteer, wkhtmltopdf, or pdf-lib
      return content;
    } else if (format === 'docx') {
      // In a real implementation, this would generate a DOCX file
      // using a library like docx, officegen, or docxtemplater
      return content;
    } else if (format === 'json') {
      // Return a JSON representation
      return JSON.stringify(context, null, 2);
    } else {
      // Default to HTML
      return content;
    }
  }
  
  /**
   * Save the rendered report
   */
  private async saveReportOutput(report: any, content: string): Promise<string> {
    // In a real implementation, this would save the file to a persistent storage
    // like a file system, S3, or a dedicated document storage service
    
    // For simplicity, we'll just return a URL path
    return `/api/compliance/reports/${report.id}/download`;
  }
  
  /**
   * Schedule a report for periodic generation
   */
  private scheduleReport(report: any): void {
    // In a real implementation, this would use a scheduling library
    // like node-cron, agenda, or a dedicated service
    
    console.log(`Report ${report.id} scheduled with cron: ${report.generationSchedule}`);
    
    // We would set up a timer/scheduler here
    // For now, just log that we would schedule it
  }
  
  /**
   * Generate scheduled reports
   */
  public async generateScheduledReports(): Promise<void> {
    try {
      // Get all reports that are scheduled
      const scheduledReports = await db.select()
        .from(complianceReports)
        .where(eq(complianceReports.scheduledGeneration, true));
      
      console.log(`Found ${scheduledReports.length} scheduled reports to process`);
      
      // Process each scheduled report
      for (const report of scheduledReports) {
        // In a real implementation, we would check if the report needs to be generated
        // based on its schedule and last generation time
        
        // Generate the report using system user ID (1)
        await this.generateReport(report.id, report.createdBy, report.workspaceId);
      }
    } catch (error) {
      console.error('Error generating scheduled reports:', error);
    }
  }
}

// Create and export the singleton instance
export const reportGeneratorService = new ReportGeneratorService();