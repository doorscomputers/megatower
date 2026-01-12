/**
 * Investigate payment allocations and excess amounts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(70))
  console.log('PAYMENT ALLOCATION INVESTIGATION')
  console.log('='.repeat(70))

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    process.exit(1)
  }

  // Get all September payments with their allocations
  const payments = await prisma.payment.findMany({
    where: {
      tenantId: tenant.id,
      paymentDate: {
        gte: new Date('2025-09-01'),
        lt: new Date('2025-10-01')
      }
    },
    include: {
      unit: { select: { unitNumber: true } },
      billPayments: {
        include: {
          bill: { select: { billNumber: true, billingMonth: true } }
        }
      }
    },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  // Get September bills
  const septBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: {
        gte: new Date('2025-09-01'),
        lt: new Date('2025-10-01')
      }
    },
    include: {
      unit: { select: { unitNumber: true } }
    }
  })

  // Create a map of unit to bill
  const unitBillMap = new Map<string, typeof septBills[0]>()
  for (const bill of septBills) {
    unitBillMap.set(bill.unit.unitNumber, bill)
  }

  console.log('\n--- PAYMENT ALLOCATION ANALYSIS ---\n')

  let totalPayments = 0
  let totalAllocated = 0
  let totalExcess = 0
  const excessByUnit = new Map<string, number>()

  for (const payment of payments) {
    const paymentTotal = Number(payment.totalAmount)
    totalPayments += paymentTotal

    // Sum up allocations for this payment
    let allocatedAmount = 0
    for (const bp of payment.billPayments) {
      allocatedAmount += Number(bp.totalAmount)
    }
    totalAllocated += allocatedAmount

    const excess = paymentTotal - allocatedAmount
    if (excess > 0.01) {
      totalExcess += excess
      const current = excessByUnit.get(payment.unit.unitNumber) || 0
      excessByUnit.set(payment.unit.unitNumber, current + excess)
    }

    // Get the September bill for this unit
    const bill = unitBillMap.get(payment.unit.unitNumber)
    const billTotal = bill ? Number(bill.totalAmount) : 0

    console.log(`${payment.unit.unitNumber} | OR# ${payment.orNumber}`)
    console.log(`  Payment: ₱${paymentTotal.toLocaleString()}`)
    console.log(`  Allocated: ₱${allocatedAmount.toLocaleString()}`)
    if (excess > 0.01) {
      console.log(`  EXCESS: ₱${excess.toLocaleString()} (not allocated to any bill)`)
    }
    if (payment.billPayments.length > 0) {
      console.log(`  Applied to:`)
      for (const bp of payment.billPayments) {
        console.log(`    - ${bp.bill.billNumber}: ₱${Number(bp.totalAmount).toLocaleString()}`)
      }
    } else {
      console.log(`  Applied to: NONE (no bill allocations)`)
    }
    console.log('')
  }

  console.log('='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Total Payments: ₱${totalPayments.toLocaleString()}`)
  console.log(`Total Allocated to Bills: ₱${totalAllocated.toLocaleString()}`)
  console.log(`Total Excess (Unallocated): ₱${totalExcess.toLocaleString()}`)

  if (excessByUnit.size > 0) {
    console.log('\nExcess by Unit:')
    for (const [unit, excess] of excessByUnit) {
      console.log(`  ${unit}: ₱${excess.toLocaleString()}`)
    }
  }

  // Check advance balances
  const advances = await prisma.unitAdvanceBalance.findMany({
    where: { tenantId: tenant.id },
    include: { unit: { select: { unitNumber: true } } }
  })

  console.log('\n--- ADVANCE BALANCES ---')
  if (advances.length === 0) {
    console.log('No advance balances recorded.')
  } else {
    for (const adv of advances) {
      console.log(`${adv.unit.unitNumber}: Dues ₱${Number(adv.advanceDues).toLocaleString()}, Util ₱${Number(adv.advanceUtilities).toLocaleString()}`)
    }
  }

  // Analyze specific cases
  console.log('\n--- DETAILED ANALYSIS: Units with Large Excess ---\n')

  for (const [unit, excess] of excessByUnit) {
    if (excess > 1000) {
      const bill = unitBillMap.get(unit)
      const unitPayments = payments.filter(p => p.unit.unitNumber === unit)
      const totalUnitPayments = unitPayments.reduce((sum, p) => sum + Number(p.totalAmount), 0)

      console.log(`${unit}:`)
      console.log(`  September Bill: ₱${bill ? Number(bill.totalAmount).toLocaleString() : 'N/A'}`)
      console.log(`  Total Payments: ₱${totalUnitPayments.toLocaleString()}`)
      console.log(`  Bill Paid Amount: ₱${bill ? Number(bill.paidAmount).toLocaleString() : 'N/A'}`)
      console.log(`  Excess: ₱${excess.toLocaleString()}`)
      console.log(`  Payments:`)
      for (const p of unitPayments) {
        console.log(`    OR# ${p.orNumber}: ₱${Number(p.totalAmount).toLocaleString()}`)
        console.log(`      Electric: ₱${Number(p.electricAmount)}, Water: ₱${Number(p.waterAmount)}`)
        console.log(`      Dues: ₱${Number(p.duesAmount)}, SP: ₱${Number(p.spAssessmentAmount)}`)
        console.log(`      Advance: ₱${Number(p.advanceDuesAmount) + Number(p.advanceUtilAmount)}`)
      }
      console.log('')
    }
  }

  console.log('='.repeat(70))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
