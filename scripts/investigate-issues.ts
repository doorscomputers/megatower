import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== INVESTIGATING REMAINING ISSUES ===\n")

  // ISSUE 1: BillPayment Component Sum Mismatch
  console.log("--- ISSUE 1: BillPayment Component Sum Mismatch ---\n")

  const billPayments = await prisma.billPayment.findMany({
    include: {
      payment: { select: { orNumber: true } },
      bill: { select: { billNumber: true } },
    },
  })

  let mismatchDetails: any[] = []
  for (const bp of billPayments) {
    const componentSum =
      Number(bp.electricAmount) +
      Number(bp.waterAmount) +
      Number(bp.duesAmount) +
      Number(bp.penaltyAmount) +
      Number(bp.spAssessmentAmount) +
      Number(bp.otherAmount)

    const diff = Math.abs(Number(bp.totalAmount) - componentSum)
    if (diff > 0.01) {
      mismatchDetails.push({
        bill: bp.bill?.billNumber,
        payment: bp.payment?.orNumber,
        components: componentSum.toFixed(2),
        total: Number(bp.totalAmount).toFixed(2),
        diff: diff.toFixed(2),
        electric: Number(bp.electricAmount),
        water: Number(bp.waterAmount),
        dues: Number(bp.duesAmount),
        penalty: Number(bp.penaltyAmount),
        sp: Number(bp.spAssessmentAmount),
        other: Number(bp.otherAmount),
      })
    }
  }

  console.log(`Found ${mismatchDetails.length} BillPayments with component sum mismatch\n`)

  // Show sample
  mismatchDetails.slice(0, 5).forEach((d) => {
    console.log(`Bill: ${d.bill}, Payment: ${d.payment}`)
    console.log(`  Components: E=${d.electric}, W=${d.water}, D=${d.dues}, P=${d.penalty}, SP=${d.sp}, O=${d.other}`)
    console.log(`  Sum: ${d.components}, Total: ${d.total}, Diff: ${d.diff}`)
    console.log()
  })

  // ISSUE 2: Overpaid Bills (paidAmount > total)
  console.log("--- ISSUE 2: Overpaid Bills ---\n")

  const allBills = await prisma.bill.findMany({
    include: { unit: true },
  })

  const overpaidBills = allBills.filter(
    (b) => Number(b.paidAmount) > Number(b.totalAmount) + 0.01
  )

  console.log(`Found ${overpaidBills.length} bills with paidAmount > totalAmount\n`)

  for (const bill of overpaidBills) {
    const overpayment = Number(bill.paidAmount) - Number(bill.totalAmount)
    console.log(`${bill.billNumber} (${bill.unit.unitNumber})`)
    console.log(`  Total: ₱${Number(bill.totalAmount).toFixed(2)}`)
    console.log(`  Paid: ₱${Number(bill.paidAmount).toFixed(2)}`)
    console.log(`  Balance: ₱${Number(bill.balance).toFixed(2)}`)
    console.log(`  Overpayment: ₱${overpayment.toFixed(2)}`)
    console.log(`  Status: ${bill.status}`)
    console.log()
  }

  // Check if these bills should just have their paidAmount corrected
  // If balance is 0 and status is PAID, paidAmount should equal totalAmount
  console.log("=== PROPOSED FIX ===\n")
  console.log("For overpaid bills, set paidAmount = totalAmount since balance = 0 and overpayment went to advance\n")

  // ISSUE 3: BillPayment issue analysis
  console.log("--- ANALYZING BillPayment Issue ---\n")

  // The difference might be coming from SP Assessment not being included
  // Let me check if there's a pattern
  const patterns: Record<string, number> = {}
  for (const d of mismatchDetails) {
    const diffKey = Number(d.diff).toFixed(2)
    patterns[diffKey] = (patterns[diffKey] || 0) + 1
  }

  console.log("Difference amounts frequency:")
  Object.entries(patterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([diff, count]) => {
      console.log(`  ₱${diff}: ${count} occurrences`)
    })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
