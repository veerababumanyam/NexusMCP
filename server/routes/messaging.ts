/**
 * Messaging Routes
 * 
 * RESTful API routes for managing messaging integrations:
 * - Slack configuration
 * - Microsoft Teams configuration
 * - SMS providers (Twilio, Vonage, Plivo)
 * - Message templates
 * - Message delivery logs
 */

import { Router } from 'express';
import { MessagingService } from '../services/integrations/MessagingService';
import { testMessageSchema, testSmsSchema } from '../../shared/schema_messaging';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

// Middleware for authentication will be provided by the server routes

const router = Router();

// Rate limiters
const messagingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many requests to messaging APIs, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const testMessageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 test messages per minute
  message: 'Too many test message requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @route GET /api/messaging/configs
 * @desc Get all messaging configurations
 * @access Private
 */
router.get('/configs', messagingRateLimiter, async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    const messagingService = new MessagingService(req);
    const configs = await messagingService.getMessagingConfigurations(workspaceId);
    
    // Remove sensitive data before sending to client
    const safeConfigs = configs.map(config => {
      const { botToken, credentials, ...safeConfig } = config;
      return {
        ...safeConfig,
        hasCredentials: !!botToken || !!credentials
      };
    });
    
    res.status(200).json(safeConfigs);
  } catch (error) {
    console.error('Error getting messaging configurations:', error);
    res.status(500).json({ error: 'Failed to retrieve messaging configurations' });
  }
});

/**
 * @route GET /api/messaging/configs/:id
 * @desc Get a specific messaging configuration
 * @access Private
 */
router.get('/configs/:id',  messagingRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    const config = await messagingService.getMessagingConfiguration(id);
    
    if (!config) {
      return res.status(404).json({ error: 'Messaging configuration not found' });
    }
    
    // Remove sensitive data before sending to client
    const { botToken, credentials, ...safeConfig } = config;
    
    res.status(200).json({
      ...safeConfig,
      hasCredentials: !!botToken || !!credentials
    });
  } catch (error) {
    console.error(`Error getting messaging configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve messaging configuration' });
  }
});

/**
 * @route POST /api/messaging/configs
 * @desc Create a new messaging configuration
 * @access Private
 */
router.post('/configs',  messagingRateLimiter, async (req, res) => {
  try {
    const messagingService = new MessagingService(req);
    const config = await messagingService.createMessagingConfiguration(req.body);
    
    // Remove sensitive data before sending response
    const { botToken, credentials, ...safeConfig } = config;
    
    res.status(201).json({
      ...safeConfig,
      hasCredentials: !!botToken || !!credentials
    });
  } catch (error) {
    console.error('Error creating messaging configuration:', error);
    res.status(500).json({ error: 'Failed to create messaging configuration' });
  }
});

/**
 * @route PUT /api/messaging/configs/:id
 * @desc Update a messaging configuration
 * @access Private
 */
router.put('/configs/:id',  messagingRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    
    // Check if configuration exists
    const existingConfig = await messagingService.getMessagingConfiguration(id);
    if (!existingConfig) {
      return res.status(404).json({ error: 'Messaging configuration not found' });
    }
    
    // Preserve credentials if not provided
    if (!req.body.botToken && existingConfig.botToken) {
      req.body.botToken = existingConfig.botToken;
    }
    
    if (!req.body.credentials && existingConfig.credentials) {
      req.body.credentials = existingConfig.credentials;
    }
    
    const updatedConfig = await messagingService.updateMessagingConfiguration(id, req.body);
    
    // Remove sensitive data before sending response
    const { botToken, credentials, ...safeConfig } = updatedConfig;
    
    res.status(200).json({
      ...safeConfig,
      hasCredentials: !!botToken || !!credentials
    });
  } catch (error) {
    console.error(`Error updating messaging configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update messaging configuration' });
  }
});

/**
 * @route DELETE /api/messaging/configs/:id
 * @desc Delete a messaging configuration
 * @access Private
 */
router.delete('/configs/:id',  messagingRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    
    // Check if configuration exists
    const existingConfig = await messagingService.getMessagingConfiguration(id);
    if (!existingConfig) {
      return res.status(404).json({ error: 'Messaging configuration not found' });
    }
    
    const result = await messagingService.deleteMessagingConfiguration(id);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Error deleting messaging configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete messaging configuration' });
  }
});

/**
 * @route POST /api/messaging/configs/:id/test
 * @desc Test a messaging configuration
 * @access Private
 */
router.post('/configs/:id/test',  testMessageRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    
    // Validate request data
    const validationResult = testMessageSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid test message data',
        details: validationResult.error.format()
      });
    }
    
    const result = await messagingService.testMessagingConfiguration(id, validationResult.data);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Error testing messaging configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to test messaging configuration' });
  }
});

// SMS ROUTES

/**
 * @route GET /api/messaging/sms/configs
 * @desc Get all SMS configurations
 * @access Private
 */
router.get('/sms/configs',  messagingRateLimiter, async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    const messagingService = new MessagingService(req);
    const configs = await messagingService.getSmsConfigurations(workspaceId);
    
    // Remove sensitive data before sending to client
    const safeConfigs = configs.map(config => {
      const { accountSid, authToken, ...safeConfig } = config;
      return {
        ...safeConfig,
        hasCredentials: !!accountSid && !!authToken
      };
    });
    
    res.status(200).json(safeConfigs);
  } catch (error) {
    console.error('Error getting SMS configurations:', error);
    res.status(500).json({ error: 'Failed to retrieve SMS configurations' });
  }
});

/**
 * @route GET /api/messaging/sms/configs/:id
 * @desc Get a specific SMS configuration
 * @access Private
 */
router.get('/sms/configs/:id',  messagingRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    const config = await messagingService.getSmsConfiguration(id);
    
    if (!config) {
      return res.status(404).json({ error: 'SMS configuration not found' });
    }
    
    // Remove sensitive data before sending to client
    const { accountSid, authToken, ...safeConfig } = config;
    
    res.status(200).json({
      ...safeConfig,
      hasCredentials: !!accountSid && !!authToken
    });
  } catch (error) {
    console.error(`Error getting SMS configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve SMS configuration' });
  }
});

/**
 * @route POST /api/messaging/sms/configs
 * @desc Create a new SMS configuration
 * @access Private
 */
router.post('/sms/configs',  messagingRateLimiter, async (req, res) => {
  try {
    const messagingService = new MessagingService(req);
    const config = await messagingService.createSmsConfiguration(req.body);
    
    // Remove sensitive data before sending response
    const { accountSid, authToken, ...safeConfig } = config;
    
    res.status(201).json({
      ...safeConfig,
      hasCredentials: !!accountSid && !!authToken
    });
  } catch (error) {
    console.error('Error creating SMS configuration:', error);
    res.status(500).json({ error: 'Failed to create SMS configuration' });
  }
});

/**
 * @route PUT /api/messaging/sms/configs/:id
 * @desc Update an SMS configuration
 * @access Private
 */
router.put('/sms/configs/:id',  messagingRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    
    // Check if configuration exists
    const existingConfig = await messagingService.getSmsConfiguration(id);
    if (!existingConfig) {
      return res.status(404).json({ error: 'SMS configuration not found' });
    }
    
    // Preserve credentials if not provided
    if (!req.body.accountSid && existingConfig.accountSid) {
      req.body.accountSid = existingConfig.accountSid;
    }
    
    if (!req.body.authToken && existingConfig.authToken) {
      req.body.authToken = existingConfig.authToken;
    }
    
    const updatedConfig = await messagingService.updateSmsConfiguration(id, req.body);
    
    // Remove sensitive data before sending response
    const { accountSid, authToken, ...safeConfig } = updatedConfig;
    
    res.status(200).json({
      ...safeConfig,
      hasCredentials: !!accountSid && !!authToken
    });
  } catch (error) {
    console.error(`Error updating SMS configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update SMS configuration' });
  }
});

/**
 * @route DELETE /api/messaging/sms/configs/:id
 * @desc Delete an SMS configuration
 * @access Private
 */
router.delete('/sms/configs/:id',  messagingRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    
    // Check if configuration exists
    const existingConfig = await messagingService.getSmsConfiguration(id);
    if (!existingConfig) {
      return res.status(404).json({ error: 'SMS configuration not found' });
    }
    
    const result = await messagingService.deleteSmsConfiguration(id);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Error deleting SMS configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete SMS configuration' });
  }
});

/**
 * @route POST /api/messaging/sms/configs/:id/test
 * @desc Test an SMS configuration
 * @access Private
 */
router.post('/sms/configs/:id/test',  testMessageRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    
    // Validate request data
    const validationResult = testSmsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid test SMS data',
        details: validationResult.error.format()
      });
    }
    
    const result = await messagingService.testSmsConfiguration(id, validationResult.data);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Error testing SMS configuration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to test SMS configuration' });
  }
});

// TEMPLATE ROUTES

/**
 * @route GET /api/messaging/templates
 * @desc Get all message templates
 * @access Private
 */
router.get('/templates',  messagingRateLimiter, async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    const platform = req.query.platform as string | undefined;
    
    const messagingService = new MessagingService(req);
    const templates = await messagingService.getMessageTemplates(platform, workspaceId);
    
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error getting message templates:', error);
    res.status(500).json({ error: 'Failed to retrieve message templates' });
  }
});

/**
 * @route GET /api/messaging/templates/:id
 * @desc Get a specific message template
 * @access Private
 */
router.get('/templates/:id',  messagingRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    const template = await messagingService.getMessageTemplate(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Message template not found' });
    }
    
    res.status(200).json(template);
  } catch (error) {
    console.error(`Error getting message template ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve message template' });
  }
});

/**
 * @route POST /api/messaging/templates
 * @desc Create a new message template
 * @access Private
 */
router.post('/templates',  messagingRateLimiter, async (req, res) => {
  try {
    const messagingService = new MessagingService(req);
    const template = await messagingService.createMessageTemplate(req.body);
    
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating message template:', error);
    res.status(500).json({ error: 'Failed to create message template' });
  }
});

/**
 * @route PUT /api/messaging/templates/:id
 * @desc Update a message template
 * @access Private
 */
router.put('/templates/:id',  messagingRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    
    // Check if template exists
    const existingTemplate = await messagingService.getMessageTemplate(id);
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Message template not found' });
    }
    
    const updatedTemplate = await messagingService.updateMessageTemplate(id, req.body);
    res.status(200).json(updatedTemplate);
  } catch (error) {
    console.error(`Error updating message template ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update message template' });
  }
});

/**
 * @route DELETE /api/messaging/templates/:id
 * @desc Delete a message template
 * @access Private
 */
router.delete('/templates/:id',  messagingRateLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const messagingService = new MessagingService(req);
    
    // Check if template exists
    const existingTemplate = await messagingService.getMessageTemplate(id);
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Message template not found' });
    }
    
    const result = await messagingService.deleteMessageTemplate(id);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Error deleting message template ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete message template' });
  }
});

// LOGS ROUTES

/**
 * @route GET /api/messaging/logs
 * @desc Get message delivery logs
 * @access Private
 */
router.get('/logs',  messagingRateLimiter, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    const messagingService = new MessagingService(req);
    const logs = await messagingService.getDeliveryLogs(limit, offset);
    
    res.status(200).json(logs);
  } catch (error) {
    console.error('Error getting message delivery logs:', error);
    res.status(500).json({ error: 'Failed to retrieve message delivery logs' });
  }
});

// SLACK SEND MESSAGE ROUTE

/**
 * @route POST /api/messaging/slack/send
 * @desc Send a message to Slack
 * @access Private
 */
router.post('/slack/send',  messagingRateLimiter, async (req, res) => {
  try {
    // Validate request data
    const schema = z.object({
      configId: z.number().int().positive(),
      recipient: z.string().min(1),
      content: z.string().min(1),
      blocks: z.any().optional()
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid message data',
        details: validationResult.error.format()
      });
    }
    
    const messagingService = new MessagingService(req);
    const result = await messagingService.sendSlackMessage(
      validationResult.data.configId,
      {
        recipient: validationResult.data.recipient,
        content: validationResult.data.content,
        blocks: validationResult.data.blocks
      }
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending Slack message:', error);
    res.status(500).json({ error: 'Failed to send Slack message' });
  }
});

/**
 * @route POST /api/messaging/slack/send-template
 * @desc Send a template-based message to Slack
 * @access Private
 */
router.post('/slack/send-template',  messagingRateLimiter, async (req, res) => {
  try {
    // Validate request data
    const schema = z.object({
      configId: z.number().int().positive(),
      templateId: z.number().int().positive(),
      recipient: z.string().min(1),
      variables: z.record(z.any()).optional()
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid template message data',
        details: validationResult.error.format()
      });
    }
    
    const messagingService = new MessagingService(req);
    const result = await messagingService.sendSlackTemplateMessage(
      validationResult.data.configId,
      {
        templateId: validationResult.data.templateId,
        recipient: validationResult.data.recipient,
        variables: validationResult.data.variables
      }
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending Slack template message:', error);
    res.status(500).json({ error: 'Failed to send Slack template message' });
  }
});

// MS TEAMS SEND MESSAGE ROUTE

/**
 * @route POST /api/messaging/teams/send
 * @desc Send a message to MS Teams
 * @access Private
 */
router.post('/teams/send',  messagingRateLimiter, async (req, res) => {
  try {
    // Validate request data
    const schema = z.object({
      configId: z.number().int().positive(),
      recipient: z.string().min(1),
      content: z.string().min(1),
      subject: z.string().optional(),
      blocks: z.any().optional()
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid message data',
        details: validationResult.error.format()
      });
    }
    
    const messagingService = new MessagingService(req);
    const result = await messagingService.sendMsTeamsMessage(
      validationResult.data.configId,
      {
        recipient: validationResult.data.recipient,
        content: validationResult.data.content,
        subject: validationResult.data.subject,
        blocks: validationResult.data.blocks
      }
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending MS Teams message:', error);
    res.status(500).json({ error: 'Failed to send MS Teams message' });
  }
});

/**
 * @route POST /api/messaging/teams/send-template
 * @desc Send a template-based message to MS Teams
 * @access Private
 */
router.post('/teams/send-template',  messagingRateLimiter, async (req, res) => {
  try {
    // Validate request data
    const schema = z.object({
      configId: z.number().int().positive(),
      templateId: z.number().int().positive(),
      recipient: z.string().min(1),
      variables: z.record(z.any()).optional()
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid template message data',
        details: validationResult.error.format()
      });
    }
    
    const messagingService = new MessagingService(req);
    const result = await messagingService.sendMsTeamsTemplateMessage(
      validationResult.data.configId,
      {
        templateId: validationResult.data.templateId,
        recipient: validationResult.data.recipient,
        variables: validationResult.data.variables
      }
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending MS Teams template message:', error);
    res.status(500).json({ error: 'Failed to send MS Teams template message' });
  }
});

// SMS SEND MESSAGE ROUTE

/**
 * @route POST /api/messaging/sms/send
 * @desc Send an SMS message
 * @access Private
 */
router.post('/sms/send',  messagingRateLimiter, async (req, res) => {
  try {
    // Validate request data
    const schema = z.object({
      configId: z.number().int().positive(),
      phoneNumber: z.string().refine(
        (val) => /^\+[1-9]\d{1,14}$/.test(val),
        { message: "Phone number must be in E.164 format (e.g. +12125551234)" }
      ),
      message: z.string().min(1)
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid SMS data',
        details: validationResult.error.format()
      });
    }
    
    const messagingService = new MessagingService(req);
    const result = await messagingService.sendSms(
      validationResult.data.configId,
      validationResult.data.phoneNumber,
      validationResult.data.message
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

/**
 * @route POST /api/messaging/sms/send-template
 * @desc Send a template-based SMS
 * @access Private
 */
router.post('/sms/send-template',  messagingRateLimiter, async (req, res) => {
  try {
    // Validate request data
    const schema = z.object({
      configId: z.number().int().positive(),
      templateId: z.number().int().positive(),
      phoneNumber: z.string().refine(
        (val) => /^\+[1-9]\d{1,14}$/.test(val),
        { message: "Phone number must be in E.164 format (e.g. +12125551234)" }
      ),
      variables: z.record(z.any()).optional()
    });
    
    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid template SMS data',
        details: validationResult.error.format()
      });
    }
    
    const messagingService = new MessagingService(req);
    const result = await messagingService.sendSmsTemplate(
      validationResult.data.configId,
      validationResult.data.templateId,
      validationResult.data.phoneNumber,
      validationResult.data.variables || {}
    );
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending template SMS:', error);
    res.status(500).json({ error: 'Failed to send template SMS' });
  }
});

// Export the router with proper middleware
export default router;