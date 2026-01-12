const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function checkPayments(unitNumber) {
  const unit = await p.unit.findFirst({ where: { unitNumber } })

  console.log(`\n=== ${unitNumber} Payment Analysis ===`)

  // Get all bills
  const bills = await p.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  // Get all payments with allocations
  const payments = await p.payment.findMany({
    where: { unitId: unit.id },
    include: {
      billPayments: {
        include: { bill: true }
      }
    },
    orderBy: { paymentDate: 'asc' }
  })

  console.log('\n--- Bills ---')
  for (const b of bills) {
    const month = b.billingMonth.toISOString().slice(0,7)
    console.log(`${month}: Total=${Number(b.totalAmount).toFixed(2)}, Paid=${Number(b.paidAmount).toFixed(2)}, Balance=${Number(b.balance).toFixed(2)}, Status=${b.status}`)
    if (Number(b.balance) > 0) {
      console.log(`  Components: E=${Number(b.electricAmount).toFixed(2)}, W=${Number(b.waterAmount).toFixed(2)}, D=${Number(b.associationDues).toFixed(2)}, SP=${Number(b.spAssessment).toFixed(2)}, P=${Number(b.penaltyAmount).toFixed(2)}`)
    }
  }

  console.log('\n--- Payments ---')
  for (const p of payments) {
    console.log(`${p.paymentDate.toISOString().slice(0,10)} OR#${p.orNumber}: ₱${Number(p.totalAmount).toFixed(2)}`)
    console.log(`  Components: E=${Number(p.electricAmount).toFixed(2)}, W=${Number(p.waterAmount).toFixed(2)}, D=${Number(p.duesAmount).toFixed(2)}, SP=${Number(p.spAssessmentAmount).toFixed(2)}, PD=${Number(p.pastDuesAmount).toFixed(2)}`)
    console.log(`  Advance: Dues=${Number(p.advanceDuesAmount).toFixed(2)}, Util=${Number(p.advanceUtilAmount).toFixed(2)}`)
  }
}

async function main() {
  await checkPayments('M2-2F-16')
  await checkPayments('M2-2F-17')
  await checkPayments('M2-2F-5')
  await p.$disconnect()
}

main().catch(console.error)
