/**
 * Authentication Service - Application Layer
 * 
 * This service handles authentication-related operations.
 * It follows Clean Architecture principles by:
 * - Exposing application-level operations for authentication
 * - Handling business rules related to authentication
 * - Abstracting away infrastructure details
 * - Providing a consistent interface for authentication
 * 
 * References:
 * - Clean Architecture (Robert C. Martin)
 * - Implementing Domain-Driven Design (Vaughn Vernon)
 */

import { User, AuthMethod, UserStatus } from '@/domain/entities/User';
import { queryClient } from '@/lib/queryClient';

// Login credentials interface
export interface LoginCredentials {
  username: string;
  password: string;
}

// MFA verification data
export interface MfaVerificationData {
  userId: number;
  code: string;
  method: string;
}

// Registration data interface
export interface RegistrationData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// Authentication provider data
export interface AuthProvider {
  id: string;
  name: string;
  type: string;
  url: string;
  icon?: string;
}

// Auth response from API
export interface AuthResponse {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
  roles: { id: number; name: string }[];
  permissions: string[];
  mfaEnabled?: boolean;
  mfaRequired?: boolean;
  requireReauthentication?: boolean;
  authMethod?: string;
  token?: string;
}

// MFA challenge response
export interface MfaResponse {
  mfaRequired: boolean;
  userId: number;
  preferredMethod: string;
  availableMethods: string[];
}

/**
 * Authentication Service - Application Layer
 * 
 * Handles all authentication-related operations
 */
class AuthService {
  private readonly API_BASE_URL = '/api/auth';
  
  /**
   * Login with username and password
   * @param credentials Login credentials
   */
  async login(credentials: LoginCredentials): Promise<User | MfaResponse> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include', // Include cookies
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }
      
      const data = await response.json();
      
      // Check if MFA is required
      if (data.mfaRequired) {
        return {
          mfaRequired: true,
          userId: data.userId,
          preferredMethod: data.preferredMethod || 'totp',
          availableMethods: data.availableMethods || ['totp'],
        };
      }
      
      // Return user entity
      return User.fromApiResponse(data);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
  
  /**
   * Complete MFA verification
   * @param verificationData MFA verification data
   */
  async verifyMfa(verificationData: MfaVerificationData): Promise<User> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verificationData),
        credentials: 'include', // Include cookies
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'MFA verification failed');
      }
      
      const data = await response.json();
      return User.fromApiResponse(data);
    } catch (error) {
      console.error('MFA verification error:', error);
      throw error;
    }
  }
  
  /**
   * Register a new user
   * @param registrationData User registration data
   */
  async register(registrationData: RegistrationData): Promise<User> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
        credentials: 'include', // Include cookies
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      
      const data = await response.json();
      return User.fromApiResponse(data);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }
  
  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/logout`, {
        method: 'POST',
        credentials: 'include', // Include cookies
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Logout failed');
      }
      
      // Clear any cached auth data
      queryClient.setQueryData(['/api/user'], null);
      
      // Invalidate any auth-dependent queries
      queryClient.invalidateQueries();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
  
  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/me`, {
        credentials: 'include', // Include cookies
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - return null instead of throwing
          return null;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get current user');
      }
      
      const data = await response.json();
      return User.fromApiResponse(data);
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }
  
  /**
   * Get available authentication providers
   */
  async getAuthProviders(): Promise<AuthProvider[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/providers`, {
        credentials: 'include', // Include cookies
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get auth providers');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get auth providers error:', error);
      throw error;
    }
  }
  
  /**
   * Check if the user has a specific permission
   * @param user The user to check permissions for
   * @param requiredPermission The permission to check
   */
  hasPermission(user: User | null, requiredPermission: string): boolean {
    if (!user) {
      return false;
    }
    
    return user.hasPermission(requiredPermission);
  }
  
  /**
   * Check if the user has a specific role
   * @param user The user to check roles for
   * @param requiredRole The role to check
   */
  hasRole(user: User | null, requiredRole: string): boolean {
    if (!user) {
      return false;
    }
    
    return user.hasRole(requiredRole);
  }
}

// Export singleton instance
export const authService = new AuthService();