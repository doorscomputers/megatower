const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function check() {
  // Check M2-2F-16 ALL bills with their status
  const unit16 = await p.unit.findFirst({ where: { unitNumber: 'M2-2F-16' }})
  console.log('=== M2-2F-16 ALL Bills ===')
  const bills16 = await p.bill.findMany({
    where: { unitId: unit16.id },
    orderBy: { billingMonth: 'asc' }
  })
  for (const b of bills16) {
    console.log(b.billingMonth.toISOString().slice(0,7), '| Status:', b.status.padEnd(8), '| Total:', Number(b.totalAmount).toFixed(2).padStart(10), '| Paid:', Number(b.paidAmount).toFixed(2).padStart(10), '| Balance:', Number(b.balance).toFixed(2).padStart(10))
  }

  // Check M2-2F-17 ALL bills with their status
  const unit17 = await p.unit.findFirst({ where: { unitNumber: 'M2-2F-17' }})
  console.log('')
  console.log('=== M2-2F-17 ALL Bills ===')
  const bills17 = await p.bill.findMany({
    where: { unitId: unit17.id },
    orderBy: { billingMonth: 'asc' }
  })
  for (const b of bills17) {
    console.log(b.billingMonth.toISOString().slice(0,7), '| Status:', b.status.padEnd(8), '| Total:', Number(b.totalAmount).toFixed(2).padStart(10), '| Paid:', Number(b.paidAmount).toFixed(2).padStart(10), '| Balance:', Number(b.balance).toFixed(2).padStart(10))
  }

  await p.$disconnect()
}
check().catch(console.error)
