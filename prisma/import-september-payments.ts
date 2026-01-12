/**
 * September Payments Import Script
 *
 * Parses payment data from Excel files and creates Payment records
 * to pay off September 2025 bills.
 *
 * Run with: npx tsx prisma/import-september-payments.ts
 */

import { PrismaClient, PaymentMethod } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

const prisma = new PrismaClient()

// ==========================================
// CONFIGURATION
// ==========================================

// Path to the Excel files
const EXCEL_PATH = 'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\NOV 2025 MEGATOWER II'

// Payment date for imported payments (September 2025)
const PAYMENT_DATE = new Date('2025-09-15')

// Payment rows in Excel (0-indexed)
const PAYMENT_START_ROW = 36  // Row 37 in Excel
const PAYMENT_END_ROW = 43    // Row 44 in Excel

// Column indices (0-indexed)
const COMPONENT_COL = 7   // Column H
const OR_NUMBER_COL = 11  // Column L
const AMOUNT_COL = 15     // Column P

// ==========================================
// TYPES
// ==========================================

interface PaymentComponent {
  component: string
  orNumber: string
  amount: number
}

interface GroupedPayment {
  orNumber: string
  unitId: string
  unitNumber: string
  electricAmount: number
  waterAmount: number
  duesAmount: number
  pastDuesAmount: number
  spAssessmentAmount: number
  advanceDuesAmount: number
  advanceUtilAmount: number
  totalAmount: number
}

// ==========================================
// PARSING FUNCTIONS
// ==========================================

function parseComponentName(raw: string): string | null {
  const name = raw.trim().toUpperCase()

  if (name.includes('ELECTRIC')) return 'ELECTRIC'
  if (name.includes('WATER')) return 'WATER'
  if (name.includes('ASSOC') || name.includes('DUES')) return 'DUES'
  if (name.includes('SP') && name.includes('ASSESSMENT')) return 'SP_ASSESSMENT'
  if (name.includes('PAST') && name.includes('DUE')) return 'PAST_DUES'
  if (name.includes('ADVANCE')) return 'ADVANCE'

  return null
}

function parsePaymentsFromSheet(ws: XLSX.WorkSheet): PaymentComponent[] {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]
  const payments: PaymentComponent[] = []

  for (let i = PAYMENT_START_ROW; i <= PAYMENT_END_ROW && i < data.length; i++) {
    const row = data[i] || []

    const componentRaw = String(row[COMPONENT_COL] || '').trim()
    const orNumberRaw = String(row[OR_NUMBER_COL] || '').trim()
    const amountRaw = row[AMOUNT_COL]

    const component = parseComponentName(componentRaw)
    if (!component) continue

    // Parse OR# - could be number or string
    let orNumber = orNumberRaw
    if (!orNumber || orNumber === '0' || orNumber === '-') continue

    // Parse amount
    const amount = typeof amountRaw === 'number'
      ? amountRaw
      : parseFloat(String(amountRaw).replace(/[₱,]/g, '')) || 0

    if (amount <= 0) continue

    payments.push({
      component,
      orNumber: String(orNumber),
      amount,
    })
  }

  return payments
}

function extractUnitNumberFromSheet(ws: XLSX.WorkSheet): string | null {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

  // Row 9: Unit number (cols 7-8 based on import-excel.ts)
  const unitRow = data[9] || []
  const floorPrefix = String(unitRow[7] || '').trim()
  const unitNum = String(unitRow[8] || '').trim()

  if (!floorPrefix && !unitNum) return null

  // For M2 units
  const normalizedUnit = unitNum.replace(/\s+/g, '')
  return `M2-${floorPrefix}-${normalizedUnit}`
}

function groupPaymentsByOR(
  payments: PaymentComponent[],
  unitId: string,
  unitNumber: string
): GroupedPayment[] {
  // Group by OR#
  const grouped = new Map<string, GroupedPayment>()

  for (const p of payments) {
    if (!grouped.has(p.orNumber)) {
      grouped.set(p.orNumber, {
        orNumber: p.orNumber,
        unitId,
        unitNumber,
        electricAmount: 0,
        waterAmount: 0,
        duesAmount: 0,
        pastDuesAmount: 0,
        spAssessmentAmount: 0,
        advanceDuesAmount: 0,
        advanceUtilAmount: 0,
        totalAmount: 0,
      })
    }

    const payment = grouped.get(p.orNumber)!

    switch (p.component) {
      case 'ELECTRIC':
        payment.electricAmount += p.amount
        break
      case 'WATER':
        payment.waterAmount += p.amount
        break
      case 'DUES':
        payment.duesAmount += p.amount
        break
      case 'PAST_DUES':
        payment.pastDuesAmount += p.amount
        break
      case 'SP_ASSESSMENT':
        payment.spAssessmentAmount += p.amount
        break
      case 'ADVANCE':
        // Could be either dues or utilities - default to dues
        payment.advanceDuesAmount += p.amount
        break
    }

    payment.totalAmount += p.amount
  }

  return Array.from(grouped.values())
}

// ==========================================
// MAIN IMPORT FUNCTION
// ==========================================

async function importPayments() {
  console.log('='.repeat(60))
  console.log('SEPTEMBER 2025 PAYMENTS IMPORT')
  console.log('='.repeat(60))

  // Get tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found! Run npm run db:seed first.')
    process.exit(1)
  }
  console.log(`\nUsing tenant: ${tenant.name}`)

  // Find Excel files
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`\nPath not found: ${EXCEL_PATH}`)
    process.exit(1)
  }

  const files = fs.readdirSync(EXCEL_PATH)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .filter(f => f.toLowerCase().includes('oct') || f.toLowerCase().includes('2nd'))

  console.log(`\nFound ${files.length} Excel file(s)`)

  let totalPaymentsCreated = 0
  let totalAmount = 0

  for (const file of files) {
    console.log(`\n--- Processing: ${file} ---`)

    const filePath = path.join(EXCEL_PATH, file)
    const wb = XLSX.readFile(filePath)

    // Process each sheet (each unit)
    for (const sheetName of wb.SheetNames) {
      if (sheetName.includes('SUMMARY') || sheetName.includes('BALANCES')) continue

      const ws = wb.Sheets[sheetName]

      // Get unit number from sheet
      const unitNumber = extractUnitNumberFromSheet(ws)
      if (!unitNumber) {
        console.log(`   Skipping sheet "${sheetName}" - no unit number found`)
        continue
      }

      // Find unit in database
      const unit = await prisma.unit.findFirst({
        where: {
          tenantId: tenant.id,
          unitNumber: unitNumber,
        }
      })

      if (!unit) {
        console.log(`   Unit not found: ${unitNumber}`)
        continue
      }

      // Parse payments from sheet
      const paymentComponents = parsePaymentsFromSheet(ws)

      if (paymentComponents.length === 0) {
        console.log(`   No payments found for ${unitNumber}`)
        continue
      }

      console.log(`   Found ${paymentComponents.length} payment components for ${unitNumber}`)

      // Group by OR#
      const groupedPayments = groupPaymentsByOR(paymentComponents, unit.id, unitNumber)

      // Create payments
      for (const gp of groupedPayments) {
        // Check if payment with this OR# already exists
        const existingPayment = await prisma.payment.findFirst({
          where: {
            tenantId: tenant.id,
            orNumber: gp.orNumber,
          }
        })

        if (existingPayment) {
          console.log(`   OR# ${gp.orNumber} already exists - skipping`)
          continue
        }

        // Create the payment
        try {
          const payment = await prisma.$transaction(async (tx) => {
            // Create Payment record
            const newPayment = await tx.payment.create({
              data: {
                tenantId: tenant.id,
                unitId: gp.unitId,
                orNumber: gp.orNumber,
                paymentDate: PAYMENT_DATE,
                paymentMethod: PaymentMethod.CASH,
                electricAmount: gp.electricAmount,
                waterAmount: gp.waterAmount,
                duesAmount: gp.duesAmount,
                pastDuesAmount: gp.pastDuesAmount,
                spAssessmentAmount: gp.spAssessmentAmount,
                advanceDuesAmount: gp.advanceDuesAmount,
                advanceUtilAmount: gp.advanceUtilAmount,
                totalAmount: gp.totalAmount,
                status: 'CONFIRMED',
                remarks: 'Imported from Excel (September 2025)',
              }
            })

            // Allocate to bills (FIFO)
            const unpaidBills = await tx.bill.findMany({
              where: {
                unitId: gp.unitId,
                tenantId: tenant.id,
                status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
              },
              orderBy: { billingMonth: 'asc' },
              include: {
                payments: {
                  select: {
                    electricAmount: true,
                    waterAmount: true,
                    duesAmount: true,
                    penaltyAmount: true,
                    spAssessmentAmount: true,
                  }
                }
              }
            })

            // Track remaining amounts
            let remainingElectric = gp.electricAmount
            let remainingWater = gp.waterAmount
            let remainingDues = gp.duesAmount
            let remainingPenalty = gp.pastDuesAmount
            let remainingSP = gp.spAssessmentAmount

            for (const bill of unpaidBills) {
              if (remainingElectric <= 0 && remainingWater <= 0 &&
                  remainingDues <= 0 && remainingPenalty <= 0 && remainingSP <= 0) {
                break
              }

              // Calculate what's been paid for each component
              const paidElectric = bill.payments.reduce((sum, p) => sum + Number(p.electricAmount), 0)
              const paidWater = bill.payments.reduce((sum, p) => sum + Number(p.waterAmount), 0)
              const paidDues = bill.payments.reduce((sum, p) => sum + Number(p.duesAmount), 0)
              const paidPenalty = bill.payments.reduce((sum, p) => sum + Number(p.penaltyAmount), 0)
              const paidSP = bill.payments.reduce((sum, p) => sum + Number(p.spAssessmentAmount), 0)

              // Calculate outstanding
              const outstandingElectric = Math.max(0, Number(bill.electricAmount) - paidElectric)
              const outstandingWater = Math.max(0, Number(bill.waterAmount) - paidWater)
              const outstandingDues = Math.max(0, Number(bill.associationDues) - paidDues)
              const outstandingPenalty = Math.max(0, Number(bill.penaltyAmount) - paidPenalty)
              const outstandingSP = Math.max(0, Number(bill.spAssessment) - paidSP)

              // Allocate
              const allocElectric = Math.min(remainingElectric, outstandingElectric)
              const allocWater = Math.min(remainingWater, outstandingWater)
              const allocDues = Math.min(remainingDues, outstandingDues)
              const allocPenalty = Math.min(remainingPenalty, outstandingPenalty)
              const allocSP = Math.min(remainingSP, outstandingSP)

              const allocTotal = allocElectric + allocWater + allocDues + allocPenalty + allocSP

              if (allocTotal > 0) {
                // Create BillPayment record
                await tx.billPayment.create({
                  data: {
                    paymentId: newPayment.id,
                    billId: bill.id,
                    electricAmount: allocElectric,
                    waterAmount: allocWater,
                    duesAmount: allocDues,
                    penaltyAmount: allocPenalty,
                    spAssessmentAmount: allocSP,
                    otherAmount: 0,
                    totalAmount: allocTotal,
                  }
                })

                // Update bill
                const newPaidAmount = Number(bill.paidAmount) + allocTotal
                const newBalance = Number(bill.totalAmount) - newPaidAmount
                const newStatus = newBalance <= 0.01 ? 'PAID'
                  : newPaidAmount > 0 ? 'PARTIAL' : 'UNPAID'

                await tx.bill.update({
                  where: { id: bill.id },
                  data: {
                    paidAmount: newPaidAmount,
                    balance: Math.max(0, newBalance),
                    status: newStatus,
                  }
                })

                // Reduce remaining
                remainingElectric -= allocElectric
                remainingWater -= allocWater
                remainingDues -= allocDues
                remainingPenalty -= allocPenalty
                remainingSP -= allocSP
              }
            }

            // Handle advance payments
            if (gp.advanceDuesAmount > 0 || gp.advanceUtilAmount > 0) {
              await tx.unitAdvanceBalance.upsert({
                where: {
                  tenantId_unitId: {
                    tenantId: tenant.id,
                    unitId: gp.unitId,
                  }
                },
                update: {
                  advanceDues: { increment: gp.advanceDuesAmount },
                  advanceUtilities: { increment: gp.advanceUtilAmount },
                },
                create: {
                  tenantId: tenant.id,
                  unitId: gp.unitId,
                  advanceDues: gp.advanceDuesAmount,
                  advanceUtilities: gp.advanceUtilAmount,
                }
              })
            }

            return newPayment
          })

          totalPaymentsCreated++
          totalAmount += gp.totalAmount
          console.log(`   Created: OR# ${gp.orNumber} for ${gp.unitNumber} - ₱${gp.totalAmount.toLocaleString()}`)

        } catch (error: any) {
          console.error(`   Error creating payment OR# ${gp.orNumber}:`, error.message)
        }
      }
    }
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n' + '='.repeat(60))
  console.log('IMPORT COMPLETE!')
  console.log('='.repeat(60))
  console.log(`
Summary:
- Payments Created: ${totalPaymentsCreated}
- Total Amount: ₱${totalAmount.toLocaleString()}

Next Steps:
1. Open the app and go to Payments > List to verify
2. Generate October bills - payments will be reflected in SOA
`)
}

// ==========================================
// RUN
// ==========================================

importPayments()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
