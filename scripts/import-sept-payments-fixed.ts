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
  const match = csvUnit.match(/(\d+F)\s+(\d+)/i)
  if (match) {
    return `M2-${match[1].toUpperCase()}-${match[2]}`
  }
  return csvUnit
}

// Extract OR numbers from string
function extractOrNumbers(orNumbers: string): { electric?: string, water?: string, dues?: string, sp?: string } {
  const result: { electric?: string, water?: string, dues?: string, sp?: string } = {}

  // Electric: OR# 21325
  const elecMatch = orNumbers.match(/Electric:\s*OR#\s*(\d+)/i)
  if (elecMatch && elecMatch[1] !== '0') result.electric = elecMatch[1]

  // Water: OR# 21325
  const waterMatch = orNumbers.match(/Water:\s*OR#\s*(\d+)/i)
  if (waterMatch && waterMatch[1] !== '0') result.water = waterMatch[1]

  // Association Dues: OR# 137
  const duesMatch = orNumbers.match(/Association Dues:\s*OR#\s*(\d+)/i)
  if (duesMatch && duesMatch[1] !== '0') result.dues = duesMatch[1]

  // Special Assessment: OR# 21325
  const spMatch = orNumbers.match(/Special Assessment:\s*OR#\s*(\d+)/i)
  if (spMatch && spMatch[1] !== '0') result.sp = spMatch[1]

  return result
}

async function main() {
  console.log('=== Import September 2025 Payments with Proper Allocation ===\n')

  // Read CSV file
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
  console.log('Tenant:', tenant.name)

  // Get all units
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, unitNumber: true }
  })
  const unitMap = new Map(units.map(u => [u.unitNumber, u.id]))

  // Payment date - September 15, 2025 (middle of month)
  const paymentDate = new Date('2025-09-15')

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

    const orNums = extractOrNumbers(payment.orNumbers)

    try {
      await prisma.$transaction(async (tx) => {
        // Find the September bill for this unit
        const septBill = await tx.bill.findFirst({
          where: {
            unitId,
            billingMonth: {
              gte: new Date('2025-09-01'),
              lt: new Date('2025-10-01')
            }
          }
        })

        if (!septBill) {
          console.log(`No September bill found for ${dbUnitNumber} - skipping`)
          skipped++
          return
        }

        // Calculate how much to allocate to this bill
        const billTotal = Number(septBill.totalAmount)
        const paymentTotal = payment.totalPayment
        const allocateAmount = Math.min(paymentTotal, billTotal)
        const excessAmount = Math.max(0, paymentTotal - billTotal)

        // Create the payment record
        // Use a unique OR number combining the unit number to avoid duplicates
        // Many units share the same OR# (e.g., 21325) so we make it unique per unit
        const baseOr = orNums.electric || orNums.dues || orNums.water || orNums.sp || 'SEPT'
        const orNumber = `${baseOr}-${dbUnitNumber.replace('M2-', '')}`

        const newPayment = await tx.payment.create({
          data: {
            tenantId: tenant.id,
            unitId,
            orNumber,
            paymentDate,
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

        // Create BillPayment allocation
        await tx.billPayment.create({
          data: {
            paymentId: newPayment.id,
            billId: septBill.id,
            electricAmount: Math.min(payment.electric, Number(septBill.electricAmount)),
            waterAmount: Math.min(payment.water, Number(septBill.waterAmount)),
            duesAmount: Math.min(payment.associationDues, Number(septBill.associationDues)),
            penaltyAmount: Math.min(payment.pastDues, Number(septBill.penaltyAmount)),
            spAssessmentAmount: Math.min(payment.specialAssessment, Number(septBill.spAssessment || 0)),
            otherAmount: 0,
            totalAmount: allocateAmount
          }
        })

        // Update the bill
        const newPaidAmount = Number(septBill.paidAmount) + allocateAmount
        const newBalance = billTotal - newPaidAmount
        let newStatus: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID'

        if (newPaidAmount >= billTotal) {
          newStatus = 'PAID'
        } else if (newPaidAmount > 0) {
          newStatus = 'PARTIAL'
        }

        await tx.bill.update({
          where: { id: septBill.id },
          data: {
            paidAmount: newPaidAmount,
            balance: Math.max(0, newBalance),
            status: newStatus
          }
        })

        // Handle excess as advance payment
        if (excessAmount > 0) {
          await tx.unitAdvanceBalance.upsert({
            where: { unitId },
            update: {
              advanceUtilities: { increment: excessAmount }
            },
            create: {
              unitId,
              tenantId: tenant.id,
              advanceDues: 0,
              advanceUtilities: excessAmount
            }
          })
          console.log(`  → Excess ₱${excessAmount.toFixed(2)} added to advance balance`)
        }

        console.log(`✓ ${dbUnitNumber} | OR# ${orNumber} | Paid ₱${allocateAmount.toFixed(2)} → Bill ${newStatus}`)
        created++
      })
    } catch (err: any) {
      console.error(`✗ Error for ${dbUnitNumber}:`, err.message)
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
