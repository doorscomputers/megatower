/**
 * Billing Calculation E2E Tests
 * Verifies calculations match Excel data from '2ND FLOOR (t2).xlsx'
 */

import { test, expect, Page } from '@playwright/test'

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'Admin@123456'

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('#username').fill(ADMIN_USERNAME)
  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 30000 })
}

// Water tier settings (Residential)
const waterSettings = {
  tier1Max: 1,
  tier1Rate: 80,
  tier2Max: 6,
  tier2Rate: 200,
  tier3Max: 11,
  tier3Rate: 370,
  tier4Max: 21,
  tier4Rate: 40,
  tier5Max: 31,
  tier5Rate: 45,
  tier6Max: 41,
  tier6Rate: 50,
  tier7Rate: 55,
}

// Electric settings
const electricSettings = {
  rate: 8.39,
  minCharge: 50,
}

// Association dues
const duesRate = 60

// Calculate residential water bill
function calculateResidentialWater(consumption: number): number {
  const cons = consumption

  if (cons <= waterSettings.tier1Max) return waterSettings.tier1Rate
  if (cons > waterSettings.tier1Max && cons < waterSettings.tier2Max) return waterSettings.tier2Rate
  if (cons >= waterSettings.tier2Max && cons < waterSettings.tier3Max) return waterSettings.tier3Rate
  if (cons >= waterSettings.tier3Max && cons < waterSettings.tier4Max)
    return (cons - 10) * waterSettings.tier4Rate + waterSettings.tier3Rate
  if (cons >= waterSettings.tier4Max && cons < waterSettings.tier5Max)
    return (cons - 20) * waterSettings.tier5Rate + 770
  if (cons >= waterSettings.tier5Max && cons < waterSettings.tier6Max)
    return (cons - 30) * waterSettings.tier6Rate + 1220
  return (cons - 40) * waterSettings.tier7Rate + 1720
}

// Calculate electric bill
function calculateElectricBill(consumption: number): number {
  const amount = consumption * electricSettings.rate
  return Math.max(amount, electricSettings.minCharge)
}

// Calculate association dues
function calculateAssociationDues(area: number): number {
  return area * duesRate
}

test.describe('Billing Calculations', () => {
  // Test cases from Excel data (2ND FLOOR (t2).xlsx - November 2025)
  const testCases = [
    {
      unit: '2F-1',
      owner: 'Sps. Mario & Rosemarie Suarez',
      electric: { consumption: 115, expected: 964.85 },
      water: { consumption: 2, expected: 200 },
      dues: { area: 34.5, expected: 2070 },
      totalExpected: 3234.85,
    },
    {
      unit: '2F-2',
      owner: 'MS. ELAINE MAE RAMOS',
      electric: { consumption: 129, expected: 1082.31 },
      water: { consumption: 8, expected: 370 },
      dues: { area: 30, expected: 1800 },
      totalExpected: 3252.31,
    },
    {
      unit: '2F-5',
      owner: 'SPS. Richard & Perlita Lapid',
      electric: { consumption: 17, expected: 142.63 },
      water: { consumption: 2, expected: 200 },
      dues: { area: 45, expected: 2700 },
      totalExpected: 3042.63,
    },
    {
      unit: '2F-6',
      owner: 'SPS. EDUARDO & MARIVIC ALONZO',
      electric: { consumption: 157, expected: 1317.23 },
      water: { consumption: 5, expected: 200 }, // BOUNDARY: 5 cu.m = Tier 2
      dues: { area: 45, expected: 2700 },
      totalExpected: 4217.23,
    },
    {
      unit: '2F-11',
      owner: 'Ms. Demetria Sotelo',
      electric: { consumption: 204, expected: 1711.56 },
      water: { consumption: 12, expected: 450 }, // Tier 4: (12-10)*40 + 370
      dues: { area: 48.5, expected: 2910 },
      totalExpected: 5071.56,
    },
    {
      unit: '2F-19',
      owner: 'Engr. Diosdado David',
      electric: { consumption: 0, expected: 50 }, // MINIMUM CHARGE
      water: { consumption: 0, expected: 80 }, // Tier 1 minimum
      dues: { area: 25.5, expected: 1530 },
      totalExpected: 1660,
    },
  ]

  for (const tc of testCases) {
    test(`Electric calculation for ${tc.unit}: ${tc.electric.consumption} kWh`, () => {
      const result = calculateElectricBill(tc.electric.consumption)
      expect(Math.abs(result - tc.electric.expected)).toBeLessThan(0.01)
    })

    test(`Water calculation for ${tc.unit}: ${tc.water.consumption} cu.m`, () => {
      const result = calculateResidentialWater(tc.water.consumption)
      expect(Math.abs(result - tc.water.expected)).toBeLessThan(0.01)
    })

    test(`Association dues for ${tc.unit}: ${tc.dues.area} sqm`, () => {
      const result = calculateAssociationDues(tc.dues.area)
      expect(Math.abs(result - tc.dues.expected)).toBeLessThan(0.01)
    })

    test(`Total bill for ${tc.unit}`, () => {
      const electric = calculateElectricBill(tc.electric.consumption)
      const water = calculateResidentialWater(tc.water.consumption)
      const dues = calculateAssociationDues(tc.dues.area)
      const total = electric + water + dues
      expect(Math.abs(total - tc.totalExpected)).toBeLessThan(0.01)
    })
  }
})

test.describe('Water Tier Boundary Tests', () => {
  const boundaryTests = [
    { cons: 0, expected: 80, tier: 'Tier 1 (0)' },
    { cons: 1, expected: 80, tier: 'Tier 1 (1)' },
    { cons: 2, expected: 200, tier: 'Tier 2 (2)' },
    { cons: 5, expected: 200, tier: 'Tier 2 (5) - BOUNDARY' },
    { cons: 6, expected: 370, tier: 'Tier 3 (6)' },
    { cons: 10, expected: 370, tier: 'Tier 3 (10)' },
    { cons: 11, expected: 410, tier: 'Tier 4 (11): 370 + (11-10)*40' },
    { cons: 20, expected: 770, tier: 'Tier 4 (20): 370 + (20-10)*40' },
    { cons: 21, expected: 815, tier: 'Tier 5 (21): 770 + (21-20)*45' },
    { cons: 30, expected: 1220, tier: 'Tier 5 (30): 770 + (30-20)*45 = 1220' },
    { cons: 31, expected: 1270, tier: 'Tier 6 (31): 1220 + (31-30)*50' },
    { cons: 40, expected: 1720, tier: 'Tier 6 (40): 1220 + (40-30)*50' },
    { cons: 41, expected: 1775, tier: 'Tier 7 (41): 1720 + (41-40)*55' },
    { cons: 50, expected: 2270, tier: 'Tier 7 (50): 1720 + (50-40)*55' },
  ]

  for (const tc of boundaryTests) {
    test(`Water ${tc.cons} cu.m = P${tc.expected} [${tc.tier}]`, () => {
      const result = calculateResidentialWater(tc.cons)
      expect(Math.abs(result - tc.expected)).toBeLessThan(0.01)
    })
  }
})

test.describe('Electric Minimum Charge Tests', () => {
  const minChargeTests = [
    { cons: 0, expected: 50, note: '0 kWh = P50 minimum' },
    { cons: 5, expected: 50, note: '5*8.39=41.95 < 50, charge minimum' },
    { cons: 6, expected: 50.34, note: '6*8.39=50.34 > 50, charge actual' },
    { cons: 10, expected: 83.9, note: '10*8.39=83.9' },
    { cons: 100, expected: 839, note: '100*8.39=839' },
  ]

  for (const tc of minChargeTests) {
    test(`Electric ${tc.cons} kWh = P${tc.expected} [${tc.note}]`, () => {
      const result = calculateElectricBill(tc.cons)
      expect(Math.abs(result - tc.expected)).toBeLessThan(0.01)
    })
  }
})

test.describe('Billing Page UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate to billing page', async ({ page }) => {
    await page.goto('/billing')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/.*billing/)
  })

  test('should navigate to bill generation page', async ({ page }) => {
    await page.goto('/billing/generate')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/.*billing\/generate/)
  })
})
