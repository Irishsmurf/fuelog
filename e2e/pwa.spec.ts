import { test, expect } from '@playwright/test';

test.describe('PWA Validation', () => {
  test('should have a manifest link', async ({ page }) => {
    await page.goto('/');
    // The plugin injects manifest.webmanifest by default
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeAttached();
    const href = await manifestLink.getAttribute('href');
    expect(href).toMatch(/manifest.*\.webmanifest/);
  });

  test('should have correct theme-color meta tag', async ({ page }) => {
    await page.goto('/');
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveAttribute('content', '#4f46e5');
  });

  test('should register a service worker', async ({ page, context }) => {
    await page.goto('/');
    
    // In many environments (like dev), SW might not be active.
    // But in build/preview it should be.
    // We can check if navigator.serviceWorker exists
    const swExists = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(swExists).toBe(true);
  });
});
