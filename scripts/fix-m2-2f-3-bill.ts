/**
 * Fix M2-2F-3 December bill - remove advance deduction to match Excel
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')

  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-3' }
  })

  if (!unit) {
    console.log('Unit not found')
    return
  }

  const bill = await prisma.bill.findFirst({
    where: { unitId: unit.id, billingMonth: decPeriod }
  })

  if (!bill) {
    console.log('December bill not found')
    return
  }

  console.log('=== Before Fix ===')
  console.log(`Electric: ₱${Number(bill.electricAmount).toFixed(2)}`)
  console.log(`Water: ₱${Number(bill.waterAmount).toFixed(2)}`)
  console.log(`Dues: ₱${Number(bill.associationDues).toFixed(2)}`)
  console.log(`Parking: ₱${Number(bill.parkingFee).toFixed(2)}`)
  console.log(`Advance Dues Applied: ₱${Number(bill.advanceDuesApplied || 0).toFixed(2)}`)
  console.log(`Total: ₱${Number(bill.totalAmount).toFixed(2)}`)

  // Calculate correct total without advance deduction
  const correctTotal = Number(bill.electricAmount) +
                       Number(bill.waterAmount) +
                       Number(bill.associationDues) +
                       Number(bill.parkingFee) +
                       Number(bill.spAssessment) -
                       Number(bill.discounts)
  // Don't subtract advanceDuesApplied or advanceUtilApplied

  // Also restore the advance balance that was incorrectly used
  const advanceDuesApplied = Number(bill.advanceDuesApplied || 0)

  // Update the bill
  await prisma.bill.update({
    where: { id: bill.id },
    data: {
      advanceDuesApplied: 0,
      advanceUtilApplied: 0,
      totalAmount: correctTotal,
      balance: correctTotal - Number(bill.paidAmount)
    }
  })

  // Restore the advance balance
  if (advanceDuesApplied > 0) {
    const advanceBalance = await prisma.unitAdvanceBalance.findFirst({
      where: { unitId: unit.id }
    })

    if (advanceBalance) {
      await prisma.unitAdvanceBalance.update({
        where: { id: advanceBalance.id },
        data: {
          advanceDues: { increment: advanceDuesApplied }
        }
      })
      console.log(`\nRestored advance balance: ₱${advanceDuesApplied.toFixed(2)}`)
    }
  }

  console.log('\n=== After Fix ===')
  console.log(`Advance Dues Applied: ₱0.00`)
  console.log(`Total: ₱${correctTotal.toFixed(2)}`)
  console.log(`Expected: ₱4,701.65`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
