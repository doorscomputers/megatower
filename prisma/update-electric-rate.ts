/**
 * Update electric rate to 11.94 and regenerate October bills
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('UPDATING ELECTRIC RATE')
  console.log('='.repeat(60))

  const tenant = await prisma.tenant.findFirst({
    include: { settings: true }
  })

  if (!tenant || !tenant.settings) {
    console.error('No tenant or settings found!')
    process.exit(1)
  }

  console.log(`\nCurrent electric rate: ₱${tenant.settings.electricRate}`)
  console.log(`New electric rate: ₱11.94`)

  // Update the electric rate
  await prisma.tenantSettings.update({
    where: { id: tenant.settings.id },
    data: {
      electricRate: 11.94
    }
  })

  console.log('\nElectric rate updated successfully!')

  // Verify the update
  const updated = await prisma.tenantSettings.findUnique({
    where: { id: tenant.settings.id }
  })
  console.log(`Verified new rate: ₱${updated?.electricRate}`)

  console.log('\n' + '='.repeat(60))
  console.log('Now regenerate October bills with:')
  console.log('  npx tsx prisma/regenerate-october.ts')
  console.log('  npx tsx prisma/generate-sept-oct-bills.ts --october')
  console.log('='.repeat(60))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
