/**
 * Allocate Unallocated Payments to Bills
 *
 * This script finds payments that haven't been allocated to bills (no BillPayment records)
 * and allocates them to unpaid/partial bills for each unit.
 *
 * Run this BEFORE generating new bills to ensure previous payments are properly applied.
 *
 * Usage: npx tsx scripts/allocate-payments.ts
 */

import { PrismaClient, BillStatus, PaymentStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function allocatePayments() {
  console.log('========================================')
  console.log('Allocate Unallocated Payments to Bills')
  console.log('========================================\n')

  // Find all payments that don't have any BillPayment records
  const unallocatedPayments = await prisma.payment.findMany({
    where: {
      billPayments: {
        none: {} // No BillPayment records linked
      },
      status: PaymentStatus.CONFIRMED // Only confirmed payments
    },
    include: {
      unit: { select: { unitNumber: true } }
    },
    orderBy: [
      { paymentDate: 'asc' },
      { createdAt: 'asc' }
    ]
  })

  console.log(`Found ${unallocatedPayments.length} unallocated payments\n`)

  if (unallocatedPayments.length === 0) {
    console.log('No unallocated payments found. All payments are already linked to bills.')
    return
  }

  let paymentsProcessed = 0
  let billPaymentsCreated = 0
  let billsUpdated = 0

  for (const payment of unallocatedPayments) {
    console.log(`Processing payment: OR#${payment.orNumber} for ${payment.unit?.unitNumber || 'Unknown Unit'}`)
    console.log(`  Amount: ₱${Number(payment.totalAmount).toFixed(2)}`)
    console.log(`  Date: ${payment.paymentDate.toDateString()}`)

    // Get unpaid/partial bills for this unit (oldest first)
    const unpaidBills = await prisma.bill.findMany({
      where: {
        unitId: payment.unitId,
        status: {
          in: [BillStatus.UNPAID, BillStatus.PARTIAL]
        }
      },
      include: {
        payments: true // Get existing BillPayment records
      },
      orderBy: [
        { billingMonth: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    if (unpaidBills.length === 0) {
      console.log(`  No unpaid bills found for this unit. Skipping.`)
      continue
    }

    console.log(`  Found ${unpaidBills.length} unpaid bill(s)`)

    // Track remaining amounts to allocate
    let remainingElectric = Number(payment.electricAmount)
    let remainingWater = Number(payment.waterAmount)
    let remainingDues = Number(payment.duesAmount)
    let remainingPenalty = Number(payment.penaltyAmount || 0)
    let remainingSP = Number(payment.spAssessmentAmount || 0)
    let remainingPastDues = Number(payment.pastDuesAmount || 0)

    // Allocate to each bill
    for (const bill of unpaidBills) {
      // Calculate already paid on this bill
      const paidElectric = bill.payments.reduce((sum, p) => sum + Number(p.electricAmount), 0)
      const paidWater = bill.payments.reduce((sum, p) => sum + Number(p.waterAmount), 0)
      const paidDues = bill.payments.reduce((sum, p) => sum + Number(p.duesAmount), 0)
      const paidPenalty = bill.payments.reduce((sum, p) => sum + Number(p.penaltyAmount), 0)
      const paidSP = bill.payments.reduce((sum, p) => sum + Number(p.spAssessmentAmount), 0)

      // Calculate outstanding for each component
      const outstandingElectric = Math.max(0, Number(bill.electricAmount) - paidElectric)
      const outstandingWater = Math.max(0, Number(bill.waterAmount) - paidWater)
      const outstandingDues = Math.max(0, Number(bill.associationDues) - paidDues)
      const outstandingPenalty = Math.max(0, Number(bill.penaltyAmount) - paidPenalty)
      const outstandingSP = Math.max(0, Number(bill.spAssessment || 0) - paidSP)

      // Allocate what we can
      const allocElectric = Math.min(remainingElectric, outstandingElectric)
      const allocWater = Math.min(remainingWater, outstandingWater)
      const allocDues = Math.min(remainingDues + remainingPastDues, outstandingDues) // Include past dues in dues allocation
      const allocPenalty = Math.min(remainingPenalty, outstandingPenalty)
      const allocSP = Math.min(remainingSP, outstandingSP)

      const allocTotal = allocElectric + allocWater + allocDues + allocPenalty + allocSP

      if (allocTotal > 0) {
        // Create BillPayment record
        await prisma.billPayment.create({
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
        billPaymentsCreated++

        // Update bill
        const newPaidAmount = Number(bill.paidAmount) + allocTotal
        const newBalance = Number(bill.totalAmount) - newPaidAmount
        const newStatus: BillStatus = newBalance <= 0.01
          ? BillStatus.PAID
          : newPaidAmount > 0
            ? BillStatus.PARTIAL
            : BillStatus.UNPAID

        await prisma.bill.update({
          where: { id: bill.id },
          data: {
            paidAmount: newPaidAmount,
            balance: Math.max(0, newBalance),
            status: newStatus
          }
        })
        billsUpdated++

        const billMonth = bill.billingMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        console.log(`    → Allocated ₱${allocTotal.toFixed(2)} to ${billMonth} bill (${bill.billNumber})`)
        console.log(`      New balance: ₱${Math.max(0, newBalance).toFixed(2)}, Status: ${newStatus}`)

        // Reduce remaining amounts
        remainingElectric -= allocElectric
        remainingWater -= allocWater
        remainingDues -= Math.min(remainingDues, allocDues)
        remainingPastDues -= Math.max(0, allocDues - remainingDues)
        remainingPenalty -= allocPenalty
        remainingSP -= allocSP
      }

      // Check if we've allocated everything
      const totalRemaining = remainingElectric + remainingWater + remainingDues + remainingPenalty + remainingSP + remainingPastDues
      if (totalRemaining <= 0.01) break
    }

    paymentsProcessed++
    console.log('')
  }

  console.log('========================================')
  console.log('ALLOCATION COMPLETE')
  console.log('========================================')
  console.log(`\nSummary:`)
  console.log(`  - Payments processed: ${paymentsProcessed}`)
  console.log(`  - BillPayment records created: ${billPaymentsCreated}`)
  console.log(`  - Bills updated: ${billsUpdated}`)

  console.log(`\nNext steps:`)
  console.log(`1. Check Bills List page - November bills should show status PAID`)
  console.log(`2. Generate December 2025 bills`)
  console.log(`3. Verify "Prev Bal" shows ₱0.00 for fully paid units`)
}

allocatePayments()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
