import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Get sample bills with penalties
  const billsWithPenalty = await prisma.bill.findMany({
    where: { penaltyAmount: { gt: 0 } },
    orderBy: { createdAt: "asc" },
    take: 10,
    include: { unit: true },
  })

  console.log("\nBills with penalties (ordered by creation date):\n")

  for (const b of billsWithPenalty) {
    const principal = Number(b.totalAmount) - Number(b.penaltyAmount)
    const penaltyPercent = (Number(b.penaltyAmount) / principal) * 100

    console.log(`${b.billNumber} (${b.billType || "REGULAR"})`)
    console.log(`  Unit: ${b.unit.unitNumber}`)
    console.log(`  Created: ${b.createdAt.toISOString()}`)
    console.log(`  Billing Month: ${b.billingMonth.toISOString().split("T")[0]}`)
    console.log(`  Principal: ₱${principal.toFixed(2)}`)
    console.log(`  Penalty: ₱${Number(b.penaltyAmount).toFixed(2)} (${penaltyPercent.toFixed(3)}%)`)
    console.log(`  SP Assessment: ₱${Number(b.spAssessment).toFixed(2)}`)
    console.log(``)
  }

  // Check if there's a pattern - are opening balance bills different?
  console.log("\n=== Analyzing by Bill Type ===\n")

  const billsByType = await prisma.bill.groupBy({
    by: ["billType"],
    where: { penaltyAmount: { gt: 0 } },
    _count: { id: true },
    _avg: { penaltyAmount: true },
  })

  for (const bt of billsByType) {
    console.log(`${bt.billType || "REGULAR"}: ${bt._count.id} bills, avg penalty: ₱${Number(bt._avg.penaltyAmount).toFixed(2)}`)
  }

  // Check the earliest bill generation timestamp
  console.log("\n=== Bill Creation Timeline ===\n")

  const firstBill = await prisma.bill.findFirst({
    orderBy: { createdAt: "asc" },
  })
  const lastBill = await prisma.bill.findFirst({
    orderBy: { createdAt: "desc" },
  })

  console.log(`First bill created: ${firstBill?.createdAt.toISOString()}`)
  console.log(`Last bill created: ${lastBill?.createdAt.toISOString()}`)

  // Get distinct creation dates
  const billsGroupedByDate = await prisma.bill.groupBy({
    by: ["createdAt"],
    _count: { id: true },
    orderBy: { createdAt: "asc" },
  })

  // Group by day
  const byDay: Record<string, number> = {}
  for (const bg of billsGroupedByDate) {
    const day = bg.createdAt.toISOString().split("T")[0]
    byDay[day] = (byDay[day] || 0) + bg._count.id
  }

  console.log("\nBills created per day:")
  for (const [day, count] of Object.entries(byDay)) {
    console.log(`  ${day}: ${count} bills`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
