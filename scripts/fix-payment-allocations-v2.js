const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

/**
 * This script fixes payment allocations by using TOTAL amount FIFO allocation.
 * It doesn't try to allocate by component since payment components don't match bill components.
 */

async function fixAllPaymentAllocations() {
  console.log('=== FIXING ALL PAYMENT ALLOCATIONS (TOTAL-based FIFO) ===\n')

  // Get all tenants
  const tenants = await p.tenant.findMany()

  for (const tenant of tenants) {
    console.log(`\nProcessing tenant: ${tenant.name}`)

    // Get all units for this tenant
    const units = await p.unit.findMany({
      where: { tenantId: tenant.id },
      orderBy: { unitNumber: 'asc' }
    })

    for (const unit of units) {
      await fixUnitPayments(unit)
    }
  }

  console.log('\n=== DONE ===')
  await p.$disconnect()
}

async function fixUnitPayments(unit) {
  // Get all bills for this unit
  const bills = await p.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  if (bills.length === 0) return

  // Get all payments for this unit (excluding advance-only payments)
  const payments = await p.payment.findMany({
    where: { unitId: unit.id },
    orderBy: { paymentDate: 'asc' }
  })

  if (payments.length === 0) return

  console.log(`\n  Unit ${unit.unitNumber}: ${bills.length} bills, ${payments.length} payments`)

  // Delete existing BillPayment records for this unit's bills
  await p.billPayment.deleteMany({
    where: {
      bill: { unitId: unit.id }
    }
  })

  // Reset all bills to unpaid
  for (const bill of bills) {
    await p.bill.update({
      where: { id: bill.id },
      data: {
        paidAmount: 0,
        balance: Number(bill.totalAmount),
        status: 'UNPAID'
      }
    })
  }

  // Calculate total payment amount (excluding advances)
  for (const payment of payments) {
    // Total amount to allocate to bills = total - advance amounts
    const advanceAmount = Number(payment.advanceDuesAmount) + Number(payment.advanceUtilAmount) + Number(payment.otherAdvanceAmount || 0)
    let remainingAmount = Number(payment.totalAmount) - advanceAmount

    // Get current unpaid bills in FIFO order
    const unpaidBills = await p.bill.findMany({
      where: {
        unitId: unit.id,
        status: { in: ['UNPAID', 'PARTIAL'] }
      },
      orderBy: { billingMonth: 'asc' }
    })

    for (const bill of unpaidBills) {
      if (remainingAmount <= 0) break

      const currentBalance = Number(bill.balance)
      const allocAmount = Math.min(remainingAmount, currentBalance)

      if (allocAmount > 0) {
        // Create BillPayment record
        await p.billPayment.create({
          data: {
            paymentId: payment.id,
            billId: bill.id,
            electricAmount: 0,
            waterAmount: 0,
            duesAmount: 0,
            penaltyAmount: 0,
            spAssessmentAmount: 0,
            otherAmount: 0,
            totalAmount: allocAmount
          }
        })

        // Update bill
        const newPaidAmount = Number(bill.paidAmount) + allocAmount
        const newBalance = Number(bill.totalAmount) - newPaidAmount
        const newStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIAL'

        await p.bill.update({
          where: { id: bill.id },
          data: {
            paidAmount: newPaidAmount,
            balance: Math.max(0, newBalance),
            status: newStatus
          }
        })

        remainingAmount -= allocAmount
      }
    }

    // Log any remaining (should go to advance)
    if (remainingAmount > 0.01) {
      console.log(`    Payment OR#${payment.orNumber}: ₱${remainingAmount.toFixed(2)} excess (advance)`)
    }
  }

  // Log final state
  const updatedBills = await p.bill.findMany({
    where: { unitId: unit.id, status: { in: ['PARTIAL', 'UNPAID'] } },
    orderBy: { billingMonth: 'asc' }
  })

  if (updatedBills.length > 0) {
    console.log(`    Remaining unpaid/partial bills:`)
    for (const b of updatedBills) {
      console.log(`      ${b.billingMonth.toISOString().slice(0,7)}: Balance=₱${Number(b.balance).toFixed(2)}`)
    }
  }
}

fixAllPaymentAllocations().catch(console.error)
