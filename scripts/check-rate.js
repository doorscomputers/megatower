const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Update penalty rate to 10 (meaning 10%)
  await p.tenantSettings.updateMany({
    data: { penaltyRate: 10 }
  })
  console.log('Updated penalty rate to 10')

  const s = await p.tenantSettings.findFirst()
  console.log('New rate:', Number(s.penaltyRate))

  await p.$disconnect()
}

main().catch(console.error)
