/**
 * Record excess payment amounts as advance balances
 *
 * Run with: npx tsx prisma/record-advance-balances.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('RECORDING ADVANCE BALANCES FROM EXCESS PAYMENTS')
  console.log('='.repeat(60))

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
      unit: { select: { id: true, unitNumber: true } },
      billPayments: true
    }
  })

  // Calculate excess per unit
  const excessByUnit = new Map<string, { unitId: string, unitNumber: string, excess: number }>()

  for (const payment of payments) {
    const paymentTotal = Number(payment.totalAmount)
    const allocatedAmount = payment.billPayments.reduce((sum, bp) => sum + Number(bp.totalAmount), 0)
    const excess = paymentTotal - allocatedAmount

    if (excess > 0.01) {
      const current = excessByUnit.get(payment.unitId) || {
        unitId: payment.unitId,
        unitNumber: payment.unit.unitNumber,
        excess: 0
      }
      current.excess += excess
      excessByUnit.set(payment.unitId, current)
    }
  }

  console.log(`\nFound ${excessByUnit.size} units with excess payments\n`)

  let totalAdvanceRecorded = 0

  for (const [unitId, data] of excessByUnit) {
    // Split excess 50/50 between dues and utilities (as per the existing logic)
    const advanceDues = data.excess / 2
    const advanceUtilities = data.excess / 2

    // Upsert advance balance
    await prisma.unitAdvanceBalance.upsert({
      where: {
        tenantId_unitId: {
          tenantId: tenant.id,
          unitId: unitId
        }
      },
      update: {
        advanceDues: { increment: advanceDues },
        advanceUtilities: { increment: advanceUtilities },
      },
      create: {
        tenantId: tenant.id,
        unitId: unitId,
        advanceDues: advanceDues,
        advanceUtilities: advanceUtilities,
      }
    })

    totalAdvanceRecorded += data.excess
    console.log(`${data.unitNumber}: ₱${data.excess.toLocaleString()} → Dues: ₱${advanceDues.toLocaleString()}, Util: ₱${advanceUtilities.toLocaleString()}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('ADVANCE BALANCES RECORDED')
  console.log('='.repeat(60))
  console.log(`Total advance recorded: ₱${totalAdvanceRecorded.toLocaleString()}`)
  console.log(`Units with advances: ${excessByUnit.size}`)

  // Verify
  const advances = await prisma.unitAdvanceBalance.findMany({
    where: { tenantId: tenant.id },
    include: { unit: { select: { unitNumber: true } } }
  })

  console.log('\n--- ADVANCE BALANCES IN DATABASE ---')
  let totalDues = 0
  let totalUtil = 0
  for (const adv of advances) {
    const dues = Number(adv.advanceDues)
    const util = Number(adv.advanceUtilities)
    totalDues += dues
    totalUtil += util
    console.log(`${adv.unit.unitNumber}: Dues ₱${dues.toLocaleString()}, Util ₱${util.toLocaleString()}`)
  }
  console.log(`\nTotal Advance Dues: ₱${totalDues.toLocaleString()}`)
  console.log(`Total Advance Utilities: ₱${totalUtil.toLocaleString()}`)
  console.log(`Grand Total: ₱${(totalDues + totalUtil).toLocaleString()}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
