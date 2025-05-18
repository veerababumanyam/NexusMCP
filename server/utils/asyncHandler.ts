import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to automatically catch and forward errors to Express error handling
 * 
 * @param fn The async route handler function to wrap
 * @returns A function compatible with Express route handlers that catches errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};