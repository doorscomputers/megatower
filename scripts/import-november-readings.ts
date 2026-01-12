import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// November 2025 meter readings (read on Oct 26 for Nov billing)
// Format: unitNumber, elecPrev, elecPres, elecCons, waterPrev, waterPres, waterCons
const NOVEMBER_READINGS = [
  { unit: 'M2-2F-1', elecPrev: 8982, elecPres: 9097, elecCons: 115, waterPrev: 626, waterPres: 628, waterCons: 2 },
  { unit: 'M2-2F-2', elecPrev: 10177, elecPres: 10306, elecCons: 129, waterPrev: 552, waterPres: 560, waterCons: 8 },
  { unit: 'M2-2F-3', elecPrev: 7956, elecPres: 8064, elecCons: 108, waterPrev: 481, waterPres: 488, waterCons: 7 },
  { unit: 'M2-2F-5', elecPrev: 5917, elecPres: 5934, elecCons: 17, waterPrev: 400, waterPres: 402, waterCons: 2 },
  { unit: 'M2-2F-6', elecPrev: 11697, elecPres: 11854, elecCons: 157, waterPrev: 502, waterPres: 507, waterCons: 5 },
  { unit: 'M2-2F-7', elecPrev: 11062, elecPres: 11185, elecCons: 123, waterPrev: 467, waterPres: 473, waterCons: 6 },
  { unit: 'M2-2F-8', elecPrev: 6887, elecPres: 6922, elecCons: 35, waterPrev: 452, waterPres: 453, waterCons: 1 },
  { unit: 'M2-2F-9', elecPrev: 8017, elecPres: 8095, elecCons: 78, waterPrev: 374, waterPres: 377, waterCons: 3 },
  { unit: 'M2-2F-10', elecPrev: 9372, elecPres: 9451, elecCons: 79, waterPrev: 673, waterPres: 678, waterCons: 5 },
  { unit: 'M2-2F-11', elecPrev: 11311, elecPres: 11515, elecCons: 204, waterPrev: 682, waterPres: 694, waterCons: 12 },
  { unit: 'M2-2F-12', elecPrev: 7681, elecPres: 7818, elecCons: 137, waterPrev: 487, waterPres: 491, waterCons: 4 },
  { unit: 'M2-2F-15', elecPrev: 10148, elecPres: 10285, elecCons: 137, waterPrev: 664, waterPres: 671, waterCons: 7 },
  { unit: 'M2-2F-16', elecPrev: 7139, elecPres: 7207, elecCons: 68, waterPrev: 423, waterPres: 427, waterCons: 4 },
  { unit: 'M2-2F-17', elecPrev: 7681, elecPres: 7718, elecCons: 37, waterPrev: 372, waterPres: 374, waterCons: 2 },
  { unit: 'M2-2F-18', elecPrev: 9133, elecPres: 9208, elecCons: 75, waterPrev: 716, waterPres: 721, waterCons: 5 },
  { unit: 'M2-2F-19', elecPrev: 7764, elecPres: 7799, elecCons: 35, waterPrev: 396, waterPres: 397, waterCons: 1 },
  { unit: 'M2-2F-20', elecPrev: 4701, elecPres: 4735, elecCons: 34, waterPrev: 305, waterPres: 309, waterCons: 4 },
  { unit: 'M2-2F-21', elecPrev: 9811, elecPres: 9934, elecCons: 123, waterPrev: 691, waterPres: 699, waterCons: 8 },
  { unit: 'M2-2F-22', elecPrev: 10439, elecPres: 10605, elecCons: 166, waterPrev: 590, waterPres: 598, waterCons: 8 },
]

async function main() {
  console.log('=== Importing November 2025 Meter Readings ===\n')

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    return
  }

  // November billing period (readings taken Sept 27 - Oct 26)
  const billingPeriod = new Date('2025-11-01')
  const readingDate = new Date('2025-10-26')

  let electricCreated = 0
  let electricUpdated = 0
  let waterCreated = 0
  let waterUpdated = 0

  for (const reading of NOVEMBER_READINGS) {
    const unit = await prisma.unit.findFirst({
      where: { unitNumber: reading.unit, tenantId: tenant.id }
    })

    if (!unit) {
      console.log(`Unit ${reading.unit} not found - skipping`)
      continue
    }

    // Electric reading
    const existingElectric = await prisma.electricReading.findUnique({
      where: {
        unitId_billingPeriod: {
          unitId: unit.id,
          billingPeriod
        }
      }
    })

    if (existingElectric) {
      await prisma.electricReading.update({
        where: { id: existingElectric.id },
        data: {
          previousReading: reading.elecPrev,
          presentReading: reading.elecPres,
          consumption: reading.elecCons,
          readingDate
        }
      })
      electricUpdated++
    } else {
      await prisma.electricReading.create({
        data: {
          unitId: unit.id,
          billingPeriod,
          readingDate,
          previousReading: reading.elecPrev,
          presentReading: reading.elecPres,
          consumption: reading.elecCons
        }
      })
      electricCreated++
    }

    // Water reading
    const existingWater = await prisma.waterReading.findUnique({
      where: {
        unitId_billingPeriod: {
          unitId: unit.id,
          billingPeriod
        }
      }
    })

    if (existingWater) {
      await prisma.waterReading.update({
        where: { id: existingWater.id },
        data: {
          previousReading: reading.waterPrev,
          presentReading: reading.waterPres,
          consumption: reading.waterCons,
          readingDate
        }
      })
      waterUpdated++
    } else {
      await prisma.waterReading.create({
        data: {
          unitId: unit.id,
          billingPeriod,
          readingDate,
          previousReading: reading.waterPrev,
          presentReading: reading.waterPres,
          consumption: reading.waterCons
        }
      })
      waterCreated++
    }

    console.log(`${reading.unit}: Electric ${reading.elecPrev}→${reading.elecPres}=${reading.elecCons}kWh, Water ${reading.waterPrev}→${reading.waterPres}=${reading.waterCons}cu.m`)
  }

  console.log('\n=== Summary ===')
  console.log(`Electric readings: ${electricCreated} created, ${electricUpdated} updated`)
  console.log(`Water readings: ${waterCreated} created, ${waterUpdated} updated`)
  console.log('\n=== Import Complete ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
