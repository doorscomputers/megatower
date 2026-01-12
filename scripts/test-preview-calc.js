const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function simulatePreview() {
  // Simulate what the bill generation API does for M2-2F-16
  const unit = await p.unit.findFirst({ where: { unitNumber: 'M2-2F-16' } })

  console.log('=== Simulating Bill Generation Preview for M2-2F-16 ===')
  console.log('Unit ID:', unit.id)

  // This is the exact same query as in the API
  const previousBills = await p.bill.findMany({
    where: {
      unitId: unit.id,
      status: {
        in: ["UNPAID", "PARTIAL"],
      },
    },
    orderBy: {
      dueDate: "asc",
    },
  })

  console.log('\nPrevious bills found (UNPAID/PARTIAL):', previousBills.length)

  let previousBalance = 0
  for (const prevBill of previousBills) {
    const unpaidBalance = Math.max(0, Number(prevBill.balance))
    console.log(`  ${prevBill.billingMonth.toISOString().slice(0,7)}: balance=${unpaidBalance.toFixed(2)}, status=${prevBill.status}`)
    previousBalance += unpaidBalance
  }

  console.log('\n>>> Calculated previousBalance:', previousBalance.toFixed(2))
  console.log('>>> Expected (from screenshot):', '4,768.45')
  console.log('>>> Difference:', (4768.45 - previousBalance).toFixed(2))

  // Also check M2-2F-17
  console.log('\n\n=== Simulating Bill Generation Preview for M2-2F-17 ===')
  const unit17 = await p.unit.findFirst({ where: { unitNumber: 'M2-2F-17' } })

  const previousBills17 = await p.bill.findMany({
    where: {
      unitId: unit17.id,
      status: {
        in: ["UNPAID", "PARTIAL"],
      },
    },
    orderBy: {
      dueDate: "asc",
    },
  })

  console.log('Previous bills found (UNPAID/PARTIAL):', previousBills17.length)

  let previousBalance17 = 0
  for (const prevBill of previousBills17) {
    const unpaidBalance = Math.max(0, Number(prevBill.balance))
    console.log(`  ${prevBill.billingMonth.toISOString().slice(0,7)}: balance=${unpaidBalance.toFixed(2)}, status=${prevBill.status}`)
    previousBalance17 += unpaidBalance
  }

  console.log('\n>>> Calculated previousBalance:', previousBalance17.toFixed(2))
  console.log('>>> Expected (from screenshot):', '308.19')
  console.log('>>> Difference:', (308.19 - previousBalance17).toFixed(2))

  await p.$disconnect()
}

simulatePreview().catch(console.error)
