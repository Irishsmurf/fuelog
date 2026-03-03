import { test, expect, devices } from '@playwright/test';

test.describe('Mobile UX Smoke Tests', () => {
  test.use({ ...devices['iPhone 12'] });

  test('should show bottom navigation on mobile', async ({ page }) => {
    await page.goto('/');
    
    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeVisible();
    
    // Check for primary mobile links
    await expect(bottomNav.locator('text=Log')).toBeVisible();
    await expect(bottomNav.locator('text=History')).toBeVisible();
  });

  test('should show simplified header on mobile', async ({ page }) => {
    await page.goto('/');
    
    // Header should exist but desktop nav should be hidden
    const header = page.locator('header');
    await expect(header).toBeVisible();
    
    const desktopLinks = header.locator('.hidden.sm\\:flex');
    await expect(desktopLinks).toBeHidden();
  });
});

test.describe('Desktop UX Smoke Tests', () => {
  test.use({ ...devices['Desktop Chrome'] });

  test('should show top navigation on desktop', async ({ page }) => {
    await page.goto('/');
    
    const header = page.locator('header');
    const desktopLinks = header.locator('.hidden.sm\\:flex');
    await expect(desktopLinks).toBeVisible();
    
    const bottomNav = page.locator('nav.fixed.bottom-0');
    await expect(bottomNav).toBeHidden();
  });
});
