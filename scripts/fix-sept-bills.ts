import { PrismaClient } from '@prisma/client'
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
  const match = csvUnit.match(/(\d+F)\s+(\d+)/i)
  if (match) {
    return `M2-${match[1].toUpperCase()}-${match[2]}`
  }
  return csvUnit
}

async function main() {
  console.log('=== Fix September 2025 Bills Using Payment Data ===\n')

  // Read payment CSV (payments = bills since paid in full)
  const csvPath = 'D:\\Megatower\\scripts\\september-2025-payments.csv'
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const lines = csvContent.trim().split('\n')
  const dataLines = lines.slice(1)

  // Get tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    return
  }

  // Get all units
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, unitNumber: true }
  })
  const unitMap = new Map(units.map(u => [u.unitNumber, u.id]))

  let updated = 0
  let skipped = 0

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
    }

    // Skip if no payment (means no bill either)
    if (payment.totalPayment === 0) {
      console.log(`Skipping ${payment.unitNumber} - No payment/bill`)
      skipped++
      continue
    }

    // Convert unit number
    const dbUnitNumber = convertUnitNumber(payment.unitNumber)
    const unitId = unitMap.get(dbUnitNumber)

    if (!unitId) {
      console.error(`Unit not found: ${payment.unitNumber} (${dbUnitNumber})`)
      skipped++
      continue
    }

    // Find the September bill for this unit
    const septBill = await prisma.bill.findFirst({
      where: {
        unitId,
        billingMonth: {
          gte: new Date('2025-09-01'),
          lt: new Date('2025-10-01')
        }
      }
    })

    if (!septBill) {
      console.log(`No September bill found for ${dbUnitNumber}`)
      skipped++
      continue
    }

    // Calculate new total (payment = bill since paid in full)
    const newTotal = payment.electric + payment.water + payment.associationDues + payment.specialAssessment

    // Update the bill to match the payment amounts
    await prisma.bill.update({
      where: { id: septBill.id },
      data: {
        electricAmount: payment.electric,
        waterAmount: payment.water,
        associationDues: payment.associationDues,
        spAssessment: payment.specialAssessment,
        totalAmount: newTotal,
        paidAmount: newTotal, // Paid in full
        balance: 0, // No balance remaining
        status: 'PAID'
      }
    })

    const oldTotal = Number(septBill.totalAmount)
    const diff = newTotal - oldTotal

    console.log(`✓ ${dbUnitNumber} | Old: ₱${oldTotal.toFixed(2)} → New: ₱${newTotal.toFixed(2)} | Diff: ${diff >= 0 ? '+' : ''}₱${diff.toFixed(2)}`)
    updated++
  }

  console.log('\n=== Summary ===')
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
