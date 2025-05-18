/**
 * Integration Tests for AuthController
 * 
 * This file implements integration tests for the Auth API
 * Following:
 * - ISO/IEC/IEEE 29119-4 Test Design Techniques
 * - OWASP ASVS 4.0 Authentication Testing Requirements
 * - NIST SP 800-115 Technical Guide to Information Security Testing
 */

import express from 'express';
import request from 'supertest';
import { authController } from '../../../server/presentation/AuthController';
import { userService } from '../../../server/application/services/UserService';
import { eventBus } from '../../../server/infrastructure/events/EventBus';

// Mock dependencies
jest.mock('../../../server/application/services/UserService');
jest.mock('../../../server/infrastructure/events/EventBus');

describe('AuthController Integration Tests', () => {
  let app: express.Express;
  
  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Register auth routes
    app.post('/api/auth/register', authController.register);
    app.post('/api/auth/login', authController.login);
    app.post('/api/auth/logout', authController.logout);
    app.post('/api/auth/mfa/verify', authController.verifyMfa);
    app.get('/api/auth/me', authController.getCurrentUser);
    app.get('/api/auth/providers', authController.getAuthProviders);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /api/auth/register', () => {
    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ /* invalid input without required fields */ });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should register a new user successfully', async () => {
      // Mock userService.registerUser
      (userService.registerUser as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        isActive: true,
        roles: [{ id: 1, name: 'user' }],
        permissions: ['read:profile']
      });
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'Password123!',
          email: 'test@example.com'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('username', 'testuser');
      expect(eventBus.publish).toHaveBeenCalled();
    });
    
    it('should handle registration failure', async () => {
      // Mock userService.registerUser to throw error
      (userService.registerUser as jest.Mock).mockRejectedValue(
        new Error('Username already exists')
      );
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'Password123!',
          email: 'test@example.com'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Username already exists');
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ /* missing required fields */ });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 401 for invalid credentials', async () => {
      // Mock getUserByUsername to return null (user not found)
      (userService.getUserByUsername as jest.Mock).mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'wronguser',
          password: 'WrongPassword123!'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.stringContaining('auth.failure'),
        expect.any(Object),
        expect.any(Object)
      );
    });
    
    it('should handle MFA requirement', async () => {
      // Mock user with MFA enabled
      (userService.getUserByUsername as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'testuser',
        password: 'hashedpassword',
        isActive: true,
        mfaEnabled: true,
        preferredMfaMethod: 'totp'
      });
      
      // Mock password verification
      (userService.verifyPassword as jest.Mock).mockResolvedValue(true);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mfaRequired', true);
      expect(response.body).toHaveProperty('userId', 1);
      expect(response.body).toHaveProperty('preferredMethod', 'totp');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.stringContaining('mfa.challenged'),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
  
  describe('GET /api/auth/me', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return user data if authenticated', async () => {
      // Create app with authentication mock middleware
      const authApp = express();
      authApp.use(express.json());
      
      // Mock authentication middleware
      authApp.use((req, res, next) => {
        req.isAuthenticated = () => true;
        req.user = { id: 1 };
        next();
      });
      
      // Register route
      authApp.get('/api/auth/me', authController.getCurrentUser);
      
      // Mock user service to return user data
      (userService.getUserById as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        isActive: true,
        roles: [{ id: 1, name: 'user' }],
        permissions: ['read:profile']
      });
      
      const response = await request(authApp)
        .get('/api/auth/me');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('username', 'testuser');
      expect(response.body).not.toHaveProperty('password');
    });
  });
});