import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Find unit M2-GF-16
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: "M2-GF-16" },
  })

  if (!unit) {
    console.log("Unit M2-GF-16 not found!")
    return
  }

  console.log("\n=== All Bills for M2-GF-16 ===\n")

  const allBills = await prisma.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: "asc" },
  })

  for (const bill of allBills) {
    console.log(`${bill.billNumber}`)
    console.log(`  Type: ${bill.billType || "REGULAR"}`)
    console.log(`  Billing Month: ${bill.billingMonth.toISOString().split("T")[0]}`)
    console.log(`  Status: ${bill.status}`)
    console.log(`  Electric: ₱${Number(bill.electricAmount).toFixed(2)}`)
    console.log(`  Water: ₱${Number(bill.waterAmount).toFixed(2)}`)
    console.log(`  Assoc Dues: ₱${Number(bill.associationDues).toFixed(2)}`)
    console.log(`  Parking Fee: ₱${Number(bill.parkingFee).toFixed(2)}`)
    console.log(`  SP Assessment: ₱${Number(bill.spAssessment).toFixed(2)}`)
    console.log(`  Penalty: ₱${Number(bill.penaltyAmount).toFixed(2)}`)
    console.log(`  Other Charges: ₱${Number(bill.otherCharges).toFixed(2)}`)
    console.log(`  Discounts: -₱${Number(bill.discounts).toFixed(2)}`)
    console.log(`  Adv Dues Applied: -₱${Number(bill.advanceDuesApplied).toFixed(2)}`)
    console.log(`  Adv Util Applied: -₱${Number(bill.advanceUtilApplied).toFixed(2)}`)
    console.log(`  ---`)
    const sum = Number(bill.electricAmount) + Number(bill.waterAmount) + Number(bill.associationDues) +
                Number(bill.parkingFee) + Number(bill.spAssessment) + Number(bill.penaltyAmount) +
                Number(bill.otherCharges) - Number(bill.discounts) - Number(bill.advanceDuesApplied) -
                Number(bill.advanceUtilApplied)
    console.log(`  Sum of Components: ₱${sum.toFixed(2)}`)
    console.log(`  Total: ₱${Number(bill.totalAmount).toFixed(2)}`)
    console.log(`  Difference: ₱${(Number(bill.totalAmount) - sum).toFixed(2)} (this is previousBalance)`)
    console.log(`  ---`)
    console.log(`  Paid: ₱${Number(bill.paidAmount).toFixed(2)}`)
    console.log(`  Balance: ₱${Number(bill.balance).toFixed(2)}`)
    console.log(`  Created: ${bill.createdAt.toISOString()}`)
    console.log("")
  }

  console.log("=== Summary ===")
  console.log(`Total bills: ${allBills.length}`)
  console.log(`Opening Balance bills: ${allBills.filter(b => b.billType === "OPENING_BALANCE").length}`)
  console.log(`Regular bills: ${allBills.filter(b => !b.billType || b.billType === "REGULAR").length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
