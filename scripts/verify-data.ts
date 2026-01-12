import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("\n=== PHASE 2: Payment Processing Verification ===\n")

  // 1. Get bills with outstanding balances
  console.log("1. Bills with Outstanding Balances:")
  const unpaidBills = await prisma.bill.findMany({
    where: {
      status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
    },
    include: {
      unit: {
        select: { unitNumber: true },
      },
      payments: {
        select: {
          electricAmount: true,
          waterAmount: true,
          duesAmount: true,
          penaltyAmount: true,
          spAssessmentAmount: true,
          totalAmount: true,
        },
      },
    },
    orderBy: [
      { unit: { unitNumber: "asc" } },
      { billingMonth: "asc" },
    ],
    take: 20,
  })

  if (unpaidBills.length === 0) {
    console.log("   No unpaid bills found.\n")
  } else {
    for (const bill of unpaidBills) {
      const totalPaid = bill.payments.reduce(
        (sum, p) => sum + Number(p.totalAmount),
        0
      )
      console.log(
        `   ${bill.unit.unitNumber} | ${bill.billNumber} | ${bill.billingMonth.toISOString().split("T")[0]} | ${bill.status} | Total: ₱${Number(bill.totalAmount).toFixed(2)} | Paid: ₱${totalPaid.toFixed(2)} | Balance: ₱${Number(bill.balance).toFixed(2)} | Penalty: ₱${Number(bill.penaltyAmount).toFixed(2)}`
      )
    }
  }

  // 2. Get recent payments
  console.log("\n2. Recent Payments (last 10):")
  const recentPayments = await prisma.payment.findMany({
    include: {
      unit: {
        select: { unitNumber: true },
      },
      billPayments: {
        select: {
          billId: true,
          totalAmount: true,
        },
      },
    },
    orderBy: { paymentDate: "desc" },
    take: 10,
  })

  if (recentPayments.length === 0) {
    console.log("   No payments found.\n")
  } else {
    for (const payment of recentPayments) {
      const billsAllocated = payment.billPayments.length
      console.log(
        `   ${payment.unit.unitNumber} | OR#: ${payment.orNumber} | Date: ${payment.paymentDate.toISOString().split("T")[0]} | Total: ₱${Number(payment.totalAmount).toFixed(2)} | Bills Allocated: ${billsAllocated}`
      )
    }
  }

  // 3. Verify payment allocation - check that paidAmount matches sum of BillPayments
  console.log("\n3. Payment Allocation Verification:")
  const billsWithPayments = await prisma.bill.findMany({
    where: {
      paidAmount: { gt: 0 },
    },
    include: {
      unit: {
        select: { unitNumber: true },
      },
      payments: {
        select: {
          totalAmount: true,
        },
      },
    },
    take: 15,
  })

  let allocationErrors = 0
  for (const bill of billsWithPayments) {
    const sumFromBillPayments = bill.payments.reduce(
      (sum, p) => sum + Number(p.totalAmount),
      0
    )
    const paidAmountOnBill = Number(bill.paidAmount)
    const diff = Math.abs(sumFromBillPayments - paidAmountOnBill)

    if (diff > 0.01) {
      console.log(
        `   ⚠️ MISMATCH: ${bill.unit.unitNumber} | ${bill.billNumber} | Bill.paidAmount: ₱${paidAmountOnBill.toFixed(2)} | Sum(BillPayments): ₱${sumFromBillPayments.toFixed(2)} | Diff: ₱${diff.toFixed(2)}`
      )
      allocationErrors++
    }
  }

  if (allocationErrors === 0) {
    console.log("   ✅ All payment allocations are correct!")
  }

  // 4. Verify bill balance calculation
  console.log("\n4. Bill Balance Verification:")
  const billsToVerify = await prisma.bill.findMany({
    take: 20,
  })

  let balanceErrors = 0
  for (const bill of billsToVerify) {
    const expectedBalance = Number(bill.totalAmount) - Number(bill.paidAmount)
    const actualBalance = Number(bill.balance)
    const diff = Math.abs(expectedBalance - actualBalance)

    if (diff > 0.01) {
      console.log(
        `   ⚠️ BALANCE MISMATCH: ${bill.billNumber} | Total: ₱${Number(bill.totalAmount).toFixed(2)} | Paid: ₱${Number(bill.paidAmount).toFixed(2)} | Expected Balance: ₱${expectedBalance.toFixed(2)} | Actual Balance: ₱${actualBalance.toFixed(2)}`
      )
      balanceErrors++
    }
  }

  if (balanceErrors === 0) {
    console.log("   ✅ All bill balances are correctly calculated!")
  }

  console.log("\n=== PHASE 3: Interest/Penalty Verification ===\n")

  // 5. Check bills with penalties
  console.log("5. Bills with Penalties:")
  const billsWithPenalty = await prisma.bill.findMany({
    where: {
      penaltyAmount: { gt: 0 },
    },
    include: {
      unit: {
        select: { unitNumber: true },
      },
    },
    orderBy: { billingMonth: "desc" },
    take: 10,
  })

  if (billsWithPenalty.length === 0) {
    console.log("   No bills with penalties found.\n")
  } else {
    for (const bill of billsWithPenalty) {
      console.log(
        `   ${bill.unit.unitNumber} | ${bill.billNumber} | ${bill.billingMonth.toISOString().split("T")[0]} | Penalty: ₱${Number(bill.penaltyAmount).toFixed(2)} | Total: ₱${Number(bill.totalAmount).toFixed(2)}`
      )
    }
  }

  // 6. Summary statistics
  console.log("\n=== SUMMARY ===\n")

  const totalBills = await prisma.bill.count()
  const paidBills = await prisma.bill.count({ where: { status: "PAID" } })
  const partialBills = await prisma.bill.count({ where: { status: "PARTIAL" } })
  const unpaidCount = await prisma.bill.count({
    where: { status: { in: ["UNPAID", "OVERDUE"] } },
  })
  const totalPayments = await prisma.payment.count()

  const outstandingSum = await prisma.bill.aggregate({
    where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
    _sum: { balance: true },
  })

  console.log(`   Total Bills: ${totalBills}`)
  console.log(`   - PAID: ${paidBills}`)
  console.log(`   - PARTIAL: ${partialBills}`)
  console.log(`   - UNPAID/OVERDUE: ${unpaidCount}`)
  console.log(`   Total Payments: ${totalPayments}`)
  console.log(
    `   Total Outstanding: ₱${Number(outstandingSum._sum.balance || 0).toFixed(2)}`
  )

  console.log("\n=== Verification Complete ===\n")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
