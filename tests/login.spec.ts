import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Wait for the page to load
    await expect(page).toHaveURL(/.*login/);

    // Fill in the login form
    await page.fill('#username', 'admin');
    await page.fill('#password', 'Admin@123456');

    // Click the login button
    await page.click('button[type="submit"]');

    // Wait for navigation after successful login
    await page.waitForURL(/.*dashboard/, { timeout: 10000 });

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // Optionally check for dashboard content
    await expect(page.locator('body')).toContainText(/dashboard|home|welcome/i, { timeout: 5000 });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in invalid credentials
    await page.fill('#username', 'wronguser');
    await page.fill('#password', 'wrongpassword');

    // Click the login button
    await page.click('button[type="submit"]');

    // Wait a bit for error message
    await page.waitForTimeout(2000);

    // Should still be on login page
    await expect(page).toHaveURL(/.*login/);

    // Check for error message (adjust based on your actual error display)
    const errorMessage = page.locator('text=/invalid|error|incorrect/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should have required form fields', async ({ page }) => {
    await page.goto('/login');

    // Check that username and password fields exist
    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    const submitButton = page.locator('button[type="submit"]');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('should navigate to login page from root', async ({ page }) => {
    // Try to access root
    await page.goto('/');

    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
  });
});
