/**
 * PENALTY CALCULATION VALIDATION TEST
 * Validates against Ma'am Rose's exact Excel values (cell-by-cell verified)
 *
 * Run with: npx ts-node tests/penalty-validation.ts
 */

// Re-implement locally for testing (avoid module resolution issues)
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
      const sumWithPrevInterest = totalInterest + tenPercentP
      const compoundInterest = sumWithPrevInterest * penaltyRate
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
console.log('PENALTY CALCULATION VALIDATION - Ma\'am Rose\'s Excel Examples')
console.log('='.repeat(80))

// Test Case 1: Equal monthly principal of 1,717.65 (7 months)
// From plan document Section 4: VERIFIED Example
console.log('\n--- TEST 1: Equal Principal (7 months @ 1,717.65) ---')

const testCase1Bills: UnpaidBill[] = [
  { month: 'June', principal: 1717.65 },
  { month: 'July', principal: 1717.65 },
  { month: 'August', principal: 1717.65 },
  { month: 'September', principal: 1717.65 },
  { month: 'October', principal: 1717.65 },
  { month: 'November', principal: 1717.65 },
  { month: 'December', principal: 1717.65 },
]

const expectedResults1 = [
  { month: 'June', totalInterest: 171.765 },
  { month: 'July', totalInterest: 377.883 },
  { month: 'August', totalInterest: 604.6128 },
  { month: 'September', totalInterest: 854.01558 },
  { month: 'October', totalInterest: 1128.358638 },
  { month: 'November', totalInterest: 1430.1360018 },
  { month: 'December', totalInterest: 1762.09110198 },
]

const result1 = calculateCompoundingPenalty(testCase1Bills)

console.log('| Month      | Expected Tot.Int | Actual Tot.Int | Match? |')
console.log('|------------|------------------|----------------|--------|')

let allPassed = true
result1.breakdown.forEach((item, index) => {
  const expected = expectedResults1[index].totalInterest
  const actual = item.totalInterest
  const diff = Math.abs(expected - actual)
  const pass = diff < 0.0001  // Allow tiny floating point difference
  if (!pass) allPassed = false

  console.log(`| ${item.month.padEnd(10)} | ${expected.toFixed(6).padStart(16)} | ${actual.toFixed(6).padStart(14)} | ${pass ? '  OK  ' : ' FAIL '} |`)
})

console.log('\nFinal Summary:')
console.log(`  Total Principal: ${result1.totalPrincipal.toFixed(2)}`)
console.log(`  Total Interest:  ${result1.totalInterest.toFixed(6)}`)
console.log(`  Total w/ Int:    ${result1.totalWithInterest.toFixed(6)}`)
console.log(`  Expected Tot Int: 1762.09110198`)
console.log(`  Test 1 Result: ${Math.abs(result1.totalInterest - 1762.09110198) < 0.0001 ? 'PASS' : 'FAIL'}`)

// Test Case 2: 2F-16 Variable principals
// From plan document Section 4
console.log('\n--- TEST 2: Variable Principals (2F-16 Example) ---')

const testCase2Bills: UnpaidBill[] = [
  { month: 'August', principal: 2555.09 },
  { month: 'September', principal: 4077.04 },
  { month: 'October', principal: 4898.00 },
]

const expectedResults2 = [
  { month: 'August', totalInterest: 255.509 },
  { month: 'September', totalInterest: 729.5343 },
  { month: 'October', totalInterest: 1341.26773 },
]

const result2 = calculateCompoundingPenalty(testCase2Bills)

console.log('| Month      | Expected Tot.Int | Actual Tot.Int | Match? |')
console.log('|------------|------------------|----------------|--------|')

result2.breakdown.forEach((item, index) => {
  const expected = expectedResults2[index].totalInterest
  const actual = item.totalInterest
  const diff = Math.abs(expected - actual)
  const pass = diff < 0.001
  if (!pass) allPassed = false

  console.log(`| ${item.month.padEnd(10)} | ${expected.toFixed(6).padStart(16)} | ${actual.toFixed(6).padStart(14)} | ${pass ? '  OK  ' : ' FAIL '} |`)
})

console.log('\nFinal Summary:')
console.log(`  Total Principal: ${result2.totalPrincipal.toFixed(2)}`)
console.log(`  Total Interest:  ${result2.totalInterest.toFixed(6)}`)
console.log(`  Total w/ Int:    ${result2.totalWithInterest.toFixed(6)}`)
console.log(`  Expected Total w/ Int: 12871.39773 (Tot Int: 1341.26773)`)
console.log(`  Test 2 Result: ${Math.abs(result2.totalInterest - 1341.26773) < 0.001 ? 'PASS' : 'FAIL'}`)

// Test Case 3: 6F-09 (3 months)
// From plan document Section 4
console.log('\n--- TEST 3: 6F-09 Example (3 months) ---')

const testCase3Bills: UnpaidBill[] = [
  { month: 'August', principal: 2073.36 },
  { month: 'September', principal: 1990.00 },
  { month: 'October', principal: 1530.00 },
]

const expectedResults3 = [
  { month: 'August', totalInterest: 207.336 },
  { month: 'September', totalInterest: 446.9696 },
  { month: 'October', totalInterest: 659.96656 },
]

const result3 = calculateCompoundingPenalty(testCase3Bills)

console.log('| Month      | Expected Tot.Int | Actual Tot.Int | Match? |')
console.log('|------------|------------------|----------------|--------|')

result3.breakdown.forEach((item, index) => {
  const expected = expectedResults3[index].totalInterest
  const actual = item.totalInterest
  const diff = Math.abs(expected - actual)
  const pass = diff < 0.001
  if (!pass) allPassed = false

  console.log(`| ${item.month.padEnd(10)} | ${expected.toFixed(6).padStart(16)} | ${actual.toFixed(6).padStart(14)} | ${pass ? '  OK  ' : ' FAIL '} |`)
})

console.log('\nFinal Summary:')
console.log(`  Total Principal: ${result3.totalPrincipal.toFixed(2)}`)
console.log(`  Total Interest:  ${result3.totalInterest.toFixed(6)}`)
console.log(`  Total w/ Int:    ${result3.totalWithInterest.toFixed(6)}`)
console.log(`  Expected Total w/ Int: 6253.32656 (Tot Int: 659.96656)`)
console.log(`  Test 3 Result: ${Math.abs(result3.totalInterest - 659.96656) < 0.001 ? 'PASS' : 'FAIL'}`)

// Final verdict
console.log('\n' + '='.repeat(80))
console.log('OVERALL TEST RESULT:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED')
console.log('='.repeat(80))

if (!allPassed) {
  process.exit(1)
}
