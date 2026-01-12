import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== FIXING FINAL BILLPAYMENT ROUNDING ===\n")

  // Find all BillPayments with any mismatch
  const billPayments = await prisma.billPayment.findMany({
    include: {
      bill: true,
      payment: true,
    },
  })

  let fixed = 0
  for (const bp of billPayments) {
    const componentSum =
      Number(bp.electricAmount) +
      Number(bp.waterAmount) +
      Number(bp.duesAmount) +
      Number(bp.penaltyAmount) +
      Number(bp.spAssessmentAmount) +
      Number(bp.otherAmount)

    const total = Number(bp.totalAmount)
    const diff = total - componentSum

    // If there's a small difference (rounding), add it to dues
    if (Math.abs(diff) > 0.001 && Math.abs(diff) <= 0.02) {
      const newDues = Number(bp.duesAmount) + diff

      await prisma.billPayment.update({
        where: { id: bp.id },
        data: {
          duesAmount: newDues,
        },
      })

      fixed++
      console.log(`Fixed: Bill ${bp.bill?.billNumber}, diff was ${diff.toFixed(4)}`)
    }
  }

  console.log(`\n✓ Fixed ${fixed} BillPayment records with rounding differences`)

  // Verify
  const verifyBP = await prisma.billPayment.findMany()
  let stillMismatched = 0
  for (const bp of verifyBP) {
    const componentSum =
      Number(bp.electricAmount) +
      Number(bp.waterAmount) +
      Number(bp.duesAmount) +
      Number(bp.penaltyAmount) +
      Number(bp.spAssessmentAmount) +
      Number(bp.otherAmount)

    if (Math.abs(Number(bp.totalAmount) - componentSum) > 0.01) {
      stillMismatched++
    }
  }
  console.log(`Remaining mismatches: ${stillMismatched}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
