import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== FIXING REMAINING BILLPAYMENT MISMATCHES ===\n")

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

    const diff = Math.abs(Number(bp.totalAmount) - componentSum)

    if (diff > 0.02) {
      console.log(`Fixing: Bill ${bp.bill?.billNumber}, Payment ${bp.payment?.orNumber}`)
      console.log(`  Total: ${Number(bp.totalAmount).toFixed(2)}, Sum: ${componentSum.toFixed(2)}`)

      const bill = bp.bill
      const bpTotal = Number(bp.totalAmount)

      if (bill) {
        // Calculate components based on bill proportions
        const billTotal = Number(bill.totalAmount)

        if (billTotal > 0) {
          const ratio = bpTotal / billTotal

          // Calculate proportional amounts
          let electric = Number(bill.electricAmount) * ratio
          let water = Number(bill.waterAmount) * ratio
          let dues = Number(bill.associationDues) * ratio
          let penalty = Number(bill.penaltyAmount) * ratio
          let sp = Number(bill.spAssessment) * ratio
          let other = Number(bill.otherCharges) * ratio

          // Adjust to ensure sum equals totalAmount exactly
          const newSum = electric + water + dues + penalty + sp + other
          const adjustment = bpTotal - newSum

          // Add adjustment to the largest component
          if (dues >= electric && dues >= water && dues >= sp) {
            dues += adjustment
          } else if (electric >= water && electric >= sp) {
            electric += adjustment
          } else if (water >= sp) {
            water += adjustment
          } else {
            sp += adjustment
          }

          await prisma.billPayment.update({
            where: { id: bp.id },
            data: {
              electricAmount: Math.max(0, electric),
              waterAmount: Math.max(0, water),
              duesAmount: Math.max(0, dues),
              penaltyAmount: Math.max(0, penalty),
              spAssessmentAmount: Math.max(0, sp),
              otherAmount: Math.max(0, other),
            },
          })

          fixed++
          console.log(`  Fixed with proportional allocation\n`)
        }
      }
    }
  }

  console.log(`\n✓ Fixed ${fixed} remaining BillPayment records`)

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

    if (Math.abs(Number(bp.totalAmount) - componentSum) > 0.02) {
      stillMismatched++
    }
  }
  console.log(`Remaining mismatches: ${stillMismatched}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
