/**
 * Seed Sample Data Script
 *
 * Adds sample owners, units, and meter readings directly to the database.
 * Run with: npx tsx prisma/seed-sample-data.ts
 */

import { PrismaClient, UnitType, OccupancyStatus } from '@prisma/client'

const prisma = new PrismaClient()

// Configuration
const BILLING_MONTH = new Date('2025-01-01') // January 2025
// Reading date is typically the 26th of the previous month (per billing cycle)
const READING_DATE = new Date('2024-12-26')

// Sample Owners
const SAMPLE_OWNERS = [
  { lastName: 'Dela Cruz', firstName: 'Juan', email: 'juan@example.com', phone: '09171234567' },
  { lastName: 'Santos', firstName: 'Maria', email: 'maria@example.com', phone: '09181234567' },
  { lastName: 'Reyes', firstName: 'Pedro', email: 'pedro@example.com', phone: '09191234567' },
  { lastName: 'Garcia', firstName: 'Ana', email: 'ana@example.com', phone: '09201234567' },
  { lastName: 'Mendoza', firstName: 'Jose', email: 'jose@example.com', phone: '09211234567' },
  { lastName: 'Lopez', firstName: 'Carmen', email: 'carmen@example.com', phone: '09221234567' },
  { lastName: 'Corp', firstName: 'HomeAsia', email: 'homeasia@corp.com', phone: '028881234' },
  { lastName: 'Insurance', firstName: 'Commonwealth', email: 'cwi@insurance.com', phone: '028882345' },
]

// Sample Units (matching Excel GF, 2F-6F structure)
const SAMPLE_UNITS = [
  // Ground Floor - Mix of Commercial and Residential
  { unitNumber: 'GF-1', floorLevel: 'GF', area: 34.5, unitType: 'COMMERCIAL' as UnitType, ownerIndex: 6 },
  { unitNumber: 'GF-2', floorLevel: 'GF', area: 35.0, unitType: 'COMMERCIAL' as UnitType, ownerIndex: 6 },
  { unitNumber: 'GF-3', floorLevel: 'GF', area: 48.5, unitType: 'COMMERCIAL' as UnitType, ownerIndex: 6 },
  { unitNumber: 'GF-4', floorLevel: 'GF', area: 25.5, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 0 },
  { unitNumber: 'GF-5', floorLevel: 'GF', area: 30.0, unitType: 'COMMERCIAL' as UnitType, ownerIndex: 6 },
  { unitNumber: 'GF-6', floorLevel: 'GF', area: 28.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 1 },
  { unitNumber: 'GF-7', floorLevel: 'GF', area: 32.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 2 },
  { unitNumber: 'GF-8', floorLevel: 'GF', area: 29.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 3 },

  // 2nd Floor - Residential
  { unitNumber: '2F-1', floorLevel: '2F', area: 45.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 0 },
  { unitNumber: '2F-2', floorLevel: '2F', area: 40.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 1 },
  { unitNumber: '2F-3', floorLevel: '2F', area: 38.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 2 },
  { unitNumber: '2F-4', floorLevel: '2F', area: 42.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 3 },
  { unitNumber: '2F-5', floorLevel: '2F', area: 35.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 4 },
  { unitNumber: '2F-6', floorLevel: '2F', area: 41.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 5 },

  // 3rd Floor - Residential
  { unitNumber: '3F-1', floorLevel: '3F', area: 50.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 0 },
  { unitNumber: '3F-2', floorLevel: '3F', area: 45.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 1 },
  { unitNumber: '3F-3', floorLevel: '3F', area: 41.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 2 },
  { unitNumber: '3F-4', floorLevel: '3F', area: 38.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 3 },
  { unitNumber: '3F-5', floorLevel: '3F', area: 55.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 4 },

  // 4th Floor - Residential
  { unitNumber: '4F-1', floorLevel: '4F', area: 48.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 0 },
  { unitNumber: '4F-2', floorLevel: '4F', area: 52.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 1 },
  { unitNumber: '4F-3', floorLevel: '4F', area: 44.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 2 },
  { unitNumber: '4F-4', floorLevel: '4F', area: 46.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 3 },

  // 5th Floor - Residential
  { unitNumber: '5F-1', floorLevel: '5F', area: 58.5, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 4 },
  { unitNumber: '5F-2', floorLevel: '5F', area: 67.5, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 5 },
  { unitNumber: '5F-3', floorLevel: '5F', area: 54.0, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 0 },

  // 6th Floor - Residential (larger units)
  { unitNumber: '6F-1', floorLevel: '6F', area: 58.5, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 1 },
  { unitNumber: '6F-2', floorLevel: '6F', area: 67.5, unitType: 'RESIDENTIAL' as UnitType, ownerIndex: 2 },
]

// Generate realistic meter readings
function generateReadings(unitNumber: string, unitType: UnitType) {
  // Base readings (simulate existing meter readings)
  const electricBase = 10000 + Math.floor(Math.random() * 5000)
  const waterBase = 500 + Math.floor(Math.random() * 200)

  // Consumption varies by unit type
  // Commercial tends to use more
  const electricConsumption = unitType === 'COMMERCIAL'
    ? Math.floor(Math.random() * 400) + 100  // 100-500 kWh
    : Math.floor(Math.random() * 200) + 30   // 30-230 kWh

  // Water consumption varies to test all tiers
  // Values chosen to test: 0-1, 2-5, 6-10, 11-20, 21-30, 31-40, 40+ tiers
  const waterTierTargets = [1, 3, 5, 7, 10, 14, 18, 22, 27, 35, 45]
  const waterConsumption = waterTierTargets[Math.floor(Math.random() * waterTierTargets.length)]

  return {
    electricPrev: electricBase,
    electricPres: electricBase + electricConsumption,
    electricCons: electricConsumption,
    waterPrev: waterBase,
    waterPres: waterBase + waterConsumption,
    waterCons: waterConsumption,
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('SEEDING SAMPLE DATA')
  console.log('='.repeat(60))

  // Get tenant ID
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found! Run npm run db:seed first.')
    process.exit(1)
  }

  console.log(`\nUsing tenant: ${tenant.name}`)

  // 1. Create Owners
  console.log('\n1. Creating owners...')
  const ownerIds: string[] = []

  for (const owner of SAMPLE_OWNERS) {
    const existing = await prisma.owner.findFirst({
      where: { email: owner.email, tenantId: tenant.id }
    })

    const ownerName = `${owner.firstName} ${owner.lastName}`
    if (existing) {
      ownerIds.push(existing.id)
      console.log(`   Exists: ${ownerName}`)
    } else {
      const created = await prisma.owner.create({
        data: {
          ...owner,
          tenantId: tenant.id,
        }
      })
      ownerIds.push(created.id)
      console.log(`   Created: ${ownerName}`)
    }
  }

  // 2. Create Units
  console.log('\n2. Creating units...')
  const unitMap: Record<string, { id: string; unitType: UnitType }> = {}

  for (const unit of SAMPLE_UNITS) {
    const ownerId = ownerIds[Math.min(unit.ownerIndex, ownerIds.length - 1)]

    const existing = await prisma.unit.findFirst({
      where: { unitNumber: unit.unitNumber, tenantId: tenant.id }
    })

    if (existing) {
      unitMap[unit.unitNumber] = { id: existing.id, unitType: existing.unitType }
      console.log(`   Exists: ${unit.unitNumber}`)
    } else {
      const created = await prisma.unit.create({
        data: {
          unitNumber: unit.unitNumber,
          floorLevel: unit.floorLevel,
          area: unit.area,
          unitType: unit.unitType,
          occupancyStatus: OccupancyStatus.OCCUPIED,
          ownerId: ownerId,
          tenantId: tenant.id,
        }
      })
      unitMap[unit.unitNumber] = { id: created.id, unitType: created.unitType }
      console.log(`   Created: ${unit.unitNumber} (${unit.unitType})`)
    }
  }

  // 3. Create Meter Readings for the billing month
  console.log(`\n3. Creating meter readings for ${BILLING_MONTH.toISOString().slice(0, 7)}...`)

  for (const [unitNumber, unitInfo] of Object.entries(unitMap)) {
    const readings = generateReadings(unitNumber, unitInfo.unitType)

    // Check if readings already exist
    const existingElectric = await prisma.electricReading.findFirst({
      where: {
        unitId: unitInfo.id,
        billingPeriod: BILLING_MONTH,
      }
    })

    if (!existingElectric) {
      await prisma.electricReading.create({
        data: {
          unitId: unitInfo.id,
          readingDate: READING_DATE,
          billingPeriod: BILLING_MONTH,
          previousReading: readings.electricPrev,
          presentReading: readings.electricPres,
          consumption: readings.electricCons,
        }
      })
      console.log(`   Electric ${unitNumber}: ${readings.electricCons} kWh`)
    } else {
      console.log(`   Electric ${unitNumber}: Already exists`)
    }

    const existingWater = await prisma.waterReading.findFirst({
      where: {
        unitId: unitInfo.id,
        billingPeriod: BILLING_MONTH,
      }
    })

    if (!existingWater) {
      await prisma.waterReading.create({
        data: {
          unitId: unitInfo.id,
          readingDate: READING_DATE,
          billingPeriod: BILLING_MONTH,
          previousReading: readings.waterPrev,
          presentReading: readings.waterPres,
          consumption: readings.waterCons,
        }
      })
      console.log(`   Water ${unitNumber}: ${readings.waterCons} cu.m`)
    } else {
      console.log(`   Water ${unitNumber}: Already exists`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('SAMPLE DATA SEEDING COMPLETE!')
  console.log('='.repeat(60))

  console.log(`
Summary:
- Owners: ${ownerIds.length}
- Units: ${Object.keys(unitMap).length}
- Billing Period: ${BILLING_MONTH.toISOString().slice(0, 7)}

Next Steps:
1. Go to /billing/generate to generate bills
2. Select the billing month: ${BILLING_MONTH.toISOString().slice(0, 7)}
3. Click "Preview Bills" and then "Generate Bills"
`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
