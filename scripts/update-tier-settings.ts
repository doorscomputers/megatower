/**
 * Update Tenant Settings with Correct Tier Boundaries
 * Run with: npx tsx scripts/update-tier-settings.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Updating tenant settings with correct tier boundaries...')

  // Update tenant settings with correct tier boundaries
  const result = await prisma.tenantSettings.updateMany({
    data: {
      // Residential tier boundaries - EXCLUSIVE upper bounds
      waterResTier1Max: 1,    // <=1 → Tier 1
      waterResTier2Max: 6,    // <6 → Tier 2 (includes 2,3,4,5)
      waterResTier3Max: 11,   // <11 → Tier 3 (includes 6-10)
      waterResTier4Max: 21,   // <21 → Tier 4 (includes 11-20)
      waterResTier5Max: 31,   // <31 → Tier 5 (includes 21-30)
      waterResTier6Max: 41,   // <41 → Tier 6 (includes 31-40)
      // Commercial tier boundaries
      waterComTier1Max: 1,
      waterComTier2Max: 6,
      waterComTier3Max: 11,
      waterComTier4Max: 21,
      waterComTier5Max: 31,
      waterComTier6Max: 41,
    }
  })

  console.log(`Updated ${result.count} tenant settings record(s)`)
  console.log('')
  console.log('Correct tier boundary values:')
  console.log('  Tier 1 Max: 1  (<=1 cu.m)')
  console.log('  Tier 2 Max: 6  (<6 means 2-5 cu.m)')
  console.log('  Tier 3 Max: 11 (<11 means 6-10 cu.m)')
  console.log('  Tier 4 Max: 21 (<21 means 11-20 cu.m)')
  console.log('  Tier 5 Max: 31 (<31 means 21-30 cu.m)')
  console.log('  Tier 6 Max: 41 (<41 means 31-40 cu.m)')
  console.log('  Tier 7: >40 cu.m')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
