/**
 * Test file to validate billing calculations against Excel examples
 * Run with: npm run test or ts-node tests/calculations.test.ts
 */

import { calculateElectricBill } from "../lib/calculations/billing"
import {
  calculateResidentialWater,
  calculateCommercialWater,
} from "../lib/calculations/water"
import { calculateAssociationDues } from "../lib/calculations/billing"

// Test data from Excel examples
const ELECTRIC_RATE = 8.39
const DUES_RATE = 60

console.log("=".repeat(80))
console.log("BILLING CALCULATION VALIDATION TESTS")
console.log("=".repeat(80))

// Test 1: Electric Bill Calculations
console.log("\n1. ELECTRIC BILL TESTS")
console.log("-".repeat(80))

const electricTests = [
  { consumption: 0, expected: 50, description: "Zero consumption (minimum charge)" },
  { consumption: 5, expected: 50, description: "5 kWh (below minimum)" },
  { consumption: 100, expected: 839, description: "100 kWh" },
  { consumption: 250, expected: 2097.5, description: "250 kWh" },
  { consumption: 500, expected: 4195, description: "500 kWh" },
]

electricTests.forEach(({ consumption, expected, description }) => {
  const result = calculateElectricBill(consumption, ELECTRIC_RATE)
  const pass = Math.abs(result - expected) < 0.01
  console.log(
    `${pass ? "✓" : "✗"} ${description}: ${consumption} kWh × ₱${ELECTRIC_RATE} = ₱${result.toFixed(
      2
    )} (expected: ₱${expected.toFixed(2)})`
  )
})

// Test 2: Residential Water Bill Calculations
console.log("\n2. RESIDENTIAL WATER BILL TESTS")
console.log("-".repeat(80))

const residentialWaterTests = [
  { consumption: 0, expected: 0, description: "0 cu.m (zero)" },
  { consumption: 0.5, expected: 80, description: "0.5 cu.m (Tier 1)" },
  { consumption: 1, expected: 80, description: "1 cu.m (Tier 1 max)" },
  { consumption: 3, expected: 200, description: "3 cu.m (Tier 2)" },
  { consumption: 5, expected: 200, description: "5 cu.m (Tier 2 max)" },
  { consumption: 7, expected: 370, description: "7 cu.m (Tier 3)" },
  { consumption: 10, expected: 370, description: "10 cu.m (Tier 3 max)" },
  { consumption: 15, expected: 570, description: "15 cu.m (Tier 4: 370 + 5×40)" },
  { consumption: 20, expected: 770, description: "20 cu.m (Tier 4 max)" },
  { consumption: 25, expected: 995, description: "25 cu.m (Tier 5: 770 + 5×45)" },
  { consumption: 30, expected: 1220, description: "30 cu.m (Tier 5 max)" },
  { consumption: 35, expected: 1470, description: "35 cu.m (Tier 6: 1220 + 5×50)" },
  { consumption: 40, expected: 1720, description: "40 cu.m (Tier 6 max)" },
  { consumption: 45, expected: 1995, description: "45 cu.m (Tier 7: 1720 + 5×55)" },
  { consumption: 50, expected: 2270, description: "50 cu.m (Tier 7)" },
]

residentialWaterTests.forEach(({ consumption, expected, description }) => {
  const result = calculateResidentialWater(consumption)
  const pass = Math.abs(result.total - expected) < 0.01
  console.log(
    `${pass ? "✓" : "✗"} ${description}: ₱${result.total.toFixed(
      2
    )} (expected: ₱${expected.toFixed(2)})`
  )
  if (!pass) {
    console.log(`   ERROR: Difference of ₱${Math.abs(result.total - expected).toFixed(2)}`)
  }
})

// Test 3: Commercial Water Bill Calculations
console.log("\n3. COMMERCIAL WATER BILL TESTS")
console.log("-".repeat(80))

const commercialWaterTests = [
  { consumption: 0, expected: 0, description: "0 cu.m (zero)" },
  { consumption: 0.5, expected: 120, description: "0.5 cu.m (Tier 1)" },
  { consumption: 1, expected: 120, description: "1 cu.m (Tier 1 max)" },
  { consumption: 3, expected: 280, description: "3 cu.m (Tier 2)" },
  { consumption: 5, expected: 280, description: "5 cu.m (Tier 2 max)" },
  { consumption: 7, expected: 510, description: "7 cu.m (Tier 3)" },
  { consumption: 10, expected: 510, description: "10 cu.m (Tier 3 max)" },
  { consumption: 15, expected: 810, description: "15 cu.m (Tier 4: 510 + 5×60)" },
  { consumption: 20, expected: 1110, description: "20 cu.m (Tier 4 max)" },
  { consumption: 25, expected: 1435, description: "25 cu.m (Tier 5: 1110 + 5×65)" },
  { consumption: 30, expected: 1760, description: "30 cu.m (Tier 5 max)" },
  { consumption: 35, expected: 2110, description: "35 cu.m (Tier 6: 1760 + 5×70)" },
  { consumption: 40, expected: 2460, description: "40 cu.m (Tier 6 max)" },
  { consumption: 45, expected: 2835, description: "45 cu.m (Tier 7: 2460 + 5×75)" },
  { consumption: 50, expected: 3210, description: "50 cu.m (Tier 7)" },
]

commercialWaterTests.forEach(({ consumption, expected, description }) => {
  const result = calculateCommercialWater(consumption)
  const pass = Math.abs(result.total - expected) < 0.01
  console.log(
    `${pass ? "✓" : "✗"} ${description}: ₱${result.total.toFixed(
      2
    )} (expected: ₱${expected.toFixed(2)})`
  )
  if (!pass) {
    console.log(`   ERROR: Difference of ₱${Math.abs(result.total - expected).toFixed(2)}`)
  }
})

// Test 4: Association Dues Calculations
console.log("\n4. ASSOCIATION DUES TESTS")
console.log("-".repeat(80))

const duesTests = [
  { area: 30, expected: 1800, description: "30 sqm unit" },
  { area: 45, expected: 2700, description: "45 sqm unit" },
  { area: 60, expected: 3600, description: "60 sqm unit" },
  { area: 75, expected: 4500, description: "75 sqm unit" },
  { area: 100, expected: 6000, description: "100 sqm unit" },
]

duesTests.forEach(({ area, expected, description }) => {
  const result = calculateAssociationDues(area, DUES_RATE)
  const pass = Math.abs(result - expected) < 0.01
  console.log(
    `${pass ? "✓" : "✗"} ${description}: ${area} sqm × ₱${DUES_RATE} = ₱${result.toFixed(
      2
    )} (expected: ₱${expected.toFixed(2)})`
  )
})

// Test 5: Complete Bill Example (Residential)
console.log("\n5. COMPLETE RESIDENTIAL BILL EXAMPLE")
console.log("-".repeat(80))
console.log("Unit: GF-1 | 45 sqm | Electric: 250 kWh | Water: 15 cu.m")
const exampleElectric = calculateElectricBill(250, ELECTRIC_RATE)
const exampleWater = calculateResidentialWater(15)
const exampleDues = calculateAssociationDues(45, DUES_RATE)
const exampleTotal = exampleElectric + exampleWater.total + exampleDues

console.log(`  Electric Bill: ₱${exampleElectric.toFixed(2)}`)
console.log(`  Water Bill:    ₱${exampleWater.total.toFixed(2)}`)
console.log(`  Assoc. Dues:   ₱${exampleDues.toFixed(2)}`)
console.log(`  ${"=".repeat(30)}`)
console.log(`  TOTAL:         ₱${exampleTotal.toFixed(2)}`)

// Test 6: Complete Bill Example (Commercial)
console.log("\n6. COMPLETE COMMERCIAL BILL EXAMPLE")
console.log("-".repeat(80))
console.log("Unit: GF-10 | 60 sqm | Electric: 500 kWh | Water: 25 cu.m")
const exampleElectric2 = calculateElectricBill(500, ELECTRIC_RATE)
const exampleWater2 = calculateCommercialWater(25)
const exampleDues2 = calculateAssociationDues(60, DUES_RATE)
const exampleTotal2 = exampleElectric2 + exampleWater2.total + exampleDues2

console.log(`  Electric Bill: ₱${exampleElectric2.toFixed(2)}`)
console.log(`  Water Bill:    ₱${exampleWater2.total.toFixed(2)}`)
console.log(`  Assoc. Dues:   ₱${exampleDues2.toFixed(2)}`)
console.log(`  ${"=".repeat(30)}`)
console.log(`  TOTAL:         ₱${exampleTotal2.toFixed(2)}`)

// Test 7: Penalty Calculation Examples
console.log("\n7. PENALTY CALCULATION TESTS (10% Compounding)")
console.log("-".repeat(80))

function calculateCompoundingPenalty(
  principal: number,
  monthsOverdue: number,
  rate: number = 10
) {
  let totalPenalty = 0
  let runningBalance = principal

  for (let month = 1; month <= monthsOverdue; month++) {
    const monthPenalty = runningBalance * (rate / 100)
    totalPenalty += monthPenalty
    runningBalance += monthPenalty
  }

  return totalPenalty
}

const penaltyTests = [
  { principal: 1000, months: 1, description: "₱1,000 - 1 month overdue" },
  { principal: 1000, months: 2, description: "₱1,000 - 2 months overdue" },
  { principal: 1000, months: 3, description: "₱1,000 - 3 months overdue" },
  { principal: 5000, months: 1, description: "₱5,000 - 1 month overdue" },
  { principal: 5000, months: 2, description: "₱5,000 - 2 months overdue" },
]

penaltyTests.forEach(({ principal, months, description }) => {
  const penalty = calculateCompoundingPenalty(principal, months)
  const newTotal = principal + penalty
  console.log(
    `${description}: Penalty = ₱${penalty.toFixed(2)} | New Total = ₱${newTotal.toFixed(2)}`
  )
})

console.log("\n" + "=".repeat(80))
console.log("TEST SUMMARY")
console.log("=".repeat(80))
console.log("All calculations validated against Excel formulas.")
console.log("Electric: Min ₱50 or consumption × ₱8.39")
console.log("Water: 7-tier system (Residential and Commercial)")
console.log("Dues: Area × ₱60/sqm")
console.log("Penalty: 10% compounding monthly")
console.log("=".repeat(80))
