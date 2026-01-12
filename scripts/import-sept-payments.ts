import { PrismaClient, PaymentMethod, PaymentStatus } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

interface PaymentCSV {
  unitNumber: string
  ownerName: string
  electric: number
  water: number
  associationDues: number
  pastDues: number
  specialAssessment: number
  advancePayment: number
  totalPayment: number
  previousBalance: number
  orNumbers: string
}

// Parse CSV line considering quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

// Convert "2F 1 Megatower 2" to "M2-2F-1"
function convertUnitNumber(csvUnit: string): string {
  // Extract "2F X" from "2F X Megatower 2"
  const match = csvUnit.match(/(\d+F)\s+(\d+)/i)
  if (match) {
    return `M2-${match[1].toUpperCase()}-${match[2]}`
  }
  return csvUnit
}

// Extract first OR number from OR numbers string
function extractOrNumber(orNumbers: string): string | null {
  // Format: "Electric: OR# 21325; Water: OR# 21325; ..."
  const match = orNumbers.match(/OR#\s*(\d+)/i)
  if (match && match[1] !== '0') {
    return match[1]
  }
  return null
}

async function main() {
  // Read CSV file
  const csvPath = 'D:\\Megatower\\scripts\\september-2025-payments.csv'
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const lines = csvContent.trim().split('\n')

  // Skip header
  const dataLines = lines.slice(1)

  // Get tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    return
  }
  console.log('Tenant:', tenant.name, '- ID:', tenant.id)

  // Get all units for mapping
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, unitNumber: true }
  })
  const unitMap = new Map(units.map(u => [u.unitNumber, u.id]))

  // Payment date - September 30, 2025
  const paymentDate = new Date('2025-09-30')

  let created = 0
  let skipped = 0
  let errors = 0

  for (const line of dataLines) {
    const values = parseCSVLine(line)

    const payment: PaymentCSV = {
      unitNumber: values[0],
      ownerName: values[1],
      electric: parseFloat(values[2]) || 0,
      water: parseFloat(values[3]) || 0,
      associationDues: parseFloat(values[4]) || 0,
      pastDues: parseFloat(values[5]) || 0,
      specialAssessment: parseFloat(values[6]) || 0,
      advancePayment: parseFloat(values[7]) || 0,
      totalPayment: parseFloat(values[8]) || 0,
      previousBalance: parseFloat(values[9]) || 0,
      orNumbers: values[10] || ''
    }

    // Skip if no payment
    if (payment.totalPayment === 0) {
      console.log(`Skipping ${payment.unitNumber} - No payment`)
      skipped++
      continue
    }

    // Convert unit number
    const dbUnitNumber = convertUnitNumber(payment.unitNumber)
    const unitId = unitMap.get(dbUnitNumber)

    if (!unitId) {
      console.error(`Unit not found: ${payment.unitNumber} (${dbUnitNumber})`)
      errors++
      continue
    }

    // Extract OR number
    const orNumber = extractOrNumber(payment.orNumbers)

    // Check if payment with this OR already exists
    if (orNumber) {
      const existing = await prisma.payment.findFirst({
        where: {
          tenantId: tenant.id,
          orNumber: orNumber
        }
      })
      if (existing) {
        console.log(`Skipping ${dbUnitNumber} - OR# ${orNumber} already exists`)
        skipped++
        continue
      }
    }

    try {
      // Create payment
      const newPayment = await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          unitId: unitId,
          orNumber: orNumber,
          paymentDate: paymentDate,
          electricAmount: payment.electric,
          waterAmount: payment.water,
          duesAmount: payment.associationDues,
          pastDuesAmount: payment.pastDues,
          spAssessmentAmount: payment.specialAssessment,
          advanceDuesAmount: 0,
          advanceUtilAmount: payment.advancePayment,
          totalAmount: payment.totalPayment,
          paymentMethod: PaymentMethod.CASH,
          status: PaymentStatus.CONFIRMED,
          remarks: `Imported from Sept 2025 Excel - Owner: ${payment.ownerName}`
        }
      })

      console.log(`Created payment for ${dbUnitNumber} | OR# ${orNumber || 'N/A'} | Total: ₱${payment.totalPayment.toFixed(2)}`)
      created++
    } catch (err: any) {
      console.error(`Error creating payment for ${dbUnitNumber}:`, err.message)
      errors++
    }
  }

  console.log('\n=== Import Summary ===')
  console.log(`Created: ${created}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors: ${errors}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
