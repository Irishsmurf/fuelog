import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('has title', async ({ page }) => {
    await page.goto('/');
    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Fuelog/);
  });

  test('shows login page for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    // Expect the header "Fuel Logger" to be visible
    await expect(page.getByRole('heading', { name: 'Fuel Logger' })).toBeVisible();

    // Expect the Sign in button to be visible
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  });

  test('protected routes show login page', async ({ page }) => {
    await page.goto('/history');
    // Since the user is not logged in, they should see the login component
    await expect(page.getByRole('heading', { name: 'Fuel Logger' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  });
});
