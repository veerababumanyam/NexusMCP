/**
 * API Client - Infrastructure Layer
 * 
 * This module provides the infrastructure for making API requests.
 * It follows Clean Architecture principles by:
 * - Encapsulating HTTP request details
 * - Handling error responses consistently
 * - Providing a standard interface for API communication
 * - Implementing security best practices
 * 
 * References:
 * - Clean Architecture (Robert C. Martin)
 * - Implementing Domain-Driven Design (Vaughn Vernon)
 */

// Error class for API errors
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
}

// Abstraction for Network requests
class HttpClient {
  // Default request headers
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  /**
   * Set a default header for all requests
   * @param key Header name
   * @param value Header value
   */
  setDefaultHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }
  
  /**
   * Remove a default header
   * @param key Header name
   */
  removeDefaultHeader(key: string): void {
    delete this.defaultHeaders[key];
  }
  
  /**
   * Make an HTTP request
   * @param url The URL to request
   * @param method HTTP method
   * @param data Request body data (for POST/PUT/PATCH)
   * @param options Additional request options
   */
  async request<T = any>(
    url: string,
    method: string,
    data?: any,
    options: RequestInit = {}
  ): Promise<T> {
    // Merge default headers with provided headers
    const headers = {
      ...this.defaultHeaders,
      ...(options.headers || {}),
    };
    
    // Build fetch request options
    const requestOptions: RequestInit = {
      method,
      headers,
      credentials: 'include', // Include cookies for authentication
      ...options,
    };
    
    // Add body data if provided
    if (data) {
      requestOptions.body = JSON.stringify(data);
    }
    
    try {
      // Make the request
      const response = await fetch(url, requestOptions);
      
      // Handle successful no-content responses
      if (response.status === 204) {
        return {} as T;
      }
      
      // Parse response body
      let responseData: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      // Check if request was successful
      if (!response.ok) {
        // Extract error message
        const errorMessage = 
          typeof responseData === 'object' && responseData.message
            ? responseData.message
            : typeof responseData === 'string'
              ? responseData
              : 'An error occurred';
        
        // Throw API error
        throw new ApiError(response.status, errorMessage, responseData);
      }
      
      return responseData as T;
    } catch (error) {
      // Re-throw ApiError instances
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Wrap other errors
      throw new ApiError(0, (error as Error).message || 'Network error');
    }
  }
  
  // HTTP method convenience wrappers
  async get<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, 'GET', undefined, options);
  }
  
  async post<T = any>(url: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, 'POST', data, options);
  }
  
  async put<T = any>(url: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, 'PUT', data, options);
  }
  
  async patch<T = any>(url: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, 'PATCH', data, options);
  }
  
  async delete<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(url, 'DELETE', undefined, options);
  }
}

// Configuration for API client
export interface ApiClientConfig {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  onError?: (error: ApiError) => void;
}

/**
 * API Client for accessing backend services
 */
export class ApiClient {
  private http: HttpClient;
  private baseUrl: string;
  private onError?: (error: ApiError) => void;
  
  constructor(config: ApiClientConfig = {}) {
    this.http = new HttpClient();
    this.baseUrl = config.baseUrl || '';
    this.onError = config.onError;
    
    // Set default headers if provided
    if (config.defaultHeaders) {
      Object.entries(config.defaultHeaders).forEach(([key, value]) => {
        this.http.setDefaultHeader(key, value);
      });
    }
  }
  
  /**
   * Build a complete URL with base URL and endpoint
   * @param endpoint API endpoint
   */
  private buildUrl(endpoint: string): string {
    // If endpoint is already a full URL, return it
    if (endpoint.startsWith('http')) {
      return endpoint;
    }
    
    // Otherwise, join baseUrl and endpoint
    return `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }
  
  /**
   * Set a token for authenticated requests
   * @param token Authentication token
   */
  setAuthToken(token: string): void {
    this.http.setDefaultHeader('Authorization', `Bearer ${token}`);
  }
  
  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.http.removeDefaultHeader('Authorization');
  }
  
  /**
   * Make a GET request
   * @param endpoint API endpoint
   * @param options Request options
   */
  async get<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      return await this.http.get<T>(this.buildUrl(endpoint), options);
    } catch (error) {
      if (error instanceof ApiError && this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }
  
  /**
   * Make a POST request
   * @param endpoint API endpoint
   * @param data Request body data
   * @param options Request options
   */
  async post<T = any>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    try {
      return await this.http.post<T>(this.buildUrl(endpoint), data, options);
    } catch (error) {
      if (error instanceof ApiError && this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }
  
  /**
   * Make a PUT request
   * @param endpoint API endpoint
   * @param data Request body data
   * @param options Request options
   */
  async put<T = any>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    try {
      return await this.http.put<T>(this.buildUrl(endpoint), data, options);
    } catch (error) {
      if (error instanceof ApiError && this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }
  
  /**
   * Make a PATCH request
   * @param endpoint API endpoint
   * @param data Request body data
   * @param options Request options
   */
  async patch<T = any>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    try {
      return await this.http.patch<T>(this.buildUrl(endpoint), data, options);
    } catch (error) {
      if (error instanceof ApiError && this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }
  
  /**
   * Make a DELETE request
   * @param endpoint API endpoint
   * @param options Request options
   */
  async delete<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      return await this.http.delete<T>(this.buildUrl(endpoint), options);
    } catch (error) {
      if (error instanceof ApiError && this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient({
  baseUrl: '', // Empty base URL for same-origin requests
  onError: (error: ApiError) => {
    // Global error handling
    if (error.statusCode === 401) {
      // Handle unauthenticated requests
      console.warn('Authentication required');
      // Could dispatch an event or redirect to login
    } else if (error.statusCode === 403) {
      // Handle forbidden requests
      console.warn('Access denied');
    } else if (error.statusCode === 500) {
      // Handle server errors
      console.error('Server error:', error.message);
    }
  }
});