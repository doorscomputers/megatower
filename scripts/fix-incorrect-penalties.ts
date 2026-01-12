import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * This script fixes incorrect penalty values on bills
 *
 * The issue: September and October 2025 bills have small penalties (0.1% of principal)
 * when they should have NO penalties or correct penalties (10%)
 *
 * Logic:
 * - September 2025 bills: First month, NO previous unpaid bills, penalty should be 0
 * - October 2025 bills: If September is unpaid and 1 month old, still grace period, penalty = 0
 * - Only when generating November+ bills would September bills (2+ months old) get 10% penalty
 *
 * Fix: Set penaltyAmount = 0 for September and October bills,
 * and recalculate totalAmount to exclude the incorrect penalty
 */
async function main() {
  console.log("=== FIX INCORRECT PENALTY DATA ===\n")

  // First, analyze the current state
  const billsWithPenalty = await prisma.bill.findMany({
    where: { penaltyAmount: { gt: 0 } },
    include: { unit: true },
    orderBy: { billingMonth: "asc" },
  })

  console.log(`Found ${billsWithPenalty.length} bills with penalties\n`)

  // Group by billing month
  const byMonth: Record<string, typeof billsWithPenalty> = {}
  for (const bill of billsWithPenalty) {
    const month = bill.billingMonth.toISOString().split("T")[0]
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(bill)
  }

  for (const [month, bills] of Object.entries(byMonth)) {
    const totalIncorrectPenalty = bills.reduce((sum, b) => sum + Number(b.penaltyAmount), 0)
    console.log(`${month}: ${bills.length} bills with total penalty ₱${totalIncorrectPenalty.toFixed(2)}`)
  }

  // Confirm with user
  console.log("\n=== PROPOSED FIX ===")
  console.log("For September and October 2025 bills:")
  console.log("1. Set penaltyAmount = 0")
  console.log("2. Recalculate totalAmount = totalAmount - oldPenalty")
  console.log("3. Recalculate balance = totalAmount - paidAmount")
  console.log("\nThis will NOT affect August (opening balance) bills.\n")

  // Get confirmation (for dry run, just show what would be done)
  const DRY_RUN = false // Set to false to actually fix the data

  if (DRY_RUN) {
    console.log("*** DRY RUN - No changes will be made ***\n")
  }

  // Fix September and October bills
  const septOctBills = await prisma.bill.findMany({
    where: {
      billingMonth: {
        in: [
          new Date(Date.UTC(2025, 8, 1)), // September
          new Date(Date.UTC(2025, 9, 1)), // October
        ],
      },
      penaltyAmount: { gt: 0 },
    },
  })

  console.log(`Bills to fix: ${septOctBills.length}\n`)

  let totalPenaltyRemoved = 0
  let fixedCount = 0

  for (const bill of septOctBills) {
    const oldPenalty = Number(bill.penaltyAmount)
    const oldTotal = Number(bill.totalAmount)
    const newTotal = oldTotal - oldPenalty
    const newBalance = newTotal - Number(bill.paidAmount)

    if (oldPenalty > 0) {
      totalPenaltyRemoved += oldPenalty

      if (!DRY_RUN) {
        await prisma.bill.update({
          where: { id: bill.id },
          data: {
            penaltyAmount: 0,
            totalAmount: newTotal,
            balance: Math.max(0, newBalance),
            status: newBalance <= 0.01 ? "PAID" : Number(bill.paidAmount) > 0 ? "PARTIAL" : "UNPAID",
          },
        })
        fixedCount++
      } else {
        // Just count for dry run
        fixedCount++
        if (fixedCount <= 5) {
          console.log(`Would fix: ${bill.billNumber}`)
          console.log(`  Old: Total ₱${oldTotal.toFixed(2)}, Penalty ₱${oldPenalty.toFixed(2)}`)
          console.log(`  New: Total ₱${newTotal.toFixed(2)}, Penalty ₱0.00\n`)
        }
      }
    }
  }

  console.log("=== SUMMARY ===\n")
  console.log(`Bills to fix: ${fixedCount}`)
  console.log(`Total incorrect penalty to remove: ₱${totalPenaltyRemoved.toFixed(2)}`)

  if (DRY_RUN) {
    console.log("\n*** Run with DRY_RUN = false to apply fixes ***")
  } else {
    console.log(`\n✓ Fixed ${fixedCount} bills`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
