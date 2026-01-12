const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== CHECKING ALL UNITS FOR PAYMENT ALLOCATION ISSUES ===\n')

  const tenant = await prisma.tenant.findFirst()
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id, isActive: true, unitNumber: { startsWith: 'M2-2F' } },
    orderBy: { unitNumber: 'asc' }
  })

  const problemUnits = []

  for (const unit of units) {
    // Get bills ordered by date
    const bills = await prisma.bill.findMany({
      where: { unitId: unit.id },
      orderBy: { billingMonth: 'asc' }
    })

    // Get payments ordered by date
    const payments = await prisma.payment.findMany({
      where: { unitId: unit.id },
      orderBy: { paymentDate: 'asc' }
    })

    if (payments.length === 0) continue

    // Check if older bills are unpaid while newer bills are paid
    let foundPaidBill = false
    let hasIssue = false

    for (const bill of bills) {
      const isPaid = bill.status === 'PAID' || Number(bill.balance) === 0

      if (isPaid) {
        foundPaidBill = true
      } else if (foundPaidBill && Number(bill.balance) > 0) {
        // Older unpaid bill exists after a paid bill - this is the issue
        hasIssue = true
        break
      }
    }

    // Also check: if total payments > total bills paid amounts
    const totalPayments = payments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
    const totalPaidOnBills = bills.reduce((sum, b) => sum + Number(b.paidAmount), 0)
    const totalBillAmount = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
    const totalBalance = bills.reduce((sum, b) => sum + Number(b.balance), 0)

    // Check for overpayment that should have been applied
    const unpaidBills = bills.filter(b => Number(b.balance) > 0)
    const paidBills = bills.filter(b => Number(b.paidAmount) > Number(b.totalAmount))

    if (paidBills.length > 0 && unpaidBills.length > 0) {
      hasIssue = true
    }

    // Also check if paidAmount on any bill exceeds totalAmount
    for (const bill of bills) {
      if (Number(bill.paidAmount) > Number(bill.totalAmount)) {
        hasIssue = true
        break
      }
    }

    if (hasIssue || unpaidBills.length > 0) {
      const oldestUnpaid = unpaidBills.length > 0 ? unpaidBills[0].billingMonth.toISOString().slice(0,7) : null

      if (hasIssue) {
        problemUnits.push({
          unit: unit.unitNumber,
          totalPayments,
          totalPaidOnBills,
          totalBalance,
          hasOlderUnpaid: hasIssue,
          oldestUnpaid
        })
      }
    }
  }

  if (problemUnits.length === 0) {
    console.log('No payment allocation issues found!')
  } else {
    console.log('UNITS WITH POTENTIAL PAYMENT ALLOCATION ISSUES:\n')
    for (const p of problemUnits) {
      console.log(`${p.unit}: Payments=₱${p.totalPayments.toFixed(2)}, PaidOnBills=₱${p.totalPaidOnBills.toFixed(2)}, Balance=₱${p.totalBalance.toFixed(2)}, OldestUnpaid=${p.oldestUnpaid || 'none'}`)
    }
    console.log(`\nTotal problem units: ${problemUnits.length}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
