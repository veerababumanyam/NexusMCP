/**
 * Cypress Configuration for End-to-End & Behavior-Driven Development (BDD) Tests
 * 
 * Implements:
 * - ISO/IEC/IEEE 29119-5 Keyword-Driven Testing
 * - BDD Gherkin-style test specifications
 * - WCAG 2.1 AA+ Accessibility Testing
 * - OWASP ASVS 4.0 Security Testing Requirements
 */

import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      on('task', {
        // Add custom tasks for test setup and teardown
        log(message) {
          console.log(message);
          return null;
        },
        seedDatabase() {
          // Would call database seeding script in a real implementation
          console.log('Seeding test database');
          return null;
        },
        clearDatabase() {
          // Would clear test database in a real implementation
          console.log('Clearing test database');
          return null;
        }
      });
    },
    specPattern: 'tests/e2e/specs/**/*.{js,jsx,ts,tsx,feature}',
    supportFile: 'tests/e2e/support/e2e.ts',
    baseUrl: 'http://localhost:5000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 5000,
    requestTimeout: 10000,
    responseTimeout: 30000
  },
  fixturesFolder: 'tests/e2e/fixtures',
  supportFolder: 'tests/e2e/support',
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite'
    },
    specPattern: 'client/src/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'tests/e2e/support/component.ts'
  },
  retries: {
    runMode: 1,
    openMode: 0
  },
  env: {
    grepFilterSpecs: true,
    grepOmitFiltered: true
  },
  // Configure for accessibility testing
  a11y: {
    // WCAG 2.1 AA+ compliance
    runOnly: {
      type: 'tag',
      values: ['wcag21aa', 'best-practice', 'section508']
    }
  }
});