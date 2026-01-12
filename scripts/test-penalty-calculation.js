const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testPenaltyCalculation(unitNumber, billingMonthStr) {
  console.log('='.repeat(70))
  console.log(`PENALTY CALCULATION TEST: ${unitNumber}`)
  console.log('='.repeat(70))

  const unit = await prisma.unit.findFirst({
    where: { unitNumber },
    include: { owner: true }
  })

  if (!unit) {
    console.log('Unit not found!')
    return
  }

  console.log('Owner:', unit.owner?.lastName, unit.owner?.firstName)

  // Get tenant settings for penalty rate
  const tenant = await prisma.tenant.findFirst({
    include: { settings: true }
  })
  const penaltyRate = Number(tenant.settings.penaltyRate)  // e.g., 0.10 for 10% (stored as decimal)

  console.log('Penalty Rate:', (penaltyRate * 100) + '%')

  // Parse billing month (default to current month)
  let billingPeriod
  if (billingMonthStr) {
    const [year, month] = billingMonthStr.split('-').map(Number)
    billingPeriod = new Date(Date.UTC(year, month - 1, 1))
  } else {
    const now = new Date()
    billingPeriod = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  }
  console.log('Billing Period:', billingPeriod.toISOString().slice(0,7))

  // Get all unpaid bills ordered by billing month (oldest first)
  const unpaidBills = await prisma.bill.findMany({
    where: {
      unitId: unit.id,
      status: { in: ['UNPAID', 'PARTIAL'] }
    },
    orderBy: { billingMonth: 'asc' }
  })

  if (unpaidBills.length === 0) {
    console.log('\nNo unpaid bills found!')
    return
  }

  console.log('\n--- UNPAID BILLS ---')
  console.log('Month        | Bill Total  | Penalty     | Principal   | Paid        | Balance     | Months Overdue')
  console.log('-'.repeat(105))

  let cumulativeInterest = 0
  let interestAppliedCount = 0
  let totalPreviousBalance = 0

  const breakdown = []

  for (const bill of unpaidBills) {
    // Use actual bill balance (what's still owed)
    const unpaidBalance = Math.max(0, Number(bill.balance))
    totalPreviousBalance += unpaidBalance

    // Calculate months overdue based on billing month difference
    // Bill is due the month AFTER billing, so 1st month past due = current - (bill + 1)
    // September bill due in October. November SOA = 1st month past due (grace)
    // December SOA = 2nd month past due (interest applies)
    const billMonth = bill.billingMonth
    const monthsOverdue = (billingPeriod.getFullYear() - billMonth.getFullYear()) * 12 +
                         (billingPeriod.getMonth() - billMonth.getMonth()) - 1

    // Calculate unpaid principal (bill total minus penalty)
    const billPrincipal = Number(bill.totalAmount) - Number(bill.penaltyAmount)
    const paidAmount = Number(bill.paidAmount)
    const totalWithPenalty = Number(bill.totalAmount)
    const unpaidRatio = totalWithPenalty > 0 ? Math.max(0, totalWithPenalty - paidAmount) / totalWithPenalty : 1
    const unpaidPrincipal = billPrincipal * unpaidRatio

    const monthLabel = bill.billingMonth.toISOString().slice(0,7)

    console.log(
      monthLabel.padEnd(12) + ' | ' +
      Number(bill.totalAmount).toFixed(2).padStart(11) + ' | ' +
      Number(bill.penaltyAmount).toFixed(2).padStart(11) + ' | ' +
      billPrincipal.toFixed(2).padStart(11) + ' | ' +
      paidAmount.toFixed(2).padStart(11) + ' | ' +
      unpaidBalance.toFixed(2).padStart(11) + ' | ' +
      monthsOverdue
    )

    // Apply interest based on months overdue
    // 1st month overdue = grace period (no interest)
    // 2nd month+ = interest applies
    if (monthsOverdue >= 2 && unpaidPrincipal > 0) {
      const tenPercentP = unpaidPrincipal * penaltyRate
      let sumWithPrev, compound, totalInterest

      if (interestAppliedCount === 0) {
        // First bill getting interest: simple 10%
        sumWithPrev = tenPercentP
        compound = 0
        totalInterest = tenPercentP
        cumulativeInterest = totalInterest
      } else {
        // Subsequent bills: compound formula
        sumWithPrev = cumulativeInterest + tenPercentP
        compound = sumWithPrev * penaltyRate
        totalInterest = sumWithPrev + compound
        cumulativeInterest = totalInterest
      }
      interestAppliedCount++

      breakdown.push({
        month: monthLabel,
        monthsOverdue,
        principal: unpaidPrincipal,
        tenPercentP,
        sumWithPrev,
        compound,
        totalInterest
      })
    } else if (monthsOverdue === 1) {
      breakdown.push({
        month: monthLabel,
        monthsOverdue,
        principal: unpaidPrincipal,
        tenPercentP: 0,
        sumWithPrev: 0,
        compound: 0,
        totalInterest: 0,
        graceMonth: true
      })
    }
  }

  console.log('\n--- MA\'AM ROSE\'S CUMULATIVE COMPOUND CALCULATION ---')
  console.log('Month     | Mths OD | Principal   | 10% P       | Sum w/Prev  | Compound    | Total Interest')
  console.log('-'.repeat(100))

  for (const row of breakdown) {
    if (row.graceMonth) {
      console.log(
        row.month.padEnd(9) + ' | ' +
        String(row.monthsOverdue).padStart(7) + ' | ' +
        row.principal.toFixed(2).padStart(11) + ' | ' +
        '(GRACE PERIOD - NO INTEREST)'.padStart(50)
      )
    } else {
      console.log(
        row.month.padEnd(9) + ' | ' +
        String(row.monthsOverdue).padStart(7) + ' | ' +
        row.principal.toFixed(2).padStart(11) + ' | ' +
        row.tenPercentP.toFixed(2).padStart(11) + ' | ' +
        row.sumWithPrev.toFixed(2).padStart(11) + ' | ' +
        row.compound.toFixed(2).padStart(11) + ' | ' +
        row.totalInterest.toFixed(2).padStart(14)
      )
    }
  }

  console.log('\n--- SUMMARY (Matches SOA Display) ---')
  console.log('Previous Balance:', totalPreviousBalance.toFixed(2))
  console.log('Penalty/Interest:', cumulativeInterest.toFixed(2))
  console.log('')
}

async function main() {
  // Test with a specific unit and optional billing month
  // Usage: node test-penalty-calculation.js M2-2F-5 2025-11
  const unitToTest = process.argv[2] || 'M2-2F-16'
  const billingMonth = process.argv[3] || null  // e.g., '2025-11' for November 2025
  await testPenaltyCalculation(unitToTest, billingMonth)

  console.log('\nDone!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
