/**
 * API Error - Infrastructure Layer
 * 
 * This module provides a standardized error class for API errors.
 * It allows for consistent error handling and formatting throughout the application.
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
    
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }
  
  /**
   * Convert the error to a JSON response format
   */
  toJSON() {
    return {
      status: 'error',
      statusCode: this.statusCode,
      message: this.message,
      ...(this.data ? { data: this.data } : {})
    };
  }
}