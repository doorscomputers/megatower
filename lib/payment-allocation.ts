/**
 * Payment Allocation System
 * 
 * Handles partial and full payments
 * Supports FIFO (Oldest First) and LIFO (Newest First) strategies
 */

export interface UnpaidBill {
  id: string
  billNumber: string
  billingMonth: Date
  dueDate: Date
  
  electricAmount: number
  waterAmount: number
  associationDues: number
  penaltyAmount: number
  otherCharges: number
  
  totalAmount: number
  paidAmount: number
  balance: number
  
  monthsOverdue: number
}

export interface PaymentAllocation {
  billId: string
  billNumber: string
  billingMonth: Date
  
  electricAmount: number
  waterAmount: number
  duesAmount: number
  penaltyAmount: number
  otherAmount: number
  
  totalAmount: number
  remainingBillBalance: number
}

export type AllocationStrategy = 'OLDEST_FIRST' | 'NEWEST_FIRST' | 'MANUAL'

/**
 * Allocate payment to unpaid bills
 */
export function allocatePayment(
  paymentAmount: number,
  unpaidBills: UnpaidBill[],
  strategy: AllocationStrategy = 'OLDEST_FIRST'
): {
  allocations: PaymentAllocation[]
  advanceAmount: number
  totalAllocated: number
} {
  let remainingAmount = paymentAmount
  const allocations: PaymentAllocation[] = []
  
  // Sort bills based on strategy
  const sortedBills = sortBillsByStrategy(unpaidBills, strategy)
  
  for (const bill of sortedBills) {
    if (remainingAmount <= 0) break
    
    const amountToApply = Math.min(remainingAmount, bill.balance)
    
    // Allocate proportionally to bill components
    const allocation = allocateToBillComponents(bill, amountToApply)
    
    allocations.push({
      billId: bill.id,
      billNumber: bill.billNumber,
      billingMonth: bill.billingMonth,
      ...allocation,
      totalAmount: amountToApply,
      remainingBillBalance: bill.balance - amountToApply
    })
    
    remainingAmount -= amountToApply
  }
  
  return {
    allocations,
    advanceAmount: remainingAmount,
    totalAllocated: paymentAmount - remainingAmount
  }
}

/**
 * Sort bills based on allocation strategy
 */
function sortBillsByStrategy(
  bills: UnpaidBill[],
  strategy: AllocationStrategy
): UnpaidBill[] {
  const sorted = [...bills]
  
  if (strategy === 'OLDEST_FIRST') {
    // Sort by billing month ascending (oldest first)
    return sorted.sort((a, b) => 
      a.billingMonth.getTime() - b.billingMonth.getTime()
    )
  } else if (strategy === 'NEWEST_FIRST') {
    // Sort by billing month descending (newest first)
    return sorted.sort((a, b) => 
      b.billingMonth.getTime() - a.billingMonth.getTime()
    )
  }
  
  return sorted
}

/**
 * Allocate payment amount to bill components proportionally
 */
function allocateToBillComponents(
  bill: UnpaidBill,
  amount: number
): {
  electricAmount: number
  waterAmount: number
  duesAmount: number
  penaltyAmount: number
  otherAmount: number
} {
  // Calculate unpaid amounts for each component
  const unpaidElectric = bill.electricAmount - (bill.paidAmount > 0 ? 
    Math.min(bill.paidAmount, bill.electricAmount) : 0)
  const unpaidWater = bill.waterAmount
  const unpaidDues = bill.associationDues
  const unpaidPenalty = bill.penaltyAmount
  const unpaidOther = bill.otherCharges
  
  const totalUnpaid = bill.balance
  
  // If amount covers entire bill
  if (amount >= totalUnpaid) {
    return {
      electricAmount: unpaidElectric,
      waterAmount: unpaidWater,
      duesAmount: unpaidDues,
      penaltyAmount: unpaidPenalty,
      otherAmount: unpaidOther
    }
  }
  
  // Allocate proportionally
  const ratio = amount / totalUnpaid
  
  return {
    electricAmount: Number((unpaidElectric * ratio).toFixed(2)),
    waterAmount: Number((unpaidWater * ratio).toFixed(2)),
    duesAmount: Number((unpaidDues * ratio).toFixed(2)),
    penaltyAmount: Number((unpaidPenalty * ratio).toFixed(2)),
    otherAmount: Number((unpaidOther * ratio).toFixed(2))
  }
}

/**
 * Manual allocation - user specifies exact amounts per bill
 */
export interface ManualAllocationInput {
  billId: string
  electricAmount?: number
  waterAmount?: number
  duesAmount?: number
  penaltyAmount?: number
  otherAmount?: number
}

export function allocatePaymentManually(
  paymentAmount: number,
  manualAllocations: ManualAllocationInput[],
  unpaidBills: UnpaidBill[]
): {
  allocations: PaymentAllocation[]
  advanceAmount: number
  totalAllocated: number
  errors: string[]
} {
  let remainingAmount = paymentAmount
  const allocations: PaymentAllocation[] = []
  const errors: string[] = []
  
  for (const input of manualAllocations) {
    const bill = unpaidBills.find(b => b.id === input.billId)
    if (!bill) {
      errors.push(`Bill ${input.billId} not found`)
      continue
    }
    
    const totalAllocated = 
      (input.electricAmount || 0) +
      (input.waterAmount || 0) +
      (input.duesAmount || 0) +
      (input.penaltyAmount || 0) +
      (input.otherAmount || 0)
    
    if (totalAllocated > remainingAmount) {
      errors.push(`Insufficient funds for bill ${bill.billNumber}`)
      continue
    }
    
    if (totalAllocated > bill.balance) {
      errors.push(`Allocation exceeds bill balance for ${bill.billNumber}`)
      continue
    }
    
    allocations.push({
      billId: bill.id,
      billNumber: bill.billNumber,
      billingMonth: bill.billingMonth,
      electricAmount: input.electricAmount || 0,
      waterAmount: input.waterAmount || 0,
      duesAmount: input.duesAmount || 0,
      penaltyAmount: input.penaltyAmount || 0,
      otherAmount: input.otherAmount || 0,
      totalAmount: totalAllocated,
      remainingBillBalance: bill.balance - totalAllocated
    })
    
    remainingAmount -= totalAllocated
  }
  
  return {
    allocations,
    advanceAmount: remainingAmount,
    totalAllocated: paymentAmount - remainingAmount,
    errors
  }
}

/**
 * Generate payment summary for display
 */
export function generatePaymentSummary(
  paymentAmount: number,
  allocations: PaymentAllocation[],
  advanceAmount: number
): {
  totalPaid: number
  billsPaid: number
  billsPartiallyPaid: number
  totalElectric: number
  totalWater: number
  totalDues: number
  totalPenalty: number
  totalOther: number
  advancePayment: number
} {
  return {
    totalPaid: paymentAmount,
    billsPaid: allocations.filter(a => a.remainingBillBalance === 0).length,
    billsPartiallyPaid: allocations.filter(a => a.remainingBillBalance > 0).length,
    totalElectric: allocations.reduce((sum, a) => sum + a.electricAmount, 0),
    totalWater: allocations.reduce((sum, a) => sum + a.waterAmount, 0),
    totalDues: allocations.reduce((sum, a) => sum + a.duesAmount, 0),
    totalPenalty: allocations.reduce((sum, a) => sum + a.penaltyAmount, 0),
    totalOther: allocations.reduce((sum, a) => sum + a.otherAmount, 0),
    advancePayment: advanceAmount
  }
}
