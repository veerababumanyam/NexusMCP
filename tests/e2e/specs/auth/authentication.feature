Feature: User Authentication
  As a user of the NexusMCP platform
  I want to securely authenticate with various methods
  So that I can access protected resources safely

  Background:
    Given I am on the authentication page

  Scenario: User can register a new account
    When I click on the "Register" tab
    And I fill in the following:
      | username  | newuser123     |
      | password  | SecureP@ss123! |
      | email     | new@example.com|
      | fullName  | New User       |
    And I click the "Register" button
    Then I should be redirected to the dashboard
    And I should see a welcome message for "New User"

  Scenario: User can log in with valid credentials
    When I fill in the following:
      | username  | testuser     |
      | password  | Password123! |
    And I click the "Login" button
    Then I should be redirected to the dashboard
    And I should see a welcome message for "Test User"

  Scenario: User cannot log in with invalid credentials
    When I fill in the following:
      | username  | testuser        |
      | password  | WrongPassword!  |
    And I click the "Login" button
    Then I should see an error message "Invalid username or password"
    And I should remain on the authentication page

  Scenario: User with MFA enabled must complete verification
    When I fill in the following:
      | username  | mfauser      |
      | password  | Password123! |
    And I click the "Login" button
    Then I should see the MFA verification form
    When I enter a valid verification code
    And I click the "Verify" button
    Then I should be redirected to the dashboard

  Scenario: User can log out
    Given I am logged in as "testuser"
    When I click on the user menu
    And I click the "Logout" option
    Then I should be redirected to the authentication page
    And I should be logged out