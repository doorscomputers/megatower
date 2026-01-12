/**
 * Playwright E2E Test: Add Sample Data
 *
 * This script adds sample data to the Megatower Billing System:
 * 1. Logs in as admin
 * 2. Creates sample owners (if needed)
 * 3. Creates sample units (if needed)
 * 4. Adds sample electric and water readings for a billing period
 *
 * Run with: npx playwright test e2e/sample-data.spec.ts
 */

import { test, expect, Page } from '@playwright/test'

// Configuration
const BASE_URL = 'http://localhost:3000'
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'Admin@123456'

// Sample billing period (adjust as needed)
const BILLING_MONTH = '2025-01' // January 2025

// Sample Owners Data
const SAMPLE_OWNERS = [
  { name: 'Juan Dela Cruz', email: 'juan@example.com', phone: '09171234567' },
  { name: 'Maria Santos', email: 'maria@example.com', phone: '09181234567' },
  { name: 'Pedro Reyes', email: 'pedro@example.com', phone: '09191234567' },
  { name: 'Ana Garcia', email: 'ana@example.com', phone: '09201234567' },
  { name: 'Jose Mendoza', email: 'jose@example.com', phone: '09211234567' },
  { name: 'Carmen Lopez', email: 'carmen@example.com', phone: '09221234567' },
  { name: 'HomeAsia Corp', email: 'homeasia@corp.com', phone: '028881234' },
  { name: 'Commonwealth Insurance', email: 'cwi@insurance.com', phone: '028882345' },
]

// Sample Units Data (matching Excel structure)
const SAMPLE_UNITS = [
  // Ground Floor - Mix of Commercial and Residential
  { unitNumber: 'GF-1', floorLevel: 'GF', area: 34.5, unitType: 'COMMERCIAL', ownerIndex: 6 },
  { unitNumber: 'GF-2', floorLevel: 'GF', area: 35.0, unitType: 'COMMERCIAL', ownerIndex: 6 },
  { unitNumber: 'GF-3', floorLevel: 'GF', area: 48.5, unitType: 'COMMERCIAL', ownerIndex: 6 },
  { unitNumber: 'GF-4', floorLevel: 'GF', area: 25.5, unitType: 'RESIDENTIAL', ownerIndex: 0 },
  { unitNumber: 'GF-5', floorLevel: 'GF', area: 30.0, unitType: 'COMMERCIAL', ownerIndex: 6 },
  { unitNumber: 'GF-6', floorLevel: 'GF', area: 28.0, unitType: 'RESIDENTIAL', ownerIndex: 1 },

  // 2nd Floor - Residential
  { unitNumber: '2F-1', floorLevel: '2F', area: 45.0, unitType: 'RESIDENTIAL', ownerIndex: 0 },
  { unitNumber: '2F-2', floorLevel: '2F', area: 40.0, unitType: 'RESIDENTIAL', ownerIndex: 1 },
  { unitNumber: '2F-3', floorLevel: '2F', area: 38.0, unitType: 'RESIDENTIAL', ownerIndex: 2 },
  { unitNumber: '2F-4', floorLevel: '2F', area: 42.0, unitType: 'RESIDENTIAL', ownerIndex: 3 },
  { unitNumber: '2F-5', floorLevel: '2F', area: 35.0, unitType: 'RESIDENTIAL', ownerIndex: 4 },

  // 3rd Floor - Residential
  { unitNumber: '3F-1', floorLevel: '3F', area: 50.0, unitType: 'RESIDENTIAL', ownerIndex: 0 },
  { unitNumber: '3F-2', floorLevel: '3F', area: 45.0, unitType: 'RESIDENTIAL', ownerIndex: 1 },
  { unitNumber: '3F-3', floorLevel: '3F', area: 41.0, unitType: 'RESIDENTIAL', ownerIndex: 2 },
  { unitNumber: '3F-4', floorLevel: '3F', area: 38.0, unitType: 'RESIDENTIAL', ownerIndex: 3 },
  { unitNumber: '3F-5', floorLevel: '3F', area: 55.0, unitType: 'RESIDENTIAL', ownerIndex: 4 },

  // 4th Floor - Residential
  { unitNumber: '4F-1', floorLevel: '4F', area: 48.0, unitType: 'RESIDENTIAL', ownerIndex: 0 },
  { unitNumber: '4F-2', floorLevel: '4F', area: 52.0, unitType: 'RESIDENTIAL', ownerIndex: 1 },
  { unitNumber: '4F-3', floorLevel: '4F', area: 44.0, unitType: 'RESIDENTIAL', ownerIndex: 2 },

  // 5th Floor - Residential
  { unitNumber: '5F-1', floorLevel: '5F', area: 58.5, unitType: 'RESIDENTIAL', ownerIndex: 3 },
  { unitNumber: '5F-2', floorLevel: '5F', area: 67.5, unitType: 'RESIDENTIAL', ownerIndex: 4 },

  // 6th Floor - Residential
  { unitNumber: '6F-1', floorLevel: '6F', area: 58.5, unitType: 'RESIDENTIAL', ownerIndex: 5 },
  { unitNumber: '6F-2', floorLevel: '6F', area: 67.5, unitType: 'RESIDENTIAL', ownerIndex: 5 },
]

// Sample Meter Readings (variable consumption to test different tiers)
// Electric: Random between 50-500 kWh
// Water: Random between 1-50 cu.m to test all tiers
function generateSampleReadings() {
  const readings: Array<{
    unitNumber: string
    electricPrev: number
    electricPres: number
    waterPrev: number
    waterPres: number
  }> = []

  let electricBase = 10000 // Starting meter reading
  let waterBase = 1000

  for (const unit of SAMPLE_UNITS) {
    // Generate random consumption
    const electricConsumption = Math.floor(Math.random() * 450) + 50 // 50-500 kWh
    const waterConsumption = Math.floor(Math.random() * 45) + 1 // 1-45 cu.m

    readings.push({
      unitNumber: unit.unitNumber,
      electricPrev: electricBase,
      electricPres: electricBase + electricConsumption,
      waterPrev: waterBase,
      waterPres: waterBase + waterConsumption,
    })

    electricBase += electricConsumption + Math.floor(Math.random() * 100)
    waterBase += waterConsumption + Math.floor(Math.random() * 10)
  }

  return readings
}

// Helper: Login to the system
async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#username', ADMIN_USERNAME)
  await page.fill('#password', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 30000 })
  await expect(page).toHaveURL(/dashboard/)
}

// Helper: Navigate via sidebar
async function navigateTo(page: Page, path: string, waitForText?: string) {
  await page.goto(path)
  if (waitForText) {
    await page.waitForSelector(`text=${waitForText}`, { timeout: 10000 })
  }
  await page.waitForLoadState('networkidle')
}

test.describe('Sample Data Setup', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('Add sample owners via API', async ({ request }) => {
    // Use API directly for faster owner creation
    for (const owner of SAMPLE_OWNERS) {
      const response = await request.post(`${BASE_URL}/api/owners`, {
        data: owner,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // 201 = created, 409 = already exists (both are OK)
      expect([200, 201, 409, 500]).toContain(response.status())

      if (response.ok()) {
        console.log(`Created owner: ${owner.name}`)
      } else {
        console.log(`Owner may already exist: ${owner.name}`)
      }
    }
  })

  test('Add sample units via API', async ({ request }) => {
    // First get existing owners to map IDs
    const ownersResponse = await request.get(`${BASE_URL}/api/owners`)
    const owners = await ownersResponse.json()

    if (owners.length === 0) {
      console.log('No owners found. Please run the owners test first.')
      return
    }

    for (const unit of SAMPLE_UNITS) {
      const ownerIndex = Math.min(unit.ownerIndex, owners.length - 1)
      const owner = owners[ownerIndex]

      const response = await request.post(`${BASE_URL}/api/units`, {
        data: {
          unitNumber: unit.unitNumber,
          floorLevel: unit.floorLevel,
          area: unit.area,
          unitType: unit.unitType,
          ownerId: owner.id,
          occupancyStatus: 'OCCUPIED',
        },
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok()) {
        console.log(`Created unit: ${unit.unitNumber}`)
      } else {
        console.log(`Unit may already exist: ${unit.unitNumber}`)
      }
    }
  })

  test('Add sample electric readings via UI', async ({ page }) => {
    const readings = generateSampleReadings()

    await navigateTo(page, '/readings/electric', 'Electric Readings')

    // Set billing month
    const monthInput = page.locator('input[type="month"]')
    await monthInput.fill(BILLING_MONTH)

    // Process each floor
    const floors = ['GF', '2F', '3F', '4F', '5F', '6F']

    for (const floor of floors) {
      // Select floor
      await page.click(`text=${floor}`) // Assuming floor selector
      await page.waitForTimeout(1000)

      // Get units for this floor
      const floorReadings = readings.filter((r) =>
        r.unitNumber.startsWith(floor)
      )

      for (const reading of floorReadings) {
        // Find the input row for this unit
        const unitRow = page.locator(`tr:has-text("${reading.unitNumber}")`)

        if (await unitRow.count() > 0) {
          // Fill present reading
          const presentInput = unitRow.locator('input[type="number"]').first()
          if (await presentInput.count() > 0) {
            await presentInput.fill(reading.electricPres.toString())
            console.log(`Set electric reading for ${reading.unitNumber}: ${reading.electricPres}`)
          }
        }
      }

      // Save readings for this floor
      const saveButton = page.locator('button:has-text("Save")')
      if (await saveButton.count() > 0) {
        await saveButton.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test('Add sample water readings via UI', async ({ page }) => {
    const readings = generateSampleReadings()

    await navigateTo(page, '/readings/water', 'Water Readings')

    // Set billing month
    const monthInput = page.locator('input[type="month"]')
    await monthInput.fill(BILLING_MONTH)

    // Process each floor
    const floors = ['GF', '2F', '3F', '4F', '5F', '6F']

    for (const floor of floors) {
      // Select floor
      await page.click(`text=${floor}`)
      await page.waitForTimeout(1000)

      // Get units for this floor
      const floorReadings = readings.filter((r) =>
        r.unitNumber.startsWith(floor)
      )

      for (const reading of floorReadings) {
        const unitRow = page.locator(`tr:has-text("${reading.unitNumber}")`)

        if (await unitRow.count() > 0) {
          const presentInput = unitRow.locator('input[type="number"]').first()
          if (await presentInput.count() > 0) {
            await presentInput.fill(reading.waterPres.toString())
            console.log(`Set water reading for ${reading.unitNumber}: ${reading.waterPres}`)
          }
        }
      }

      // Save readings
      const saveButton = page.locator('button:has-text("Save")')
      if (await saveButton.count() > 0) {
        await saveButton.click()
        await page.waitForTimeout(1000)
      }
    }
  })
})

// Standalone script for direct API seeding (faster)
test.describe('API-Based Sample Data Seeding', () => {
  test('Seed all sample data via API', async ({ request }) => {
    console.log('='.repeat(60))
    console.log('SEEDING SAMPLE DATA VIA API')
    console.log('='.repeat(60))

    // 1. Create owners
    console.log('\n1. Creating owners...')
    const ownerIds: string[] = []

    for (const owner of SAMPLE_OWNERS) {
      const response = await request.post(`${BASE_URL}/api/owners`, {
        data: owner,
      })

      if (response.ok()) {
        const created = await response.json()
        ownerIds.push(created.id)
        console.log(`  Created: ${owner.name}`)
      } else {
        // Try to get existing
        const listResponse = await request.get(`${BASE_URL}/api/owners`)
        const allOwners = await listResponse.json()
        const existing = allOwners.find((o: any) => o.email === owner.email)
        if (existing) {
          ownerIds.push(existing.id)
          console.log(`  Exists: ${owner.name}`)
        }
      }
    }

    // 2. Create units
    console.log('\n2. Creating units...')
    const unitIds: Record<string, string> = {}

    for (const unit of SAMPLE_UNITS) {
      const ownerId = ownerIds[Math.min(unit.ownerIndex, ownerIds.length - 1)]

      const response = await request.post(`${BASE_URL}/api/units`, {
        data: {
          unitNumber: unit.unitNumber,
          floorLevel: unit.floorLevel,
          area: unit.area,
          unitType: unit.unitType,
          ownerId: ownerId,
          occupancyStatus: 'OCCUPIED',
        },
      })

      if (response.ok()) {
        const created = await response.json()
        unitIds[unit.unitNumber] = created.id
        console.log(`  Created: ${unit.unitNumber}`)
      } else {
        // Try to get existing
        const listResponse = await request.get(`${BASE_URL}/api/units`)
        const allUnits = await listResponse.json()
        const existing = allUnits.find((u: any) => u.unitNumber === unit.unitNumber)
        if (existing) {
          unitIds[unit.unitNumber] = existing.id
          console.log(`  Exists: ${unit.unitNumber}`)
        }
      }
    }

    // 3. Create meter readings
    console.log('\n3. Creating meter readings...')
    const readings = generateSampleReadings()
    const billingPeriod = new Date(BILLING_MONTH + '-01').toISOString()

    for (const reading of readings) {
      const unitId = unitIds[reading.unitNumber]
      if (!unitId) {
        console.log(`  Skipped ${reading.unitNumber}: Unit not found`)
        continue
      }

      // Electric reading
      const electricResponse = await request.post(`${BASE_URL}/api/readings/electric`, {
        data: {
          unitId,
          billingPeriod,
          presentReading: reading.electricPres,
          remarks: 'Sample data',
        },
      })

      if (electricResponse.ok()) {
        console.log(`  Electric ${reading.unitNumber}: ${reading.electricPres} kWh`)
      }

      // Water reading
      const waterResponse = await request.post(`${BASE_URL}/api/readings/water`, {
        data: {
          unitId,
          billingPeriod,
          presentReading: reading.waterPres,
          remarks: 'Sample data',
        },
      })

      if (waterResponse.ok()) {
        console.log(`  Water ${reading.unitNumber}: ${reading.waterPres} cu.m`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('SAMPLE DATA SEEDING COMPLETE')
    console.log('='.repeat(60))
  })
})
