/**
 * Regenerate September and October 2025 Bills with New Electric Rate
 *
 * This script:
 * 1. Deletes existing September and October 2025 bills (and their BillPayment allocations)
 * 2. Regenerates bills with the updated electric rate (₱11.94)
 * 3. Re-allocates September payments to September bills using FIFO
 */

import { PrismaClient, BillStatus } from '@prisma/client'
import { calculateBill } from '../lib/calculations/billing'

const prisma = new PrismaClient()

async function deleteBillsForMonth(billingMonth: string) {
  const billingPeriod = new Date(billingMonth + '-01')

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) return

  // Delete BillPayments for bills in this period
  const bills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: billingPeriod
    },
    select: { id: true }
  })

  const billIds = bills.map(b => b.id)

  if (billIds.length > 0) {
    // Delete bill payments
    const deletedBillPayments = await prisma.billPayment.deleteMany({
      where: { billId: { in: billIds } }
    })
    console.log(`  Deleted ${deletedBillPayments.count} BillPayment allocations`)

    // Delete bills
    const deletedBills = await prisma.bill.deleteMany({
      where: { id: { in: billIds } }
    })
    console.log(`  Deleted ${deletedBills.count} bills for ${billingMonth}`)
  }
}

async function generateBillsForMonth(billingMonth: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`GENERATING BILLS FOR ${billingMonth}`)
  console.log('='.repeat(60))

  const tenant = await prisma.tenant.findFirst({
    include: { settings: true }
  })

  if (!tenant || !tenant.settings) {
    console.error('No tenant or settings found!')
    process.exit(1)
  }

  const billingPeriod = new Date(billingMonth + '-01')
  console.log(`\nBilling period: ${billingPeriod.toISOString().slice(0, 7)}`)
  console.log(`Electric rate: ₱${tenant.settings.electricRate}`)

  // Get all units
  const units = await prisma.unit.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
    },
    include: {
      owner: true,
    },
    orderBy: [{ floorLevel: 'asc' }, { unitNumber: 'asc' }],
  })

  console.log(`\nFound ${units.length} active units`)

  // Get readings for this billing period
  const electricReadings = await prisma.electricReading.findMany({
    where: {
      billingPeriod,
      unit: { tenantId: tenant.id },
    },
  })
  const waterReadings = await prisma.waterReading.findMany({
    where: {
      billingPeriod,
      unit: { tenantId: tenant.id },
    },
  })

  console.log(`Electric readings: ${electricReadings.length}`)
  console.log(`Water readings: ${waterReadings.length}`)

  // Get billing adjustments
  const adjustments = await prisma.billingAdjustment.findMany({
    where: {
      tenantId: tenant.id,
      billingPeriod,
    },
  })

  // Get advance balances (only for October - September won't have advances yet)
  const advanceBalances = billingMonth === '2025-10'
    ? await prisma.unitAdvanceBalance.findMany({ where: { tenantId: tenant.id } })
    : []

  // Calculate dates
  const year = billingPeriod.getFullYear()
  const month = billingPeriod.getMonth()
  const periodFrom = new Date(year, month - 1, 27)
  const periodTo = new Date(year, month, 26)
  const statementDate = new Date(year, month, 27)
  const dueDate = new Date(year, month + 1, 6)

  console.log(`\nBilling period: ${periodFrom.toDateString()} to ${periodTo.toDateString()}`)
  console.log(`Statement date: ${statementDate.toDateString()}`)
  console.log(`Due date: ${dueDate.toDateString()}`)

  // Get last bill number (excluding this month's bills which we just deleted)
  const lastBill = await prisma.bill.findFirst({
    where: {
      tenantId: tenant.id,
      billingMonth: { lt: billingPeriod }
    },
    orderBy: { billNumber: 'desc' },
  })
  let billCounter = lastBill
    ? parseInt(lastBill.billNumber.split('-').pop() || '0')
    : 0

  const settings = tenant.settings
  let billsGenerated = 0
  let totalAmount = 0

  for (const unit of units) {
    const electricReading = electricReadings.find(r => r.unitId === unit.id)
    const waterReading = waterReadings.find(r => r.unitId === unit.id)
    const adjustment = adjustments.find(a => a.unitId === unit.id)
    const advanceBalance = advanceBalances.find(a => a.unitId === unit.id)

    if (!electricReading || !waterReading) {
      console.log(`  ${unit.unitNumber}: Missing readings - skipping`)
      continue
    }

    // Calculate bill
    const billCalc = calculateBill({
      electricConsumption: Number(electricReading.consumption),
      waterConsumption: Number(waterReading.consumption),
      area: Number(unit.area),
      unitType: unit.unitType as 'RESIDENTIAL' | 'COMMERCIAL',
      settings: {
        electricRate: parseFloat(settings.electricRate.toString()),
        electricMinCharge: parseFloat(settings.electricMinCharge.toString()),
        associationDuesRate: parseFloat(settings.associationDuesRate.toString()),
        penaltyRate: parseFloat(settings.penaltyRate.toString()),
        waterSettings: {
          waterResTier1Max: parseFloat(settings.waterResTier1Max.toString()),
          waterResTier1Rate: parseFloat(settings.waterResTier1Rate.toString()),
          waterResTier2Max: parseFloat(settings.waterResTier2Max.toString()),
          waterResTier2Rate: parseFloat(settings.waterResTier2Rate.toString()),
          waterResTier3Max: parseFloat(settings.waterResTier3Max.toString()),
          waterResTier3Rate: parseFloat(settings.waterResTier3Rate.toString()),
          waterResTier4Max: parseFloat(settings.waterResTier4Max.toString()),
          waterResTier4Rate: parseFloat(settings.waterResTier4Rate.toString()),
          waterResTier5Max: parseFloat(settings.waterResTier5Max.toString()),
          waterResTier5Rate: parseFloat(settings.waterResTier5Rate.toString()),
          waterResTier6Max: parseFloat(settings.waterResTier6Max.toString()),
          waterResTier6Rate: parseFloat(settings.waterResTier6Rate.toString()),
          waterResTier7Rate: parseFloat(settings.waterResTier7Rate.toString()),
          waterComTier1Max: parseFloat(settings.waterComTier1Max.toString()),
          waterComTier1Rate: parseFloat(settings.waterComTier1Rate.toString()),
          waterComTier2Max: parseFloat(settings.waterComTier2Max.toString()),
          waterComTier2Rate: parseFloat(settings.waterComTier2Rate.toString()),
          waterComTier3Max: parseFloat(settings.waterComTier3Max.toString()),
          waterComTier3Rate: parseFloat(settings.waterComTier3Rate.toString()),
          waterComTier4Max: parseFloat(settings.waterComTier4Max.toString()),
          waterComTier4Rate: parseFloat(settings.waterComTier4Rate.toString()),
          waterComTier5Max: parseFloat(settings.waterComTier5Max.toString()),
          waterComTier5Rate: parseFloat(settings.waterComTier5Rate.toString()),
          waterComTier6Max: parseFloat(settings.waterComTier6Max.toString()),
          waterComTier6Rate: parseFloat(settings.waterComTier6Rate.toString()),
          waterComTier7Rate: parseFloat(settings.waterComTier7Rate.toString()),
        }
      }
    })

    // Calculate parking fee
    const parkingArea = Number(unit.parkingArea || 0)
    const parkingRate = parseFloat(settings.parkingRate?.toString() || '60')
    const parkingFee = parkingArea * parkingRate

    // Get adjustments
    const spAssessment = Number(adjustment?.spAssessment || 0)
    const discounts = Number(adjustment?.discounts || 0)

    // Get advance balances (only for October)
    const availableAdvanceDues = Number(advanceBalance?.advanceDues || 0)
    const availableAdvanceUtil = Number(advanceBalance?.advanceUtilities || 0)

    // Get previous unpaid balance (only for October - check September bills)
    let previousBalance = 0
    let totalPenalties = 0

    if (billingMonth === '2025-10') {
      const previousBills = await prisma.bill.findMany({
        where: {
          unitId: unit.id,
          status: { in: ['UNPAID', 'PARTIAL'] },
          billingMonth: { lt: billingPeriod },
        },
      })

      for (const prevBill of previousBills) {
        const balance = Number(prevBill.totalAmount) - Number(prevBill.paidAmount)
        previousBalance += balance

        const daysPastDue = Math.floor(
          (statementDate.getTime() - prevBill.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysPastDue > 0) {
          const monthsOverdue = Math.ceil(daysPastDue / 30)
          let penaltyAmount = 0
          let runningBalance = balance - Number(prevBill.penaltyAmount)

          for (let m = 1; m <= monthsOverdue; m++) {
            const monthPenalty = runningBalance * (Number(settings.penaltyRate) / 100)
            penaltyAmount += monthPenalty
            runningBalance += monthPenalty
          }

          totalPenalties += penaltyAmount
        }
      }
    }

    // Calculate advances to apply (only for October)
    const advanceDuesApplied = billingMonth === '2025-10'
      ? Math.min(availableAdvanceDues, billCalc.associationDues)
      : 0
    const utilityCharges = billCalc.electricAmount + billCalc.waterAmount
    const advanceUtilApplied = billingMonth === '2025-10'
      ? Math.min(availableAdvanceUtil, utilityCharges)
      : 0

    // Calculate total
    const currentCharges = billCalc.electricAmount +
                          billCalc.waterAmount +
                          billCalc.associationDues +
                          parkingFee +
                          spAssessment
    const totalDeductions = discounts + advanceDuesApplied + advanceUtilApplied
    const total = currentCharges + previousBalance + totalPenalties - totalDeductions

    // Generate bill number
    billCounter++
    const billNumber = `MT-${billingPeriod.getFullYear()}${String(
      billingPeriod.getMonth() + 1
    ).padStart(2, '0')}-${String(billCounter).padStart(4, '0')}`

    // Create bill
    await prisma.bill.create({
      data: {
        billNumber,
        tenantId: tenant.id,
        unitId: unit.id,
        billingMonth: billingPeriod,
        billingPeriodStart: periodFrom,
        billingPeriodEnd: periodTo,
        statementDate,
        dueDate,
        electricAmount: billCalc.electricAmount,
        waterAmount: billCalc.waterAmount,
        associationDues: billCalc.associationDues,
        parkingFee,
        spAssessment,
        discounts,
        advanceDuesApplied,
        advanceUtilApplied,
        penaltyAmount: totalPenalties,
        totalAmount: total,
        paidAmount: 0,
        balance: total,
        status: 'UNPAID' as BillStatus,
      },
    })

    // Update advance balances (only for October)
    if ((advanceDuesApplied > 0 || advanceUtilApplied > 0) && advanceBalance) {
      await prisma.unitAdvanceBalance.update({
        where: { id: advanceBalance.id },
        data: {
          advanceDues: { decrement: advanceDuesApplied },
          advanceUtilities: { decrement: advanceUtilApplied },
        },
      })
    }

    billsGenerated++
    totalAmount += total

    // Show electric calculation for verification
    const electricCalc = Number(electricReading.consumption) * parseFloat(settings.electricRate.toString())
    console.log(`  ${unit.unitNumber}: ${billNumber} - ₱${total.toLocaleString()} (Electric: ${electricReading.consumption} × ${settings.electricRate} = ₱${electricCalc.toFixed(2)})`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('GENERATION COMPLETE')
  console.log('='.repeat(60))
  console.log(`Bills generated: ${billsGenerated}`)
  console.log(`Total amount: ₱${totalAmount.toLocaleString()}`)

  return billsGenerated
}

async function reallocateSeptemberPayments() {
  console.log(`\n${'='.repeat(60)}`)
  console.log('RE-ALLOCATING SEPTEMBER PAYMENTS')
  console.log('='.repeat(60))

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) return

  const septBillingPeriod = new Date('2025-09-01')

  // Get September payments
  const payments = await prisma.payment.findMany({
    where: {
      tenantId: tenant.id,
      paymentDate: {
        gte: new Date('2025-09-01'),
        lt: new Date('2025-10-01')
      }
    },
    orderBy: { paymentDate: 'asc' }
  })

  console.log(`\nFound ${payments.length} September payments to re-allocate`)

  // Get September bills
  const septBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: septBillingPeriod
    },
    include: { unit: true }
  })

  console.log(`Found ${septBills.length} September bills`)

  let totalAllocated = 0
  let paymentsAllocated = 0
  let totalExcess = 0

  // Track cumulative paid amounts per bill (FIX: accumulate instead of overwrite)
  const paidPerBill = new Map<string, number>()
  // Track excess payments per unit for advance balances
  const excessPerUnit = new Map<string, number>()

  for (const payment of payments) {
    // Find the September bill for this unit
    const bill = septBills.find(b => b.unitId === payment.unitId)

    if (!bill) {
      console.log(`  No September bill found for payment ${payment.orNumber}`)
      continue
    }

    const paymentAmount = Number(payment.totalAmount)
    const billTotal = Number(bill.totalAmount)

    // Get current paid amount for this bill (accumulate!)
    const currentPaid = paidPerBill.get(bill.id) || 0
    const remainingBalance = billTotal - currentPaid

    // Allocate up to the remaining balance (not the full bill total!)
    const toAllocate = Math.min(paymentAmount, remainingBalance)

    // Calculate excess (payment amount beyond what's needed for this bill)
    const excessAmount = paymentAmount - toAllocate
    if (excessAmount > 0) {
      const currentExcess = excessPerUnit.get(payment.unitId) || 0
      excessPerUnit.set(payment.unitId, currentExcess + excessAmount)
      totalExcess += excessAmount
    }

    if (toAllocate > 0) {
      // Create BillPayment record
      await prisma.billPayment.create({
        data: {
          billId: bill.id,
          paymentId: payment.id,
          totalAmount: toAllocate,
          // Allocate proportionally
          electricAmount: (Number(bill.electricAmount) / billTotal) * toAllocate,
          waterAmount: (Number(bill.waterAmount) / billTotal) * toAllocate,
          duesAmount: (Number(bill.associationDues) / billTotal) * toAllocate,
          penaltyAmount: 0,
          spAssessmentAmount: 0,
          otherAmount: 0,
        }
      })

      // Update cumulative paid amount (FIX: accumulate!)
      const newPaidAmount = currentPaid + toAllocate
      paidPerBill.set(bill.id, newPaidAmount)

      const newBalance = billTotal - newPaidAmount
      const newStatus = newBalance <= 0 ? 'PAID' : newBalance < billTotal ? 'PARTIAL' : 'UNPAID'

      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus as BillStatus
        }
      })

      totalAllocated += toAllocate
      paymentsAllocated++
      console.log(`  Allocated ₱${toAllocate.toLocaleString()} from ${payment.orNumber} to ${bill.billNumber} (cumulative: ₱${newPaidAmount.toLocaleString()})`)
    } else if (excessAmount > 0) {
      console.log(`  Payment ${payment.orNumber} (₱${paymentAmount.toLocaleString()}) → Bill already paid, ₱${excessAmount.toLocaleString()} excess`)
    }
  }

  console.log(`\nTotal allocated: ₱${totalAllocated.toLocaleString()}`)
  console.log(`Payments processed: ${paymentsAllocated}`)
  console.log(`Total excess (for advances): ₱${totalExcess.toLocaleString()}`)

  // Return excess per unit for advance balance recording
  return excessPerUnit
}

async function main() {
  console.log('='.repeat(60))
  console.log('REGENERATING BILLS WITH NEW ELECTRIC RATE (₱11.94)')
  console.log('='.repeat(60))

  // Step 1: Reset advance balances back to original values
  console.log('\nStep 1: Resetting advance balances...')
  await prisma.unitAdvanceBalance.deleteMany({})
  console.log('  Advance balances cleared')

  // Step 2: Delete October bills first (they depend on September)
  console.log('\nStep 2: Deleting October 2025 bills...')
  await deleteBillsForMonth('2025-10')

  // Step 3: Delete September bills
  console.log('\nStep 3: Deleting September 2025 bills...')
  await deleteBillsForMonth('2025-09')

  // Step 4: Regenerate September bills
  console.log('\nStep 4: Regenerating September 2025 bills...')
  await generateBillsForMonth('2025-09')

  // Step 5: Re-allocate September payments and get excess amounts
  const excessPerUnit = await reallocateSeptemberPayments()

  // Step 6: Record advance balances from excess payments
  console.log(`\n${'='.repeat(60)}`)
  console.log('RECORDING ADVANCE BALANCES FROM EXCESS PAYMENTS')
  console.log('='.repeat(60))

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) return

  // Get unit info for display
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, unitNumber: true }
  })
  const unitMap = new Map(units.map(u => [u.id, u.unitNumber]))

  let totalExcess = 0
  let unitsWithExcess = 0

  for (const [unitId, excess] of excessPerUnit) {
    if (excess > 0) {
      unitsWithExcess++
      totalExcess += excess

      // Split 50/50 between dues and utilities
      const advanceDues = excess / 2
      const advanceUtil = excess / 2

      await prisma.unitAdvanceBalance.create({
        data: {
          tenantId: tenant.id,
          unitId,
          advanceDues,
          advanceUtilities: advanceUtil
        }
      })

      const unitNumber = unitMap.get(unitId) || unitId
      console.log(`  ${unitNumber}: Excess ₱${excess.toFixed(2)} → Advance (Dues: ₱${advanceDues.toFixed(2)}, Util: ₱${advanceUtil.toFixed(2)})`)
    }
  }

  console.log(`\nTotal excess as advances: ₱${totalExcess.toFixed(2)}`)
  console.log(`Units with advances: ${unitsWithExcess}`)

  // Step 7: Regenerate October bills (with advances applied)
  console.log('\nStep 7: Regenerating October 2025 bills...')
  await generateBillsForMonth('2025-10')

  console.log('\n' + '='.repeat(60))
  console.log('ALL DONE!')
  console.log('='.repeat(60))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
