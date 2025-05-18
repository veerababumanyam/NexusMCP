/**
 * Base Controller - Presentation Layer
 * 
 * This module provides a base class for all controllers with common utilities for:
 * - Request validation
 * - Error handling
 * - Response formatting
 * - Logging and auditing
 */

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../infrastructure/api/ApiError';
import { eventBus } from '../infrastructure/events/EventBus';

/**
 * Base controller class with common utilities
 */
export class BaseController {
  /**
   * Create an auditable event for significant actions
   */
  protected createAuditEvent(
    eventType: string,
    req: Request,
    data: Record<string, any> = {}
  ): void {
    const user = req.user;
    
    eventBus.publish(`audit.${eventType}`, {
      ...data,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: user?.id,
      method: req.method,
      path: req.path
    }, {
      source: this.constructor.name,
      userId: user?.id
    });
  }
  
  /**
   * Create a request handler with error handling
   */
  protected createHandler(
    handler: (req: Request, res: Response) => Promise<Response | undefined>
  ) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await handler(req, res);
      } catch (error) {
        this.handleError(error, req, res);
      }
    };
  }
  
  /**
   * Create a validated request handler with zod schema
   */
  protected createValidatedHandler<T extends AnyZodObject>(
    schema: T,
    handler: (req: Request, res: Response, data: any) => Promise<Response | undefined>
  ) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Combine body, query, and params for validation
        const data = {
          ...req.body,
          ...req.query,
          ...req.params
        };
        
        // Validate using zod schema
        const validatedData = schema.parse(data);
        
        // Call handler with validated data
        await handler(req, res, validatedData);
      } catch (error) {
        // Special handling for zod validation errors
        if (error instanceof ZodError) {
          return this.sendValidationError(res, error);
        }
        
        this.handleError(error, req, res);
      }
    };
  }
  
  /**
   * Handle various error types consistently
   */
  protected handleError(error: any, req: Request, res: Response): Response {
    console.error(`Error in ${this.constructor.name}:`, error);
    
    // Log error event
    this.createAuditEvent('error', req, {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
    
    // Handle ApiError specially
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json(error.toJSON());
    }
    
    // Default error response
    return res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {})
    });
  }
  
  /**
   * Send a validation error response
   */
  protected sendValidationError(res: Response, error: ZodError): Response {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: error.errors
    });
  }
  
  /**
   * Send a standardized success response
   */
  protected sendSuccess(
    res: Response,
    data: Record<string, any> = {},
    message: string = 'Success'
  ): Response {
    return res.status(200).json({
      status: 'success',
      message,
      ...data
    });
  }
  
  /**
   * Send a standardized error response
   */
  protected sendError(
    res: Response,
    message: string,
    statusCode: number = 500,
    error?: any
  ): Response {
    console.error(`Error: ${message}`, error);
    
    return res.status(statusCode).json({
      status: 'error',
      message,
      ...(process.env.NODE_ENV !== 'production' && error ? { 
        error: error instanceof Error ? error.message : String(error)
      } : {})
    });
  }
}