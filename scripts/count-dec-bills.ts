import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const count = await prisma.bill.count({
    where: { billingMonth: new Date('2025-12-01T00:00:00.000Z') }
  })
  console.log('December 2025 bills count:', count)
}
main().catch(console.error).finally(() => prisma.$disconnect())
