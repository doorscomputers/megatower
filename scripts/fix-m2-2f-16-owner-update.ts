/**
 * Fix M2-2F-16 owner assignment
 * Change from Parfiles to Mark Jayson C. Padua
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Fixing M2-2F-16 Owner Assignment ===\n')

  // Get tenant ID
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.log('No tenant found!')
    return
  }

  // Find Mark Padua owner
  let markPadua = await prisma.owner.findFirst({
    where: {
      lastName: { contains: 'Padua', mode: 'insensitive' }
    }
  })

  // Update Mark Padua's name to full name
  if (markPadua) {
    console.log(`Found existing owner: ${markPadua.firstName} ${markPadua.lastName}`)

    // Update to full name
    markPadua = await prisma.owner.update({
      where: { id: markPadua.id },
      data: {
        firstName: 'MARK JAYSON C.',
        lastName: 'PADUA'
      }
    })
    console.log(`Updated name to: ${markPadua.firstName} ${markPadua.lastName}`)
  } else {
    // Create new owner
    markPadua = await prisma.owner.create({
      data: {
        tenantId: tenant.id,
        firstName: 'MARK JAYSON C.',
        lastName: 'PADUA'
      }
    })
    console.log(`Created new owner: ${markPadua.firstName} ${markPadua.lastName}`)
  }

  // Find M2-2F-16 unit
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-16' },
    include: { owner: true }
  })

  if (!unit) {
    console.log('Unit M2-2F-16 not found!')
    return
  }

  console.log(`\nBefore: ${unit.unitNumber} -> ${unit.owner?.firstName} ${unit.owner?.lastName}`)

  // Update unit to correct owner
  await prisma.unit.update({
    where: { id: unit.id },
    data: { ownerId: markPadua.id }
  })

  // Verify
  const updatedUnit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-16' },
    include: { owner: true }
  })

  console.log(`After: ${updatedUnit?.unitNumber} -> ${updatedUnit?.owner?.firstName} ${updatedUnit?.owner?.lastName}`)

  console.log('\n=== Done ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
