/**
 * Philippine Timezone Utility
 *
 * All billing operations use Philippine time (Asia/Manila, UTC+8)
 * This ensures consistent date handling regardless of server location (e.g., Vercel US servers)
 */

// Philippine timezone offset: UTC+8
const PH_TIMEZONE = 'Asia/Manila'
const PH_OFFSET_HOURS = 8

/**
 * Create a date that represents midnight in Philippine time
 * stored as UTC for database consistency
 *
 * @param year Full year (e.g., 2025)
 * @param month Month (1-12, NOT 0-indexed like JS Date)
 * @param day Day of month (1-31)
 * @returns Date object representing midnight Philippine time in UTC
 */
export function createPhilippineDate(year: number, month: number, day: number = 1): Date {
  // Create the date as if it's midnight in Philippine time
  // Then subtract 8 hours to get the UTC equivalent
  // This way, when displayed in PH timezone, it shows the correct date
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  return utcDate
}

/**
 * Create a billing period date (first of month in Philippine time)
 *
 * @param year Full year (e.g., 2025)
 * @param month Month (1-12)
 * @returns Date representing first of month at midnight PH time
 */
export function createBillingPeriod(year: number, month: number): Date {
  return createPhilippineDate(year, month, 1)
}

/**
 * Format a date for display in Philippine timezone
 *
 * @param date Date to format
 * @param options Intl.DateTimeFormat options
 * @returns Formatted date string in Philippine timezone
 */
export function formatPhilippineDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('en-PH', {
    timeZone: PH_TIMEZONE,
    ...options
  })
}

/**
 * Get current date in Philippine timezone
 * @returns Current date/time adjusted to Philippine timezone
 */
export function getPhilippineNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: PH_TIMEZONE }))
}

/**
 * Parse a date string and return as Philippine timezone date
 * Useful for parsing form inputs which are typically in YYYY-MM format
 *
 * @param dateString Date string in YYYY-MM or YYYY-MM-DD format
 * @returns Date object for the first of that month (or specified day)
 */
export function parsePhilippineDate(dateString: string): Date {
  const parts = dateString.split('-')
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parts[2] ? parseInt(parts[2], 10) : 1
  return createPhilippineDate(year, month, day)
}

/**
 * Convert a billing month string (YYYY-MM) to billing period date
 *
 * @param billingMonth String in YYYY-MM format
 * @returns Date for the first of that month
 */
export function billingMonthToDate(billingMonth: string): Date {
  return parsePhilippineDate(billingMonth + '-01')
}

/**
 * Get the billing period display string
 *
 * @param date Billing period date
 * @returns Formatted string like "November 2025"
 */
export function getBillingPeriodDisplay(date: Date): string {
  return formatPhilippineDate(date, { year: 'numeric', month: 'long' })
}

// Common billing periods for 2025-2026 (pre-calculated for consistency)
export const BILLING_PERIODS = {
  OCTOBER_2025: createBillingPeriod(2025, 10),
  NOVEMBER_2025: createBillingPeriod(2025, 11),
  DECEMBER_2025: createBillingPeriod(2025, 12),
  JANUARY_2026: createBillingPeriod(2026, 1),
} as const
