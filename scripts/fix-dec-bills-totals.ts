/**
 * Fix December 2025 bill totals
 * The totalAmount should be the sum of all individual components
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')

  console.log('=== Fixing December 2025 Bill Totals ===\n')

  // Get all December bills
  const decBills = await prisma.bill.findMany({
    where: { billingMonth: decPeriod },
    include: { unit: true }
  })

  console.log(`Found ${decBills.length} December bills\n`)

  let fixedCount = 0
  let totalDifference = 0

  for (const bill of decBills) {
    // Calculate correct total from components
    const electric = Number(bill.electricAmount)
    const water = Number(bill.waterAmount)
    const dues = Number(bill.associationDues)
    const parking = Number(bill.parkingFee)
    const spAssessment = Number(bill.spAssessment)
    const discounts = Number(bill.discounts)
    const advanceDues = Number(bill.advanceDuesApplied || 0)
    const advanceUtil = Number(bill.advanceUtilApplied || 0)

    const correctTotal = electric + water + dues + parking + spAssessment - discounts - advanceDues - advanceUtil
    const currentTotal = Number(bill.totalAmount)
    const difference = Math.abs(correctTotal - currentTotal)

    if (difference > 0.01) { // More than 1 cent difference
      console.log(`${bill.unit.unitNumber}:`)
      console.log(`  Electric: ₱${electric.toFixed(2)}`)
      console.log(`  Water: ₱${water.toFixed(2)}`)
      console.log(`  Dues: ₱${dues.toFixed(2)}`)
      console.log(`  Parking: ₱${parking.toFixed(2)}`)
      console.log(`  SP Assessment: ₱${spAssessment.toFixed(2)}`)
      console.log(`  Discounts: -₱${discounts.toFixed(2)}`)
      console.log(`  Advance Dues: -₱${advanceDues.toFixed(2)}`)
      console.log(`  Advance Util: -₱${advanceUtil.toFixed(2)}`)
      console.log(`  ---`)
      console.log(`  Current Total: ₱${currentTotal.toFixed(2)}`)
      console.log(`  Correct Total: ₱${correctTotal.toFixed(2)}`)
      console.log(`  Difference: ₱${difference.toFixed(2)}`)
      console.log()

      // Update the bill with correct total
      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          totalAmount: correctTotal,
          balance: correctTotal - Number(bill.paidAmount)
        }
      })

      fixedCount++
      totalDifference += difference
    }
  }

  console.log('=== Summary ===')
  console.log(`Fixed: ${fixedCount} bills`)
  console.log(`Total difference corrected: ₱${totalDifference.toFixed(2)}`)

  // Verify specific units
  console.log('\n=== Verification ===')
  const targetUnits = ['M2-2F-3', 'M2-2F-5', 'M2-2F-6']

  for (const unitNum of targetUnits) {
    const bill = await prisma.bill.findFirst({
      where: {
        billingMonth: decPeriod,
        unit: { unitNumber: unitNum }
      },
      include: { unit: true }
    })

    if (bill) {
      console.log(`${unitNum}: Total=₱${Number(bill.totalAmount).toFixed(2)}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
