import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface TestResult {
  test: string
  status: "PASS" | "FAIL" | "SKIP"
  details: string
}

const results: TestResult[] = []

function log(test: string, status: "PASS" | "FAIL" | "SKIP", details: string) {
  results.push({ test, status, details })
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️"
  console.log(`${icon} ${test}: ${details}`)
}

async function main() {
  console.log("\n" + "=".repeat(70))
  console.log("BILL GENERATION COMPREHENSIVE TESTING")
  console.log("=".repeat(70) + "\n")

  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })
  if (!tenant || !tenant.settings) {
    console.log("ERROR: No tenant or settings found!")
    return
  }

  // =============================================
  // TEST 1: BILL NUMBER SEQUENCE
  // =============================================
  console.log("--- TEST 1: Bill Number Sequence ---\n")

  const bills = await prisma.bill.findMany({
    where: { tenantId: tenant.id, billType: { not: "OPENING_BALANCE" } },
    orderBy: [{ billingMonth: "asc" }, { createdAt: "asc" }],
    select: { billNumber: true, billingMonth: true },
  })

  // Check bill numbers follow pattern MT-YYYYMM-XXXX
  let sequenceErrors = 0
  const billNumberPattern = /^MT-\d{6}-\d{4}$/

  for (const bill of bills) {
    if (!billNumberPattern.test(bill.billNumber)) {
      sequenceErrors++
      if (sequenceErrors <= 3) {
        console.log(`   Invalid format: ${bill.billNumber}`)
      }
    }
  }

  // Check for duplicate bill numbers
  const billNumberSet = new Set<string>()
  let duplicates: string[] = []
  for (const bill of bills) {
    if (billNumberSet.has(bill.billNumber)) {
      duplicates.push(bill.billNumber)
    }
    billNumberSet.add(bill.billNumber)
  }

  if (sequenceErrors === 0 && duplicates.length === 0) {
    log("Bill Number Sequence", "PASS", `All ${bills.length} bills have valid unique numbers`)
  } else if (duplicates.length > 0) {
    log("Bill Number Sequence", "FAIL", `Found ${duplicates.length} duplicate bill numbers`)
  } else {
    log("Bill Number Sequence", "FAIL", `${sequenceErrors} bills have invalid number format`)
  }

  // =============================================
  // TEST 2: BILL COMPONENT CALCULATIONS
  // =============================================
  console.log("\n--- TEST 2: Bill Component Sum Verification ---\n")

  const allBills = await prisma.bill.findMany({
    where: { tenantId: tenant.id },
    take: 100,
  })

  let componentErrors = 0
  for (const bill of allBills) {
    // Total should = sum of components
    const componentSum =
      Number(bill.electricAmount) +
      Number(bill.waterAmount) +
      Number(bill.associationDues) +
      Number(bill.penaltyAmount) +
      Number(bill.spAssessment) +
      Number(bill.otherCharges) -
      Number(bill.advanceDuesApplied) -
      Number(bill.advanceUtilApplied)

    // Note: Total includes discounts and adjustments
    const total = Number(bill.totalAmount)
    const diff = Math.abs(total - componentSum)

    // Allow for discount difference
    if (diff > Number(bill.discountAmount) + 0.01) {
      componentErrors++
      if (componentErrors <= 3) {
        console.log(`   ${bill.billNumber}: Sum=${componentSum.toFixed(2)}, Total=${total.toFixed(2)}, Discount=${Number(bill.discountAmount).toFixed(2)}`)
      }
    }
  }

  if (componentErrors === 0) {
    log("Bill Component Sum", "PASS", "All bill totals match component sums")
  } else {
    log("Bill Component Sum", "FAIL", `${componentErrors} bills have component mismatches`)
  }

  // =============================================
  // TEST 3: WATER TIER CALCULATIONS
  // =============================================
  console.log("\n--- TEST 3: Water Tier Rate Verification ---\n")

  // Get water settings
  const settings = tenant.settings

  // Check if residential tiers are configured properly (ascending order)
  const resTiers = [
    { max: Number(settings.waterResTier1Max), rate: Number(settings.waterResTier1Rate) },
    { max: Number(settings.waterResTier2Max), rate: Number(settings.waterResTier2Rate) },
    { max: Number(settings.waterResTier3Max), rate: Number(settings.waterResTier3Rate) },
    { max: Number(settings.waterResTier4Max), rate: Number(settings.waterResTier4Rate) },
    { max: Number(settings.waterResTier5Max), rate: Number(settings.waterResTier5Rate) },
    { max: Number(settings.waterResTier6Max), rate: Number(settings.waterResTier6Rate) },
  ]

  let tierConfigOk = true
  for (let i = 1; i < resTiers.length; i++) {
    if (resTiers[i].max <= resTiers[i - 1].max) {
      tierConfigOk = false
      console.log(`   Tier ${i + 1} max (${resTiers[i].max}) <= Tier ${i} max (${resTiers[i - 1].max})`)
    }
  }

  if (tierConfigOk) {
    log("Water Tier Config", "PASS", "All tier boundaries are in ascending order")
  } else {
    log("Water Tier Config", "FAIL", "Tier boundaries are not properly ordered")
  }

  // =============================================
  // TEST 4: ELECTRIC MINIMUM CHARGE
  // =============================================
  console.log("\n--- TEST 4: Electric Minimum Charge ---\n")

  const electricBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      electricAmount: { gt: 0 },
    },
    include: { unit: true },
  })

  const minCharge = 50 // ₱50 minimum
  let minChargeErrors = 0

  for (const bill of electricBills) {
    const electricAmount = Number(bill.electricAmount)
    if (electricAmount < minCharge - 0.01 && electricAmount > 0) {
      minChargeErrors++
      if (minChargeErrors <= 3) {
        console.log(`   ${bill.billNumber}: Electric ₱${electricAmount.toFixed(2)} < minimum ₱${minCharge}`)
      }
    }
  }

  if (minChargeErrors === 0) {
    log("Electric Minimum Charge", "PASS", "All electric bills meet minimum charge requirement")
  } else {
    log("Electric Minimum Charge", "FAIL", `${minChargeErrors} bills below minimum charge`)
  }

  // =============================================
  // TEST 5: ASSOCIATION DUES CALCULATION
  // =============================================
  console.log("\n--- TEST 5: Association Dues Verification ---\n")

  const duesRate = Number(settings.associationDuesRate)
  const billsWithDues = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      associationDues: { gt: 0 },
      billType: { not: "OPENING_BALANCE" },
    },
    include: { unit: true },
    take: 50,
  })

  let duesErrors = 0
  for (const bill of billsWithDues) {
    const area = Number(bill.unit.area)
    const expectedDues = area * duesRate
    const actualDues = Number(bill.associationDues)
    const diff = Math.abs(expectedDues - actualDues)

    if (diff > 0.01) {
      duesErrors++
      if (duesErrors <= 3) {
        console.log(`   ${bill.billNumber}: Area=${area}, Expected=₱${expectedDues.toFixed(2)}, Actual=₱${actualDues.toFixed(2)}`)
      }
    }
  }

  if (duesErrors === 0) {
    log("Association Dues Calculation", "PASS", "All dues match area × rate calculation")
  } else {
    log("Association Dues Calculation", "FAIL", `${duesErrors} bills have dues calculation errors`)
  }

  // =============================================
  // TEST 6: OPENING BALANCE BILLS
  // =============================================
  console.log("\n--- TEST 6: Opening Balance Bills ---\n")

  const openingBills = await prisma.bill.findMany({
    where: { tenantId: tenant.id, billType: "OPENING_BALANCE" },
    include: { unit: true },
  })

  let obErrors = 0
  for (const bill of openingBills) {
    // Opening balance should have total = balance + paid
    const balance = Number(bill.balance)
    const paid = Number(bill.paidAmount)
    const total = Number(bill.totalAmount)

    if (Math.abs(total - (balance + paid)) > 0.01) {
      obErrors++
      if (obErrors <= 3) {
        console.log(`   ${bill.billNumber}: Total=${total.toFixed(2)} != Balance=${balance.toFixed(2)} + Paid=${paid.toFixed(2)}`)
      }
    }
  }

  if (obErrors === 0) {
    log("Opening Balance Bills", "PASS", `All ${openingBills.length} opening balance bills are consistent`)
  } else {
    log("Opening Balance Bills", "FAIL", `${obErrors} opening balance bills have calculation errors`)
  }

  // =============================================
  // TEST 7: ONE BILL PER UNIT PER MONTH
  // =============================================
  console.log("\n--- TEST 7: One Bill Per Unit Per Month ---\n")

  const billsByUnitMonth = await prisma.$queryRaw<{ unitId: string; billingMonth: Date; count: number }[]>`
    SELECT "unitId", "billingMonth", COUNT(*) as count
    FROM "Bill"
    WHERE "tenantId" = ${tenant.id} AND "billType" != 'OPENING_BALANCE'
    GROUP BY "unitId", "billingMonth"
    HAVING COUNT(*) > 1
  `

  if (billsByUnitMonth.length === 0) {
    log("One Bill Per Unit Per Month", "PASS", "No duplicate bills per unit per month")
  } else {
    log("One Bill Per Unit Per Month", "FAIL", `${billsByUnitMonth.length} unit-month combinations have multiple bills`)
    billsByUnitMonth.slice(0, 3).forEach((dup) => {
      console.log(`   Unit: ${dup.unitId}, Month: ${dup.billingMonth}, Count: ${dup.count}`)
    })
  }

  // =============================================
  // TEST 8: BALANCE CALCULATION
  // =============================================
  console.log("\n--- TEST 8: Bill Balance Calculation ---\n")

  let balanceErrors = 0
  for (const bill of allBills) {
    const total = Number(bill.totalAmount)
    const paid = Number(bill.paidAmount)
    const balance = Number(bill.balance)
    const expected = Math.max(0, total - paid)

    if (Math.abs(balance - expected) > 0.01) {
      balanceErrors++
      if (balanceErrors <= 3) {
        console.log(`   ${bill.billNumber}: Balance=${balance.toFixed(2)}, Expected=${expected.toFixed(2)} (Total=${total.toFixed(2)} - Paid=${paid.toFixed(2)})`)
      }
    }
  }

  if (balanceErrors === 0) {
    log("Bill Balance Calculation", "PASS", "All bills have correct balance = total - paid")
  } else {
    log("Bill Balance Calculation", "FAIL", `${balanceErrors} bills have incorrect balance calculations`)
  }

  // =============================================
  // SUMMARY
  // =============================================
  console.log("\n" + "=".repeat(70))
  console.log("BILL GENERATION TEST SUMMARY")
  console.log("=".repeat(70))

  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  const skipped = results.filter((r) => r.status === "SKIP").length

  console.log(`\n✅ PASSED:  ${passed}`)
  console.log(`❌ FAILED:  ${failed}`)
  console.log(`⏭️ SKIPPED: ${skipped}`)
  console.log(`   TOTAL:   ${results.length}`)

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:")
    results.filter((r) => r.status === "FAIL").forEach((r) => console.log(`   - ${r.test}: ${r.details}`))
  }

  console.log("\n" + "=".repeat(70) + "\n")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
