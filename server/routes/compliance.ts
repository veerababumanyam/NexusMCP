/**
 * Compliance Automation and Reporting API Routes
 * 
 * Provides endpoints for:
 * - Compliance framework management
 * - Control management
 * - Evidence collection and verification
 * - Assessment creation and tracking
 * - Report generation and download
 * - Compliance analytics
 * 
 * Follows Zero Trust Architecture principles with appropriate
 * authentication, authorization, and input validation.
 */

import { Express, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { complianceService } from '../services/compliance/complianceService';
import { reportGeneratorService } from '../services/compliance/reportGeneratorService';
import { storage } from '../storage';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Set up temporary upload storage for evidence files
const upload = multer({ 
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const tempDir = path.join(os.tmpdir(), 'compliance-evidence');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

// Helper function to check if user is workspace admin
async function isWorkspaceAdmin(userId: number, workspaceId: number): Promise<boolean> {
  try {
    const workspace = await storage.getWorkspace(workspaceId);
    if (!workspace) return false;
    
    // Find the user's membership in this workspace
    const members = await storage.getWorkspaceMembers(workspaceId);
    const userMembership = members.find(m => m.userId === userId);
    
    return userMembership?.role === 'admin' || userMembership?.role === 'owner';
  } catch (error) {
    console.error('Error checking workspace admin status:', error);
    return false;
  }
}

// Helper to handle async controller functions
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Register all compliance routes
export function registerComplianceRoutes(app: Express) {
  const router = app;
  
  // Authentication middleware
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    next();
  }
  
  // Authorization middleware for workspace access
  function requireWorkspaceAccess(req: Request, res: Response, next: NextFunction) {
    const workspaceId = parseInt(req.params.workspaceId || req.body.workspaceId || req.query.workspaceId, 10);
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (isNaN(workspaceId)) {
      return res.status(400).json({ message: 'Valid workspace ID is required' });
    }
    
    next();
  }
  
  // Authorization middleware for workspace admin
  const requireWorkspaceAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const workspaceId = parseInt(req.params.workspaceId || req.body.workspaceId || req.query.workspaceId, 10);
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (isNaN(workspaceId)) {
      return res.status(400).json({ message: 'Valid workspace ID is required' });
    }
    
    const isAdmin = await isWorkspaceAdmin(req.user!.id, workspaceId);
    if (!isAdmin) {
      return res.status(403).json({ message: 'Admin access required for this operation' });
    }
    
    next();
  });
  
  /**
   * Compliance Framework Routes
   */
  
  // Get all frameworks
  router.get('/api/compliance/frameworks', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      workspaceId: req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined,
      name: req.query.name as string,
      category: req.query.category as string,
      isActive: req.query.isActive ? req.query.isActive === 'true' : undefined
    };
    
    const frameworks = await complianceService.getFrameworks(filters);
    res.json(frameworks);
  }));
  
  // Get a framework by ID
  router.get('/api/compliance/frameworks/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const framework = await complianceService.getFrameworkById(id, workspaceId);
    if (!framework) {
      return res.status(404).json({ message: 'Framework not found' });
    }
    
    res.json(framework);
  }));
  
  // Create a framework
  router.post('/api/compliance/frameworks', 
    requireAuth,
    requireWorkspaceAccess,
    [
      body('name').isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('version').isString().isLength({ min: 1 }).withMessage('Version is required'),
      body('category').isString().withMessage('Category is required'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Add created by information
      const frameworkData = {
        ...req.body,
        createdBy: req.user!.id,
        createdAt: new Date()
      };
      
      const framework = await complianceService.createFramework(frameworkData);
      res.status(201).json(framework);
    })
  );
  
  // Update a framework
  router.put('/api/compliance/frameworks/:id', 
    requireAuth,
    requireWorkspaceAccess,
    [
      param('id').isInt().withMessage('Valid framework ID is required'),
      body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('version').optional().isString().withMessage('Version must be a string'),
      body('category').optional().isString().withMessage('Category must be a string'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if framework exists
      const existingFramework = await complianceService.getFrameworkById(id, workspaceId);
      if (!existingFramework) {
        return res.status(404).json({ message: 'Framework not found' });
      }
      
      const framework = await complianceService.updateFramework(id, req.body, workspaceId);
      res.json(framework);
    })
  );
  
  // Delete a framework
  router.delete('/api/compliance/frameworks/:id', 
    requireAuth,
    requireWorkspaceAdmin,
    [
      param('id').isInt().withMessage('Valid framework ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.query.workspaceId as string, 10);
      
      const success = await complianceService.deleteFramework(id, workspaceId);
      if (!success) {
        return res.status(404).json({ message: 'Framework not found' });
      }
      
      res.status(204).end();
    })
  );
  
  /**
   * Compliance Control Routes
   */
  
  // Get all controls
  router.get('/api/compliance/controls', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      workspaceId: req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined,
      frameworkId: req.query.frameworkId ? parseInt(req.query.frameworkId as string, 10) : undefined,
      category: req.query.category as string,
      severity: req.query.severity as string,
      implementationStatus: req.query.implementationStatus as string,
      search: req.query.search as string
    };
    
    const controls = await complianceService.getControls(filters);
    res.json(controls);
  }));
  
  // Get a control by ID
  router.get('/api/compliance/controls/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const control = await complianceService.getControlById(id, workspaceId);
    if (!control) {
      return res.status(404).json({ message: 'Control not found' });
    }
    
    res.json(control);
  }));
  
  // Create a control
  router.post('/api/compliance/controls', 
    requireAuth,
    requireWorkspaceAccess,
    [
      body('code').isString().isLength({ min: 2 }).withMessage('Code must be at least 2 characters'),
      body('name').isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('description').isString().isLength({ min: 5 }).withMessage('Description must be at least 5 characters'),
      body('frameworkId').isInt().withMessage('Valid framework ID is required'),
      body('category').isString().withMessage('Category is required'),
      body('severity').isString().withMessage('Severity is required'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const control = await complianceService.createControl(req.body);
      res.status(201).json(control);
    })
  );
  
  // Update a control
  router.put('/api/compliance/controls/:id', 
    requireAuth,
    requireWorkspaceAccess,
    [
      param('id').isInt().withMessage('Valid control ID is required'),
      body('code').optional().isString().isLength({ min: 2 }).withMessage('Code must be at least 2 characters'),
      body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('description').optional().isString().isLength({ min: 5 }).withMessage('Description must be at least 5 characters'),
      body('frameworkId').optional().isInt().withMessage('Valid framework ID is required'),
      body('category').optional().isString().withMessage('Category must be a string'),
      body('severity').optional().isString().withMessage('Severity must be a string'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if control exists
      const existingControl = await complianceService.getControlById(id, workspaceId);
      if (!existingControl) {
        return res.status(404).json({ message: 'Control not found' });
      }
      
      const control = await complianceService.updateControl(id, req.body, workspaceId);
      res.json(control);
    })
  );
  
  // Delete a control
  router.delete('/api/compliance/controls/:id', 
    requireAuth,
    requireWorkspaceAdmin,
    [
      param('id').isInt().withMessage('Valid control ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.query.workspaceId as string, 10);
      
      const success = await complianceService.deleteControl(id, workspaceId);
      if (!success) {
        return res.status(404).json({ message: 'Control not found' });
      }
      
      res.status(204).end();
    })
  );
  
  /**
   * Compliance Assessment Routes
   */
  
  // Get all assessments
  router.get('/api/compliance/assessments', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      workspaceId: req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined,
      frameworkId: req.query.frameworkId ? parseInt(req.query.frameworkId as string, 10) : undefined,
      status: req.query.status as string,
      assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo as string, 10) : undefined,
      search: req.query.search as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
    };
    
    const assessments = await complianceService.getAssessments(filters);
    res.json(assessments);
  }));
  
  // Get an assessment by ID
  router.get('/api/compliance/assessments/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const assessment = await complianceService.getAssessmentById(id, workspaceId);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }
    
    res.json(assessment);
  }));
  
  // Create an assessment
  router.post('/api/compliance/assessments', 
    requireAuth,
    requireWorkspaceAccess,
    [
      body('name').isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('frameworkId').isInt().withMessage('Valid framework ID is required'),
      body('status').isString().withMessage('Status is required'),
      body('startDate').isISO8601().withMessage('Valid start date is required'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Add created by information
      const assessmentData = {
        ...req.body,
        createdBy: req.user!.id,
        createdAt: new Date()
      };
      
      const assessment = await complianceService.createAssessment(assessmentData);
      res.status(201).json(assessment);
    })
  );
  
  // Update an assessment
  router.put('/api/compliance/assessments/:id', 
    requireAuth,
    requireWorkspaceAccess,
    [
      param('id').isInt().withMessage('Valid assessment ID is required'),
      body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('status').optional().isString().withMessage('Status must be a string'),
      body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
      body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if assessment exists
      const existingAssessment = await complianceService.getAssessmentById(id, workspaceId);
      if (!existingAssessment) {
        return res.status(404).json({ message: 'Assessment not found' });
      }
      
      const assessment = await complianceService.updateAssessment(id, req.body, workspaceId);
      res.json(assessment);
    })
  );
  
  // Delete an assessment
  router.delete('/api/compliance/assessments/:id', 
    requireAuth,
    requireWorkspaceAdmin,
    [
      param('id').isInt().withMessage('Valid assessment ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.query.workspaceId as string, 10);
      
      const success = await complianceService.deleteAssessment(id, workspaceId);
      if (!success) {
        return res.status(404).json({ message: 'Assessment not found' });
      }
      
      res.status(204).end();
    })
  );
  
  /**
   * Assessment Results Routes
   */
  
  // Get all results for an assessment
  router.get('/api/compliance/assessments/:assessmentId/results', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const assessmentId = parseInt(req.params.assessmentId, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const results = await complianceService.getAssessmentResults(assessmentId, workspaceId);
    res.json(results);
  }));
  
  // Get a result by ID
  router.get('/api/compliance/assessment-results/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const result = await complianceService.getAssessmentResultById(id, workspaceId);
    if (!result) {
      return res.status(404).json({ message: 'Assessment result not found' });
    }
    
    res.json(result);
  }));
  
  // Create an assessment result
  router.post('/api/compliance/assessment-results', 
    requireAuth,
    requireWorkspaceAccess,
    [
      body('assessmentId').isInt().withMessage('Valid assessment ID is required'),
      body('controlId').isInt().withMessage('Valid control ID is required'),
      body('status').isString().withMessage('Status is required'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Add assessed by information
      const resultData = {
        ...req.body,
        assessedBy: req.user!.id,
        assessedAt: new Date()
      };
      
      const result = await complianceService.createAssessmentResult(resultData);
      res.status(201).json(result);
    })
  );
  
  // Update an assessment result
  router.put('/api/compliance/assessment-results/:id', 
    requireAuth,
    requireWorkspaceAccess,
    [
      param('id').isInt().withMessage('Valid result ID is required'),
      body('status').optional().isString().withMessage('Status must be a string'),
      body('notes').optional().isString(),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if result exists
      const existingResult = await complianceService.getAssessmentResultById(id, workspaceId);
      if (!existingResult) {
        return res.status(404).json({ message: 'Assessment result not found' });
      }
      
      const result = await complianceService.updateAssessmentResult(id, req.body, workspaceId);
      res.json(result);
    })
  );
  
  // Delete an assessment result
  router.delete('/api/compliance/assessment-results/:id', 
    requireAuth,
    requireWorkspaceAdmin,
    [
      param('id').isInt().withMessage('Valid result ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.query.workspaceId as string, 10);
      
      const success = await complianceService.deleteAssessmentResult(id, workspaceId);
      if (!success) {
        return res.status(404).json({ message: 'Assessment result not found' });
      }
      
      res.status(204).end();
    })
  );
  
  /**
   * Evidence Routes
   */
  
  // Get all evidence for a control
  router.get('/api/compliance/controls/:controlId/evidence', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const controlId = parseInt(req.params.controlId, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const evidence = await complianceService.getEvidence(controlId, workspaceId);
    res.json(evidence);
  }));
  
  // Get evidence by ID
  router.get('/api/compliance/evidence/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const evidence = await complianceService.getEvidenceById(id, workspaceId);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }
    
    res.json(evidence);
  }));
  
  // Create evidence with file upload
  router.post('/api/compliance/evidence', 
    requireAuth,
    requireWorkspaceAccess,
    upload.single('file'), // Handle file upload
    [
      body('controlId').isInt().withMessage('Valid control ID is required'),
      body('evidenceType').isString().withMessage('Evidence type is required'),
      body('name').isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Add file information if a file was uploaded
      let evidenceData: any = {
        ...req.body,
        createdBy: req.user!.id,
        createdAt: new Date()
      };
      
      if (req.file) {
        // In a real implementation, we would upload this to persistent storage
        // and store the URL. For now, we'll just store the filename
        evidenceData.fileUrl = `/uploads/${req.file.filename}`;
      }
      
      // Handle text content if provided
      if (req.body.textContent) {
        evidenceData.textContent = req.body.textContent;
      }
      
      const evidence = await complianceService.createEvidence(evidenceData);
      res.status(201).json(evidence);
    })
  );
  
  // Update evidence
  router.put('/api/compliance/evidence/:id', 
    requireAuth,
    requireWorkspaceAccess,
    upload.single('file'), // Handle file upload
    [
      param('id').isInt().withMessage('Valid evidence ID is required'),
      body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('description').optional().isString(),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if evidence exists
      const existingEvidence = await complianceService.getEvidenceById(id, workspaceId);
      if (!existingEvidence) {
        return res.status(404).json({ message: 'Evidence not found' });
      }
      
      // Update evidence data
      let evidenceData: any = { ...req.body };
      
      // Add file information if a file was uploaded
      if (req.file) {
        evidenceData.fileUrl = `/uploads/${req.file.filename}`;
      }
      
      const evidence = await complianceService.updateEvidence(id, evidenceData, workspaceId);
      res.json(evidence);
    })
  );
  
  // Verify evidence
  router.post('/api/compliance/evidence/:id/verify', 
    requireAuth,
    requireWorkspaceAccess,
    [
      param('id').isInt().withMessage('Valid evidence ID is required'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if evidence exists
      const existingEvidence = await complianceService.getEvidenceById(id, workspaceId);
      if (!existingEvidence) {
        return res.status(404).json({ message: 'Evidence not found' });
      }
      
      const evidence = await complianceService.verifyEvidence(id, req.user!.id, workspaceId);
      res.json(evidence);
    })
  );
  
  // Delete evidence
  router.delete('/api/compliance/evidence/:id', 
    requireAuth,
    requireWorkspaceAdmin,
    [
      param('id').isInt().withMessage('Valid evidence ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.query.workspaceId as string, 10);
      
      const success = await complianceService.deleteEvidence(id, workspaceId);
      if (!success) {
        return res.status(404).json({ message: 'Evidence not found' });
      }
      
      res.status(204).end();
    })
  );
  
  /**
   * Report Routes
   */
  
  // Get all reports
  router.get('/api/compliance/reports', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      workspaceId: req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined,
      assessmentId: req.query.assessmentId ? parseInt(req.query.assessmentId as string, 10) : undefined,
      type: req.query.type as string,
      status: req.query.status as string,
      search: req.query.search as string,
      frameworkIds: req.query.frameworkIds ? 
        (Array.isArray(req.query.frameworkIds) 
          ? (req.query.frameworkIds as string[]).map(id => parseInt(id, 10))
          : [parseInt(req.query.frameworkIds as string, 10)]) 
        : undefined
    };
    
    const reports = await complianceService.getReports(filters);
    res.json(reports);
  }));
  
  // Get a report by ID
  router.get('/api/compliance/reports/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const report = await complianceService.getReportById(id, workspaceId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    res.json(report);
  }));
  
  // Create a report
  router.post('/api/compliance/reports', 
    requireAuth,
    requireWorkspaceAccess,
    [
      body('name').isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('type').isString().withMessage('Report type is required'),
      body('format').isString().withMessage('Report format is required'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required'),
      body('assessmentId').optional().isInt().withMessage('Assessment ID must be an integer'),
      body('frameworkIds').optional().isArray().withMessage('Framework IDs must be an array')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Add created by information
      const reportData = {
        ...req.body,
        createdBy: req.user!.id,
        createdAt: new Date(),
        status: 'draft'
      };
      
      const report = await complianceService.createReport(reportData);
      res.status(201).json(report);
    })
  );
  
  // Update a report
  router.put('/api/compliance/reports/:id', 
    requireAuth,
    requireWorkspaceAccess,
    [
      param('id').isInt().withMessage('Valid report ID is required'),
      body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('type').optional().isString().withMessage('Report type must be a string'),
      body('format').optional().isString().withMessage('Report format must be a string'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if report exists
      const existingReport = await complianceService.getReportById(id, workspaceId);
      if (!existingReport) {
        return res.status(404).json({ message: 'Report not found' });
      }
      
      // Only allow updating if in draft or scheduled state
      if (existingReport.status !== 'draft' && existingReport.status !== 'scheduled') {
        return res.status(400).json({ 
          message: 'Only reports in draft or scheduled status can be updated' 
        });
      }
      
      const report = await complianceService.updateReport(id, req.body, workspaceId);
      res.json(report);
    })
  );
  
  // Generate a report
  router.post('/api/compliance/reports/:id/generate', 
    requireAuth,
    requireWorkspaceAccess,
    [
      param('id').isInt().withMessage('Valid report ID is required'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if report exists
      const existingReport = await complianceService.getReportById(id, workspaceId);
      if (!existingReport) {
        return res.status(404).json({ message: 'Report not found' });
      }
      
      const reportUrl = await reportGeneratorService.generateReport(id, req.user!.id, workspaceId);
      if (!reportUrl) {
        return res.status(500).json({ message: 'Failed to generate report' });
      }
      
      // Get the updated report
      const report = await complianceService.getReportById(id, workspaceId);
      res.json({ 
        ...report,
        downloadUrl: reportUrl
      });
    })
  );
  
  // Download a report
  router.get('/api/compliance/reports/:id/download', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    // Check if report exists
    const report = await complianceService.getReportById(id, workspaceId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    // Check if report has been generated
    if (report.status !== 'generated' && report.status !== 'approved') {
      return res.status(400).json({ message: 'Report has not been generated yet' });
    }
    
    // In a real implementation, we would send the actual file
    // For now, we'll send a placeholder response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.json"`);
    
    // Send mock report data
    res.json({
      report: {
        id: report.id,
        name: report.name,
        type: report.type,
        format: report.format,
        generatedAt: report.generatedAt
      },
      meta: {
        generated: true,
        format: report.format,
        timestamp: new Date().toISOString()
      },
      message: "This is a placeholder for the actual report content"
    });
  }));
  
  // Approve a report
  router.post('/api/compliance/reports/:id/approve', 
    requireAuth,
    requireWorkspaceAdmin,
    [
      param('id').isInt().withMessage('Valid report ID is required'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if report exists
      const existingReport = await complianceService.getReportById(id, workspaceId);
      if (!existingReport) {
        return res.status(404).json({ message: 'Report not found' });
      }
      
      // Only allow approving if in generated state
      if (existingReport.status !== 'generated') {
        return res.status(400).json({ 
          message: 'Only generated reports can be approved' 
        });
      }
      
      const report = await complianceService.updateReport(id, {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: req.user!.id
      }, workspaceId);
      
      res.json(report);
    })
  );
  
  // Delete a report
  router.delete('/api/compliance/reports/:id', 
    requireAuth,
    requireWorkspaceAdmin,
    [
      param('id').isInt().withMessage('Valid report ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.query.workspaceId as string, 10);
      
      const success = await complianceService.deleteReport(id, workspaceId);
      if (!success) {
        return res.status(404).json({ message: 'Report not found' });
      }
      
      res.status(204).end();
    })
  );
  
  /**
   * Report Template Routes
   */
  
  // Get all report templates
  router.get('/api/compliance/report-templates', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const templates = await complianceService.getReportTemplates(workspaceId);
    res.json(templates);
  }));
  
  // Get a report template by ID
  router.get('/api/compliance/report-templates/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string, 10) : undefined;
    
    const template = await complianceService.getReportTemplateById(id, workspaceId);
    if (!template) {
      return res.status(404).json({ message: 'Report template not found' });
    }
    
    res.json(template);
  }));
  
  // Create a report template
  router.post('/api/compliance/report-templates', 
    requireAuth,
    requireWorkspaceAccess,
    [
      body('name').isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('type').isString().withMessage('Template type is required'),
      body('format').isString().withMessage('Template format is required'),
      body('content').isString().isLength({ min: 10 }).withMessage('Template content must be at least 10 characters'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Add created by information
      const templateData = {
        ...req.body,
        createdBy: req.user!.id,
        createdAt: new Date(),
        isCustom: true,
        isDefault: false
      };
      
      const template = await complianceService.createReportTemplate(templateData);
      res.status(201).json(template);
    })
  );
  
  // Update a report template
  router.put('/api/compliance/report-templates/:id', 
    requireAuth,
    requireWorkspaceAccess,
    [
      param('id').isInt().withMessage('Valid template ID is required'),
      body('name').optional().isString().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
      body('content').optional().isString().isLength({ min: 10 }).withMessage('Template content must be at least 10 characters'),
      body('workspaceId').isInt().withMessage('Valid workspace ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.body.workspaceId, 10);
      
      // Check if template exists
      const existingTemplate = await complianceService.getReportTemplateById(id, workspaceId);
      if (!existingTemplate) {
        return res.status(404).json({ message: 'Report template not found' });
      }
      
      // Only allow updating custom templates
      if (!existingTemplate.isCustom || existingTemplate.isDefault) {
        return res.status(400).json({ 
          message: 'Default templates cannot be modified' 
        });
      }
      
      const template = await complianceService.updateReportTemplate(id, {
        ...req.body,
        updatedAt: new Date()
      }, workspaceId);
      
      res.json(template);
    })
  );
  
  // Delete a report template
  router.delete('/api/compliance/report-templates/:id', 
    requireAuth,
    requireWorkspaceAdmin,
    [
      param('id').isInt().withMessage('Valid template ID is required')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const id = parseInt(req.params.id, 10);
      const workspaceId = parseInt(req.query.workspaceId as string, 10);
      
      const success = await complianceService.deleteReportTemplate(id, workspaceId);
      if (!success) {
        return res.status(404).json({ 
          message: 'Report template not found or cannot be deleted (default template)' 
        });
      }
      
      res.status(204).end();
    })
  );
  
  /**
   * Compliance Analytics API
   */
  
  // Get compliance metrics
  router.get('/api/compliance/metrics', 
    requireAuth,
    requireWorkspaceAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const workspaceId = parseInt(req.query.workspaceId as string, 10);
      
      if (isNaN(workspaceId)) {
        return res.status(400).json({ message: 'Valid workspace ID is required' });
      }
      
      const metrics = await complianceService.getComplianceMetrics(workspaceId);
      res.json(metrics);
    })
  );

  console.log('Compliance routes registered');
  
  return router;
}