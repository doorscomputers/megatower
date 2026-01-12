/**
 * CODEBASE VERIFICATION TEST
 *
 * This test verifies the ACTUAL codebase implementation (lib/calculations/*)
 * works correctly with the corrected tier boundary settings.
 *
 * Run with: npx tsx tests/codebase-verification.ts
 */

// Import actual implementations from codebase
import { calculateResidentialWater, calculateCommercialWater, WaterTierSettings } from '../lib/calculations/water'
import { calculateElectricBill, calculateAssociationDues, calculateCompoundingPenalty, UnpaidBill, BillingSettings } from '../lib/calculations/billing'

console.log('='.repeat(80))
console.log('CODEBASE VERIFICATION TEST')
console.log('Testing actual lib/calculations/* implementations')
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
    console.log(`✓ ${name}: ${actual.toFixed(2)} = ${expected.toFixed(2)}`)
  } else {
    failedTests++
    const errorMsg = `✗ ${name}: GOT ${actual.toFixed(6)}, EXPECTED ${expected.toFixed(6)}, DIFF ${diff.toFixed(6)}`
    console.log(errorMsg)
    failures.push(errorMsg)
  }

  return pass
}

// CORRECTED settings that match Excel formulas
// These are the values that should be in TenantSettings after the fix
const WATER_SETTINGS: WaterTierSettings = {
  // Residential - boundary values are EXCLUSIVE upper bounds
  waterResTier1Max: 1,    // <=1 → Tier 1
  waterResTier1Rate: 80,
  waterResTier2Max: 6,    // <6 → Tier 2 (includes 2,3,4,5)
  waterResTier2Rate: 200,
  waterResTier3Max: 11,   // <11 → Tier 3 (includes 6,7,8,9,10)
  waterResTier3Rate: 370,
  waterResTier4Max: 21,   // <21 → Tier 4 (includes 11-20)
  waterResTier4Rate: 40,
  waterResTier5Max: 31,   // <31 → Tier 5 (includes 21-30)
  waterResTier5Rate: 45,
  waterResTier6Max: 41,   // <41 → Tier 6 (includes 31-40)
  waterResTier6Rate: 50,
  waterResTier7Rate: 55,  // >=41 → Tier 7

  // Commercial
  waterComTier1Max: 1,
  waterComTier1Rate: 200,
  waterComTier2Max: 6,
  waterComTier2Rate: 250,
  waterComTier3Max: 11,
  waterComTier3Rate: 740,
  waterComTier4Max: 21,
  waterComTier4Rate: 55,
  waterComTier5Max: 31,
  waterComTier5Rate: 60,
  waterComTier6Max: 41,
  waterComTier6Rate: 65,
  waterComTier7Rate: 85,
}

const BILLING_SETTINGS: BillingSettings = {
  electricRate: 8.39,
  electricMinCharge: 50,
  associationDuesRate: 60,
  penaltyRate: 0.10,
  waterSettings: WATER_SETTINGS,
}

// ============================================================================
// 1. RESIDENTIAL WATER - ACTUAL CODEBASE
// ============================================================================
console.log('\n' + '='.repeat(80))
console.log('1. RESIDENTIAL WATER (lib/calculations/water.ts)')
console.log('='.repeat(80))

const resWaterTests = [
  // Tier 1
  { cons: 0, expected: 80, note: 'Tier 1' },
  { cons: 1, expected: 80, note: 'Tier 1 boundary' },
  // Tier 2 - CRITICAL: 5 cu.m must be 200, not 370
  { cons: 2, expected: 200, note: 'Tier 2' },
  { cons: 5, expected: 200, note: 'Tier 2 - CRITICAL BOUNDARY (5 cu.m = ₱200)' },
  { cons: 5.9, expected: 200, note: 'Tier 2' },
  // Tier 3
  { cons: 6, expected: 370, note: 'Tier 3' },
  { cons: 10, expected: 370, note: 'Tier 3 boundary' },
  // Tier 4: (cons-10)*40 + 370
  { cons: 11, expected: 410, note: 'Tier 4: (11-10)*40+370' },
  { cons: 14, expected: 530, note: 'Tier 4: (14-10)*40+370 (Excel GF-16)' },
  { cons: 20, expected: 770, note: 'Tier 4: (20-10)*40+370' },
  // Tier 5: (cons-20)*45 + 770
  { cons: 21, expected: 815, note: 'Tier 5: (21-20)*45+770' },
  { cons: 30, expected: 1220, note: 'Tier 5: (30-20)*45+770' },
  // Tier 6: (cons-30)*50 + 1220
  { cons: 31, expected: 1270, note: 'Tier 6: (31-30)*50+1220' },
  { cons: 40, expected: 1720, note: 'Tier 6: (40-30)*50+1220' },
  // Tier 7: (cons-40)*55 + 1720
  { cons: 41, expected: 1775, note: 'Tier 7: (41-40)*55+1720' },
  { cons: 50, expected: 2270, note: 'Tier 7: (50-40)*55+1720' },
]

console.log('')
for (const tc of resWaterTests) {
  const result = calculateResidentialWater(tc.cons, WATER_SETTINGS)
  test(`Res ${tc.cons} cu.m (${tc.note})`, result, tc.expected)
}

// ============================================================================
// 2. COMMERCIAL WATER - ACTUAL CODEBASE
// ============================================================================
console.log('\n' + '='.repeat(80))
console.log('2. COMMERCIAL WATER (lib/calculations/water.ts)')
console.log('='.repeat(80))

const comWaterTests = [
  { cons: 0, expected: 200, note: 'Tier 1 (Excel GF-1)' },
  { cons: 1, expected: 200, note: 'Tier 1' },
  { cons: 2, expected: 250, note: 'Tier 2 (Excel GF-2)' },
  { cons: 5, expected: 250, note: 'Tier 2 - CRITICAL BOUNDARY' },
  { cons: 6, expected: 740, note: 'Tier 3' },
  { cons: 10, expected: 740, note: 'Tier 3' },
  { cons: 11, expected: 795, note: 'Tier 4: (11-10)*55+740' },
  { cons: 20, expected: 1290, note: 'Tier 4: (20-10)*55+740' },
  { cons: 21, expected: 1350, note: 'Tier 5: (21-20)*60+1290' },
  { cons: 30, expected: 1890, note: 'Tier 5: (30-20)*60+1290' },
  { cons: 31, expected: 1955, note: 'Tier 6: (31-30)*65+1890' },
  { cons: 40, expected: 2540, note: 'Tier 6: (40-30)*65+1890' },
  { cons: 41, expected: 2625, note: 'Tier 7: (41-40)*85+2540' },
  { cons: 125.554, expected: 9812.09, note: 'Tier 7 (Excel GF-5)' },
]

console.log('')
for (const tc of comWaterTests) {
  const result = calculateCommercialWater(tc.cons, WATER_SETTINGS)
  test(`Com ${tc.cons} cu.m (${tc.note})`, result, tc.expected)
}

// ============================================================================
// 3. ELECTRIC BILLING - ACTUAL CODEBASE
// ============================================================================
console.log('\n' + '='.repeat(80))
console.log('3. ELECTRIC BILLING (lib/calculations/billing.ts)')
console.log('='.repeat(80))

const electricTests = [
  { cons: 0, expected: 50, note: 'Zero → minimum' },
  { cons: 3, expected: 50, note: '3×8.39=25.17 → minimum' },
  { cons: 5.96, expected: 50.00, note: '5.96×8.39=50.00 → exactly minimum' },
  { cons: 6, expected: 50.34, note: '6×8.39=50.34' },
  { cons: 11, expected: 92.29, note: '11×8.39 (Excel GF-1)' },
  { cons: 115, expected: 964.85, note: '115×8.39 (Excel 2F-1)' },
]

console.log('')
for (const tc of electricTests) {
  const result = calculateElectricBill(tc.cons, BILLING_SETTINGS)
  test(`Electric ${tc.cons} kWh (${tc.note})`, result, tc.expected)
}

// ============================================================================
// 4. ASSOCIATION DUES - ACTUAL CODEBASE
// ============================================================================
console.log('\n' + '='.repeat(80))
console.log('4. ASSOCIATION DUES (lib/calculations/billing.ts)')
console.log('='.repeat(80))

const duesTests = [
  { area: 34.5, expected: 2070, note: 'GF-1' },
  { area: 45, expected: 2700, note: '2F-5' },
  { area: 67.5, expected: 4050, note: '6F-2' },
]

console.log('')
for (const tc of duesTests) {
  const result = calculateAssociationDues(tc.area, BILLING_SETTINGS)
  test(`Dues ${tc.area} sqm (${tc.note})`, result, tc.expected)
}

// ============================================================================
// 5. PENALTY CALCULATION - ACTUAL CODEBASE
// ============================================================================
console.log('\n' + '='.repeat(80))
console.log('5. PENALTY CALCULATION (lib/calculations/billing.ts)')
console.log('='.repeat(80))

const penaltyBills: UnpaidBill[] = [
  { month: 'Mar', principal: 3010.18 },
  { month: 'Apr', principal: 3398 },
  { month: 'May', principal: 3172.66 },
  { month: 'Jun', principal: 1770 },
  { month: 'Jul', principal: 1770 },
]
// Total principal = 3010.18 + 3398 + 3172.66 + 1770 + 1770 = 13120.84

const penaltyResult = calculateCompoundingPenalty(penaltyBills, 0.10)

console.log('')
test('Penalty after 5 months (Latest Excel)', penaltyResult.totalInterest, 1769.3726798, 0.0001)
test('Total Principal', penaltyResult.totalPrincipal, 13120.84, 0.01)
test('Total With Interest', penaltyResult.totalWithInterest, 14890.2126798, 0.0001)

// ============================================================================
// 6. COMPLETE BILL CALCULATION
// ============================================================================
console.log('\n' + '='.repeat(80))
console.log('6. COMPLETE BILL CALCULATION')
console.log('='.repeat(80))

// Test case: GF-5 Commercial (from Excel)
const gf5Electric = calculateElectricBill(100, BILLING_SETTINGS)
const gf5Water = calculateCommercialWater(125.554, WATER_SETTINGS)
const gf5Dues = calculateAssociationDues(30, BILLING_SETTINGS)
const gf5Total = gf5Electric + gf5Water + gf5Dues

console.log('')
console.log('GF-5 (Commercial): 100 kWh, 125.554 cu.m, 30 sqm')
test('  Electric', gf5Electric, 839)
test('  Water', gf5Water, 9812.09)
test('  Dues', gf5Dues, 1800)
test('  TOTAL', gf5Total, 12451.09)

// Test case: 2F-5 Residential with 5 cu.m water (boundary test)
const r25Electric = calculateElectricBill(115, BILLING_SETTINGS)
const r25Water = calculateResidentialWater(5, WATER_SETTINGS) // CRITICAL: must be 200
const r25Dues = calculateAssociationDues(45, BILLING_SETTINGS)
const r25Total = r25Electric + r25Water + r25Dues

console.log('')
console.log('2F-5 (Residential): 115 kWh, 5 cu.m, 45 sqm')
test('  Electric', r25Electric, 964.85)
test('  Water (5 cu.m MUST be 200)', r25Water, 200)
test('  Dues', r25Dues, 2700)
test('  TOTAL', r25Total, 3864.85)

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(80))
console.log('CODEBASE VERIFICATION SUMMARY')
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
  console.log('❌ CODEBASE VERIFICATION FAILED!')
  console.log('DO NOT DEPLOY - There are bugs in the calculation code!')
  process.exit(1)
} else {
  console.log('✅ CODEBASE VERIFICATION PASSED!')
  console.log('')
  console.log('The following have been verified:')
  console.log('  - lib/calculations/water.ts - Residential water tiers')
  console.log('  - lib/calculations/water.ts - Commercial water tiers')
  console.log('  - lib/calculations/billing.ts - Electric billing')
  console.log('  - lib/calculations/billing.ts - Association dues')
  console.log('  - lib/calculations/billing.ts - Penalty calculation')
  console.log('')
  console.log('All calculations match Excel formulas exactly!')
}
