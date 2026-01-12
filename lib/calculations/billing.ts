import { calculateWaterBill, WaterTierSettings } from './water'

export interface BillingSettings {
  // Electric
  electricRate: number
  electricMinCharge: number
  
  // Association Dues
  associationDuesRate: number
  
  // Penalty
  penaltyRate: number
  
  // Water tiers
  waterSettings: WaterTierSettings
}

/**
 * Calculate electric bill
 * Formula from Excel: =IF(P9<=50, 50, (E9*F9))
 * 
 * If (consumption × rate) <= min charge, charge minimum
 * Otherwise, charge consumption × rate
 */
export function calculateElectricBill(
  consumption: number,
  settings: BillingSettings
): number {
  const amount = consumption * settings.electricRate
  return Math.max(amount, settings.electricMinCharge)
}

/**
 * Calculate association dues
 * Formula: Area × Rate
 */
export function calculateAssociationDues(
  area: number,
  settings: BillingSettings
): number {
  return area * settings.associationDuesRate
}

/**
 * Interface for unpaid bill in penalty calculation
 */
export interface UnpaidBill {
  month: string
  principal: number  // Electric + Water + Assoc Dues + Other charges
}

/**
 * Calculate 10% compounding penalty
 * Based on Ma'am Rose's EXACT formula from Excel (cell-by-cell verified)
 *
 * Excel Column Reference:
 * - C: Principal (monthly bill amount)
 * - D: 10% P = C × 10%
 * - E: Sum w/ Prev Interest = E(prev) + F(prev) + D(curr)
 * - F: Comp. 10% Interest = E × 10%
 * - H: Total Interest = E + F (for month 2+) or just D (for month 1)
 *
 * Month 1: totalInterest = principal × 10%
 * Month 2+:
 *   sumWithPrevInterest = prevTotalInterest + (currentPrincipal × 10%)
 *   compoundInterest = sumWithPrevInterest × 10%
 *   totalInterest = sumWithPrevInterest + compoundInterest
 *
 * IMPORTANT: This handles VARIABLE principals (real bills vary each month)
 */
export function calculateCompoundingPenalty(
  bills: UnpaidBill[],
  penaltyRate: number = 0.10
): {
  totalInterest: number
  totalPrincipal: number
  totalWithInterest: number
  breakdown: Array<{
    month: string
    principal: number
    tenPercentP: number
    sumWithPrevInterest: number
    compoundInterest: number
    totalInterest: number
  }>
} {
  if (bills.length === 0) {
    return {
      totalInterest: 0,
      totalPrincipal: 0,
      totalWithInterest: 0,
      breakdown: []
    }
  }

  let totalInterest = 0
  let totalPrincipal = 0
  const breakdown = []

  for (let i = 0; i < bills.length; i++) {
    const principal = bills[i].principal
    const tenPercentP = principal * penaltyRate
    totalPrincipal += principal

    if (i === 0) {
      // Month 1: Simple 10% of principal (column D only)
      totalInterest = tenPercentP
      breakdown.push({
        month: bills[i].month,
        principal,
        tenPercentP,
        sumWithPrevInterest: 0,
        compoundInterest: 0,
        totalInterest
      })
    } else {
      // Month 2+: Compound calculation
      // E = E(prev) + F(prev) + D(curr) = totalInterest + tenPercentP
      const sumWithPrevInterest = totalInterest + tenPercentP
      // F = E × 10%
      const compoundInterest = sumWithPrevInterest * penaltyRate
      // H = E + F
      totalInterest = sumWithPrevInterest + compoundInterest

      breakdown.push({
        month: bills[i].month,
        principal,
        tenPercentP,
        sumWithPrevInterest,
        compoundInterest,
        totalInterest
      })
    }
  }

  return {
    totalInterest,
    totalPrincipal,
    totalWithInterest: totalPrincipal + totalInterest,
    breakdown
  }
}

/**
 * Simplified penalty calculation for single principal over multiple months
 * Use this when all months have the SAME bill amount
 *
 * @deprecated Prefer calculateCompoundingPenalty with array of bills for accuracy
 */
export function calculateSimplePenalty(
  principal: number,
  monthsOverdue: number,
  penaltyRate: number = 0.10
): number {
  if (monthsOverdue === 0) return 0

  // Create array of identical bills
  const bills: UnpaidBill[] = Array.from({ length: monthsOverdue }, (_, i) => ({
    month: `Month ${i + 1}`,
    principal
  }))

  const result = calculateCompoundingPenalty(bills, penaltyRate)
  return result.totalInterest
}

/**
 * Calculate penalty breakdown by month (legacy API for backward compatibility)
 */
export function getPenaltyBreakdown(
  principal: number,
  monthsOverdue: number,
  penaltyRate: number = 0.10
): Array<{
  month: number
  principalPenalty: number
  compoundedPenalty: number
  monthlyPenalty: number
  totalPenalty: number
}> {
  const bills: UnpaidBill[] = Array.from({ length: monthsOverdue }, (_, i) => ({
    month: `Month ${i + 1}`,
    principal
  }))

  const result = calculateCompoundingPenalty(bills, penaltyRate)

  return result.breakdown.map((item, index) => ({
    month: index + 1,
    principalPenalty: item.tenPercentP,
    compoundedPenalty: item.compoundInterest,
    monthlyPenalty: item.tenPercentP + item.compoundInterest,
    totalPenalty: item.totalInterest
  }))
}

/**
 * Calculate complete bill for a unit
 */
export interface BillCalculationInput {
  electricConsumption: number
  waterConsumption: number
  unitType: 'RESIDENTIAL' | 'COMMERCIAL'
  area: number
  settings: BillingSettings
}

export interface BillCalculationResult {
  electricAmount: number
  waterAmount: number
  associationDues: number
  subtotal: number
  penaltyAmount?: number
  totalAmount: number
  breakdown: {
    electric: {
      consumption: number
      rate: number
      amount: number
      minCharge: number
    }
    water: {
      consumption: number
      amount: number
      tier: string
    }
    dues: {
      area: number
      rate: number
      amount: number
    }
  }
}

export function calculateBill(input: BillCalculationInput): BillCalculationResult {
  const electricAmount = calculateElectricBill(input.electricConsumption, input.settings)
  const waterAmount = calculateWaterBill(
    input.waterConsumption,
    input.unitType,
    input.settings.waterSettings
  )
  const associationDues = calculateAssociationDues(input.area, input.settings)
  
  const subtotal = electricAmount + waterAmount + associationDues
  
  return {
    electricAmount,
    waterAmount,
    associationDues,
    subtotal,
    totalAmount: subtotal,
    breakdown: {
      electric: {
        consumption: input.electricConsumption,
        rate: input.settings.electricRate,
        amount: electricAmount,
        minCharge: input.settings.electricMinCharge
      },
      water: {
        consumption: input.waterConsumption,
        amount: waterAmount,
        tier: waterAmount <= 200 ? 'Tier 1-2' : 'Tier 3+'
      },
      dues: {
        area: input.area,
        rate: input.settings.associationDuesRate,
        amount: associationDues
      }
    }
  }
}

/**
 * Calculate months between two dates
 */
export function calculateMonthsDifference(
  startDate: Date,
  endDate: Date
): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const yearsDiff = end.getFullYear() - start.getFullYear()
  const monthsDiff = end.getMonth() - start.getMonth()
  
  return yearsDiff * 12 + monthsDiff
}

/**
 * Check if a bill is overdue
 */
export function isBillOverdue(dueDate: Date): boolean {
  return new Date() > new Date(dueDate)
}

/**
 * Calculate months overdue from due date
 */
export function calculateMonthsOverdue(
  dueDate: Date,
  currentDate: Date = new Date()
): number {
  if (currentDate <= dueDate) return 0
  
  const months = calculateMonthsDifference(dueDate, currentDate)
  return Math.max(0, months)
}
