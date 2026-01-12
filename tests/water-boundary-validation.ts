/**
 * WATER TIER BOUNDARY VALIDATION TEST
 * Validates against Excel formulas - CRITICAL boundary conditions
 *
 * Run with: npx ts-node tests/water-boundary-validation.ts
 */

// Re-implement locally for testing
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
  waterComTier1Max: number
  waterComTier1Rate: number
  waterComTier2Max: number
  waterComTier2Rate: number
  waterComTier3Max: number
  waterComTier3Rate: number
  waterComTier4Max: number
  waterComTier4Rate: number
  waterComTier5Max: number
  waterComTier5Rate: number
  waterComTier6Max: number
  waterComTier6Rate: number
  waterComTier7Rate: number
}

// CORRECTED settings (matching Excel formula boundaries)
const CORRECTED_SETTINGS: WaterTierSettings = {
  // Residential - Max values are EXCLUSIVE upper bounds
  waterResTier1Max: 1,    // <=1 cu.m
  waterResTier1Rate: 80,
  waterResTier2Max: 6,    // <6 means 2,3,4,5
  waterResTier2Rate: 200,
  waterResTier3Max: 11,   // <11 means 6,7,8,9,10
  waterResTier3Rate: 370,
  waterResTier4Max: 21,   // <21 means 11-20
  waterResTier4Rate: 40,
  waterResTier5Max: 31,   // <31 means 21-30
  waterResTier5Rate: 45,
  waterResTier6Max: 41,   // <41 means 31-40
  waterResTier6Rate: 50,
  waterResTier7Rate: 55,  // >40

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

// OLD WRONG settings (for comparison)
const OLD_WRONG_SETTINGS: WaterTierSettings = {
  waterResTier1Max: 1,
  waterResTier1Rate: 80,
  waterResTier2Max: 5,    // WRONG - should be 6
  waterResTier2Rate: 200,
  waterResTier3Max: 10,   // WRONG - should be 11
  waterResTier3Rate: 370,
  waterResTier4Max: 20,   // WRONG - should be 21
  waterResTier4Rate: 40,
  waterResTier5Max: 30,   // WRONG - should be 31
  waterResTier5Rate: 45,
  waterResTier6Max: 40,   // WRONG - should be 41
  waterResTier6Rate: 50,
  waterResTier7Rate: 55,

  waterComTier1Max: 1,
  waterComTier1Rate: 200,
  waterComTier2Max: 5,
  waterComTier2Rate: 250,
  waterComTier3Max: 10,
  waterComTier3Rate: 740,
  waterComTier4Max: 20,
  waterComTier4Rate: 55,
  waterComTier5Max: 30,
  waterComTier5Rate: 60,
  waterComTier6Max: 40,
  waterComTier6Rate: 65,
  waterComTier7Rate: 85,
}

/**
 * Excel formula for Residential Water:
 * =IF(J<=1, 80,
 *   IF(AND((J>1),(J<6)), 200,
 *     IF(AND((J>5),(J<11)), 370,
 *       IF(AND((J>10),(J<21)), ((J-10)*40+370),
 *         IF(AND((J>20),(J<31)), ((J-20)*45+770),
 *           IF(AND((J>30),(J<41)), (((J-30)*50+1220)),
 *             ((J-40)*55+1720)))))))
 */
function calculateResidentialWater(consumption: number, settings: WaterTierSettings): number {
  const cons = consumption

  // Tier 1: 0-1 cu.m = Fixed 80
  if (cons <= settings.waterResTier1Max) {
    return settings.waterResTier1Rate
  }

  // Tier 2: >1 to <6 = Fixed 200
  if (cons > settings.waterResTier1Max && cons < settings.waterResTier2Max) {
    return settings.waterResTier2Rate
  }

  // Tier 3: >=6 to <11 = Fixed 370
  if (cons >= settings.waterResTier2Max && cons < settings.waterResTier3Max) {
    return settings.waterResTier3Rate
  }

  // Tier 4: >=11 to <21 = 370 + (cons - 10) * 40
  if (cons >= settings.waterResTier3Max && cons < settings.waterResTier4Max) {
    return settings.waterResTier3Rate + (cons - (settings.waterResTier3Max - 1)) * settings.waterResTier4Rate
  }

  // Tier 5: >=21 to <31 = 770 + (cons - 20) * 45
  if (cons >= settings.waterResTier4Max && cons < settings.waterResTier5Max) {
    const tier4Total = settings.waterResTier3Rate +
      ((settings.waterResTier4Max - 1) - (settings.waterResTier3Max - 1)) * settings.waterResTier4Rate
    return tier4Total + (cons - (settings.waterResTier4Max - 1)) * settings.waterResTier5Rate
  }

  // Tier 6: >=31 to <41 = 1220 + (cons - 30) * 50
  if (cons >= settings.waterResTier5Max && cons < settings.waterResTier6Max) {
    const tier5Total = settings.waterResTier3Rate +
      ((settings.waterResTier4Max - 1) - (settings.waterResTier3Max - 1)) * settings.waterResTier4Rate +
      ((settings.waterResTier5Max - 1) - (settings.waterResTier4Max - 1)) * settings.waterResTier5Rate
    return tier5Total + (cons - (settings.waterResTier5Max - 1)) * settings.waterResTier6Rate
  }

  // Tier 7: >=41 = 1720 + (cons - 40) * 55
  const tier6Total = settings.waterResTier3Rate +
    ((settings.waterResTier4Max - 1) - (settings.waterResTier3Max - 1)) * settings.waterResTier4Rate +
    ((settings.waterResTier5Max - 1) - (settings.waterResTier4Max - 1)) * settings.waterResTier5Rate +
    ((settings.waterResTier6Max - 1) - (settings.waterResTier5Max - 1)) * settings.waterResTier6Rate
  return tier6Total + (cons - (settings.waterResTier6Max - 1)) * settings.waterResTier7Rate
}

console.log('='.repeat(80))
console.log('WATER TIER BOUNDARY VALIDATION - Excel Formula Comparison')
console.log('='.repeat(80))

// Excel formula expected results (manually calculated from Excel formula)
const testCases = [
  { consumption: 0, expectedExcel: 80, tier: 'Tier 1', note: '0 cu.m' },
  { consumption: 1, expectedExcel: 80, tier: 'Tier 1', note: '1 cu.m (max of tier 1)' },
  { consumption: 2, expectedExcel: 200, tier: 'Tier 2', note: '2 cu.m' },
  { consumption: 5, expectedExcel: 200, tier: 'Tier 2', note: '5 cu.m - CRITICAL BOUNDARY!' },
  { consumption: 6, expectedExcel: 370, tier: 'Tier 3', note: '6 cu.m' },
  { consumption: 10, expectedExcel: 370, tier: 'Tier 3', note: '10 cu.m (max of tier 3)' },
  { consumption: 11, expectedExcel: 410, tier: 'Tier 4', note: '11 cu.m: 370+(11-10)*40=410' },
  { consumption: 14, expectedExcel: 530, tier: 'Tier 4', note: '14 cu.m: 370+(14-10)*40=530 (from Excel GF-16)' },
  { consumption: 20, expectedExcel: 770, tier: 'Tier 4', note: '20 cu.m: 370+(20-10)*40=770' },
  { consumption: 21, expectedExcel: 815, tier: 'Tier 5', note: '21 cu.m: 770+(21-20)*45=815' },
  { consumption: 30, expectedExcel: 1220, tier: 'Tier 5', note: '30 cu.m: 770+(30-20)*45=1220' },
  { consumption: 31, expectedExcel: 1270, tier: 'Tier 6', note: '31 cu.m: 1220+(31-30)*50=1270 (from Excel 3F-5)' },
  { consumption: 40, expectedExcel: 1720, tier: 'Tier 6', note: '40 cu.m: 1220+(40-30)*50=1720' },
  { consumption: 41, expectedExcel: 1775, tier: 'Tier 7', note: '41 cu.m: 1720+(41-40)*55=1775' },
  { consumption: 50, expectedExcel: 2270, tier: 'Tier 7', note: '50 cu.m: 1720+(50-40)*55=2270' },
]

console.log('\n--- RESIDENTIAL WATER - CORRECTED SETTINGS ---')
console.log('| Consumption | Expected | Actual | Match? | Tier   | Notes |')
console.log('|-------------|----------|--------|--------|--------|-------|')

let allPassed = true
testCases.forEach(({ consumption, expectedExcel, tier, note }) => {
  const actual = calculateResidentialWater(consumption, CORRECTED_SETTINGS)
  const pass = Math.abs(actual - expectedExcel) < 0.01
  if (!pass) allPassed = false

  console.log(`| ${String(consumption).padStart(11)} | ${String(expectedExcel).padStart(8)} | ${actual.toFixed(2).padStart(6)} | ${pass ? '  OK  ' : ' FAIL '} | ${tier.padEnd(6)} | ${note} |`)
})

console.log('\n--- CRITICAL BOUNDARY TEST: 5 cu.m ---')
const at5Corrected = calculateResidentialWater(5, CORRECTED_SETTINGS)
console.log(`With CORRECTED settings (tier2Max=6): 5 cu.m = ${at5Corrected} (expected: 200)`)
console.log(`Result: ${at5Corrected === 200 ? 'CORRECT - Charges 200' : 'WRONG - Bug still exists!'}`)

// Show what the OLD settings would have calculated
console.log('\n--- What OLD settings would have charged (for comparison) ---')
console.log('With OLD settings (tier2Max=5):')
console.log('  5 cu.m would go to Tier 3 because: cons >= 5 && cons < 10 → TRUE')
console.log('  This would have charged 370 instead of 200')
console.log('  OVERCHARGE: 170 per bill!')

console.log('\n' + '='.repeat(80))
console.log('OVERALL TEST RESULT:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED')
console.log('='.repeat(80))

if (!allPassed) {
  process.exit(1)
}
