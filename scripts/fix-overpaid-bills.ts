import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Fix bills that were overpaid but the overpayment wasn't stored in UnitAdvanceBalance
 * This is a one-time fix for existing data. The payment API has been fixed to handle this going forward.
 */
async function main() {
  console.log("=== FIX OVERPAID BILLS ===\n")

  // Find bills where (totalAmount - paidAmount) is negative (overpaid)
  const allBills = await prisma.bill.findMany({
    include: { unit: true },
  })

  const overpaidBills = allBills.filter((b) => {
    const expectedBalance = Number(b.totalAmount) - Number(b.paidAmount)
    return expectedBalance < -0.01 // Negative balance = overpaid
  })

  console.log(`Found ${overpaidBills.length} overpaid bills:\n`)

  for (const bill of overpaidBills) {
    const total = Number(bill.totalAmount)
    const paid = Number(bill.paidAmount)
    const currentBalance = Number(bill.balance)
    const overpayment = paid - total

    console.log(`${bill.billNumber} (${bill.unit.unitNumber})`)
    console.log(`  Total: ₱${total.toFixed(2)}`)
    console.log(`  Paid: ₱${paid.toFixed(2)}`)
    console.log(`  Current Balance: ₱${currentBalance.toFixed(2)}`)
    console.log(`  Overpayment: ₱${overpayment.toFixed(2)}`)

    // Get existing advance balance for this unit
    const existingAdvance = await prisma.unitAdvanceBalance.findUnique({
      where: {
        tenantId_unitId: {
          tenantId: bill.tenantId,
          unitId: bill.unitId,
        },
      },
    })

    console.log(`  Existing Advance: ₱${existingAdvance ? Number(existingAdvance.advanceDues) + Number(existingAdvance.advanceUtilities) : 0}`)
    console.log()
  }

  console.log("=== APPLYING FIX ===\n")

  for (const bill of overpaidBills) {
    const total = Number(bill.totalAmount)
    const paid = Number(bill.paidAmount)
    const overpayment = paid - total

    // Set balance to 0 and ensure status is PAID
    await prisma.bill.update({
      where: { id: bill.id },
      data: {
        balance: 0,
        status: "PAID",
      },
    })

    // Add overpayment to UnitAdvanceBalance as advanceDues (since we don't know the original breakdown)
    await prisma.unitAdvanceBalance.upsert({
      where: {
        tenantId_unitId: {
          tenantId: bill.tenantId,
          unitId: bill.unitId,
        },
      },
      update: {
        advanceDues: {
          increment: overpayment,
        },
      },
      create: {
        tenantId: bill.tenantId,
        unitId: bill.unitId,
        advanceDues: overpayment,
        advanceUtilities: 0,
      },
    })

    console.log(`✓ Fixed ${bill.billNumber}: Balance → 0, Added ₱${overpayment.toFixed(2)} to advance`)
  }

  // Verify the fix
  console.log("\n=== VERIFICATION ===\n")

  for (const bill of overpaidBills) {
    const updatedBill = await prisma.bill.findUnique({ where: { id: bill.id } })
    const advance = await prisma.unitAdvanceBalance.findUnique({
      where: {
        tenantId_unitId: {
          tenantId: bill.tenantId,
          unitId: bill.unitId,
        },
      },
    })

    console.log(`${bill.billNumber}:`)
    console.log(`  Balance: ₱${Number(updatedBill?.balance).toFixed(2)}`)
    console.log(`  Status: ${updatedBill?.status}`)
    console.log(`  Advance Dues: ₱${Number(advance?.advanceDues).toFixed(2)}`)
    console.log(`  Advance Utilities: ₱${Number(advance?.advanceUtilities).toFixed(2)}`)
    console.log()
  }

  console.log("✓ All overpaid bills fixed and advance balances created")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
