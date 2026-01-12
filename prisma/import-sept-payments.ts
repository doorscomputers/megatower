/**
 * Import September 2025 Payments from Excel
 *
 * Run with: npx tsx prisma/import-sept-payments.ts
 */

import { PrismaClient, PaymentMethod } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

const EXCEL_PATH = 'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx'
const PAYMENT_DATE = new Date('2025-09-15')

// Payment rows (0-indexed)
const PAYMENT_ROWS = {
  ELECTRIC: 37,        // Row 38
  WATER: 38,           // Row 39
  ASSOC_DUES: 39,      // Row 40
  PAST_DUES: 40,       // Row 41
  SP_ASSESSMENT: 41,   // Row 42
  ADVANCE: 42,         // Row 43
}

// Column indices (0-indexed)
const COL_COMPONENT = 3  // Column D
const COL_OR_NUMBER = 7  // Column H
const COL_AMOUNT = 11    // Column L

interface PaymentData {
  unitNumber: string
  electricOR: string
  electricAmount: number
  waterOR: string
  waterAmount: number
  duesOR: string
  duesAmount: number
  pastDuesOR: string
  pastDuesAmount: number
  spAssessmentOR: string
  spAssessmentAmount: number
  advanceOR: string
  advanceAmount: number
}

function parsePaymentData(ws: XLSX.WorkSheet, sheetName: string): PaymentData | null {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

  if (data.length < 44) return null

  // Sheet name is the unit suffix (1, 2, 3, etc.)
  const unitNumber = `M2-2F-${sheetName}`

  const getRowData = (rowIdx: number) => {
    const row = data[rowIdx] || []
    const orNumber = String(row[COL_OR_NUMBER] || '').trim()
    const amount = parseFloat(row[COL_AMOUNT]) || 0
    return { orNumber, amount }
  }

  const electric = getRowData(PAYMENT_ROWS.ELECTRIC)
  const water = getRowData(PAYMENT_ROWS.WATER)
  const dues = getRowData(PAYMENT_ROWS.ASSOC_DUES)
  const pastDues = getRowData(PAYMENT_ROWS.PAST_DUES)
  const spAssessment = getRowData(PAYMENT_ROWS.SP_ASSESSMENT)
  const advance = getRowData(PAYMENT_ROWS.ADVANCE)

  // Skip if no payments
  const totalAmount = electric.amount + water.amount + dues.amount +
    pastDues.amount + spAssessment.amount + advance.amount

  if (totalAmount <= 0) return null

  return {
    unitNumber,
    electricOR: electric.orNumber,
    electricAmount: electric.amount,
    waterOR: water.orNumber,
    waterAmount: water.amount,
    duesOR: dues.orNumber,
    duesAmount: dues.amount,
    pastDuesOR: pastDues.orNumber,
    pastDuesAmount: pastDues.amount,
    spAssessmentOR: spAssessment.orNumber,
    spAssessmentAmount: spAssessment.amount,
    advanceOR: advance.orNumber,
    advanceAmount: advance.amount,
  }
}

interface GroupedPayment {
  orNumber: string
  electricAmount: number
  waterAmount: number
  duesAmount: number
  pastDuesAmount: number
  spAssessmentAmount: number
  advanceAmount: number
}

function groupByOR(payment: PaymentData): GroupedPayment[] {
  // Group components by OR#
  const grouped = new Map<string, GroupedPayment>()

  const addToGroup = (orNumber: string, field: keyof Omit<GroupedPayment, 'orNumber'>, amount: number) => {
    if (amount <= 0 || !orNumber || orNumber === '0') return

    if (!grouped.has(orNumber)) {
      grouped.set(orNumber, {
        orNumber,
        electricAmount: 0,
        waterAmount: 0,
        duesAmount: 0,
        pastDuesAmount: 0,
        spAssessmentAmount: 0,
        advanceAmount: 0,
      })
    }
    grouped.get(orNumber)![field] += amount
  }

  addToGroup(payment.electricOR, 'electricAmount', payment.electricAmount)
  addToGroup(payment.waterOR, 'waterAmount', payment.waterAmount)
  addToGroup(payment.duesOR, 'duesAmount', payment.duesAmount)
  addToGroup(payment.pastDuesOR, 'pastDuesAmount', payment.pastDuesAmount)
  addToGroup(payment.spAssessmentOR, 'spAssessmentAmount', payment.spAssessmentAmount)
  addToGroup(payment.advanceOR, 'advanceAmount', payment.advanceAmount)

  return Array.from(grouped.values())
}

async function main() {
  console.log('='.repeat(60))
  console.log('SEPTEMBER 2025 PAYMENTS IMPORT')
  console.log('='.repeat(60))
  console.log(`\nExcel file: ${EXCEL_PATH}`)

  // Get tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    process.exit(1)
  }
  console.log(`Tenant: ${tenant.name}`)

  // Read Excel file
  const wb = XLSX.readFile(EXCEL_PATH)
  console.log(`\nFound ${wb.SheetNames.length} sheets`)

  let totalPaymentsCreated = 0
  let totalAmount = 0

  // Process each sheet (unit)
  for (const sheetName of wb.SheetNames) {
    // Skip non-numeric sheets (like "6 (A)", "11 (A) paid")
    if (!/^\d+$/.test(sheetName)) {
      console.log(`\nSkipping sheet "${sheetName}" (not a unit number)`)
      continue
    }

    const ws = wb.Sheets[sheetName]
    const paymentData = parsePaymentData(ws, sheetName)

    if (!paymentData) {
      console.log(`\nSheet "${sheetName}" - No payment data`)
      continue
    }

    console.log(`\n--- ${paymentData.unitNumber} ---`)

    // Find unit in database
    const unit = await prisma.unit.findFirst({
      where: {
        tenantId: tenant.id,
        unitNumber: paymentData.unitNumber,
      }
    })

    if (!unit) {
      console.log(`  Unit not found in database: ${paymentData.unitNumber}`)
      continue
    }

    // Group payments by OR#
    const groupedPayments = groupByOR(paymentData)

    for (const gp of groupedPayments) {
      const total = gp.electricAmount + gp.waterAmount + gp.duesAmount +
        gp.pastDuesAmount + gp.spAssessmentAmount + gp.advanceAmount

      if (total <= 0) continue

      // Check if payment with this OR# already exists
      const existingPayment = await prisma.payment.findFirst({
        where: {
          tenantId: tenant.id,
          orNumber: gp.orNumber,
        }
      })

      if (existingPayment) {
        console.log(`  OR# ${gp.orNumber} already exists - skipping`)
        continue
      }

      // Create the payment
      try {
        const payment = await prisma.$transaction(async (tx) => {
          // Create Payment record
          const newPayment = await tx.payment.create({
            data: {
              tenantId: tenant.id,
              unitId: unit.id,
              orNumber: gp.orNumber,
              paymentDate: PAYMENT_DATE,
              paymentMethod: PaymentMethod.CASH,
              electricAmount: gp.electricAmount,
              waterAmount: gp.waterAmount,
              duesAmount: gp.duesAmount,
              pastDuesAmount: gp.pastDuesAmount,
              spAssessmentAmount: gp.spAssessmentAmount,
              advanceDuesAmount: gp.advanceAmount > 0 ? gp.advanceAmount / 2 : 0,
              advanceUtilAmount: gp.advanceAmount > 0 ? gp.advanceAmount / 2 : 0,
              totalAmount: total,
              status: 'CONFIRMED',
              remarks: 'Imported from October Excel SOA (September payment)',
            }
          })

          // Allocate to bills (FIFO)
          const unpaidBills = await tx.bill.findMany({
            where: {
              unitId: unit.id,
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

            const paidElectric = bill.payments.reduce((sum, p) => sum + Number(p.electricAmount), 0)
            const paidWater = bill.payments.reduce((sum, p) => sum + Number(p.waterAmount), 0)
            const paidDues = bill.payments.reduce((sum, p) => sum + Number(p.duesAmount), 0)
            const paidPenalty = bill.payments.reduce((sum, p) => sum + Number(p.penaltyAmount), 0)
            const paidSP = bill.payments.reduce((sum, p) => sum + Number(p.spAssessmentAmount), 0)

            const outstandingElectric = Math.max(0, Number(bill.electricAmount) - paidElectric)
            const outstandingWater = Math.max(0, Number(bill.waterAmount) - paidWater)
            const outstandingDues = Math.max(0, Number(bill.associationDues) - paidDues)
            const outstandingPenalty = Math.max(0, Number(bill.penaltyAmount) - paidPenalty)
            const outstandingSP = Math.max(0, Number(bill.spAssessment) - paidSP)

            const allocElectric = Math.min(remainingElectric, outstandingElectric)
            const allocWater = Math.min(remainingWater, outstandingWater)
            const allocDues = Math.min(remainingDues, outstandingDues)
            const allocPenalty = Math.min(remainingPenalty, outstandingPenalty)
            const allocSP = Math.min(remainingSP, outstandingSP)

            const allocTotal = allocElectric + allocWater + allocDues + allocPenalty + allocSP

            if (allocTotal > 0) {
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

              remainingElectric -= allocElectric
              remainingWater -= allocWater
              remainingDues -= allocDues
              remainingPenalty -= allocPenalty
              remainingSP -= allocSP
            }
          }

          // Handle advance payments
          if (gp.advanceAmount > 0) {
            await tx.unitAdvanceBalance.upsert({
              where: {
                tenantId_unitId: {
                  tenantId: tenant.id,
                  unitId: unit.id,
                }
              },
              update: {
                advanceDues: { increment: gp.advanceAmount / 2 },
                advanceUtilities: { increment: gp.advanceAmount / 2 },
              },
              create: {
                tenantId: tenant.id,
                unitId: unit.id,
                advanceDues: gp.advanceAmount / 2,
                advanceUtilities: gp.advanceAmount / 2,
              }
            })
          }

          return newPayment
        })

        totalPaymentsCreated++
        totalAmount += total
        console.log(`  Created: OR# ${gp.orNumber} - ₱${total.toLocaleString()}`)
        console.log(`    Electric: ₱${gp.electricAmount.toLocaleString()}, Water: ₱${gp.waterAmount.toLocaleString()}`)
        console.log(`    Dues: ₱${gp.duesAmount.toLocaleString()}, SP: ₱${gp.spAssessmentAmount.toLocaleString()}`)

      } catch (error: any) {
        console.error(`  Error creating payment OR# ${gp.orNumber}:`, error.message)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('IMPORT COMPLETE!')
  console.log('='.repeat(60))
  console.log(`
Summary:
- Payments Created: ${totalPaymentsCreated}
- Total Amount: ₱${totalAmount.toLocaleString()}

Next Steps:
1. Go to Billing > Generate Bills
2. Select October 2025
3. Preview and generate the October bills
`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
