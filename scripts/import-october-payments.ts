import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// November 2025 meter readings (Sept 27 - Oct 26)
// Extracted from Nov SOA Excel file
const NOVEMBER_READINGS = [
  { unit: 'M2-2F-1', electricKwh: 115, waterCuM: 2 },
  { unit: 'M2-2F-2', electricKwh: 129, waterCuM: 8 },
  { unit: 'M2-2F-3', electricKwh: 108, waterCuM: 7 },
  { unit: 'M2-2F-5', electricKwh: 17, waterCuM: 2 },
  { unit: 'M2-2F-6', electricKwh: 157, waterCuM: 5 },
  { unit: 'M2-2F-7', electricKwh: 123, waterCuM: 6 },
  { unit: 'M2-2F-8', electricKwh: 35, waterCuM: 1 },
  { unit: 'M2-2F-9', electricKwh: 78, waterCuM: 3 },
  { unit: 'M2-2F-10', electricKwh: 79, waterCuM: 5 },
  { unit: 'M2-2F-11', electricKwh: 204, waterCuM: 12 },
  { unit: 'M2-2F-12', electricKwh: 137, waterCuM: 4 },
  { unit: 'M2-2F-15', electricKwh: 137, waterCuM: 7 },
  { unit: 'M2-2F-16', electricKwh: 68, waterCuM: 4 },
  { unit: 'M2-2F-17', electricKwh: 37, waterCuM: 2 },
  { unit: 'M2-2F-18', electricKwh: 75, waterCuM: 5 },
  { unit: 'M2-2F-19', electricKwh: 35, waterCuM: 1 },
  { unit: 'M2-2F-20', electricKwh: 34, waterCuM: 4 },
  { unit: 'M2-2F-21', electricKwh: 123, waterCuM: 8 },
  { unit: 'M2-2F-22', electricKwh: 166, waterCuM: 8 },
]

// Calculate electric amount (from Excel formula)
function calculateElectric(kwh: number, rate: number = 8.39, minCharge: number = 50): number {
  const amount = kwh * rate
  return Math.max(amount, minCharge)
}

// Calculate water amount (from Excel residential formula)
function calculateWater(cuM: number): number {
  if (cuM <= 1) return 80
  if (cuM <= 5) return 200
  if (cuM <= 10) return 370
  if (cuM <= 20) return (cuM - 10) * 40 + 370
  if (cuM <= 30) return (cuM - 20) * 45 + 770
  if (cuM <= 40) return (cuM - 30) * 50 + 1220
  return (cuM - 40) * 55 + 1720
}

// Update November bills with readings
async function updateNovemberBills() {
  console.log('=== Updating November 2025 Bills with Meter Readings ===\n')

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    return
  }

  for (const reading of NOVEMBER_READINGS) {
    const unit = await prisma.unit.findFirst({
      where: { unitNumber: reading.unit, tenantId: tenant.id }
    })

    if (!unit) {
      console.log(`Unit ${reading.unit} not found`)
      continue
    }

    const bill = await prisma.bill.findFirst({
      where: {
        unitId: unit.id,
        billingMonth: new Date('2025-11-01')
      }
    })

    if (!bill) {
      console.log(`November bill not found for ${reading.unit}`)
      continue
    }

    const electricAmount = calculateElectric(reading.electricKwh)
    const waterAmount = calculateWater(reading.waterCuM)
    const oldTotal = Number(bill.totalAmount)
    const newTotal = electricAmount + waterAmount + Number(bill.associationDues) +
                     Number(bill.parkingFee) + Number(bill.spAssessment) +
                     Number(bill.penaltyAmount) + Number(bill.otherCharges) -
                     Number(bill.discounts) - Number(bill.advanceDuesApplied) -
                     Number(bill.advanceUtilApplied)

    await prisma.bill.update({
      where: { id: bill.id },
      data: {
        electricAmount,
        waterAmount,
        totalAmount: newTotal,
        balance: newTotal - Number(bill.paidAmount)
      }
    })

    console.log(`${reading.unit}: Electric ${reading.electricKwh}kWh=₱${electricAmount.toFixed(2)}, Water ${reading.waterCuM}cu.m=₱${waterAmount.toFixed(2)}, Total: ₱${oldTotal.toFixed(2)} → ₱${newTotal.toFixed(2)}`)
  }

  console.log('\n=== Update Complete ===')
}

// Run update if called with --update-nov flag
if (process.argv.includes('--update-nov')) {
  updateNovemberBills()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
} else {
  // Original import payments logic below
}

interface PaymentRecord {
  unitNumber: string
  ownerName: string
  electric: number
  water: number
  associationDues: number
  pastDues: number
  spAssessment: number
  advancePayment: number
  totalPayment: number
  previousBalance: number
  orNumbers: string
}

function parseCSV(content: string): PaymentRecord[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',')
  const records: PaymentRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    // Handle quoted fields with commas
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
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

    records.push({
      unitNumber: values[0]?.trim() || '',
      ownerName: values[1] || '',
      electric: parseFloat(values[2]) || 0,
      water: parseFloat(values[3]) || 0,
      associationDues: parseFloat(values[4]) || 0,
      pastDues: parseFloat(values[5]) || 0,
      spAssessment: parseFloat(values[6]) || 0,
      advancePayment: parseFloat(values[7]) || 0,
      totalPayment: parseFloat(values[8]) || 0,
      previousBalance: parseFloat(values[9]) || 0,
      orNumbers: values[10]?.replace(/"/g, '') || '',
    })
  }

  return records
}

async function main() {
  console.log('=== Importing October 2025 Payments ===\n')

  // Get tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    return
  }

  // Read CSV file
  const csvPath = 'D:\\Megatower\\scripts\\october-2025-payments.csv'
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const payments = parseCSV(csvContent)

  console.log(`Found ${payments.length} payment records\n`)

  let successCount = 0
  let errorCount = 0

  for (const payment of payments) {
    try {
      // Use unit number as-is from CSV (already formatted as M2-2F-X)
      let unitNumber = payment.unitNumber

      console.log(`\nProcessing: ${unitNumber} - ₱${payment.totalPayment.toFixed(2)}`)

      // Find the unit
      const unit = await prisma.unit.findFirst({
        where: {
          unitNumber,
          tenantId: tenant.id
        }
      })

      if (!unit) {
        console.log(`  ✗ Unit ${unitNumber} not found`)
        errorCount++
        continue
      }

      // Find the October 2025 bill
      const bill = await prisma.bill.findFirst({
        where: {
          unitId: unit.id,
          billingMonth: new Date('2025-10-01')
        }
      })

      if (!bill) {
        console.log(`  ✗ October bill not found for ${unitNumber}`)
        errorCount++
        continue
      }

      const billTotal = Number(bill.totalAmount)
      const paymentAmount = payment.totalPayment

      console.log(`  Bill Total: ₱${billTotal.toFixed(2)}`)
      console.log(`  Payment: ₱${paymentAmount.toFixed(2)}`)

      // Skip if payment is 0
      if (paymentAmount <= 0) {
        console.log(`  ✗ No payment to record`)
        continue
      }

      // Check if payment already exists
      const existingPayment = await prisma.payment.findFirst({
        where: {
          unitId: unit.id,
          paymentDate: {
            gte: new Date('2025-10-01'),
            lt: new Date('2025-11-01')
          }
        }
      })

      if (existingPayment) {
        console.log(`  ⚠ Payment already exists for this period, skipping`)
        continue
      }

      // Calculate allocation
      const amountForBill = Math.min(paymentAmount, billTotal)
      const advanceAmount = paymentAmount > billTotal ? paymentAmount - billTotal : 0

      // Create payment record with unique OR number
      const baseOrNumber = payment.orNumbers.replace(/OR#\s*/g, '').split(';')[0]?.trim() || null
      const uniqueOrNumber = baseOrNumber ? `${baseOrNumber}-${unitNumber}` : null

      const newPayment = await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          unitId: unit.id,
          paymentDate: new Date('2025-10-15'), // Mid-October payment date
          orNumber: uniqueOrNumber,
          electricAmount: payment.electric,
          waterAmount: payment.water,
          duesAmount: payment.associationDues,
          spAssessmentAmount: payment.spAssessment,
          pastDuesAmount: payment.pastDues,
          totalAmount: paymentAmount,
          paymentMethod: 'CASH',
          billPayments: {
            create: {
              billId: bill.id,
              electricAmount: Math.min(payment.electric, Number(bill.electricAmount)),
              waterAmount: Math.min(payment.water, Number(bill.waterAmount)),
              duesAmount: Math.min(payment.associationDues, Number(bill.associationDues)),
              penaltyAmount: Math.min(payment.pastDues, Number(bill.penaltyAmount || 0)),
              otherAmount: payment.spAssessment,
              totalAmount: amountForBill,
            }
          }
        }
      })

      // Update bill status
      const newPaidAmount = Number(bill.paidAmount) + amountForBill
      const newBalance = billTotal - newPaidAmount
      const newStatus = newBalance <= 0 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : 'UNPAID')

      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          balance: Math.max(0, newBalance),
          status: newStatus
        }
      })

      // Handle advance payment
      if (advanceAmount > 0) {
        console.log(`  Advance: ₱${advanceAmount.toFixed(2)}`)

        // Check if advance balance record exists
        const existingAdvance = await prisma.unitAdvanceBalance.findFirst({
          where: { unitId: unit.id }
        })

        if (existingAdvance) {
          await prisma.unitAdvanceBalance.update({
            where: { id: existingAdvance.id },
            data: {
              advanceDues: { increment: advanceAmount }
            }
          })
        } else {
          await prisma.unitAdvanceBalance.create({
            data: {
              tenantId: tenant.id,
              unitId: unit.id,
              advanceDues: advanceAmount,
              advanceUtilities: 0
            }
          })
        }
      }

      console.log(`  ✓ Payment recorded - Bill status: ${newStatus}`)
      successCount++

    } catch (error) {
      console.error(`  ✗ Error processing ${payment.unitNumber}:`, error)
      errorCount++
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Success: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log('\n=== Import Complete ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
