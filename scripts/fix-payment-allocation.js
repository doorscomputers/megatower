const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixUnit(unitNumber) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`FIXING: ${unitNumber}`)
  console.log('='.repeat(60))

  const unit = await prisma.unit.findFirst({
    where: { unitNumber },
    include: { owner: true }
  })

  if (!unit) {
    console.log('Unit not found!')
    return
  }

  console.log('Owner:', unit.owner?.lastName, unit.owner?.firstName)

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

  console.log('\n--- BEFORE FIX ---')
  console.log('Bills:')
  for (const b of bills) {
    console.log(`  ${b.billingMonth.toISOString().slice(0,7)}: Total=${Number(b.totalAmount).toFixed(2)}, Paid=${Number(b.paidAmount).toFixed(2)}, Balance=${Number(b.balance).toFixed(2)}, Status=${b.status}`)
  }
  console.log('Payments:')
  for (const p of payments) {
    console.log(`  ${p.paymentDate.toISOString().slice(0,10)}: OR#${p.orNumber} - ₱${Number(p.totalAmount).toFixed(2)}`)
  }

  // Step 1: Delete all existing BillPayment records for this unit's payments
  console.log('\n--- CLEARING OLD ALLOCATIONS ---')
  const paymentIds = payments.map(p => p.id)
  await prisma.billPayment.deleteMany({
    where: { paymentId: { in: paymentIds } }
  })
  console.log('Cleared existing BillPayment records')

  // Step 2: Reset all bills to unpaid state
  for (const bill of bills) {
    await prisma.bill.update({
      where: { id: bill.id },
      data: { paidAmount: 0, balance: bill.totalAmount, status: 'UNPAID' }
    })
  }
  console.log('Reset all bills to UNPAID')

  // Step 3: Delete any advance balance for this unit
  await prisma.unitAdvanceBalance.deleteMany({
    where: { unitId: unit.id }
  })
  console.log('Cleared advance balance')

  // Step 4: Reallocate payments using FIFO (oldest bill first)
  console.log('\n--- REALLOCATING PAYMENTS (FIFO) ---')

  // Refresh bills
  const refreshedBills = await prisma.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  // Track remaining balance on each bill
  const billBalances = {}
  for (const b of refreshedBills) {
    billBalances[b.id] = Number(b.totalAmount)
  }

  let totalAdvance = 0

  for (const payment of payments) {
    const paymentAmount = Number(payment.totalAmount)
    let remainingPayment = paymentAmount
    console.log(`\nProcessing payment: ${payment.paymentDate.toISOString().slice(0,10)} - ₱${paymentAmount.toFixed(2)}`)

    // Allocate to bills in order (oldest first)
    for (const bill of refreshedBills) {
      if (remainingPayment <= 0) break

      const billBalance = billBalances[bill.id]
      if (billBalance <= 0) continue // Skip fully paid bills

      const allocation = Math.min(remainingPayment, billBalance)

      // Create BillPayment record
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
      const newPaidAmount = Number(await prisma.bill.findUnique({ where: { id: bill.id } }).then(b => b.paidAmount)) + allocation
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

      console.log(`  -> ${bill.billingMonth.toISOString().slice(0,7)}: ₱${allocation.toFixed(2)} (Bill balance now: ₱${Math.max(0, billBalances[bill.id]).toFixed(2)})`)
    }

    // Any remaining becomes advance payment
    if (remainingPayment > 0) {
      totalAdvance += remainingPayment
      console.log(`  -> ADVANCE: ₱${remainingPayment.toFixed(2)}`)
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
    console.log(`\nCreated advance balance: ₱${totalAdvance.toFixed(2)}`)
  }

  // Show final state
  console.log('\n--- AFTER FIX ---')
  const finalBills = await prisma.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  console.log('Bills:')
  let totalBalance = 0
  for (const b of finalBills) {
    console.log(`  ${b.billingMonth.toISOString().slice(0,7)}: Total=${Number(b.totalAmount).toFixed(2)}, Paid=${Number(b.paidAmount).toFixed(2)}, Balance=${Number(b.balance).toFixed(2)}, Status=${b.status}`)
    totalBalance += Number(b.balance)
  }
  console.log(`\nTOTAL REMAINING BALANCE: ₱${totalBalance.toFixed(2)}`)

  const advance = await prisma.unitAdvanceBalance.findFirst({ where: { unitId: unit.id } })
  if (advance) {
    console.log(`ADVANCE BALANCE: ₱${Number(advance.advanceDues).toFixed(2)}`)
  }
}

async function main() {
  // Fix units with payment allocation issues
  await fixUnit('M2-2F-17')

  console.log('\n\nDone!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
