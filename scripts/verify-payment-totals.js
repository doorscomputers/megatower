const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function verifyUnit(unitNumber) {
  const unit = await p.unit.findFirst({ where: { unitNumber } })

  console.log(`\n=== ${unitNumber} Verification ===`)

  // Get all bills
  const bills = await p.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  const totalBillAmount = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0)

  // Get all payments
  const payments = await p.payment.findMany({
    where: { unitId: unit.id },
    orderBy: { paymentDate: 'asc' }
  })

  let totalPaymentAmount = 0
  let totalAdvanceAmount = 0

  console.log('\nPayments:')
  for (const pay of payments) {
    const advance = Number(pay.advanceDuesAmount) + Number(pay.advanceUtilAmount) + Number(pay.otherAdvanceAmount || 0)
    const billPayment = Number(pay.totalAmount) - advance
    totalPaymentAmount += billPayment
    totalAdvanceAmount += advance
    console.log(`  OR#${pay.orNumber}: Total=₱${Number(pay.totalAmount).toFixed(2)} (Bill=₱${billPayment.toFixed(2)}, Advance=₱${advance.toFixed(2)})`)
  }

  console.log('\nBills:')
  for (const b of bills) {
    console.log(`  ${b.billingMonth.toISOString().slice(0,7)}: Total=₱${Number(b.totalAmount).toFixed(2)}, Balance=₱${Number(b.balance).toFixed(2)}`)
  }

  const expectedBalance = totalBillAmount - totalPaymentAmount
  const actualBalance = bills.reduce((sum, b) => sum + Number(b.balance), 0)

  console.log('\n--- Summary ---')
  console.log(`Total Bill Amount: ₱${totalBillAmount.toFixed(2)}`)
  console.log(`Total Payment (for bills): ₱${totalPaymentAmount.toFixed(2)}`)
  console.log(`Total Advance: ₱${totalAdvanceAmount.toFixed(2)}`)
  console.log(`Expected Balance: ₱${expectedBalance.toFixed(2)}`)
  console.log(`Actual Balance: ₱${actualBalance.toFixed(2)}`)
  console.log(`Match: ${Math.abs(expectedBalance - actualBalance) < 0.01 ? '✓ YES' : '✗ NO'}`)
}

async function main() {
  await verifyUnit('M2-2F-16')
  await verifyUnit('M2-2F-17')
  await verifyUnit('M2-2F-5')
  await p.$disconnect()
}

main().catch(console.error)
