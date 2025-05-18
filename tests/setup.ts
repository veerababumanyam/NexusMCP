/**
 * Jest Test Setup
 * 
 * This file sets up the test environment and provides helper functions
 * for writing tests following TDD principles.
 */

import { db } from '../server/infrastructure/persistence/database';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Create a mock for database
jest.mock('../server/infrastructure/persistence/database', () => {
  const mockDb = {
    query: {
      users: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      userRoles: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      roles: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      permissions: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      mfaRecoveryCodes: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  
  return {
    db: mockDb,
    dbUtils: {
      encrypt: jest.fn(str => `encrypted:${str}`),
      decrypt: jest.fn(str => str.replace('encrypted:', '')),
      healthCheck: jest.fn().mockResolvedValue(true),
      executeRawSql: jest.fn().mockResolvedValue([]),
    },
  };
});

// Mock the event bus
jest.mock('../server/infrastructure/events/EventBus', () => {
  return {
    eventBus: {
      publish: jest.fn().mockImplementation(() => Promise.resolve('event-id')),
      register: jest.fn(),
      registerAsync: jest.fn(),
    },
  };
});

// Global setup before all tests
beforeAll(() => {
  console.log('Starting test suite');
});

// Global teardown after all tests
afterAll(() => {
  console.log('Test suite completed');
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});