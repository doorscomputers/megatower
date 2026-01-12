const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

/**
 * This script fixes payment allocations by:
 * 1. Clearing all existing BillPayment records
 * 2. Resetting all bill paidAmount and balance
 * 3. Re-allocating payments with proper component tracking (FIFO)
 */

async function fixAllPaymentAllocations() {
  console.log('=== FIXING ALL PAYMENT ALLOCATIONS ===\n')

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

  // Get all payments for this unit
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
        balance: bill.totalAmount,
        status: 'UNPAID'
      }
    })
  }

  // Now allocate each payment using FIFO with component tracking
  for (const payment of payments) {
    await allocatePayment(payment, unit.id)
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

async function allocatePayment(payment, unitId) {
  // Get unpaid bills for FIFO allocation
  const unpaidBills = await p.bill.findMany({
    where: {
      unitId,
      status: { in: ['UNPAID', 'PARTIAL'] }
    },
    orderBy: { billingMonth: 'asc' },
    include: {
      payments: true  // Get existing BillPayment records
    }
  })

  // Track remaining amounts from this payment
  let remainingElectric = Number(payment.electricAmount)
  let remainingWater = Number(payment.waterAmount)
  let remainingDues = Number(payment.duesAmount)
  let remainingPenalty = Number(payment.pastDuesAmount)
  let remainingSP = Number(payment.spAssessmentAmount)

  // Allocate to bills in FIFO order
  for (const bill of unpaidBills) {
    if (remainingElectric <= 0 && remainingWater <= 0 && remainingDues <= 0 &&
        remainingPenalty <= 0 && remainingSP <= 0) {
      break
    }

    // Calculate already paid amounts on this bill
    const paidElectric = bill.payments.reduce((sum, bp) => sum + Number(bp.electricAmount), 0)
    const paidWater = bill.payments.reduce((sum, bp) => sum + Number(bp.waterAmount), 0)
    const paidDues = bill.payments.reduce((sum, bp) => sum + Number(bp.duesAmount), 0)
    const paidPenalty = bill.payments.reduce((sum, bp) => sum + Number(bp.penaltyAmount), 0)
    const paidSP = bill.payments.reduce((sum, bp) => sum + Number(bp.spAssessmentAmount), 0)

    // Calculate outstanding for each component
    const outstandingElectric = Math.max(0, Number(bill.electricAmount) - paidElectric)
    const outstandingWater = Math.max(0, Number(bill.waterAmount) - paidWater)
    const outstandingDues = Math.max(0, Number(bill.associationDues) - paidDues)
    const outstandingPenalty = Math.max(0, Number(bill.penaltyAmount) - paidPenalty)
    const outstandingSP = Math.max(0, Number(bill.spAssessment) - paidSP)

    // Allocate what we can
    const allocElectric = Math.min(remainingElectric, outstandingElectric)
    const allocWater = Math.min(remainingWater, outstandingWater)
    const allocDues = Math.min(remainingDues, outstandingDues)
    const allocPenalty = Math.min(remainingPenalty, outstandingPenalty)
    const allocSP = Math.min(remainingSP, outstandingSP)

    const allocTotal = allocElectric + allocWater + allocDues + allocPenalty + allocSP

    if (allocTotal > 0) {
      // Create BillPayment record with component breakdown
      await p.billPayment.create({
        data: {
          paymentId: payment.id,
          billId: bill.id,
          electricAmount: allocElectric,
          waterAmount: allocWater,
          duesAmount: allocDues,
          penaltyAmount: allocPenalty,
          spAssessmentAmount: allocSP,
          otherAmount: 0,
          totalAmount: allocTotal
        }
      })

      // Update bill
      const newPaidAmount = Number(bill.paidAmount) + allocTotal
      const newBalance = Number(bill.totalAmount) - newPaidAmount
      const newStatus = newBalance <= 0.01 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : 'UNPAID')

      await p.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          balance: Math.max(0, newBalance),
          status: newStatus
        }
      })

      // Reduce remaining
      remainingElectric -= allocElectric
      remainingWater -= allocWater
      remainingDues -= allocDues
      remainingPenalty -= allocPenalty
      remainingSP -= allocSP
    }
  }

  // Note: Any remaining advance amounts are not handled here
  // They should go to UnitAdvanceBalance but we're not changing that
}

fixAllPaymentAllocations().catch(console.error)
