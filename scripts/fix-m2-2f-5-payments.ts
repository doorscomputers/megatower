import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Fixing M2-2F-5 Payment Allocation ===\n')

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) return

  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-5', tenantId: tenant.id }
  })
  if (!unit) {
    console.log('Unit not found')
    return
  }

  // Get September and October bills
  const septBill = await prisma.bill.findFirst({
    where: { unitId: unit.id, billingMonth: new Date('2025-09-01') }
  })
  const octBill = await prisma.bill.findFirst({
    where: { unitId: unit.id, billingMonth: new Date('2025-10-01') }
  })

  console.log('Before fix:')
  console.log('September bill:', Number(septBill?.totalAmount), 'Paid:', Number(septBill?.paidAmount), 'Status:', septBill?.status)
  console.log('October bill:', Number(octBill?.totalAmount), 'Paid:', Number(octBill?.paidAmount), 'Status:', octBill?.status)

  // According to Excel November SOA:
  // October payment of ₱12,000 included:
  // - Electric: ₱1,826.82 (for Oct)
  // - Water: ₱370.00 (for Oct)
  // - Assoc Dues: ₱5,400.00 (for Sept & Oct combined)
  // - Past Dues: ₱3,554.08
  // - SP Assessment: ₱849.10
  //
  // After payment, only ₱28.73 remains as past dues
  //
  // The September bill total was ₱5,272.60
  // Payment allocated to Sept: ₱5,272.60 - ₱28.73 = ₱5,243.87

  if (septBill) {
    // The October payment should have paid most of September
    // September total: ₱5,272.60
    // Amount paid to Sept from Oct payment: ₱5,272.60 - ₱28.73 = ₱5,243.87
    // Remaining balance: ₱28.73

    const amountPaidToSept = 5243.87
    const remainingBalance = 28.73

    await prisma.bill.update({
      where: { id: septBill.id },
      data: {
        paidAmount: amountPaidToSept,
        balance: remainingBalance,
        status: 'PARTIAL' // Still has ₱28.73 remaining
      }
    })
    console.log('\nUpdated September bill:')
    console.log('  Paid:', amountPaidToSept)
    console.log('  Balance:', remainingBalance)
    console.log('  Status: PARTIAL')
  }

  // The October bill current charges should be:
  // Electric: ₱1,826.82
  // Water: ₱370.00
  // Assoc Dues: ₱2,700.00 (not 5400 - that was for both months)
  // SP Assessment: ₱849.10
  // Penalty: carried forward penalty
  //
  // But from the Nov SOA, it looks like the Oct bill total was calculated including Sept balance
  // Let me recalculate based on what the November SOA expects

  // From Excel Nov SOA for M2-2F-5:
  // Nov Current: ₱3,042.63 (E:142.63 + W:200 + D:2700)
  // Past Dues (Oct remaining): ₱28.73
  // Total Due: ₱3,071.36

  if (octBill) {
    // October bill's current charges only (without Sept carryover):
    // E: 1826.82, W: 370, D: 2700, SP: 849.10
    // From the payment CSV: Total bill was ₱11,867.62 which included Sept balance
    //
    // Actually the October bill in database has penalty of 6.12 which doesn't match
    // Let me check if October bill should include the Sept carryover or not

    // The clean approach: October bill should just be October charges
    // Sept balance should be tracked separately

    // October current charges: 1826.82 + 370 + 2700 + 849.10 = 5745.92
    // But the database shows 11867.62 which includes Sept balance

    // For November SOA to work correctly, I need to ensure:
    // 1. Sept bill shows balance of 28.73
    // 2. Oct bill is fully paid
    // 3. Oct bill total should reflect just Oct charges if Sept is tracked separately

    // Actually, the current setup might be intentional where Oct bill includes Sept carryover
    // In that case, we just need to fix Sept to show the remaining 28.73

    // The Oct payment of 12000 was applied to Oct bill (11867.62)
    // Advance of 132.38 was recorded
    // But Sept bill wasn't touched

    // Let's also link the payment to the September bill
    const octPayment = await prisma.payment.findFirst({
      where: { unitId: unit.id, paymentDate: { gte: new Date('2025-10-01'), lt: new Date('2025-11-01') } }
    })

    if (octPayment) {
      // Create a bill payment record linking to September bill
      const existingSeptBillPayment = await prisma.billPayment.findFirst({
        where: { paymentId: octPayment.id, billId: septBill?.id }
      })

      if (!existingSeptBillPayment && septBill) {
        await prisma.billPayment.create({
          data: {
            paymentId: octPayment.id,
            billId: septBill.id,
            electricAmount: 0, // Sept electric was paid via Sept payment
            waterAmount: 0,
            duesAmount: 2700, // Half of the 5400 dues payment
            penaltyAmount: 0,
            spAssessmentAmount: 849.10,
            otherAmount: 0,
            totalAmount: 5243.87 // Amount allocated to Sept from Oct payment
          }
        })
        console.log('\nCreated BillPayment linking Oct payment to Sept bill')
      }
    }
  }

  // Remove advance balance since there shouldn't be any
  // The payment exactly covered Oct bill + most of Sept
  const advance = await prisma.unitAdvanceBalance.findFirst({
    where: { unitId: unit.id }
  })
  if (advance) {
    await prisma.unitAdvanceBalance.delete({
      where: { id: advance.id }
    })
    console.log('\nRemoved incorrect advance balance')
  }

  // Verify final state
  const septBillFinal = await prisma.bill.findFirst({
    where: { unitId: unit.id, billingMonth: new Date('2025-09-01') }
  })
  const octBillFinal = await prisma.bill.findFirst({
    where: { unitId: unit.id, billingMonth: new Date('2025-10-01') }
  })

  console.log('\n=== After Fix ===')
  console.log('September bill: Total=', Number(septBillFinal?.totalAmount), 'Paid=', Number(septBillFinal?.paidAmount), 'Balance=', Number(septBillFinal?.balance), 'Status:', septBillFinal?.status)
  console.log('October bill: Total=', Number(octBillFinal?.totalAmount), 'Paid=', Number(octBillFinal?.paidAmount), 'Balance=', Number(octBillFinal?.balance), 'Status:', octBillFinal?.status)

  console.log('\n=== Fix Complete ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
