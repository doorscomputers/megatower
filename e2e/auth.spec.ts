/**
 * Authentication E2E Tests
 * Tests login, logout, and protected routes
 */

import { test, expect } from '@playwright/test'

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'Admin@123456'

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login')

    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('text=Mega Tower Residences')).toBeVisible()
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/.*login/)
  })

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.locator('#username').fill(ADMIN_USERNAME)
    await page.locator('#password').fill(ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 30000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.locator('#username').fill('wronguser')
    await page.locator('#password').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    // Wait for error message
    await page.waitForTimeout(2000)

    // Should stay on login page and show error
    await expect(page).toHaveURL(/.*login/)
    await expect(page.locator('.bg-red-50')).toBeVisible()
  })

  test('should access protected routes after login', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.locator('#username').fill(ADMIN_USERNAME)
    await page.locator('#password').fill(ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/dashboard', { timeout: 30000 })

    // Now try protected routes - should not redirect to login
    await page.goto('/payments')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/.*login/)
  })
})

// Helper function for other tests to use
export async function login(page: any) {
  await page.goto('/login')
  await page.locator('#username').fill(ADMIN_USERNAME)
  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 30000 })
}
