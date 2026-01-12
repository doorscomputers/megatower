import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) return

  console.log('=== October 2025 Import Verification ===\n')

  // 1. Check October Bills Status
  console.log('--- October 2025 Bills Status ---')
  const octBills = await prisma.bill.findMany({
    where: {
      billingMonth: new Date('2025-10-01'),
      unit: { unitNumber: { startsWith: 'M2-2F' } }
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  let paidCount = 0
  let partialCount = 0
  let unpaidCount = 0

  for (const b of octBills) {
    const status = b.status
    if (status === 'PAID') paidCount++
    else if (status === 'PARTIAL') partialCount++
    else unpaidCount++
    console.log(`${b.unit.unitNumber}: Total=₱${Number(b.totalAmount).toFixed(2)}, Paid=₱${Number(b.paidAmount).toFixed(2)}, Balance=₱${Number(b.balance).toFixed(2)}, Status=${status}`)
  }
  console.log(`\nSummary: ${paidCount} PAID, ${partialCount} PARTIAL, ${unpaidCount} UNPAID\n`)

  // 2. Check October Payments
  console.log('--- October 2025 Payments ---')
  const octPayments = await prisma.payment.findMany({
    where: {
      paymentDate: { gte: new Date('2025-10-01'), lt: new Date('2025-11-01') },
      unit: { unitNumber: { startsWith: 'M2-2F' } }
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  let totalPayments = 0
  for (const p of octPayments) {
    const total = Number(p.totalAmount)
    totalPayments += total
    console.log(`${p.unit.unitNumber}: OR#${p.orNumber}, Electric=₱${Number(p.electricAmount).toFixed(2)}, Water=₱${Number(p.waterAmount).toFixed(2)}, Dues=₱${Number(p.duesAmount).toFixed(2)}, Total=₱${total.toFixed(2)}`)
  }
  console.log(`\nTotal October Payments: ₱${totalPayments.toFixed(2)} (${octPayments.length} payments)\n`)

  // 3. Check November Meter Readings
  console.log('--- November 2025 Meter Readings ---')
  const novElecReadings = await prisma.electricReading.findMany({
    where: {
      billingPeriod: new Date('2025-11-01'),
      unit: { unitNumber: { startsWith: 'M2-2F' } }
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  const novWaterReadings = await prisma.waterReading.findMany({
    where: {
      billingPeriod: new Date('2025-11-01'),
      unit: { unitNumber: { startsWith: 'M2-2F' } }
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  console.log(`Electric readings: ${novElecReadings.length}`)
  console.log(`Water readings: ${novWaterReadings.length}\n`)

  for (const er of novElecReadings) {
    const wr = novWaterReadings.find(w => w.unitId === er.unitId)
    console.log(`${er.unit.unitNumber}: Electric ${Number(er.previousReading)}→${Number(er.presentReading)}=${Number(er.consumption)}kWh, Water ${Number(wr?.previousReading || 0)}→${Number(wr?.presentReading || 0)}=${Number(wr?.consumption || 0)}cu.m`)
  }

  // 4. Check Advance Balances
  console.log('\n--- Advance Balances ---')
  const advances = await prisma.unitAdvanceBalance.findMany({
    where: {
      unit: { unitNumber: { startsWith: 'M2-2F' } }
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  if (advances.length === 0) {
    console.log('No advance balances found')
  } else {
    for (const a of advances) {
      console.log(`${a.unit.unitNumber}: Advance Dues=₱${Number(a.advanceDues).toFixed(2)}, Advance Utilities=₱${Number(a.advanceUtilities).toFixed(2)}`)
    }
  }

  console.log('\n=== Verification Complete ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
