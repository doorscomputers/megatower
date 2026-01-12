/**
 * Add SP Assessment Billing Adjustments from September Payments
 * Then regenerate September and October bills
 */

import { PrismaClient, BillStatus } from '@prisma/client'
import { calculateBill } from '../lib/calculations/billing'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('ADDING SP ASSESSMENT FROM SEPTEMBER PAYMENTS')
  console.log('='.repeat(60))

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found')
    return
  }

  // Get September payments with SP Assessment
  const payments = await prisma.payment.findMany({
    where: {
      paymentDate: {
        gte: new Date('2025-09-01'),
        lt: new Date('2025-10-01')
      },
      spAssessmentAmount: { gt: 0 }
    },
    include: { unit: { select: { id: true, unitNumber: true } } }
  })

  console.log(`\nFound ${payments.length} payments with SP Assessment`)

  // Group by unit and sum SP Assessment
  const spByUnit = new Map<string, { unitId: string, unitNumber: string, spAmount: number }>()

  for (const p of payments) {
    const sp = Number(p.spAssessmentAmount || 0)
    if (sp > 0) {
      const existing = spByUnit.get(p.unitId)
      if (existing) {
        existing.spAmount += sp
      } else {
        spByUnit.set(p.unitId, {
          unitId: p.unitId,
          unitNumber: p.unit.unitNumber,
          spAmount: sp
        })
      }
    }
  }

  console.log(`\nUnits with SP Assessment: ${spByUnit.size}`)

  // Delete existing September billing adjustments
  await prisma.billingAdjustment.deleteMany({
    where: {
      tenantId: tenant.id,
      billingPeriod: new Date('2025-09-01')
    }
  })
  console.log('Cleared existing September billing adjustments')

  // Create billing adjustments for September
  let created = 0
  console.log('\n' + 'Unit'.padEnd(12) + 'SP Assessment')
  console.log('-'.repeat(25))

  for (const [unitId, data] of spByUnit) {
    await prisma.billingAdjustment.create({
      data: {
        tenantId: tenant.id,
        unitId: data.unitId,
        billingPeriod: new Date('2025-09-01'),
        spAssessment: data.spAmount,
        discounts: 0,
        remarks: 'SP Assessment from September payment'
      }
    })
    console.log(data.unitNumber.padEnd(12) + '₱' + data.spAmount.toFixed(2))
    created++
  }

  console.log('-'.repeat(25))
  console.log(`Created ${created} billing adjustments`)

  // Now regenerate September bills
  console.log('\n' + '='.repeat(60))
  console.log('REGENERATING SEPTEMBER 2025 BILLS')
  console.log('='.repeat(60))

  const septBillingPeriod = new Date('2025-09-01')

  // Get existing September bills
  const existingSeptBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: septBillingPeriod
    },
    select: { id: true }
  })

  if (existingSeptBills.length > 0) {
    await prisma.billPayment.deleteMany({
      where: { billId: { in: existingSeptBills.map(b => b.id) } }
    })
    await prisma.bill.deleteMany({
      where: { id: { in: existingSeptBills.map(b => b.id) } }
    })
    console.log(`Deleted ${existingSeptBills.length} existing September bills`)
  }

  // Get settings
  const settings = await prisma.tenantSettings.findFirst({
    where: { tenantId: tenant.id }
  })
  if (!settings) {
    console.error('No settings found')
    return
  }

  // Get units with readings
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id, isActive: true },
    include: { owner: true },
    orderBy: [{ floorLevel: 'asc' }, { unitNumber: 'asc' }]
  })

  // Get September readings
  const electricReadings = await prisma.electricReading.findMany({
    where: { billingPeriod: septBillingPeriod, unit: { tenantId: tenant.id } }
  })
  const waterReadings = await prisma.waterReading.findMany({
    where: { billingPeriod: septBillingPeriod, unit: { tenantId: tenant.id } }
  })

  // Get adjustments (now with SP Assessment)
  const adjustments = await prisma.billingAdjustment.findMany({
    where: { tenantId: tenant.id, billingPeriod: septBillingPeriod }
  })

  // Calculate dates
  const year = septBillingPeriod.getFullYear()
  const month = septBillingPeriod.getMonth()
  const periodFrom = new Date(year, month - 1, 27)
  const periodTo = new Date(year, month, 26)
  const statementDate = new Date(year, month, 27)
  const dueDate = new Date(year, month + 1, 6)

  let billCounter = 0
  let billsGenerated = 0
  let totalAmount = 0

  const septBills: { id: string; unitId: string; totalAmount: number }[] = []

  console.log('\n' + 'Unit'.padEnd(12) + 'Electric'.padStart(10) + 'Water'.padStart(10) + 'Dues'.padStart(10) + 'SP Assess'.padStart(12) + 'Total'.padStart(12))
  console.log('-'.repeat(66))

  for (const unit of units) {
    const electricReading = electricReadings.find(r => r.unitId === unit.id)
    const waterReading = waterReadings.find(r => r.unitId === unit.id)

    if (!electricReading || !waterReading) continue

    const adjustment = adjustments.find(a => a.unitId === unit.id)

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

    // Get SP Assessment from billing adjustment
    const spAssessment = Number(adjustment?.spAssessment || 0)
    const discounts = Number(adjustment?.discounts || 0)

    // Calculate parking
    const parkingArea = Number(unit.parkingArea || 0)
    const parkingRate = parseFloat(settings.parkingRate?.toString() || '60')
    const parkingFee = parkingArea * parkingRate

    // Calculate total (no previous balance for September - it's the first month)
    const total = billCalc.electricAmount +
                  billCalc.waterAmount +
                  billCalc.associationDues +
                  parkingFee +
                  spAssessment -
                  discounts

    // Generate bill number
    billCounter++
    const billNumber = `MT-${septBillingPeriod.getFullYear()}${String(
      septBillingPeriod.getMonth() + 1
    ).padStart(2, '0')}-${String(billCounter).padStart(4, '0')}`

    // Create bill
    const bill = await prisma.bill.create({
      data: {
        billNumber,
        tenantId: tenant.id,
        unitId: unit.id,
        billingMonth: septBillingPeriod,
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
        advanceDuesApplied: 0,
        advanceUtilApplied: 0,
        penaltyAmount: 0,
        totalAmount: total,
        paidAmount: 0,
        balance: total,
        status: 'UNPAID' as BillStatus,
      },
    })

    septBills.push({ id: bill.id, unitId: unit.id, totalAmount: total })
    billsGenerated++
    totalAmount += total

    console.log(
      unit.unitNumber.padEnd(12) +
      ('₱' + billCalc.electricAmount.toFixed(2)).padStart(10) +
      ('₱' + billCalc.waterAmount.toFixed(2)).padStart(10) +
      ('₱' + billCalc.associationDues.toFixed(2)).padStart(10) +
      ('₱' + spAssessment.toFixed(2)).padStart(12) +
      ('₱' + total.toFixed(2)).padStart(12)
    )
  }

  console.log(`\nGenerated ${billsGenerated} September bills`)
  console.log(`Total: ₱${totalAmount.toLocaleString()}`)

  // Allocate September payments to bills
  console.log('\n' + '='.repeat(60))
  console.log('ALLOCATING SEPTEMBER PAYMENTS')
  console.log('='.repeat(60))

  const septPayments = await prisma.payment.findMany({
    where: {
      paymentDate: {
        gte: new Date('2025-09-01'),
        lt: new Date('2025-10-01')
      }
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { paymentDate: 'asc' }
  })

  // Track cumulative paid amounts per bill
  const paidPerBill = new Map<string, number>()
  // Track excess payments per unit for advance balances
  const excessPerUnit = new Map<string, number>()

  let allocatedCount = 0
  let totalExcess = 0

  for (const payment of septPayments) {
    const bill = septBills.find(b => b.unitId === payment.unitId)
    if (!bill) continue

    const paymentAmount = Number(payment.totalAmount)
    const billTotal = bill.totalAmount

    // Get current paid amount for this bill (accumulate!)
    const currentPaid = paidPerBill.get(bill.id) || 0
    const remainingBalance = billTotal - currentPaid

    // Allocate up to the remaining balance
    const toAllocate = Math.min(paymentAmount, remainingBalance)

    // Calculate excess
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
          electricAmount: Number(payment.electricAmount) * (toAllocate / paymentAmount),
          waterAmount: Number(payment.waterAmount) * (toAllocate / paymentAmount),
          duesAmount: Number(payment.duesAmount) * (toAllocate / paymentAmount),
          penaltyAmount: Number(payment.penaltyAmount || 0) * (toAllocate / paymentAmount),
          otherAmount: 0,
          totalAmount: toAllocate,
          spAssessmentAmount: Number(payment.spAssessmentAmount || 0) * (toAllocate / paymentAmount),
        },
      })

      // Update cumulative paid amount
      const newPaidAmount = currentPaid + toAllocate
      paidPerBill.set(bill.id, newPaidAmount)

      const newBalance = billTotal - newPaidAmount
      const newStatus = newBalance <= 0 ? 'PAID' : newBalance < billTotal ? 'PARTIAL' : 'UNPAID'

      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          balance: Math.max(0, newBalance),
          status: newStatus as BillStatus
        }
      })

      allocatedCount++
      console.log(`${payment.unit.unitNumber} OR# ${payment.orNumber}: ₱${paymentAmount.toFixed(2)} → allocated ₱${toAllocate.toFixed(2)}${excessAmount > 0 ? ` (excess: ₱${excessAmount.toFixed(2)})` : ''}`)
    }
  }

  console.log(`\nAllocated ${allocatedCount} payments`)
  console.log(`Total excess: ₱${totalExcess.toFixed(2)}`)

  // Update advance balances
  if (excessPerUnit.size > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('UPDATING ADVANCE BALANCES')
    console.log('='.repeat(60))

    for (const [unitId, excess] of excessPerUnit) {
      // Split excess: 50% to dues, 50% to utilities (or all to utilities)
      const advanceUtil = excess

      const existing = await prisma.unitAdvanceBalance.findFirst({
        where: { unitId }
      })

      if (existing) {
        await prisma.unitAdvanceBalance.update({
          where: { id: existing.id },
          data: {
            advanceUtilities: advanceUtil,
            advanceDues: 0
          }
        })
      } else {
        await prisma.unitAdvanceBalance.create({
          data: {
            tenantId: tenant.id,
            unitId,
            advanceDues: 0,
            advanceUtilities: advanceUtil
          }
        })
      }

      const unit = await prisma.unit.findUnique({ where: { id: unitId } })
      console.log(`${unit?.unitNumber}: ₱${excess.toFixed(2)} advance`)
    }
  }

  // Now regenerate October bills
  console.log('\n' + '='.repeat(60))
  console.log('REGENERATING OCTOBER 2025 BILLS')
  console.log('='.repeat(60))

  const octBillingPeriod = new Date('2025-10-01')

  // Delete existing October bills
  const existingOctBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: octBillingPeriod
    },
    select: { id: true }
  })

  if (existingOctBills.length > 0) {
    await prisma.billPayment.deleteMany({
      where: { billId: { in: existingOctBills.map(b => b.id) } }
    })
    await prisma.bill.deleteMany({
      where: { id: { in: existingOctBills.map(b => b.id) } }
    })
    console.log(`Deleted ${existingOctBills.length} existing October bills`)
  }

  // Get October readings
  const octElectricReadings = await prisma.electricReading.findMany({
    where: { billingPeriod: octBillingPeriod, unit: { tenantId: tenant.id } }
  })
  const octWaterReadings = await prisma.waterReading.findMany({
    where: { billingPeriod: octBillingPeriod, unit: { tenantId: tenant.id } }
  })

  // Get October adjustments
  const octAdjustments = await prisma.billingAdjustment.findMany({
    where: { tenantId: tenant.id, billingPeriod: octBillingPeriod }
  })

  // Get advance balances
  const advanceBalances = await prisma.unitAdvanceBalance.findMany({
    where: { tenantId: tenant.id }
  })

  // Get September bills with unpaid balance
  const updatedSeptBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: septBillingPeriod
    }
  })

  // Calculate dates for October
  const octYear = octBillingPeriod.getFullYear()
  const octMonth = octBillingPeriod.getMonth()
  const octPeriodFrom = new Date(octYear, octMonth - 1, 27)
  const octPeriodTo = new Date(octYear, octMonth, 26)
  const octStatementDate = new Date(octYear, octMonth, 27)
  const octDueDate = new Date(octYear, octMonth + 1, 6)

  // Get bill counter from September
  let octBillCounter = billCounter

  let octBillsGenerated = 0
  let octTotalAmount = 0

  console.log('\n' + 'Unit'.padEnd(12) + 'Electric'.padStart(10) + 'Water'.padStart(10) + 'Dues'.padStart(10) + 'Prev Bal'.padStart(12) + 'Adv Applied'.padStart(12) + 'Total'.padStart(12))
  console.log('-'.repeat(78))

  for (const unit of units) {
    const electricReading = octElectricReadings.find(r => r.unitId === unit.id)
    const waterReading = octWaterReadings.find(r => r.unitId === unit.id)

    if (!electricReading || !waterReading) continue

    const adjustment = octAdjustments.find(a => a.unitId === unit.id)
    const advanceBalance = advanceBalances.find(a => a.unitId === unit.id)

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

    // Get adjustments and advances
    const spAssessment = Number(adjustment?.spAssessment || 0)
    const discounts = Number(adjustment?.discounts || 0)
    const availableAdvanceDues = Number(advanceBalance?.advanceDues || 0)
    const availableAdvanceUtil = Number(advanceBalance?.advanceUtilities || 0)

    // Get previous unpaid balance from September
    const septBill = updatedSeptBills.find(b => b.unitId === unit.id)
    const previousBalance = septBill ? Number(septBill.balance) : 0

    // Calculate advances to apply
    const advanceDuesApplied = Math.min(availableAdvanceDues, billCalc.associationDues)
    const utilityCharges = billCalc.electricAmount + billCalc.waterAmount
    const advanceUtilApplied = Math.min(availableAdvanceUtil, utilityCharges)
    const totalAdvanceApplied = advanceDuesApplied + advanceUtilApplied

    // Calculate parking
    const parkingArea = Number(unit.parkingArea || 0)
    const parkingRate = parseFloat(settings.parkingRate?.toString() || '60')
    const parkingFee = parkingArea * parkingRate

    // Calculate total
    const currentCharges = billCalc.electricAmount +
                          billCalc.waterAmount +
                          billCalc.associationDues +
                          parkingFee +
                          spAssessment
    const totalDeductions = discounts + advanceDuesApplied + advanceUtilApplied
    const total = currentCharges + previousBalance - totalDeductions

    // Generate bill number
    octBillCounter++
    const billNumber = `MT-${octBillingPeriod.getFullYear()}${String(
      octBillingPeriod.getMonth() + 1
    ).padStart(2, '0')}-${String(octBillCounter).padStart(4, '0')}`

    // Create bill
    await prisma.bill.create({
      data: {
        billNumber,
        tenantId: tenant.id,
        unitId: unit.id,
        billingMonth: octBillingPeriod,
        billingPeriodStart: octPeriodFrom,
        billingPeriodEnd: octPeriodTo,
        statementDate: octStatementDate,
        dueDate: octDueDate,
        electricAmount: billCalc.electricAmount,
        waterAmount: billCalc.waterAmount,
        associationDues: billCalc.associationDues,
        parkingFee,
        spAssessment,
        discounts,
        advanceDuesApplied,
        advanceUtilApplied,
        penaltyAmount: 0,
        totalAmount: total,
        paidAmount: 0,
        balance: total,
        status: 'UNPAID' as BillStatus,
      },
    })

    // Update advance balances
    if ((advanceDuesApplied > 0 || advanceUtilApplied > 0) && advanceBalance) {
      await prisma.unitAdvanceBalance.update({
        where: { id: advanceBalance.id },
        data: {
          advanceDues: { decrement: advanceDuesApplied },
          advanceUtilities: { decrement: advanceUtilApplied },
        },
      })
    }

    octBillsGenerated++
    octTotalAmount += total

    console.log(
      unit.unitNumber.padEnd(12) +
      ('₱' + billCalc.electricAmount.toFixed(2)).padStart(10) +
      ('₱' + billCalc.waterAmount.toFixed(2)).padStart(10) +
      ('₱' + billCalc.associationDues.toFixed(2)).padStart(10) +
      ('₱' + previousBalance.toFixed(2)).padStart(12) +
      ('₱' + totalAdvanceApplied.toFixed(2)).padStart(12) +
      ('₱' + total.toFixed(2)).padStart(12)
    )
  }

  console.log('\n' + '='.repeat(60))
  console.log('COMPLETE')
  console.log('='.repeat(60))
  console.log(`September bills: ${billsGenerated} (now with SP Assessment)`)
  console.log(`October bills: ${octBillsGenerated}`)
  console.log(`October total: ₱${octTotalAmount.toLocaleString()}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
