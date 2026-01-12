const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function checkBillPayments(unitNumber) {
  const unit = await p.unit.findFirst({ where: { unitNumber } })

  console.log(`\n=== ${unitNumber} BillPayment Allocations ===`)

  // Get all bill payments for this unit
  const billPayments = await p.billPayment.findMany({
    where: {
      bill: { unitId: unit.id }
    },
    include: {
      payment: true,
      bill: true
    },
    orderBy: [
      { bill: { billingMonth: 'asc' } },
      { payment: { paymentDate: 'asc' } }
    ]
  })

  for (const bp of billPayments) {
    const billMonth = bp.bill.billingMonth.toISOString().slice(0,7)
    console.log(`\nBill ${billMonth} <- Payment OR#${bp.payment.orNumber} (${bp.payment.paymentDate.toISOString().slice(0,10)})`)
    console.log(`  Allocated: E=${Number(bp.electricAmount).toFixed(2)}, W=${Number(bp.waterAmount).toFixed(2)}, D=${Number(bp.duesAmount).toFixed(2)}, P=${Number(bp.penaltyAmount).toFixed(2)}, SP=${Number(bp.spAssessmentAmount).toFixed(2)}`)
    console.log(`  Total Allocated: ₱${Number(bp.totalAmount).toFixed(2)}`)
    console.log(`  Bill Total: ₱${Number(bp.bill.totalAmount).toFixed(2)}, Bill SP: ₱${Number(bp.bill.spAssessment).toFixed(2)}`)
  }

  // Summary
  const bills = await p.bill.findMany({
    where: { unitId: unit.id, status: { in: ['PARTIAL', 'UNPAID'] } },
    orderBy: { billingMonth: 'asc' }
  })

  if (bills.length > 0) {
    console.log(`\n--- Unpaid Bills Summary ---`)
    for (const b of bills) {
      console.log(`${b.billingMonth.toISOString().slice(0,7)}: Balance=₱${Number(b.balance).toFixed(2)} (SP Assessment=₱${Number(b.spAssessment).toFixed(2)})`)
    }
  }
}

async function main() {
  await checkBillPayments('M2-2F-16')
  await checkBillPayments('M2-2F-17')
  await p.$disconnect()
}

main().catch(console.error)
