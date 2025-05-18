/**
 * Jest Configuration for Test-Driven Development (TDD)
 * 
 * This configuration implements best practices for:
 * - Unit testing
 * - Integration testing
 * - Code coverage reporting
 * 
 * Follows:
 * - ISO 29119 Software Testing Standards
 * - ISTQB Testing Principles
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../',
  roots: ['<rootDir>/server', '<rootDir>/tests'],
  testMatch: [
    '**/tests/unit/**/*.spec.ts',
    '**/tests/integration/**/*.spec.ts',
    '**/tests/**/*.test.ts',
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/server/**/*.ts',
    '!<rootDir>/server/**/*.d.ts',
    '!<rootDir>/server/**/index.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};