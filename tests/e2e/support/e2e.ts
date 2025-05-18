/**
 * E2E Test Support
 * 
 * Implements support functions and custom commands for Cypress E2E tests
 * Following:
 * - ISO/IEC/IEEE 29119-5 Keyword-Driven Testing
 * - W3C ARIA Authoring Practices
 * - WCAG 2.1 AA+ Accessibility Standards
 */

import cypress from 'cypress';
import 'cypress-axe';

// Import commands for accessibility testing
import 'cypress-axe';
// Import commands for testing a11y
import 'cypress-axe';
// Import commands for cucumber/gherkin syntax
import 'cypress-cucumber-preprocessor/steps';

// Configure axe for a11y testing
Cypress.Commands.add('configureAxe', () => {
  cy.injectAxe();
  cy.configureAxe({
    // Set the rules to strict
    rules: [
      { id: 'color-contrast', enabled: true, selector: '*' },
      { id: 'landmark-one-main', enabled: true },
      { id: 'page-has-heading-one', enabled: true },
      { id: 'region', enabled: true },
      { id: 'aria-allowed-attr', enabled: true },
      { id: 'aria-required-attr', enabled: true },
      { id: 'aria-required-children', enabled: true },
      { id: 'aria-required-parent', enabled: true },
      { id: 'aria-roles', enabled: true },
      { id: 'aria-valid-attr', enabled: true },
      { id: 'aria-valid-attr-value', enabled: true },
      { id: 'html-has-lang', enabled: true },
      { id: 'image-alt', enabled: true },
      { id: 'input-button-name', enabled: true },
      { id: 'input-image-alt', enabled: true },
      { id: 'label', enabled: true },
      { id: 'link-name', enabled: true },
      { id: 'list', enabled: true },
      { id: 'listitem', enabled: true },
      { id: 'meta-refresh', enabled: true },
      { id: 'meta-viewport', enabled: true },
      { id: 'tabindex', enabled: true },
      { id: 'table-duplicate-name', enabled: true },
      { id: 'table-fake-caption', enabled: true },
      { id: 'td-has-header', enabled: true },
      { id: 'th-has-data-cells', enabled: true }
    ]
  });
});

// Add custom command for checking accessibility
Cypress.Commands.add('checkA11y', (context, options) => {
  cy.checkA11y(context, options, violations => {
    // Log violations to console
    cy.task('log', 
      `${violations.length} accessibility violation${
        violations.length === 1 ? '' : 's'
      } ${violations.length === 1 ? 'was' : 'were'} detected`
    );
    // Log each violation
    if (violations.length > 0) {
      const violationData = violations.map(({ id, impact, description, nodes }) => ({
        id,
        impact,
        description,
        nodes: nodes.length
      }));
      
      cy.task('log', `Violations: ${JSON.stringify(violationData, null, 2)}`);
    }
  });
});

// Custom command for login
Cypress.Commands.add('login', (username: string, password: string) => {
  cy.session([username, password], () => {
    cy.visit('/auth');
    cy.get('input[name="username"]').type(username);
    cy.get('input[name="password"]').type(password);
    cy.get('button[type="submit"]').click();
    
    // Wait for navigation to complete or success response
    cy.url().should('not.include', '/auth');
  });
});

// Custom command for API login
Cypress.Commands.add('apiLogin', (username: string, password: string) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { username, password },
    failOnStatusCode: false
  }).then(response => {
    // Store response for use in tests
    cy.wrap(response).as('loginResponse');
  });
});

// Before each test, seed the test database
beforeEach(() => {
  // Reset database state - uncomment when needed
  // cy.task('seedDatabase');
});

// After each test, clear localStorage and cookies
afterEach(() => {
  cy.clearLocalStorage();
  cy.clearCookies();
});

// Declare global Cypress namespace for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Configure axe for accessibility testing
       */
      configureAxe(): Chainable<Element>;
      
      /**
       * Check accessibility of current page or element
       */
      checkA11y(
        context?: string | Node | Array<string | Node>,
        options?: any
      ): Chainable<Element>;
      
      /**
       * Login as a user through the UI
       */
      login(username: string, password: string): void;
      
      /**
       * Login as a user through the API
       */
      apiLogin(username: string, password: string): Chainable<Cypress.Response<any>>;
    }
  }
}