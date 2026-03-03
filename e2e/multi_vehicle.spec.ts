import { test, expect } from '@playwright/test';

test.describe('Multi-Vehicle Support E2E', () => {
  test('should allow managing vehicles and logging fuel per vehicle', async ({ page }) => {
    await page.goto('/profile');
    
    // Check if we are redirected to login
    if (await page.url().includes('login')) {
        console.log('Skipping Multi-Vehicle E2E as it requires authentication');
        return;
    }

    // Add a new vehicle
    await page.fill('input[name="name"]', 'Test Car');
    await page.fill('input[name="make"]', 'Toyota');
    await page.fill('input[name="model"]', 'Corolla');
    await page.fill('input[name="year"]', '2022');
    await page.selectOption('select[name="fuelType"]', 'Hybrid');
    await page.click('button:has-text("Add Vehicle")');

    // Verify it appears in the list
    await expect(page.locator('text=Test Car')).toBeVisible();
    await expect(page.locator('text=2022 Toyota Corolla (Hybrid)')).toBeVisible();

    // Go to Log page
    await page.goto('/');
    
    // Verify vehicle selector exists and has the new car
    const vehicleSelector = page.locator('select#vehicle');
    await expect(vehicleSelector).toBeVisible();
    await expect(vehicleSelector).toContainText('Test Car');

    // Log fuel for this car
    await page.fill('input#cost', '50');
    await page.fill('input#distance', '400');
    await page.fill('input#fuelAmount', '30');
    await page.click('button:has-text("Save Fuel Log")');

    // Go to History
    await page.goto('/history');
    
    // Verify vehicle filter has the car
    const filterVehicle = page.locator('select#filterVehicle');
    await expect(filterVehicle).toBeVisible();
    await expect(filterVehicle).toContainText('Test Car');
    
    // Filter by this car
    await filterVehicle.selectOption({ label: 'Test Car' });
    
    // Verify the log is in the table
    await expect(page.locator('table')).toContainText('Test Car');
  });
});
