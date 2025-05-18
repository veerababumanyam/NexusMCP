/// <reference types="cypress" />

import { Given, When, Then } from "cypress-cucumber-preprocessor/steps";

// Background
Given('I am on the authentication page', () => {
  cy.visit('/auth');
  cy.get('h1').should('contain', 'Welcome');
});

// Login-related steps
When('I fill in the following:', (dataTable) => {
  // Convert the Cucumber DataTable to an object
  const formData = dataTable.rawTable.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  // Fill in each field
  Object.entries(formData).forEach(([field, value]) => {
    cy.get(`input[name="${field}"]`).clear().type(value);
  });
});

When('I click the {string} button', (buttonText) => {
  cy.contains('button', buttonText).click();
});

When('I click on the {string} tab', (tabText) => {
  cy.contains(tabText).click();
});

Then('I should be redirected to the dashboard', () => {
  cy.url().should('include', '/dashboard');
  cy.get('h1').should('contain', 'Dashboard');
});

Then('I should see a welcome message for {string}', (name) => {
  cy.contains(`Welcome, ${name}`).should('be.visible');
});

Then('I should see an error message {string}', (errorMessage) => {
  cy.contains(errorMessage).should('be.visible');
});

Then('I should remain on the authentication page', () => {
  cy.url().should('include', '/auth');
});

// MFA-related steps
Then('I should see the MFA verification form', () => {
  cy.contains('Multi-Factor Authentication').should('be.visible');
  cy.get('input[name="verificationCode"]').should('be.visible');
});

When('I enter a valid verification code', () => {
  // In a real test, you might need to mock this or use a known test code
  cy.get('input[name="verificationCode"]').type('123456');
});

// Logout-related steps
Given('I am logged in as {string}', (username) => {
  // Use the custom command defined in e2e.ts support file
  cy.login(username, 'Password123!');
  
  // Verify we're logged in
  cy.url().should('include', '/dashboard');
});

When('I click on the user menu', () => {
  cy.get('[data-testid="user-menu"]').click();
});

When('I click the {string} option', (option) => {
  cy.contains(option).click();
});

Then('I should be logged out', () => {
  // Check for login button or other indicators of logged-out state
  cy.get('button').contains('Login').should('be.visible');
  
  // Local storage should not contain authentication token
  cy.window().its('localStorage.token').should('be.undefined');
});

// We're also implementing an accessibility check on each page transition
afterEach(() => {
  // Check accessibility after each step (note: requires axe to be available)
  cy.configureAxe();
  cy.checkA11y();
});