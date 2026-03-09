# End-to-End (E2E) Test Plan for Fuelog

## Overview
This document outlines the End-to-End testing strategy for the Fuelog application. The goal is to ensure critical user flows and application stability across different environments, specifically focusing on Vercel deployments.

## Testing Framework
- **Tool**: [Playwright](https://playwright.dev/)
- **Language**: TypeScript
- **Runner**: Playwright Test Runner

## Test Scope

### 1. Smoke Tests
- Verify the application loads without crashing.
- Verify the document title is correct.
- Verify the presence of critical UI elements (e.g., Login button).

### 2. Authentication Flow (Public)
- **Login Page**: Verify the Login page is displayed for unauthenticated users.
- **Protected Routes**: Verify that accessing protected routes (e.g., `/history`, `/map`) redirects to the Login page or shows the login prompt.

### 3. Navigation
- Verify that navigation links exist (even if they redirect to login).

## CI/CD Integration

### GitHub Actions
A GitHub Actions workflow (`.github/workflows/playwright.yml`) is configured to:
1.  Checkout the code.
2.  Install dependencies.
3.  Build the application (`npm run build`).
4.  Run Playwright tests (`npx playwright test`).

This ensures that every Pull Request and Push to the `main` branch is verified before deployment.

## Running Tests Locally

To run the E2E tests locally:

1.  **Install dependencies**:
    ```bash
    npm install
    npx playwright install --with-deps
    ```

2.  **Run tests**:
    ```bash
    npm run test:e2e
    ```
    This command builds the app, serves it locally, and runs the tests.

3.  **Debug tests**:
    ```bash
    npx playwright test --ui
    ```

## Vercel Integration
The tests are designed to run against the local build in CI, which mimics the Vercel production environment. This ensures that the code being deployed is stable.
