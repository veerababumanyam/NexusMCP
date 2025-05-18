import { Router } from 'express';
import { smtpService } from '../services/integrations/SmtpService';
import { 
  smtpConfigurationInsertSchema,
  emailTemplateInsertSchema,
  testEmailSchema
} from '@shared/schema_smtp';

const router = Router();

/**
 * SMTP Configuration endpoints
 */

// Get all SMTP configurations
router.get('/configurations', async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId ? Number(req.query.workspaceId) : undefined;
    const configs = await smtpService.getAllSmtpConfigurations(workspaceId);
    
    // Remove sensitive information from the response
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      password: config.password ? '********' : null,
      apiKey: config.apiKey ? '********' : null
    }));
    
    res.json(sanitizedConfigs);
  } catch (error) {
    console.error('Error fetching SMTP configurations:', error);
    res.status(500).json({ error: 'Failed to fetch SMTP configurations' });
  }
});

// Get SMTP configuration by ID
router.get('/configurations/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const config = await smtpService.getSmtpConfigurationById(id);
    
    if (!config) {
      return res.status(404).json({ error: 'SMTP configuration not found' });
    }
    
    // Remove sensitive information from the response
    const sanitizedConfig = {
      ...config,
      password: config.password ? '********' : null,
      apiKey: config.apiKey ? '********' : null
    };
    
    res.json(sanitizedConfig);
  } catch (error) {
    console.error(`Error fetching SMTP configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch SMTP configuration' });
  }
});

// Create a new SMTP configuration
router.post('/configurations', async (req, res) => {
  try {
    // Validate request body
    const data = smtpConfigurationInsertSchema.parse(req.body);
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await smtpService.createSmtpConfiguration(data, req.user.id, req);
    
    // Remove sensitive information from the response
    const sanitizedResult = {
      ...result,
      password: result.password ? '********' : null,
      apiKey: result.apiKey ? '********' : null
    };
    
    res.status(201).json(sanitizedResult);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error('Error creating SMTP configuration:', error);
    res.status(500).json({ error: 'Failed to create SMTP configuration' });
  }
});

// Update an SMTP configuration
router.put('/configurations/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Validate request body
    const data = smtpConfigurationInsertSchema.partial().parse(req.body);
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await smtpService.updateSmtpConfiguration(id, data, req.user.id, req);
    
    // Remove sensitive information from the response
    const sanitizedResult = {
      ...result,
      password: result.password ? '********' : null,
      apiKey: result.apiKey ? '********' : null
    };
    
    res.json(sanitizedResult);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error(`Error updating SMTP configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update SMTP configuration' });
  }
});

// Delete an SMTP configuration
router.delete('/configurations/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    await smtpService.deleteSmtpConfiguration(id, req.user.id, req);
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting SMTP configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete SMTP configuration' });
  }
});

// Set a configuration as default
router.post('/configurations/:id/set-default', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const workspaceId = req.body.workspaceId ? Number(req.body.workspaceId) : undefined;
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await smtpService.setDefaultSmtpConfiguration(id, req.user.id, workspaceId, req);
    
    // Remove sensitive information from the response
    const sanitizedResult = {
      ...result,
      password: result.password ? '********' : null,
      apiKey: result.apiKey ? '********' : null
    };
    
    res.json(sanitizedResult);
  } catch (error) {
    console.error(`Error setting default SMTP configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to set default SMTP configuration' });
  }
});

// Test SMTP connection
router.post('/configurations/:id/test-connection', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    const result = await smtpService.testSmtpConnection(id);
    
    res.json(result);
  } catch (error) {
    console.error(`Error testing SMTP connection ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to test SMTP connection' });
  }
});

// Send a test email
router.post('/test-email', async (req, res) => {
  try {
    // Validate request body
    const data = testEmailSchema.parse(req.body);
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await smtpService.sendTestEmail(data, req.user.id, req);
    
    res.json(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * Email Templates endpoints
 */

// Get all email templates
router.get('/templates', async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId ? Number(req.query.workspaceId) : undefined;
    const templates = await smtpService.getAllEmailTemplates(workspaceId);
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Get email template by ID
router.get('/templates/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const template = await smtpService.getEmailTemplateById(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error(`Error fetching email template ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

// Create a new email template
router.post('/templates', async (req, res) => {
  try {
    // Validate request body
    const data = emailTemplateInsertSchema.parse(req.body);
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await smtpService.createEmailTemplate(data, req.user.id, req);
    
    res.status(201).json(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error('Error creating email template:', error);
    res.status(500).json({ error: 'Failed to create email template' });
  }
});

// Update an email template
router.put('/templates/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Validate request body
    const data = emailTemplateInsertSchema.partial().parse(req.body);
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await smtpService.updateEmailTemplate(id, data, req.user.id, req);
    
    res.json(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error(`Error updating email template ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

// Delete an email template
router.delete('/templates/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    await smtpService.deleteEmailTemplate(id, req.user.id, req);
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting email template ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete email template' });
  }
});

// Send an email using a template
router.post('/send-templated-email', async (req, res) => {
  try {
    // Validate request body
    if (!req.body.templateId || !req.body.recipient) {
      return res.status(400).json({ error: 'Missing required fields: templateId, recipient' });
    }
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await smtpService.sendTemplatedEmail(
      Number(req.body.templateId),
      req.body.smtpConfigId ? Number(req.body.smtpConfigId) : null,
      req.body.recipient,
      req.body.variables || {},
      req.user.id,
      req
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error sending templated email:', error);
    res.status(500).json({ error: 'Failed to send templated email' });
  }
});

/**
 * Email Logs endpoints
 */

// Get email logs
router.get('/logs', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    
    const filters: any = {};
    
    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    
    if (req.query.recipient) {
      filters.recipient = req.query.recipient as string;
    }
    
    if (req.query.smtpConfigId) {
      filters.smtpConfigId = Number(req.query.smtpConfigId);
    }
    
    if (req.query.templateId) {
      filters.templateId = Number(req.query.templateId);
    }
    
    if (req.query.workspaceId) {
      filters.workspaceId = Number(req.query.workspaceId);
    }
    
    const result = await smtpService.getEmailLogs(limit, offset, filters);
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

// Get email log by ID
router.get('/logs/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const log = await smtpService.getEmailLogById(id);
    
    if (!log) {
      return res.status(404).json({ error: 'Email log not found' });
    }
    
    res.json(log);
  } catch (error) {
    console.error(`Error fetching email log ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch email log' });
  }
});

export { router as smtpRoutes };