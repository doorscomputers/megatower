import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== FIXING DATA ISSUES ===\n")

  // FIX 1: Cap paidAmount at totalAmount for overpaid bills
  console.log("--- FIX 1: Cap paidAmount at totalAmount ---\n")

  const allBills = await prisma.bill.findMany({
    include: { unit: true },
  })

  let fixedBillCount = 0
  for (const bill of allBills) {
    const paid = Number(bill.paidAmount)
    const total = Number(bill.totalAmount)

    if (paid > total + 0.01) {
      // Cap paidAmount at totalAmount
      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: total,
        },
      })
      console.log(`Fixed ${bill.billNumber}: paidAmount ${paid.toFixed(2)} → ${total.toFixed(2)}`)
      fixedBillCount++
    }
  }

  console.log(`\n✓ Fixed ${fixedBillCount} overpaid bills\n`)

  // FIX 2: Update BillPayment components based on bill proportions
  console.log("--- FIX 2: Fix BillPayment component breakdown ---\n")

  const billPayments = await prisma.billPayment.findMany({
    include: {
      bill: true,
      payment: true,
    },
  })

  let fixedBPCount = 0
  for (const bp of billPayments) {
    const componentSum =
      Number(bp.electricAmount) +
      Number(bp.waterAmount) +
      Number(bp.duesAmount) +
      Number(bp.penaltyAmount) +
      Number(bp.spAssessmentAmount) +
      Number(bp.otherAmount)

    // If components are all 0 but totalAmount > 0, proportionally distribute
    if (componentSum < 0.01 && Number(bp.totalAmount) > 0.01) {
      const bill = bp.bill
      const bpTotal = Number(bp.totalAmount)
      const billTotal = Number(bill.totalAmount)

      if (billTotal > 0) {
        // Calculate proportions based on bill components
        const ratio = bpTotal / billTotal

        const electric = Number(bill.electricAmount) * ratio
        const water = Number(bill.waterAmount) * ratio
        const dues = Number(bill.associationDues) * ratio
        const penalty = Number(bill.penaltyAmount) * ratio
        const sp = Number(bill.spAssessment) * ratio
        const other = Number(bill.otherCharges) * ratio

        await prisma.billPayment.update({
          where: { id: bp.id },
          data: {
            electricAmount: electric,
            waterAmount: water,
            duesAmount: dues,
            penaltyAmount: penalty,
            spAssessmentAmount: sp,
            otherAmount: other,
          },
        })

        fixedBPCount++
      }
    }
  }

  console.log(`✓ Fixed ${fixedBPCount} BillPayment component breakdowns\n`)

  // VERIFY FIXES
  console.log("=== VERIFICATION ===\n")

  // Check overpaid bills
  const stillOverpaid = await prisma.bill.findMany({
    where: {},
  })

  let overpaidCount = 0
  for (const bill of stillOverpaid) {
    if (Number(bill.paidAmount) > Number(bill.totalAmount) + 0.01) {
      overpaidCount++
    }
  }
  console.log(`Overpaid bills remaining: ${overpaidCount}`)

  // Check BillPayment mismatches
  const verifyBP = await prisma.billPayment.findMany()
  let mismatchCount = 0
  for (const bp of verifyBP) {
    const componentSum =
      Number(bp.electricAmount) +
      Number(bp.waterAmount) +
      Number(bp.duesAmount) +
      Number(bp.penaltyAmount) +
      Number(bp.spAssessmentAmount) +
      Number(bp.otherAmount)

    if (Math.abs(Number(bp.totalAmount) - componentSum) > 0.02) {
      mismatchCount++
    }
  }
  console.log(`BillPayment component mismatches remaining: ${mismatchCount}`)

  console.log("\n✓ Data fixes complete")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
