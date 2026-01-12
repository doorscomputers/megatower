const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixUnit(unit) {
  // Get all bills for this unit, ordered by date (oldest first)
  const bills = await prisma.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  // Get all payments for this unit, ordered by date (oldest first)
  const payments = await prisma.payment.findMany({
    where: { unitId: unit.id },
    orderBy: { paymentDate: 'asc' }
  })

  if (payments.length === 0 || bills.length === 0) return false

  // Check if there's an issue: older bill unpaid but newer paid, or overpayment on a bill
  let hasIssue = false
  let lastPaidMonth = null
  for (const bill of bills) {
    const isPaid = bill.status === 'PAID' || Number(bill.balance) <= 0
    const isOverpaid = Number(bill.paidAmount) > Number(bill.totalAmount)

    if (isPaid) lastPaidMonth = bill.billingMonth
    if (isOverpaid) hasIssue = true

    // Check if this unpaid bill is older than a paid bill
    if (!isPaid && lastPaidMonth) {
      hasIssue = true
    }
  }

  if (!hasIssue) return false

  console.log(`\n--- Fixing ${unit.unitNumber} ---`)

  // Delete all existing BillPayment records
  const paymentIds = payments.map(p => p.id)
  await prisma.billPayment.deleteMany({
    where: { paymentId: { in: paymentIds } }
  })

  // Reset all bills
  for (const bill of bills) {
    await prisma.bill.update({
      where: { id: bill.id },
      data: { paidAmount: 0, balance: bill.totalAmount, status: 'UNPAID' }
    })
  }

  // Delete advance balance
  await prisma.unitAdvanceBalance.deleteMany({
    where: { unitId: unit.id }
  })

  // Reallocate payments using FIFO
  const refreshedBills = await prisma.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  const billBalances = {}
  for (const b of refreshedBills) {
    billBalances[b.id] = Number(b.totalAmount)
  }

  let totalAdvance = 0

  for (const payment of payments) {
    let remainingPayment = Number(payment.totalAmount)

    for (const bill of refreshedBills) {
      if (remainingPayment <= 0) break

      const billBalance = billBalances[bill.id]
      if (billBalance <= 0) continue

      const allocation = Math.min(remainingPayment, billBalance)

      await prisma.billPayment.create({
        data: {
          paymentId: payment.id,
          billId: bill.id,
          electricAmount: 0,
          waterAmount: 0,
          duesAmount: 0,
          penaltyAmount: 0,
          spAssessmentAmount: 0,
          otherAmount: 0,
          totalAmount: allocation
        }
      })

      // Update bill
      const currentBill = await prisma.bill.findUnique({ where: { id: bill.id } })
      const newPaidAmount = Number(currentBill.paidAmount) + allocation
      const newBalance = Number(bill.totalAmount) - newPaidAmount
      const newStatus = newBalance <= 0 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : 'UNPAID')

      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          balance: Math.max(0, newBalance),
          status: newStatus
        }
      })

      billBalances[bill.id] -= allocation
      remainingPayment -= allocation
    }

    if (remainingPayment > 0) {
      totalAdvance += remainingPayment
    }
  }

  // Create advance balance if any
  if (totalAdvance > 0) {
    const tenant = await prisma.tenant.findFirst()
    await prisma.unitAdvanceBalance.create({
      data: {
        tenantId: tenant.id,
        unitId: unit.id,
        advanceDues: totalAdvance,
        advanceUtilities: 0
      }
    })
  }

  // Show results
  const finalBills = await prisma.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  let totalBalance = 0
  for (const b of finalBills) {
    totalBalance += Number(b.balance)
  }
  console.log(`  Total Balance: ₱${totalBalance.toFixed(2)}${totalAdvance > 0 ? `, Advance: ₱${totalAdvance.toFixed(2)}` : ''}`)

  return true
}

async function main() {
  console.log('=== FIXING ALL PAYMENT ALLOCATIONS ===\n')

  const tenant = await prisma.tenant.findFirst()
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { unitNumber: 'asc' }
  })

  let fixedCount = 0

  for (const unit of units) {
    const fixed = await fixUnit(unit)
    if (fixed) fixedCount++
  }

  console.log(`\n=== COMPLETE ===`)
  console.log(`Fixed ${fixedCount} units`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
