/**
 * REAL Application Calculation Verification
 *
 * This script tests the ACTUAL application code in lib/calculations/
 * NOT reimplemented functions in test files.
 *
 * Run with: npx tsx scripts/verify-app-calculations.ts
 */

// Import the ACTUAL application code
import { calculateResidentialWater, calculateCommercialWater } from '../lib/calculations/water'
import { calculateElectricBill, calculateAssociationDues } from '../lib/calculations/billing'

// Test data from Excel: 2ND FLOOR (t2).xlsx - November 2025
const testCases = [
  {
    unit: '2F-1',
    owner: 'Sps. Mario & Rosemarie Suarez',
    electric: { consumption: 115, expected: 964.85 },
    water: { consumption: 2, expected: 200 },
    dues: { area: 34.5, expected: 2070 },
  },
  {
    unit: '2F-2',
    owner: 'MS. ELAINE MAE RAMOS',
    electric: { consumption: 129, expected: 1082.31 },
    water: { consumption: 8, expected: 370 },
    dues: { area: 30, expected: 1800 },
  },
  {
    unit: '2F-6',
    owner: 'SPS. EDUARDO & MARIVIC ALONZO',
    electric: { consumption: 157, expected: 1317.23 },
    water: { consumption: 5, expected: 200 }, // 5 cu.m = Tier 2
    dues: { area: 45, expected: 2700 },
  },
  {
    unit: '2F-19',
    owner: 'Engr. Diosdado David',
    electric: { consumption: 0, expected: 50 }, // Minimum charge
    water: { consumption: 0, expected: 80 }, // Tier 1 minimum
    dues: { area: 25.5, expected: 1530 },
  },
]

// Settings that match your tenant configuration
const settings = {
  electricRate: 8.39,
  electricMinCharge: 50,
  associationDuesRate: 60,
  // Water tier settings
  waterResTier1Max: 1,
  waterResTier1Rate: 80,
  waterResTier2Max: 6,
  waterResTier2Rate: 200,
  waterResTier3Max: 11,
  waterResTier3Rate: 370,
  waterResTier4Max: 21,
  waterResTier4Rate: 40,
  waterResTier5Max: 31,
  waterResTier5Rate: 45,
  waterResTier6Max: 41,
  waterResTier6Rate: 50,
  waterResTier7Rate: 55,
}

console.log('='.repeat(80))
console.log('TESTING ACTUAL APPLICATION CODE')
console.log('Source: lib/calculations/water.ts and lib/calculations/billing.ts')
console.log('='.repeat(80))

let passed = 0
let failed = 0

for (const tc of testCases) {
  console.log(`\n--- ${tc.unit} (${tc.owner}) ---`)

  // Test Electric using ACTUAL app function
  const electricResult = calculateElectricBill(tc.electric.consumption, settings)
  const electricPass = Math.abs(electricResult - tc.electric.expected) < 0.01
  console.log(
    `Electric: ${tc.electric.consumption} kWh = P${electricResult.toFixed(2)} ` +
    `(expected P${tc.electric.expected}) ${electricPass ? '✓ PASS' : '✗ FAIL'}`
  )
  if (electricPass) passed++; else failed++

  // Test Water using ACTUAL app function
  const waterResult = calculateResidentialWater(tc.water.consumption, settings)
  const waterPass = Math.abs(waterResult - tc.water.expected) < 0.01
  console.log(
    `Water: ${tc.water.consumption} cu.m = P${waterResult.toFixed(2)} ` +
    `(expected P${tc.water.expected}) ${waterPass ? '✓ PASS' : '✗ FAIL'}`
  )
  if (waterPass) passed++; else failed++

  // Test Dues using ACTUAL app function
  const duesResult = calculateAssociationDues(tc.dues.area, settings)
  const duesPass = Math.abs(duesResult - tc.dues.expected) < 0.01
  console.log(
    `Dues: ${tc.dues.area} sqm x P60 = P${duesResult.toFixed(2)} ` +
    `(expected P${tc.dues.expected}) ${duesPass ? '✓ PASS' : '✗ FAIL'}`
  )
  if (duesPass) passed++; else failed++
}

console.log('\n' + '='.repeat(80))
console.log(`RESULTS: ${passed} passed, ${failed} failed`)
console.log('='.repeat(80))

if (failed > 0) {
  console.log('\n⚠️  SOME TESTS FAILED!')
  process.exit(1)
} else {
  console.log('\n✓ All tests passed! App calculations match Excel data.')
  process.exit(0)
}
