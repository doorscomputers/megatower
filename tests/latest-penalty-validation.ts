/**
 * LATEST PENALTY COMPUTATION VALIDATION
 * From: LatestPenaltyComputation.xls
 *
 * Run with: npx ts-node tests/latest-penalty-validation.ts
 */

interface UnpaidBill {
  month: string
  principal: number
}

function calculateCompoundingPenalty(
  bills: UnpaidBill[],
  penaltyRate: number = 0.10
): {
  totalInterest: number
  totalPrincipal: number
  totalWithInterest: number
  breakdown: Array<{
    month: string
    principal: number
    tenPercentP: number
    sumWithPrevInterest: number
    compoundInterest: number
    totalInterest: number
  }>
} {
  if (bills.length === 0) {
    return {
      totalInterest: 0,
      totalPrincipal: 0,
      totalWithInterest: 0,
      breakdown: []
    }
  }

  let totalInterest = 0
  let totalPrincipal = 0
  const breakdown: Array<{
    month: string
    principal: number
    tenPercentP: number
    sumWithPrevInterest: number
    compoundInterest: number
    totalInterest: number
  }> = []

  for (let i = 0; i < bills.length; i++) {
    const principal = bills[i].principal
    const tenPercentP = principal * penaltyRate
    totalPrincipal += principal

    if (i === 0) {
      // Month 1: Simple 10% of principal
      totalInterest = tenPercentP
      breakdown.push({
        month: bills[i].month,
        principal,
        tenPercentP,
        sumWithPrevInterest: 0,
        compoundInterest: 0,
        totalInterest
      })
    } else {
      // Month 2+: Compound calculation
      // D = D(prev) + E(prev) + C(curr) = totalInterest + tenPercentP
      const sumWithPrevInterest = totalInterest + tenPercentP
      // E = D * 10%
      const compoundInterest = sumWithPrevInterest * penaltyRate
      // G = D + E
      totalInterest = sumWithPrevInterest + compoundInterest

      breakdown.push({
        month: bills[i].month,
        principal,
        tenPercentP,
        sumWithPrevInterest,
        compoundInterest,
        totalInterest
      })
    }
  }

  return {
    totalInterest,
    totalPrincipal,
    totalWithInterest: totalPrincipal + totalInterest,
    breakdown
  }
}

console.log('='.repeat(80))
console.log('LATEST PENALTY COMPUTATION VALIDATION')
console.log('Source: LatestPenaltyComputation.xls')
console.log('='.repeat(80))

// Data from LatestPenaltyComputation.xls (cell-by-cell extracted)
const testBills: UnpaidBill[] = [
  { month: 'Mar', principal: 3010.18 },   // B4: 1640+1170.18+200
  { month: 'Apr', principal: 3398 },      // B5: 1640+1388+370
  { month: 'May', principal: 3172.66 },   // B6: 1640+1332.66+200
  { month: 'Jun', principal: 1770 },      // B7: 50+80+1640
  { month: 'Jul', principal: 1770 },      // B8: 50+80+1640
  { month: 'Aug', principal: 1770 },      // B9: 50+80+1640
  { month: 'Sep', principal: 1770 },      // B10: 50+80+1640
  { month: 'Oct', principal: 1770 },      // B11: 50+80+1640
  { month: 'Nov', principal: 1770 },      // B12: 50+80+1640
  { month: 'Dec', principal: 1770 },      // B13: 50+80+1640
]

// Expected results from Excel (G column = tot int)
const expectedTotInt = [
  301.018,          // G4
  704.8998,         // G5
  1124.38238,       // G6
  1431.520618,      // G7
  1769.3726798,     // G8
  2141.00994778,    // G9
  2549.810942558,   // G10
  2999.4920368138,  // G11
  3494.14124049518, // G12
  4038.2553645447,  // G13
]

// Expected tot w/o int (H column)
const expectedTotWoInt = [
  3010.18,   // H4
  6408.18,   // H5
  9580.84,   // H6
  11350.84,  // H7
  13120.84,  // H8
  14890.84,  // H9
  16660.84,  // H10
  18430.84,  // H11
  20200.84,  // H12
  21970.84,  // H13
]

// Expected tot w/ int (I column)
const expectedTotWInt = [
  3311.198,           // I4
  7113.0798,          // I5
  10705.22238,        // I6
  12782.360618,       // I7
  14890.2126798,      // I8
  17031.84994778,     // I9
  19210.650942558,    // I10
  21430.3320368138,   // I11
  23694.98124049518,  // I12
  26009.095364544697, // I13
]

const result = calculateCompoundingPenalty(testBills)

console.log('\n--- MONTH-BY-MONTH COMPARISON ---')
console.log('| Month | Principal | Excel Tot Int | Code Tot Int | Match? |')
console.log('|-------|-----------|---------------|--------------|--------|')

let allPassed = true
result.breakdown.forEach((item, index) => {
  const expected = expectedTotInt[index]
  const actual = item.totalInterest
  const diff = Math.abs(expected - actual)
  const pass = diff < 0.0001
  if (!pass) allPassed = false

  console.log(`| ${item.month.padEnd(5)} | ${item.principal.toFixed(2).padStart(9)} | ${expected.toFixed(6).padStart(13)} | ${actual.toFixed(6).padStart(12)} | ${pass ? '  OK  ' : ' FAIL '} |`)
})

console.log('\n--- FINAL TOTALS ---')
console.log(`Total Principal (tot w/o int): ${result.totalPrincipal.toFixed(2)}`)
console.log(`  Excel expected:              ${expectedTotWoInt[9].toFixed(2)}`)
console.log(`  Match: ${Math.abs(result.totalPrincipal - expectedTotWoInt[9]) < 0.01 ? 'YES' : 'NO'}`)

console.log(`\nTotal Interest (tot int):      ${result.totalInterest.toFixed(6)}`)
console.log(`  Excel expected:              ${expectedTotInt[9].toFixed(6)}`)
console.log(`  Match: ${Math.abs(result.totalInterest - expectedTotInt[9]) < 0.0001 ? 'YES' : 'NO'}`)

console.log(`\nTotal With Interest:           ${result.totalWithInterest.toFixed(6)}`)
console.log(`  Excel expected:              ${expectedTotWInt[9].toFixed(6)}`)
console.log(`  Match: ${Math.abs(result.totalWithInterest - expectedTotWInt[9]) < 0.0001 ? 'YES' : 'NO'}`)

console.log('\n' + '='.repeat(80))
console.log('OVERALL RESULT:', allPassed ? 'ALL TESTS PASSED - Formula matches Excel exactly!' : 'SOME TESTS FAILED')
console.log('='.repeat(80))

if (!allPassed) {
  process.exit(1)
}
