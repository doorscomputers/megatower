const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function fixOctoberBills() {
  console.log('=== FIXING OCTOBER BILLS - REMOVING DUPLICATE SP ASSESSMENT ===\n')

  // Get all October 2025 bills
  const octoberBills = await p.bill.findMany({
    where: { billingMonth: new Date('2025-10-01') },
    include: { unit: true }
  })

  console.log(`Found ${octoberBills.length} October bills\n`)

  let fixedCount = 0

  for (const bill of octoberBills) {
    const spAssessment = Number(bill.spAssessment)
    const penalty = Number(bill.penaltyAmount)

    // If October bill has SP Assessment, it's likely a duplicate (already on September)
    if (spAssessment > 0 || penalty > 0) {
      // Check if September bill also has SP Assessment
      const septemberBill = await p.bill.findFirst({
        where: {
          unitId: bill.unitId,
          billingMonth: new Date('2025-09-01')
        }
      })

      const septSP = septemberBill ? Number(septemberBill.spAssessment) : 0

      console.log(`${bill.unit.unitNumber}:`)
      console.log(`  September SP Assessment: ₱${septSP.toFixed(2)}`)
      console.log(`  October SP Assessment: ₱${spAssessment.toFixed(2)}`)
      console.log(`  October Penalty: ₱${penalty.toFixed(2)}`)

      // If September already has SP Assessment, remove it from October
      if (septSP > 0 && spAssessment > 0) {
        const oldTotal = Number(bill.totalAmount)
        const newTotal = oldTotal - spAssessment - penalty
        const newBalance = newTotal - Number(bill.paidAmount)
        const newStatus = newBalance <= 0.01 ? 'PAID' : (Number(bill.paidAmount) > 0 ? 'PARTIAL' : 'UNPAID')

        console.log(`  Old Total: ₱${oldTotal.toFixed(2)} -> New Total: ₱${newTotal.toFixed(2)}`)
        console.log(`  New Balance: ₱${newBalance.toFixed(2)}, Status: ${newStatus}`)

        await p.bill.update({
          where: { id: bill.id },
          data: {
            spAssessment: 0,
            penaltyAmount: 0,
            totalAmount: newTotal,
            balance: Math.max(0, newBalance),
            status: newStatus
          }
        })

        fixedCount++
        console.log(`  ✓ Fixed!\n`)
      } else {
        console.log(`  (No September SP - keeping October SP)\n`)
      }
    }
  }

  console.log(`\n=== FIXED ${fixedCount} OCTOBER BILLS ===`)
  await p.$disconnect()
}

fixOctoberBills().catch(console.error)
