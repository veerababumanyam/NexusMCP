/**
 * User Domain Entity
 * 
 * This client-side domain entity represents the User in the domain model.
 * It follows Domain-Driven Design principles by:
 * - Encapsulating domain logic
 * - Enforcing invariants
 * - Limiting state changes to valid operations
 * - Exposing behavior rather than just state
 * 
 * References:
 * - Domain-Driven Design (Eric Evans)
 * - Implementing Domain-Driven Design (Vaughn Vernon)
 */

export enum AuthMethod {
  LOCAL = 'local',
  LDAP = 'ldap',
  SAML = 'saml',
  OIDC = 'oidc'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_ACTIVATION = 'pending_activation'
}

export interface UserRole {
  id: number;
  name: string;
  description?: string;
}

export interface UserPermission {
  name: string;
  description?: string;
}

/**
 * Properties for the User domain entity
 */
export interface UserProps {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: UserStatus;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  authMethod: AuthMethod;
  preferredMfaMethod?: string;
  roles: UserRole[];
  permissions: string[];
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User domain entity
 */
export class User {
  private readonly props: UserProps;
  
  constructor(props: UserProps) {
    this.props = props;
  }
  
  /**
   * Get user ID
   */
  get id(): number {
    return this.props.id;
  }
  
  /**
   * Get username
   */
  get username(): string {
    return this.props.username;
  }
  
  /**
   * Get email
   */
  get email(): string {
    return this.props.email;
  }
  
  /**
   * Get first name
   */
  get firstName(): string | undefined {
    return this.props.firstName;
  }
  
  /**
   * Get last name
   */
  get lastName(): string | undefined {
    return this.props.lastName;
  }
  
  /**
   * Get full name (first + last)
   */
  get fullName(): string {
    if (this.props.firstName && this.props.lastName) {
      return `${this.props.firstName} ${this.props.lastName}`;
    } else if (this.props.firstName) {
      return this.props.firstName;
    } else if (this.props.lastName) {
      return this.props.lastName;
    }
    return this.props.username;
  }
  
  /**
   * Get user status
   */
  get status(): UserStatus {
    return this.props.status;
  }
  
  /**
   * Check if user is active
   */
  get isActive(): boolean {
    return this.props.status === UserStatus.ACTIVE;
  }
  
  /**
   * Check if email is verified
   */
  get isEmailVerified(): boolean {
    return this.props.isEmailVerified;
  }
  
  /**
   * Check if MFA is enabled
   */
  get isMfaEnabled(): boolean {
    return this.props.mfaEnabled;
  }
  
  /**
   * Get authentication method
   */
  get authMethod(): AuthMethod {
    return this.props.authMethod;
  }
  
  /**
   * Get preferred MFA method
   */
  get preferredMfaMethod(): string | undefined {
    return this.props.preferredMfaMethod;
  }
  
  /**
   * Get user roles
   */
  get roles(): UserRole[] {
    return [...this.props.roles]; // Return a copy to prevent external modification
  }
  
  /**
   * Get user permissions
   */
  get permissions(): string[] {
    return [...this.props.permissions]; // Return a copy to prevent external modification
  }
  
  /**
   * Get last login date
   */
  get lastLogin(): Date | undefined {
    return this.props.lastLogin;
  }
  
  /**
   * Get created at date
   */
  get createdAt(): Date {
    return this.props.createdAt;
  }
  
  /**
   * Get updated at date
   */
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  
  /**
   * Check if user has a specific role
   * @param roleName The role name to check
   */
  hasRole(roleName: string): boolean {
    return this.props.roles.some(role => role.name === roleName);
  }
  
  /**
   * Check if user has a specific permission
   * @param permission The permission to check
   */
  hasPermission(permission: string): boolean {
    // Check for exact permission
    if (this.props.permissions.includes(permission)) {
      return true;
    }
    
    // Check for wildcard permissions
    const permissionParts = permission.split(':');
    
    // Check for global admin permissions
    if (this.props.permissions.includes('*')) {
      return true;
    }
    
    // Check for category wildcard permissions (e.g., "read:*")
    if (permissionParts.length > 1) {
      const categoryWildcard = `${permissionParts[0]}:*`;
      if (this.props.permissions.includes(categoryWildcard)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Return a plain object representation of the user
   */
  toObject(): UserProps {
    return {
      ...this.props,
      roles: [...this.props.roles],
      permissions: [...this.props.permissions]
    };
  }
  
  /**
   * Create a User entity from an API response
   */
  static fromApiResponse(response: any): User {
    // Ensure createdAt and updatedAt are Date objects
    const createdAt = response.createdAt ? new Date(response.createdAt) : new Date();
    const updatedAt = response.updatedAt ? new Date(response.updatedAt) : new Date();
    const lastLogin = response.lastLogin ? new Date(response.lastLogin) : undefined;
    
    // Map status to enum
    const status = response.status as UserStatus || UserStatus.ACTIVE;
    
    // Map authentication method to enum
    const authMethod = response.authMethod as AuthMethod || AuthMethod.LOCAL;
    
    return new User({
      id: response.id,
      username: response.username,
      email: response.email,
      firstName: response.firstName,
      lastName: response.lastName,
      status,
      isEmailVerified: !!response.isEmailVerified,
      mfaEnabled: !!response.mfaEnabled,
      authMethod,
      preferredMfaMethod: response.preferredMfaMethod,
      roles: response.roles || [],
      permissions: response.permissions || [],
      lastLogin,
      createdAt,
      updatedAt
    });
  }
}