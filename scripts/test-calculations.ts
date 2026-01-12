/**
 * Test calculations against Excel data
 * Based on 2ND FLOOR (t2).xlsx - November 2025
 */

// Inline implementations for testing (same as lib/calculations/)

interface WaterTierSettings {
  waterResTier1Max: number
  waterResTier1Rate: number
  waterResTier2Max: number
  waterResTier2Rate: number
  waterResTier3Max: number
  waterResTier3Rate: number
  waterResTier4Max: number
  waterResTier4Rate: number
  waterResTier5Max: number
  waterResTier5Rate: number
  waterResTier6Max: number
  waterResTier6Rate: number
  waterResTier7Rate: number
}

interface BillingSettings {
  electricRate: number
  electricMinCharge: number
  associationDuesRate: number
  penaltyRate: number
  waterSettings: WaterTierSettings
}

function calculateResidentialWater(consumption: number, settings: WaterTierSettings): number {
  const cons = consumption

  // Tier 1: <=1 cu.m = Fixed ₱80
  if (cons <= settings.waterResTier1Max) {
    return settings.waterResTier1Rate
  }

  // Tier 2: >1 AND <6 = Fixed ₱200
  if (cons > settings.waterResTier1Max && cons < settings.waterResTier2Max) {
    return settings.waterResTier2Rate
  }

  // Tier 3: >=6 AND <11 = Fixed ₱370
  if (cons >= settings.waterResTier2Max && cons < settings.waterResTier3Max) {
    return settings.waterResTier3Rate
  }

  // Tier 4: >=11 AND <21 = (cons-10)*40 + 370
  if (cons >= settings.waterResTier3Max && cons < settings.waterResTier4Max) {
    return (cons - 10) * settings.waterResTier4Rate + settings.waterResTier3Rate
  }

  // Tier 5: >=21 AND <31 = (cons-20)*45 + 770
  if (cons >= settings.waterResTier4Max && cons < settings.waterResTier5Max) {
    return (cons - 20) * settings.waterResTier5Rate + 770
  }

  // Tier 6: >=31 AND <41 = (cons-30)*50 + 1220
  if (cons >= settings.waterResTier5Max && cons < settings.waterResTier6Max) {
    return (cons - 30) * settings.waterResTier6Rate + 1220
  }

  // Tier 7: >=41 = (cons-40)*55 + 1720
  return (cons - 40) * settings.waterResTier7Rate + 1720
}

function calculateElectricBill(consumption: number, settings: BillingSettings): number {
  const amount = consumption * settings.electricRate
  return Math.max(amount, settings.electricMinCharge)
}

function calculateAssociationDues(area: number, settings: BillingSettings): number {
  return area * settings.associationDuesRate
}

// Default settings from schema (Residential only for this test)
const waterSettings: WaterTierSettings = {
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

const billingSettings: BillingSettings = {
  electricRate: 8.39,
  electricMinCharge: 50,
  associationDuesRate: 60,
  penaltyRate: 0.10,
  waterSettings,
}

// Test cases from Excel data
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
    water: { consumption: 5, expected: 200 }, // BOUNDARY TEST: 5 cu.m = Tier 2
    dues: { area: 45, expected: 2700 },
    totalExpected: 4217.23,
  },
  {
    unit: '2F-10',
    owner: 'MS. MA. ANA ELIZABETH SALAZAR',
    electric: { consumption: 79, expected: 662.81 },
    water: { consumption: 5, expected: 200 }, // BOUNDARY TEST: 5 cu.m = Tier 2
    dues: { area: 35, expected: 2100 },
    totalExpected: 2962.81,
  },
  {
    unit: '2F-11',
    owner: 'Ms. Demetria Sotelo',
    electric: { consumption: 204, expected: 1711.56 },
    water: { consumption: 12, expected: 450 }, // Tier 4: (12-10)*40 + 370 = 450
    dues: { area: 48.5, expected: 2910 },
    totalExpected: 5071.56,
  },
  {
    unit: '2F-19',
    owner: 'Engr. Diosdado David',
    electric: { consumption: 0, expected: 50 }, // MINIMUM CHARGE TEST
    water: { consumption: 0, expected: 80 }, // MINIMUM (Tier 1)
    dues: { area: 25.5, expected: 1530 },
    totalExpected: 1660,
  },
  {
    unit: '2F-20',
    owner: 'SPS. JACKSON & VIVIAN LESTINO',
    electric: { consumption: 0, expected: 50 }, // MINIMUM CHARGE TEST
    water: { consumption: 0, expected: 80 }, // MINIMUM (Tier 1)
    dues: { area: 25.5, expected: 1530 },
    totalExpected: 1660,
  },
]

console.log('='.repeat(80))
console.log('CALCULATION VERIFICATION TEST')
console.log('Based on: 2ND FLOOR (t2).xlsx - November 2025')
console.log('='.repeat(80))

let passed = 0
let failed = 0

for (const test of testCases) {
  console.log(`\n--- ${test.unit} (${test.owner}) ---`)

  // Test Electric
  const electricResult = calculateElectricBill(test.electric.consumption, billingSettings)
  const electricPass = Math.abs(electricResult - test.electric.expected) < 0.01
  console.log(
    `Electric: ${test.electric.consumption} kWh = ₱${electricResult.toFixed(2)} ` +
    `(expected ₱${test.electric.expected}) ${electricPass ? '✓' : '✗'}`
  )
  if (electricPass) passed++; else failed++

  // Test Water
  const waterResult = calculateResidentialWater(test.water.consumption, waterSettings)
  const waterPass = Math.abs(waterResult - test.water.expected) < 0.01
  console.log(
    `Water: ${test.water.consumption} cu.m = ₱${waterResult.toFixed(2)} ` +
    `(expected ₱${test.water.expected}) ${waterPass ? '✓' : '✗'}`
  )
  if (waterPass) passed++; else failed++

  // Test Association Dues
  const duesResult = calculateAssociationDues(test.dues.area, billingSettings)
  const duesPass = Math.abs(duesResult - test.dues.expected) < 0.01
  console.log(
    `Dues: ${test.dues.area} sqm × ₱60 = ₱${duesResult.toFixed(2)} ` +
    `(expected ₱${test.dues.expected}) ${duesPass ? '✓' : '✗'}`
  )
  if (duesPass) passed++; else failed++

  // Test Total
  const totalResult = electricResult + waterResult + duesResult
  const totalPass = Math.abs(totalResult - test.totalExpected) < 0.01
  console.log(
    `TOTAL: ₱${totalResult.toFixed(2)} (expected ₱${test.totalExpected}) ${totalPass ? '✓' : '✗'}`
  )
  if (totalPass) passed++; else failed++
}

console.log('\n' + '='.repeat(80))
console.log('BOUNDARY VALUE TESTS')
console.log('='.repeat(80))

// Test water tier boundaries
const waterBoundaryTests = [
  { cons: 0, expected: 80, tier: 'Tier 1 (0)' },
  { cons: 1, expected: 80, tier: 'Tier 1 (1)' },
  { cons: 2, expected: 200, tier: 'Tier 2 (2)' },
  { cons: 5, expected: 200, tier: 'Tier 2 (5) - BOUNDARY!' },
  { cons: 6, expected: 370, tier: 'Tier 3 (6)' },
  { cons: 10, expected: 370, tier: 'Tier 3 (10)' },
  { cons: 11, expected: 410, tier: 'Tier 4 (11): 370 + (11-10)*40 = 410' },
  { cons: 20, expected: 770, tier: 'Tier 4 (20): 370 + (20-10)*40 = 770' },
  { cons: 21, expected: 815, tier: 'Tier 5 (21): 770 + (21-20)*45 = 815' },
]

for (const test of waterBoundaryTests) {
  const result = calculateResidentialWater(test.cons, waterSettings)
  const pass = Math.abs(result - test.expected) < 0.01
  console.log(
    `Water ${test.cons} cu.m = ₱${result.toFixed(2)} (expected ₱${test.expected}) ` +
    `[${test.tier}] ${pass ? '✓' : '✗'}`
  )
  if (pass) passed++; else failed++
}

// Test electric minimum
console.log('\n--- Electric Minimum Charge Tests ---')
const electricMinTests = [
  { cons: 0, expected: 50, note: '0 kWh = ₱50 minimum' },
  { cons: 5, expected: 50, note: '5*8.39=41.95 < 50, charge minimum' },
  { cons: 6, expected: 50.34, note: '6*8.39=50.34 > 50, charge actual' },
]

for (const test of electricMinTests) {
  const result = calculateElectricBill(test.cons, billingSettings)
  const pass = Math.abs(result - test.expected) < 0.01
  console.log(
    `Electric ${test.cons} kWh = ₱${result.toFixed(2)} (expected ₱${test.expected}) ` +
    `[${test.note}] ${pass ? '✓' : '✗'}`
  )
  if (pass) passed++; else failed++
}

console.log('\n' + '='.repeat(80))
console.log(`RESULTS: ${passed} passed, ${failed} failed`)
console.log('='.repeat(80))

if (failed > 0) {
  console.log('\n⚠️  SOME TESTS FAILED! Please review the calculations.')
  process.exit(1)
} else {
  console.log('\n✓ All tests passed! Calculations match Excel data.')
  process.exit(0)
}
