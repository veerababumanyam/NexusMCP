/**
 * Compliance Automation Service
 * 
 * Provides enterprise-grade compliance automation capabilities with:
 * - Framework and control management
 * - Assessment automation
 * - Evidence collection and verification
 * - Report generation and export
 * - Compliance dashboards and analytics
 * 
 * Supports major compliance frameworks including:
 * - SOC 2, SOC 1, SOC 3
 * - ISO/IEC 27001, 27017, 27018
 * - HIPAA, GDPR, CCPA
 * - PCI DSS, NIST 800-53
 * - FedRAMP, HITRUST CSF
 */

import { db } from '@db';
import { 
  complianceFrameworks, 
  complianceControls, 
  complianceEvidence, 
  complianceAssessments, 
  complianceAssessmentResults, 
  complianceReports, 
  complianceReportTemplates,
  users,
  workspaces,
  ComplianceFramework,
  ComplianceControl,
  ComplianceEvidence,
  ComplianceAssessment,
  ComplianceAssessmentResult,
  ComplianceReport,
  ComplianceReportTemplate
} from '@shared/schema';
import { eq, and, or, like, ilike, desc, asc, inArray, sql } from 'drizzle-orm';
import { storage } from '../../storage';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// Types for compliance automation
export type ComplianceFrameworkFilter = {
  workspaceId?: number;
  name?: string;
  category?: string;
  isActive?: boolean;
};

export type ComplianceControlFilter = {
  workspaceId?: number;
  frameworkId?: number;
  category?: string;
  severity?: string;
  implementationStatus?: string;
  search?: string;
};

export type ComplianceAssessmentFilter = {
  workspaceId?: number;
  frameworkId?: number;
  status?: string;
  assignedTo?: number;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type ComplianceReportFilter = {
  workspaceId?: number;
  frameworkIds?: number[];
  assessmentId?: number;
  type?: string;
  status?: string;
  search?: string;
};

export type ComplianceReportFormat = 'pdf' | 'html' | 'docx' | 'json';

export type ComplianceEvidence = {
  id?: number;
  controlId: number;
  evidenceType: string;
  name: string;
  description?: string;
  fileUrl?: string;
  textContent?: string;
  metadata?: any;
  validUntil?: Date;
  createdBy: number;
  workspaceId: number;
};

export class ComplianceService extends EventEmitter {
  
  /**
   * Framework Management
   */
  
  public async getFrameworks(filter: ComplianceFrameworkFilter) {
    let query = db.select().from(complianceFrameworks);
    
    if (filter.workspaceId !== undefined) {
      query = query.where(eq(complianceFrameworks.workspaceId, filter.workspaceId));
    }
    
    if (filter.name) {
      query = query.where(ilike(complianceFrameworks.name, `%${filter.name}%`));
    }
    
    if (filter.category) {
      query = query.where(eq(complianceFrameworks.category, filter.category));
    }
    
    if (filter.isActive !== undefined) {
      query = query.where(eq(complianceFrameworks.isActive, filter.isActive));
    }
    
    return await query.orderBy(asc(complianceFrameworks.name));
  }
  
  public async getFrameworkById(id: number, workspaceId?: number) {
    let query = db.select().from(complianceFrameworks).where(eq(complianceFrameworks.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceFrameworks.workspaceId, workspaceId));
    }
    
    const frameworks = await query.limit(1);
    return frameworks.length > 0 ? frameworks[0] : null;
  }
  
  public async createFramework(frameworkData: any) {
    const [framework] = await db.insert(complianceFrameworks).values(frameworkData).returning();
    this.emit('framework:created', framework);
    return framework;
  }
  
  public async updateFramework(id: number, frameworkData: any, workspaceId?: number) {
    let query = db.update(complianceFrameworks)
      .set(frameworkData)
      .where(eq(complianceFrameworks.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceFrameworks.workspaceId, workspaceId));
    }
    
    const [framework] = await query.returning();
    if (framework) {
      this.emit('framework:updated', framework);
    }
    return framework;
  }
  
  public async deleteFramework(id: number, workspaceId?: number) {
    // First check if the framework exists
    const framework = await this.getFrameworkById(id, workspaceId);
    if (!framework) {
      return false;
    }
    
    // Delete framework
    await db.delete(complianceFrameworks)
      .where(eq(complianceFrameworks.id, id))
      .execute();
    
    this.emit('framework:deleted', { id, workspaceId });
    return true;
  }
  
  /**
   * Control Management
   */
  
  public async getControls(filter: ComplianceControlFilter) {
    let query = db.select().from(complianceControls);
    
    if (filter.workspaceId !== undefined) {
      query = query.where(eq(complianceControls.workspaceId, filter.workspaceId));
    }
    
    if (filter.frameworkId !== undefined) {
      query = query.where(eq(complianceControls.frameworkId, filter.frameworkId));
    }
    
    if (filter.category) {
      query = query.where(eq(complianceControls.category, filter.category));
    }
    
    if (filter.severity) {
      query = query.where(eq(complianceControls.severity, filter.severity));
    }
    
    if (filter.implementationStatus) {
      query = query.where(eq(complianceControls.implementationStatus, filter.implementationStatus));
    }
    
    if (filter.search) {
      query = query.where(
        or(
          ilike(complianceControls.code, `%${filter.search}%`),
          ilike(complianceControls.name, `%${filter.search}%`),
          ilike(complianceControls.description, `%${filter.search}%`)
        )
      );
    }
    
    return await query.orderBy(asc(complianceControls.code));
  }
  
  public async getControlById(id: number, workspaceId?: number) {
    let query = db.select().from(complianceControls).where(eq(complianceControls.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceControls.workspaceId, workspaceId));
    }
    
    const controls = await query.limit(1);
    return controls.length > 0 ? controls[0] : null;
  }
  
  public async createControl(controlData: any) {
    const [control] = await db.insert(complianceControls).values(controlData).returning();
    this.emit('control:created', control);
    return control;
  }
  
  public async updateControl(id: number, controlData: any, workspaceId?: number) {
    let query = db.update(complianceControls)
      .set(controlData)
      .where(eq(complianceControls.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceControls.workspaceId, workspaceId));
    }
    
    const [control] = await query.returning();
    if (control) {
      this.emit('control:updated', control);
    }
    return control;
  }
  
  public async deleteControl(id: number, workspaceId?: number) {
    // First check if the control exists
    const control = await this.getControlById(id, workspaceId);
    if (!control) {
      return false;
    }
    
    // Delete control
    await db.delete(complianceControls)
      .where(eq(complianceControls.id, id))
      .execute();
    
    this.emit('control:deleted', { id, workspaceId });
    return true;
  }
  
  /**
   * Assessment Management
   */
  
  public async getAssessments(filter: ComplianceAssessmentFilter) {
    let query = db.select().from(complianceAssessments);
    
    if (filter.workspaceId !== undefined) {
      query = query.where(eq(complianceAssessments.workspaceId, filter.workspaceId));
    }
    
    if (filter.frameworkId !== undefined) {
      query = query.where(eq(complianceAssessments.frameworkId, filter.frameworkId));
    }
    
    if (filter.status) {
      query = query.where(eq(complianceAssessments.status, filter.status));
    }
    
    if (filter.assignedTo !== undefined) {
      query = query.where(eq(complianceAssessments.assignedTo, filter.assignedTo));
    }
    
    if (filter.search) {
      query = query.where(
        or(
          ilike(complianceAssessments.name, `%${filter.search}%`),
          ilike(complianceAssessments.description, `%${filter.search}%`)
        )
      );
    }
    
    if (filter.dateFrom) {
      query = query.where(sql`${complianceAssessments.startDate} >= ${filter.dateFrom}`);
    }
    
    if (filter.dateTo) {
      query = query.where(sql`${complianceAssessments.endDate} <= ${filter.dateTo}`);
    }
    
    return await query.orderBy(desc(complianceAssessments.startDate));
  }
  
  public async getAssessmentById(id: number, workspaceId?: number) {
    let query = db.select().from(complianceAssessments).where(eq(complianceAssessments.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceAssessments.workspaceId, workspaceId));
    }
    
    const assessments = await query.limit(1);
    return assessments.length > 0 ? assessments[0] : null;
  }
  
  public async createAssessment(assessmentData: any) {
    const [assessment] = await db.insert(complianceAssessments).values(assessmentData).returning();
    this.emit('assessment:created', assessment);
    return assessment;
  }
  
  public async updateAssessment(id: number, assessmentData: any, workspaceId?: number) {
    let query = db.update(complianceAssessments)
      .set(assessmentData)
      .where(eq(complianceAssessments.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceAssessments.workspaceId, workspaceId));
    }
    
    const [assessment] = await query.returning();
    if (assessment) {
      this.emit('assessment:updated', assessment);
    }
    return assessment;
  }
  
  public async deleteAssessment(id: number, workspaceId?: number) {
    // First check if the assessment exists
    const assessment = await this.getAssessmentById(id, workspaceId);
    if (!assessment) {
      return false;
    }
    
    // Delete assessment
    await db.delete(complianceAssessments)
      .where(eq(complianceAssessments.id, id))
      .execute();
    
    this.emit('assessment:deleted', { id, workspaceId });
    return true;
  }
  
  /**
   * Assessment Results Management
   */
  
  public async getAssessmentResults(assessmentId: number, workspaceId?: number) {
    let query = db.select().from(complianceAssessmentResults)
      .where(eq(complianceAssessmentResults.assessmentId, assessmentId));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceAssessmentResults.workspaceId, workspaceId));
    }
    
    return await query.orderBy(asc(complianceAssessmentResults.id));
  }
  
  public async getAssessmentResultById(id: number, workspaceId?: number) {
    let query = db.select().from(complianceAssessmentResults).where(eq(complianceAssessmentResults.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceAssessmentResults.workspaceId, workspaceId));
    }
    
    const results = await query.limit(1);
    return results.length > 0 ? results[0] : null;
  }
  
  public async createAssessmentResult(resultData: any) {
    const [result] = await db.insert(complianceAssessmentResults).values(resultData).returning();
    this.emit('assessmentResult:created', result);
    
    // Update the assessment progress
    await this.updateAssessmentProgress(resultData.assessmentId);
    
    return result;
  }
  
  public async updateAssessmentResult(id: number, resultData: any, workspaceId?: number) {
    let query = db.update(complianceAssessmentResults)
      .set(resultData)
      .where(eq(complianceAssessmentResults.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceAssessmentResults.workspaceId, workspaceId));
    }
    
    const [result] = await query.returning();
    if (result) {
      this.emit('assessmentResult:updated', result);
      
      // Update the assessment progress
      await this.updateAssessmentProgress(result.assessmentId);
    }
    return result;
  }
  
  public async deleteAssessmentResult(id: number, workspaceId?: number) {
    // First check if the result exists
    const result = await this.getAssessmentResultById(id, workspaceId);
    if (!result) {
      return false;
    }
    
    // Delete result
    await db.delete(complianceAssessmentResults)
      .where(eq(complianceAssessmentResults.id, id))
      .execute();
    
    this.emit('assessmentResult:deleted', { id, workspaceId });
    
    // Update the assessment progress
    await this.updateAssessmentProgress(result.assessmentId);
    
    return true;
  }
  
  private async updateAssessmentProgress(assessmentId: number) {
    // Get the assessment
    const assessment = await this.getAssessmentById(assessmentId);
    if (!assessment) {
      return;
    }
    
    // Get the framework
    const framework = await this.getFrameworkById(assessment.frameworkId);
    if (!framework) {
      return;
    }
    
    // Count controls in the framework
    const totalControlsQuery = db.select({ count: sql`count(*)` })
      .from(complianceControls)
      .where(eq(complianceControls.frameworkId, framework.id));
    
    const totalControlsResult = await totalControlsQuery;
    const totalControls = parseInt(totalControlsResult[0].count.toString(), 10);
    
    if (totalControls === 0) {
      return;
    }
    
    // Count completed results (with status pass, fail, or na)
    const completedResultsQuery = db.select({ count: sql`count(*)` })
      .from(complianceAssessmentResults)
      .where(
        and(
          eq(complianceAssessmentResults.assessmentId, assessmentId),
          or(
            eq(complianceAssessmentResults.status, 'pass'),
            eq(complianceAssessmentResults.status, 'fail'),
            eq(complianceAssessmentResults.status, 'na')
          )
        )
      );
    
    const completedResultsResult = await completedResultsQuery;
    const completedResults = parseInt(completedResultsResult[0].count.toString(), 10);
    
    // Calculate progress percentage (0-100)
    const progress = Math.floor((completedResults / totalControls) * 100);
    
    // Update the assessment progress
    await db.update(complianceAssessments)
      .set({ progress })
      .where(eq(complianceAssessments.id, assessmentId))
      .execute();
    
    this.emit('assessment:progressUpdated', { id: assessmentId, progress });
  }
  
  /**
   * Evidence Management
   */
  
  public async getEvidence(controlId: number, workspaceId?: number) {
    let query = db.select().from(complianceEvidence)
      .where(eq(complianceEvidence.controlId, controlId));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceEvidence.workspaceId, workspaceId));
    }
    
    return await query.orderBy(desc(complianceEvidence.createdAt));
  }
  
  public async getEvidenceById(id: number, workspaceId?: number) {
    let query = db.select().from(complianceEvidence).where(eq(complianceEvidence.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceEvidence.workspaceId, workspaceId));
    }
    
    const evidence = await query.limit(1);
    return evidence.length > 0 ? evidence[0] : null;
  }
  
  public async createEvidence(evidenceData: any) {
    const [evidence] = await db.insert(complianceEvidence).values(evidenceData).returning();
    this.emit('evidence:created', evidence);
    return evidence;
  }
  
  public async updateEvidence(id: number, evidenceData: any, workspaceId?: number) {
    let query = db.update(complianceEvidence)
      .set(evidenceData)
      .where(eq(complianceEvidence.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceEvidence.workspaceId, workspaceId));
    }
    
    const [evidence] = await query.returning();
    if (evidence) {
      this.emit('evidence:updated', evidence);
    }
    return evidence;
  }
  
  public async deleteEvidence(id: number, workspaceId?: number) {
    // First check if the evidence exists
    const evidence = await this.getEvidenceById(id, workspaceId);
    if (!evidence) {
      return false;
    }
    
    // Delete evidence
    await db.delete(complianceEvidence)
      .where(eq(complianceEvidence.id, id))
      .execute();
    
    this.emit('evidence:deleted', { id, workspaceId });
    return true;
  }
  
  public async verifyEvidence(id: number, userId: number, workspaceId?: number) {
    let query = db.update(complianceEvidence)
      .set({
        verifiedAt: new Date(),
        verifiedBy: userId
      })
      .where(eq(complianceEvidence.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceEvidence.workspaceId, workspaceId));
    }
    
    const [evidence] = await query.returning();
    if (evidence) {
      this.emit('evidence:verified', evidence);
    }
    return evidence;
  }
  
  /**
   * Report Generation
   */
  
  public async getReports(filter: ComplianceReportFilter) {
    let query = db.select().from(complianceReports);
    
    if (filter.workspaceId !== undefined) {
      query = query.where(eq(complianceReports.workspaceId, filter.workspaceId));
    }
    
    if (filter.assessmentId !== undefined) {
      query = query.where(eq(complianceReports.assessmentId, filter.assessmentId));
    }
    
    if (filter.type) {
      query = query.where(eq(complianceReports.type, filter.type));
    }
    
    if (filter.status) {
      query = query.where(eq(complianceReports.status, filter.status));
    }
    
    if (filter.search) {
      query = query.where(
        or(
          ilike(complianceReports.name, `%${filter.search}%`),
          ilike(complianceReports.description, `%${filter.search}%`)
        )
      );
    }
    
    // Handling array of framework IDs
    if (filter.frameworkIds && filter.frameworkIds.length > 0) {
      // Note: This is a simplified approach for handling JSON array contains
      // A more robust implementation would use proper jsonb operators
      const frameworkIdConditions = filter.frameworkIds.map(id => {
        return sql`${complianceReports.frameworkIds}::jsonb @> '${sql.raw(JSON.stringify([id]))}' `;
      });
      
      query = query.where(or(...frameworkIdConditions));
    }
    
    return await query.orderBy(desc(complianceReports.createdAt));
  }
  
  public async getReportById(id: number, workspaceId?: number) {
    let query = db.select().from(complianceReports).where(eq(complianceReports.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceReports.workspaceId, workspaceId));
    }
    
    const reports = await query.limit(1);
    return reports.length > 0 ? reports[0] : null;
  }
  
  public async createReport(reportData: any) {
    const [report] = await db.insert(complianceReports).values(reportData).returning();
    this.emit('report:created', report);
    return report;
  }
  
  public async updateReport(id: number, reportData: any, workspaceId?: number) {
    let query = db.update(complianceReports)
      .set(reportData)
      .where(eq(complianceReports.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(eq(complianceReports.workspaceId, workspaceId));
    }
    
    const [report] = await query.returning();
    if (report) {
      this.emit('report:updated', report);
    }
    return report;
  }
  
  public async deleteReport(id: number, workspaceId?: number) {
    // First check if the report exists
    const report = await this.getReportById(id, workspaceId);
    if (!report) {
      return false;
    }
    
    // Delete report
    await db.delete(complianceReports)
      .where(eq(complianceReports.id, id))
      .execute();
    
    this.emit('report:deleted', { id, workspaceId });
    return true;
  }
  
  /**
   * Report Template Management
   */
  
  public async getReportTemplates(workspaceId?: number) {
    let query = db.select().from(complianceReportTemplates);
    
    if (workspaceId !== undefined) {
      query = query.where(
        or(
          eq(complianceReportTemplates.workspaceId, workspaceId),
          eq(complianceReportTemplates.isDefault, true)
        )
      );
    }
    
    return await query.orderBy(asc(complianceReportTemplates.name));
  }
  
  public async getReportTemplateById(id: number, workspaceId?: number) {
    let query = db.select().from(complianceReportTemplates).where(eq(complianceReportTemplates.id, id));
    
    if (workspaceId !== undefined) {
      query = query.where(
        or(
          eq(complianceReportTemplates.workspaceId, workspaceId),
          eq(complianceReportTemplates.isDefault, true)
        )
      );
    }
    
    const templates = await query.limit(1);
    return templates.length > 0 ? templates[0] : null;
  }
  
  public async createReportTemplate(templateData: any) {
    const [template] = await db.insert(complianceReportTemplates).values(templateData).returning();
    this.emit('reportTemplate:created', template);
    return template;
  }
  
  public async updateReportTemplate(id: number, templateData: any, workspaceId?: number) {
    let query = db.update(complianceReportTemplates)
      .set(templateData)
      .where(eq(complianceReportTemplates.id, id));
    
    if (workspaceId !== undefined) {
      // Only allow updating non-default templates that belong to the workspace
      query = query.where(
        and(
          eq(complianceReportTemplates.workspaceId, workspaceId),
          eq(complianceReportTemplates.isDefault, false)
        )
      );
    }
    
    const [template] = await query.returning();
    if (template) {
      this.emit('reportTemplate:updated', template);
    }
    return template;
  }
  
  public async deleteReportTemplate(id: number, workspaceId?: number) {
    // First check if the template exists and is not a default template
    const template = await this.getReportTemplateById(id, workspaceId);
    if (!template || template.isDefault) {
      return false;
    }
    
    // Delete template
    await db.delete(complianceReportTemplates)
      .where(eq(complianceReportTemplates.id, id))
      .execute();
    
    this.emit('reportTemplate:deleted', { id, workspaceId });
    return true;
  }
  
  /**
   * Report Generation Process
   */
  
  public async generateReport(reportId: number, userId: number, workspaceId?: number): Promise<string | null> {
    // Get the report configuration
    const report = await this.getReportById(reportId, workspaceId);
    if (!report) {
      return null;
    }
    
    // Get the assessment if applicable
    let assessment = null;
    if (report.assessmentId) {
      assessment = await this.getAssessmentById(report.assessmentId, workspaceId);
      if (!assessment) {
        return null;
      }
    }
    
    // If no template is specified, use the default template for this report type
    let template = null;
    const templates = await db.select()
      .from(complianceReportTemplates)
      .where(
        and(
          eq(complianceReportTemplates.type, report.type),
          eq(complianceReportTemplates.format, report.format),
          eq(complianceReportTemplates.isDefault, true)
        )
      )
      .limit(1);
    
    if (templates.length > 0) {
      template = templates[0];
    } else {
      // Fall back to any template of the correct type
      const anyTemplates = await db.select()
        .from(complianceReportTemplates)
        .where(eq(complianceReportTemplates.type, report.type))
        .limit(1);
      
      if (anyTemplates.length > 0) {
        template = anyTemplates[0];
      } else {
        return null; // No suitable template found
      }
    }
    
    // Gather data for the report
    const reportData: any = {
      report,
      assessment,
      generatedAt: new Date(),
      generatedBy: userId,
    };
    
    // If there's an assessment, include assessment results
    if (assessment) {
      reportData.results = await this.getAssessmentResults(assessment.id, workspaceId);
      
      // Fetch control information for each result
      const controlIds = reportData.results.map((result: any) => result.controlId);
      if (controlIds.length > 0) {
        const controls = await db.select()
          .from(complianceControls)
          .where(inArray(complianceControls.id, controlIds));
        
        // Create a lookup by ID
        const controlsById = controls.reduce((acc: any, control: any) => {
          acc[control.id] = control;
          return acc;
        }, {});
        
        // Add control info to each result
        reportData.results = reportData.results.map((result: any) => ({
          ...result,
          control: controlsById[result.controlId] || null
        }));
      }
    }
    
    // If specific frameworks are specified, include those
    if (report.frameworkIds && Array.isArray(report.frameworkIds) && report.frameworkIds.length > 0) {
      const frameworks = await db.select()
        .from(complianceFrameworks)
        .where(inArray(complianceFrameworks.id, report.frameworkIds));
      
      reportData.frameworks = frameworks;
      
      // Get controls for each framework
      const controlsPromises = frameworks.map((framework: any) => 
        db.select()
          .from(complianceControls)
          .where(eq(complianceControls.frameworkId, framework.id))
      );
      
      const controlsResults = await Promise.all(controlsPromises);
      
      // Assign controls to each framework
      reportData.frameworks = reportData.frameworks.map((framework: any, index: number) => ({
        ...framework,
        controls: controlsResults[index] || []
      }));
    }
    
    // Generate the report using the template
    const generatedContent = await this.renderTemplate(template.content, reportData);
    
    // Store the generated report
    const reportUrl = await this.saveReport(reportId, generatedContent, report.format);
    
    // Update the report record
    await this.updateReport(
      reportId,
      {
        status: 'generated',
        generatedUrl: reportUrl,
        generatedAt: new Date(),
        generatedBy: userId
      },
      workspaceId
    );
    
    this.emit('report:generated', { 
      id: reportId, 
      url: reportUrl,
      generatedBy: userId,
      workspaceId: report.workspaceId
    });
    
    return reportUrl;
  }
  
  private async renderTemplate(templateContent: string, data: any): Promise<string> {
    // Simple template rendering - in a real system, use a template engine
    // like Handlebars, EJS, or Pug
    let rendered = templateContent;
    
    // Replace basic placeholders
    if (data.report) {
      rendered = rendered.replace(/\{\{report\.name\}\}/g, data.report.name || '');
      rendered = rendered.replace(/\{\{report\.description\}\}/g, data.report.description || '');
      rendered = rendered.replace(/\{\{report\.type\}\}/g, data.report.type || '');
    }
    
    if (data.assessment) {
      rendered = rendered.replace(/\{\{assessment\.name\}\}/g, data.assessment.name || '');
      rendered = rendered.replace(/\{\{assessment\.description\}\}/g, data.assessment.description || '');
      rendered = rendered.replace(/\{\{assessment\.status\}\}/g, data.assessment.status || '');
      rendered = rendered.replace(/\{\{assessment\.progress\}\}/g, (data.assessment.progress || 0).toString());
      
      // Format dates
      const startDate = data.assessment.startDate 
        ? new Date(data.assessment.startDate).toLocaleDateString() 
        : '';
      const endDate = data.assessment.endDate 
        ? new Date(data.assessment.endDate).toLocaleDateString() 
        : '';
      
      rendered = rendered.replace(/\{\{assessment\.startDate\}\}/g, startDate);
      rendered = rendered.replace(/\{\{assessment\.endDate\}\}/g, endDate);
    }
    
    // Format the generated date
    const generatedDate = data.generatedAt 
      ? new Date(data.generatedAt).toLocaleDateString() 
      : new Date().toLocaleDateString();
    
    rendered = rendered.replace(/\{\{generatedDate\}\}/g, generatedDate);
    
    // In a real implementation, we would handle more complex template rendering
    // including loops for results/controls and conditional sections
    
    return rendered;
  }
  
  private async saveReport(reportId: number, content: string, format: ComplianceReportFormat): Promise<string> {
    // In a real implementation, this would save to a file system, cloud storage, etc.
    // For simplicity, we'll just return a URL
    
    // In a real implementation, we would convert to the requested format (PDF, DOCX, etc.)
    
    return `/api/compliance/reports/${reportId}/download`;
  }
  
  /**
   * Analytics and Metrics
   */
  
  public async getComplianceMetrics(workspaceId: number) {
    // Get framework statistics
    const frameworksQuery = db.select({ count: sql`count(*)` })
      .from(complianceFrameworks)
      .where(eq(complianceFrameworks.workspaceId, workspaceId));
    
    const frameworksResult = await frameworksQuery;
    const frameworkCount = parseInt(frameworksResult[0].count.toString(), 10);
    
    // Get controls statistics
    const controlsQuery = db.select({ count: sql`count(*)` })
      .from(complianceControls)
      .where(eq(complianceControls.workspaceId, workspaceId));
    
    const controlsResult = await controlsQuery;
    const controlCount = parseInt(controlsResult[0].count.toString(), 10);
    
    // Get implementation status breakdown
    const implementationStatusQuery = db.select({
      status: complianceControls.implementationStatus,
      count: sql`count(*)`
    })
      .from(complianceControls)
      .where(eq(complianceControls.workspaceId, workspaceId))
      .groupBy(complianceControls.implementationStatus);
    
    const implementationStatusResult = await implementationStatusQuery;
    const implementationStatus = implementationStatusResult.reduce((acc: any, item: any) => {
      acc[item.status] = parseInt(item.count.toString(), 10);
      return acc;
    }, {});
    
    // Get assessment statistics
    const assessmentsQuery = db.select({ count: sql`count(*)` })
      .from(complianceAssessments)
      .where(eq(complianceAssessments.workspaceId, workspaceId));
    
    const assessmentsResult = await assessmentsQuery;
    const assessmentCount = parseInt(assessmentsResult[0].count.toString(), 10);
    
    // Get assessment status breakdown
    const assessmentStatusQuery = db.select({
      status: complianceAssessments.status,
      count: sql`count(*)`
    })
      .from(complianceAssessments)
      .where(eq(complianceAssessments.workspaceId, workspaceId))
      .groupBy(complianceAssessments.status);
    
    const assessmentStatusResult = await assessmentStatusQuery;
    const assessmentStatus = assessmentStatusResult.reduce((acc: any, item: any) => {
      acc[item.status] = parseInt(item.count.toString(), 10);
      return acc;
    }, {});
    
    // Get average assessment progress
    const avgProgressQuery = db.select({
      avg: sql`avg(${complianceAssessments.progress})`
    })
      .from(complianceAssessments)
      .where(eq(complianceAssessments.workspaceId, workspaceId));
    
    const avgProgressResult = await avgProgressQuery;
    const avgProgress = avgProgressResult[0].avg ? parseFloat(avgProgressResult[0].avg.toString()) : 0;
    
    // Get report statistics
    const reportsQuery = db.select({ count: sql`count(*)` })
      .from(complianceReports)
      .where(eq(complianceReports.workspaceId, workspaceId));
    
    const reportsResult = await reportsQuery;
    const reportCount = parseInt(reportsResult[0].count.toString(), 10);
    
    return {
      frameworks: {
        total: frameworkCount
      },
      controls: {
        total: controlCount,
        implementationStatus
      },
      assessments: {
        total: assessmentCount,
        status: assessmentStatus,
        averageProgress: avgProgress
      },
      reports: {
        total: reportCount
      }
    };
  }
}

// Create and export the singleton instance
export const complianceService = new ComplianceService();