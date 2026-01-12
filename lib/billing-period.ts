/**
 * Billing Period Utilities
 *
 * Handles all billing schedule computations including:
 * - Reading periods (e.g., 26th to 26th)
 * - Bill generation dates
 * - Statement dates
 * - Due dates
 * - Grace periods
 * - Penalty start dates
 */

export interface BillingScheduleSettings {
  readingDay: number          // Day of month for meter readings (default: 26)
  billingDayOfMonth: number   // Day bills are generated (default: 27)
  statementDelay: number      // Days after billing to send statement (default: 10)
  dueDateDelay: number        // Days after statement for due date (default: 10)
  gracePeriodDays: number     // Days after due date before penalty (default: 0)
}

export interface BillingPeriodInfo {
  // The billing month (e.g., "2025-01" for January 2025 bill)
  billingMonth: string

  // Reading period
  readingPeriodStart: Date    // Previous month's reading day
  readingPeriodEnd: Date      // Current month's reading day

  // Key dates
  billGenerationDate: Date    // When bill is created
  statementDate: Date         // When statement is sent
  dueDate: Date               // Payment due date
  penaltyStartDate: Date      // When penalty begins

  // Status helpers
  isOverdue: (currentDate?: Date) => boolean
  isPenaltyApplicable: (currentDate?: Date) => boolean
  getMonthsOverdue: (currentDate?: Date) => number
}

/**
 * Default billing schedule settings
 */
export const DEFAULT_BILLING_SETTINGS: BillingScheduleSettings = {
  readingDay: 26,
  billingDayOfMonth: 27,
  statementDelay: 10,
  dueDateDelay: 10,
  gracePeriodDays: 0
}

/**
 * Calculate billing period information for a given month
 *
 * @param billingMonth - The billing month in "YYYY-MM" format (e.g., "2025-01")
 * @param settings - Billing schedule settings
 * @returns Complete billing period information
 */
export function getBillingPeriodInfo(
  billingMonth: string,
  settings: BillingScheduleSettings = DEFAULT_BILLING_SETTINGS
): BillingPeriodInfo {
  const [year, month] = billingMonth.split('-').map(Number)

  // Reading period: Previous month's reading day to current month's reading day
  // For January 2025 bill: Dec 26, 2024 to Jan 26, 2025
  const readingPeriodEnd = new Date(year, month - 1, settings.readingDay)
  const readingPeriodStart = new Date(year, month - 2, settings.readingDay)

  // Bill generation: Current month's billing day
  // For January 2025 bill: Jan 27, 2025
  const billGenerationDate = new Date(year, month - 1, settings.billingDayOfMonth)

  // Statement date: Bill generation + statement delay
  const statementDate = new Date(billGenerationDate)
  statementDate.setDate(statementDate.getDate() + settings.statementDelay)

  // Due date: Statement date + due date delay
  const dueDate = new Date(statementDate)
  dueDate.setDate(dueDate.getDate() + settings.dueDateDelay)

  // Penalty start: Due date + grace period
  const penaltyStartDate = new Date(dueDate)
  penaltyStartDate.setDate(penaltyStartDate.getDate() + settings.gracePeriodDays + 1)

  return {
    billingMonth,
    readingPeriodStart,
    readingPeriodEnd,
    billGenerationDate,
    statementDate,
    dueDate,
    penaltyStartDate,

    isOverdue: (currentDate = new Date()) => currentDate > dueDate,

    isPenaltyApplicable: (currentDate = new Date()) => currentDate >= penaltyStartDate,

    getMonthsOverdue: (currentDate = new Date()) => {
      if (currentDate <= dueDate) return 0

      const monthsDiff =
        (currentDate.getFullYear() - dueDate.getFullYear()) * 12 +
        (currentDate.getMonth() - dueDate.getMonth())

      // If we're past the due day in the current month, add 1
      if (currentDate.getDate() > dueDate.getDate()) {
        return monthsDiff + 1
      }

      return Math.max(0, monthsDiff)
    }
  }
}

/**
 * Get the current billing month based on today's date
 *
 * If today is before the reading day, return previous month
 * If today is on or after the reading day, return current month
 */
export function getCurrentBillingMonth(
  settings: BillingScheduleSettings = DEFAULT_BILLING_SETTINGS,
  currentDate: Date = new Date()
): string {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1  // 1-indexed
  const day = currentDate.getDate()

  // If we haven't reached the reading day yet, we're still in the previous billing period
  if (day < settings.readingDay) {
    if (month === 1) {
      return `${year - 1}-12`
    }
    return `${year}-${String(month - 1).padStart(2, '0')}`
  }

  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * Get the next billing month after a given month
 */
export function getNextBillingMonth(billingMonth: string): string {
  const [year, month] = billingMonth.split('-').map(Number)

  if (month === 12) {
    return `${year + 1}-01`
  }

  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Get the previous billing month before a given month
 */
export function getPreviousBillingMonth(billingMonth: string): string {
  const [year, month] = billingMonth.split('-').map(Number)

  if (month === 1) {
    return `${year - 1}-12`
  }

  return `${year}-${String(month - 1).padStart(2, '0')}`
}

/**
 * Get a range of billing months
 *
 * @param startMonth - Start month in "YYYY-MM" format
 * @param count - Number of months to generate
 * @param direction - 'forward' or 'backward'
 */
export function getBillingMonthRange(
  startMonth: string,
  count: number,
  direction: 'forward' | 'backward' = 'forward'
): string[] {
  const months: string[] = [startMonth]
  let current = startMonth

  for (let i = 1; i < count; i++) {
    current = direction === 'forward'
      ? getNextBillingMonth(current)
      : getPreviousBillingMonth(current)
    months.push(current)
  }

  return direction === 'backward' ? months.reverse() : months
}

/**
 * Format billing month for display
 */
export function formatBillingMonth(billingMonth: string): string {
  const [year, month] = billingMonth.split('-').map(Number)
  const date = new Date(year, month - 1, 1)

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
}

/**
 * Check if a date falls within a billing period
 */
export function isDateInBillingPeriod(
  date: Date,
  billingMonth: string,
  settings: BillingScheduleSettings = DEFAULT_BILLING_SETTINGS
): boolean {
  const period = getBillingPeriodInfo(billingMonth, settings)
  return date >= period.readingPeriodStart && date <= period.readingPeriodEnd
}

/**
 * Calculate dynamic penalty for overdue bills
 * This should be called when displaying bills, not stored
 *
 * @param unpaidBills - Array of unpaid bills with their amounts and billing months
 * @param penaltyRate - Monthly penalty rate (default 10% = 0.10)
 * @param currentDate - Date to calculate penalty as of
 */
export interface UnpaidBillForPenalty {
  billingMonth: string
  principalAmount: number  // Electric + Water + Assoc Dues
  dueDate: Date
}

export function calculateDynamicPenalty(
  unpaidBills: UnpaidBillForPenalty[],
  penaltyRate: number = 0.10,
  currentDate: Date = new Date()
): {
  totalPenalty: number
  breakdown: Array<{
    billingMonth: string
    principal: number
    monthsOverdue: number
    penaltyAmount: number
  }>
} {
  // Sort bills by billing month (oldest first)
  const sortedBills = [...unpaidBills].sort((a, b) =>
    a.billingMonth.localeCompare(b.billingMonth)
  )

  // Filter to only overdue bills
  const overdueBills = sortedBills.filter(bill => currentDate > bill.dueDate)

  if (overdueBills.length === 0) {
    return { totalPenalty: 0, breakdown: [] }
  }

  // Use the compounding penalty formula
  let totalInterest = 0
  const breakdown: Array<{
    billingMonth: string
    principal: number
    monthsOverdue: number
    penaltyAmount: number
  }> = []

  for (let i = 0; i < overdueBills.length; i++) {
    const bill = overdueBills[i]
    const tenPercentP = bill.principalAmount * penaltyRate

    // Calculate months overdue for this specific bill
    const monthsOverdue = Math.max(1, Math.ceil(
      (currentDate.getTime() - bill.dueDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
    ))

    if (i === 0) {
      // First overdue bill: simple 10%
      totalInterest = tenPercentP
    } else {
      // Subsequent bills: compound calculation
      const sumWithPrevInterest = totalInterest + tenPercentP
      const compoundInterest = sumWithPrevInterest * penaltyRate
      totalInterest = sumWithPrevInterest + compoundInterest
    }

    breakdown.push({
      billingMonth: bill.billingMonth,
      principal: bill.principalAmount,
      monthsOverdue,
      penaltyAmount: totalInterest
    })
  }

  return { totalPenalty: totalInterest, breakdown }
}

/**
 * Get billing schedule summary for a tenant
 */
export function getBillingScheduleSummary(
  settings: BillingScheduleSettings
): string {
  return `
Billing Schedule:
- Meter Reading Day: ${settings.readingDay}th of each month
- Reading Period: ${settings.readingDay}th (prev month) to ${settings.readingDay}th (current month)
- Bill Generation: ${settings.billingDayOfMonth}th of each month
- Statement Sent: ${settings.statementDelay} days after bill generation
- Payment Due: ${settings.dueDateDelay} days after statement
- Grace Period: ${settings.gracePeriodDays} days
- Penalty Starts: After grace period expires (10% compounding monthly)
  `.trim()
}
