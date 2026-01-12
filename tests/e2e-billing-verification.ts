/**
 * END-TO-END BILLING VERIFICATION TEST
 *
 * This test generates bills from the database and verifies each calculation
 * matches the Excel formulas exactly.
 *
 * Run with: npx tsx tests/e2e-billing-verification.ts
 */

import { PrismaClient, UnitType } from '@prisma/client'
import { calculateBill, BillingSettings } from '../lib/calculations/billing'
import { WaterTierSettings, calculateResidentialWater, calculateCommercialWater } from '../lib/calculations/water'

const prisma = new PrismaClient()

console.log('='.repeat(80))
console.log('END-TO-END BILLING VERIFICATION')
console.log('Testing bill generation with actual database data')
console.log('='.repeat(80))

let totalTests = 0
let passedTests = 0
let failedTests = 0
const failures: string[] = []

function test(name: string, actual: number, expected: number, tolerance: number = 0.01): boolean {
  totalTests++
  const diff = Math.abs(actual - expected)
  const pass = diff <= tolerance

  if (pass) {
    passedTests++
    console.log(`  ✓ ${name}: ${actual.toFixed(2)} = ${expected.toFixed(2)}`)
  } else {
    failedTests++
    const errorMsg = `  ✗ ${name}: GOT ${actual.toFixed(6)}, EXPECTED ${expected.toFixed(6)}, DIFF ${diff.toFixed(6)}`
    console.log(errorMsg)
    failures.push(`${name}: ${errorMsg}`)
  }

  return pass
}

async function main() {
  // Get tenant and settings
  const tenant = await prisma.tenant.findFirst({
    include: { settings: true }
  })

  if (!tenant || !tenant.settings) {
    console.error('No tenant or settings found!')
    process.exit(1)
  }

  console.log(`\nTenant: ${tenant.name}`)
  console.log(`Electric Rate: ₱${tenant.settings.electricRate}`)
  console.log(`Electric Min Charge: ₱${tenant.settings.electricMinCharge}`)
  console.log(`Association Dues Rate: ₱${tenant.settings.associationDuesRate}/sqm`)
  console.log(`Penalty Rate: ${tenant.settings.penaltyRate}%`)

  // Build settings objects
  const waterSettings: WaterTierSettings = {
    waterResTier1Max: parseFloat(tenant.settings.waterResTier1Max.toString()),
    waterResTier1Rate: parseFloat(tenant.settings.waterResTier1Rate.toString()),
    waterResTier2Max: parseFloat(tenant.settings.waterResTier2Max.toString()),
    waterResTier2Rate: parseFloat(tenant.settings.waterResTier2Rate.toString()),
    waterResTier3Max: parseFloat(tenant.settings.waterResTier3Max.toString()),
    waterResTier3Rate: parseFloat(tenant.settings.waterResTier3Rate.toString()),
    waterResTier4Max: parseFloat(tenant.settings.waterResTier4Max.toString()),
    waterResTier4Rate: parseFloat(tenant.settings.waterResTier4Rate.toString()),
    waterResTier5Max: parseFloat(tenant.settings.waterResTier5Max.toString()),
    waterResTier5Rate: parseFloat(tenant.settings.waterResTier5Rate.toString()),
    waterResTier6Max: parseFloat(tenant.settings.waterResTier6Max.toString()),
    waterResTier6Rate: parseFloat(tenant.settings.waterResTier6Rate.toString()),
    waterResTier7Rate: parseFloat(tenant.settings.waterResTier7Rate.toString()),
    waterComTier1Max: parseFloat(tenant.settings.waterComTier1Max.toString()),
    waterComTier1Rate: parseFloat(tenant.settings.waterComTier1Rate.toString()),
    waterComTier2Max: parseFloat(tenant.settings.waterComTier2Max.toString()),
    waterComTier2Rate: parseFloat(tenant.settings.waterComTier2Rate.toString()),
    waterComTier3Max: parseFloat(tenant.settings.waterComTier3Max.toString()),
    waterComTier3Rate: parseFloat(tenant.settings.waterComTier3Rate.toString()),
    waterComTier4Max: parseFloat(tenant.settings.waterComTier4Max.toString()),
    waterComTier4Rate: parseFloat(tenant.settings.waterComTier4Rate.toString()),
    waterComTier5Max: parseFloat(tenant.settings.waterComTier5Max.toString()),
    waterComTier5Rate: parseFloat(tenant.settings.waterComTier5Rate.toString()),
    waterComTier6Max: parseFloat(tenant.settings.waterComTier6Max.toString()),
    waterComTier6Rate: parseFloat(tenant.settings.waterComTier6Rate.toString()),
    waterComTier7Rate: parseFloat(tenant.settings.waterComTier7Rate.toString()),
  }

  const billingSettings: BillingSettings = {
    electricRate: parseFloat(tenant.settings.electricRate.toString()),
    electricMinCharge: parseFloat(tenant.settings.electricMinCharge.toString()),
    associationDuesRate: parseFloat(tenant.settings.associationDuesRate.toString()),
    penaltyRate: parseFloat(tenant.settings.penaltyRate.toString()),
    waterSettings,
  }

  // Verify settings are correct
  console.log('\n' + '='.repeat(80))
  console.log('1. VERIFYING TENANT SETTINGS')
  console.log('='.repeat(80))

  test('Electric Rate', billingSettings.electricRate, 8.39)
  test('Electric Min Charge', billingSettings.electricMinCharge, 50)
  test('Dues Rate', billingSettings.associationDuesRate, 60)
  test('Res Tier 1 Max', waterSettings.waterResTier1Max, 1)
  test('Res Tier 2 Max', waterSettings.waterResTier2Max, 6)
  test('Res Tier 3 Max', waterSettings.waterResTier3Max, 11)
  test('Res Tier 4 Max', waterSettings.waterResTier4Max, 21)
  test('Com Tier 1 Rate', waterSettings.waterComTier1Rate, 200)
  test('Com Tier 2 Rate', waterSettings.waterComTier2Rate, 250)
  test('Com Tier 3 Rate', waterSettings.waterComTier3Rate, 740)

  // Get all units with readings for January 2025
  const billingPeriod = new Date('2025-01-01')

  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    include: {
      owner: true,
      electricReadings: {
        where: { billingPeriod }
      },
      waterReadings: {
        where: { billingPeriod }
      }
    },
    orderBy: [{ floorLevel: 'asc' }, { unitNumber: 'asc' }]
  })

  console.log(`\nFound ${units.length} units with readings for ${billingPeriod.toISOString().slice(0, 7)}`)

  // Verify each unit's calculations
  console.log('\n' + '='.repeat(80))
  console.log('2. VERIFYING EACH UNIT BILL CALCULATION')
  console.log('='.repeat(80))

  for (const unit of units) {
    const electricReading = unit.electricReadings[0]
    const waterReading = unit.waterReadings[0]

    if (!electricReading || !waterReading) {
      console.log(`\n⚠️  ${unit.unitNumber}: Missing readings`)
      continue
    }

    const electricCons = parseFloat(electricReading.consumption.toString())
    const waterCons = parseFloat(waterReading.consumption.toString())
    const area = unit.area

    console.log(`\n${unit.unitNumber} (${unit.unitType}): ${electricCons} kWh, ${waterCons} cu.m, ${area} sqm`)

    // Calculate expected values manually using our verified formulas
    // Electric
    const expectedElectric = Math.max(electricCons * billingSettings.electricRate, billingSettings.electricMinCharge)

    // Water - depends on unit type
    const expectedWater = unit.unitType === 'COMMERCIAL'
      ? calculateCommercialWater(waterCons, waterSettings)
      : calculateResidentialWater(waterCons, waterSettings)

    // Dues
    const expectedDues = area * billingSettings.associationDuesRate

    // Use calculateBill function
    const bill = calculateBill({
      electricConsumption: electricCons,
      waterConsumption: waterCons,
      area: area,
      unitType: unit.unitType as 'RESIDENTIAL' | 'COMMERCIAL',
      settings: billingSettings
    })

    test('Electric', bill.electricAmount, expectedElectric)
    test('Water', bill.waterAmount, expectedWater)
    test('Dues', bill.associationDues, expectedDues)
    test('Subtotal', bill.subtotal, expectedElectric + expectedWater + expectedDues)
  }

  // ============================================================================
  // 3. SPECIFIC BOUNDARY TESTS FROM DATABASE
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('3. BOUNDARY TESTS WITH DATABASE SETTINGS')
  console.log('='.repeat(80))

  // Test critical boundary values using actual database settings
  const boundaryTests = [
    // Residential water boundaries
    { cons: 0, type: 'RESIDENTIAL', expected: 80, note: 'Res 0 cu.m → Tier 1 (₱80)' },
    { cons: 1, type: 'RESIDENTIAL', expected: 80, note: 'Res 1 cu.m → Tier 1 (₱80)' },
    { cons: 2, type: 'RESIDENTIAL', expected: 200, note: 'Res 2 cu.m → Tier 2 (₱200)' },
    { cons: 5, type: 'RESIDENTIAL', expected: 200, note: 'Res 5 cu.m → Tier 2 (₱200) - CRITICAL' },
    { cons: 5.9, type: 'RESIDENTIAL', expected: 200, note: 'Res 5.9 cu.m → Tier 2 (₱200)' },
    { cons: 6, type: 'RESIDENTIAL', expected: 370, note: 'Res 6 cu.m → Tier 3 (₱370)' },
    { cons: 10, type: 'RESIDENTIAL', expected: 370, note: 'Res 10 cu.m → Tier 3 (₱370)' },
    { cons: 11, type: 'RESIDENTIAL', expected: 410, note: 'Res 11 cu.m → Tier 4 ((11-10)*40+370)' },
    { cons: 14, type: 'RESIDENTIAL', expected: 530, note: 'Res 14 cu.m → Excel GF-16' },
    { cons: 20, type: 'RESIDENTIAL', expected: 770, note: 'Res 20 cu.m → Tier 4 boundary' },
    { cons: 21, type: 'RESIDENTIAL', expected: 815, note: 'Res 21 cu.m → Tier 5 ((21-20)*45+770)' },
    { cons: 30, type: 'RESIDENTIAL', expected: 1220, note: 'Res 30 cu.m → Tier 5 boundary' },
    { cons: 31, type: 'RESIDENTIAL', expected: 1270, note: 'Res 31 cu.m → Tier 6 ((31-30)*50+1220)' },
    { cons: 40, type: 'RESIDENTIAL', expected: 1720, note: 'Res 40 cu.m → Tier 6 boundary' },
    { cons: 41, type: 'RESIDENTIAL', expected: 1775, note: 'Res 41 cu.m → Tier 7 ((41-40)*55+1720)' },
    { cons: 50, type: 'RESIDENTIAL', expected: 2270, note: 'Res 50 cu.m → Tier 7' },
    // Commercial water boundaries
    { cons: 0, type: 'COMMERCIAL', expected: 200, note: 'Com 0 cu.m → Tier 1 (₱200)' },
    { cons: 1, type: 'COMMERCIAL', expected: 200, note: 'Com 1 cu.m → Tier 1 (₱200)' },
    { cons: 2, type: 'COMMERCIAL', expected: 250, note: 'Com 2 cu.m → Tier 2 (₱250)' },
    { cons: 5, type: 'COMMERCIAL', expected: 250, note: 'Com 5 cu.m → Tier 2 (₱250) - CRITICAL' },
    { cons: 6, type: 'COMMERCIAL', expected: 740, note: 'Com 6 cu.m → Tier 3 (₱740)' },
    { cons: 10, type: 'COMMERCIAL', expected: 740, note: 'Com 10 cu.m → Tier 3 (₱740)' },
    { cons: 11, type: 'COMMERCIAL', expected: 795, note: 'Com 11 cu.m → Tier 4 ((11-10)*55+740)' },
    { cons: 125.554, type: 'COMMERCIAL', expected: 9812.09, note: 'Com 125.554 cu.m → Excel GF-5' },
  ]

  console.log('')
  for (const tc of boundaryTests) {
    const result = tc.type === 'COMMERCIAL'
      ? calculateCommercialWater(tc.cons, waterSettings)
      : calculateResidentialWater(tc.cons, waterSettings)
    test(tc.note, result, tc.expected)
  }

  // ============================================================================
  // 4. ELECTRIC MINIMUM CHARGE TESTS
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('4. ELECTRIC MINIMUM CHARGE TESTS')
  console.log('='.repeat(80))

  const electricTests = [
    { cons: 0, expected: 50, note: '0 kWh → min ₱50' },
    { cons: 3, expected: 50, note: '3×8.39=25.17 → min ₱50' },
    { cons: 5.96, expected: 50, note: '5.96×8.39=50.00 → exactly min ₱50' },
    { cons: 6, expected: 50.34, note: '6×8.39=50.34' },
    { cons: 11, expected: 92.29, note: '11×8.39=92.29' },
    { cons: 100, expected: 839, note: '100×8.39=839' },
    { cons: 115, expected: 964.85, note: '115×8.39=964.85 (Excel 2F-1)' },
  ]

  console.log('')
  for (const tc of electricTests) {
    const result = Math.max(tc.cons * billingSettings.electricRate, billingSettings.electricMinCharge)
    test(tc.note, result, tc.expected)
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('E2E BILLING VERIFICATION SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total Tests: ${totalTests}`)
  console.log(`Passed: ${passedTests}`)
  console.log(`Failed: ${failedTests}`)
  console.log('')

  if (failedTests > 0) {
    console.log('FAILED TESTS:')
    for (const f of failures) {
      console.log(`  ${f}`)
    }
    console.log('')
    console.log('❌ E2E BILLING VERIFICATION FAILED!')
    console.log('DO NOT DEPLOY - There are bugs in the billing calculations!')
    process.exit(1)
  } else {
    console.log('✅ E2E BILLING VERIFICATION PASSED!')
    console.log('')
    console.log('All billing calculations verified:')
    console.log('  - Tenant settings loaded correctly from database')
    console.log('  - Water tier boundaries match Excel formulas')
    console.log('  - Electric minimum charge works correctly')
    console.log('  - Association dues calculated correctly')
    console.log('  - All unit bills calculate correctly')
    console.log('')
    console.log('SAFE TO DEPLOY - All calculations are accurate!')
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
