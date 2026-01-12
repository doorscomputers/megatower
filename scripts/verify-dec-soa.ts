/**
 * Verify December 2025 SOA totals
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')
  const novPeriod = new Date('2025-11-01T00:00:00.000Z')

  console.log('=== December 2025 SOA Verification ===\n')

  const targetUnits = ['M2-2F-3', 'M2-2F-5', 'M2-2F-6']

  for (const unitNum of targetUnits) {
    const unit = await prisma.unit.findFirst({
      where: { unitNumber: unitNum },
      include: { owner: true }
    })

    if (!unit) continue

    console.log(`=== ${unitNum} ===`)
    console.log(`Owner: ${unit.owner?.firstName} ${unit.owner?.lastName}`)
    console.log(`Area: ${Number(unit.area)} sqm, Parking: ${Number(unit.parkingArea || 0)} sqm`)

    // Get December bill (current charges)
    const decBill = await prisma.bill.findFirst({
      where: { unitId: unit.id, billingMonth: decPeriod }
    })

    if (decBill) {
      console.log('\nDecember Bill (Current Charges):')
      console.log(`  Electric: ₱${Number(decBill.electricAmount).toFixed(2)}`)
      console.log(`  Water: ₱${Number(decBill.waterAmount).toFixed(2)}`)
      console.log(`  Assoc Dues: ₱${Number(decBill.associationDues).toFixed(2)}`)
      console.log(`  Parking: ₱${Number(decBill.parkingFee).toFixed(2)}`)
      console.log(`  SP Assessment: ₱${Number(decBill.spAssessment).toFixed(2)}`)
      console.log(`  ---`)
      console.log(`  Total Amount: ₱${Number(decBill.totalAmount).toFixed(2)}`)
    } else {
      console.log('\nNo December bill found!')
    }

    // Check past dues (unpaid/partial bills before December)
    const pastDueBills = await prisma.bill.findMany({
      where: {
        unitId: unit.id,
        billingMonth: { lt: decPeriod },
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
      },
      orderBy: { billingMonth: 'desc' }
    })

    console.log(`\nPast Due Bills: ${pastDueBills.length}`)
    let totalPastDues = 0
    for (const bill of pastDueBills) {
      const balance = Number(bill.balance)
      totalPastDues += balance
      console.log(`  ${bill.billingMonth.toISOString().slice(0,7)}: Balance=₱${balance.toFixed(2)} (Status=${bill.status})`)
    }
    console.log(`  Total Past Dues: ₱${totalPastDues.toFixed(2)}`)

    // Check advance balances
    const advanceBalance = await prisma.unitAdvanceBalance.findFirst({
      where: { unitId: unit.id }
    })
    const advanceDues = advanceBalance ? Number(advanceBalance.advanceDues) : 0
    const advanceUtil = advanceBalance ? Number(advanceBalance.advanceUtilities) : 0
    console.log(`\nAdvance Balances:`)
    console.log(`  Advance Dues: ₱${advanceDues.toFixed(2)}`)
    console.log(`  Advance Utilities: ₱${advanceUtil.toFixed(2)}`)

    // Calculate expected total
    const currentCharges = decBill ? Number(decBill.totalAmount) : 0
    const expectedTotal = currentCharges + totalPastDues - advanceDues - advanceUtil
    console.log(`\n*** EXPECTED SOA TOTAL: ₱${expectedTotal.toFixed(2)} ***`)

    // Show what Excel expects
    if (unitNum === 'M2-2F-3') {
      console.log(`    (Excel expects: ₱4,701.65)`)
    } else if (unitNum === 'M2-2F-5') {
      console.log(`    (Excel expects: ₱3,600.53)`)
    } else if (unitNum === 'M2-2F-6') {
      console.log(`    (Excel expects: ₱5,043.44)`)
    }

    console.log('\n')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
