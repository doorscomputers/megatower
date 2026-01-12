import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { calculateBill } from "@/lib/calculations/billing"

interface BillPreview {
  unitId: string
  unitNumber: string
  ownerName: string
  ownerEmail: string | null
  floorLevel: string
  area: number
  parkingArea: number
  unitType: string
  electricReading: {
    previous: number
    present: number
    consumption: number
  } | null
  waterReading: {
    previous: number
    present: number
    consumption: number
  } | null
  calculations: {
    electricBill: number
    waterBill: number
    waterTierBreakdown?: any[]
    associationDues: number
    parkingFee: number
    spAssessment: number
    discounts: number
    advanceDuesApplied: number
    advanceUtilApplied: number
    previousBalance: number
    penalties: number
    subtotal: number
    total: number
  }
  warnings: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const body = await request.json()
    const { billingMonth, preview = true, regenerate = false } = body

    if (!billingMonth) {
      return NextResponse.json(
        { error: "Billing month is required" },
        { status: 400 }
      )
    }

    // Parse billing period - use UTC to match database dates
    const [parsedYear, parsedMonth] = billingMonth.split("-").map(Number)
    const billingPeriod = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1))
    if (isNaN(billingPeriod.getTime())) {
      return NextResponse.json(
        { error: "Invalid billing month format" },
        { status: 400 }
      )
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Get tenant settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        settings: true,
      },
    })

    if (!tenant || !tenant.settings) {
      return NextResponse.json(
        { error: "Tenant settings not found" },
        { status: 404 }
      )
    }

    // Get all active units with owners
    const units = await prisma.unit.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        owner: true,
      },
      orderBy: [{ floorLevel: "asc" }, { unitNumber: "asc" }],
    })

    if (units.length === 0) {
      return NextResponse.json(
        { error: "No active units found" },
        { status: 404 }
      )
    }

    // IMPORTANT: Bill for Month X uses readings from Month X-1
    // December 2025 SOA uses November 2025 readings (Oct 27 - Nov 26 consumption)
    // January 2026 SOA uses December 2025 readings (Nov 27 - Dec 26 consumption)
    const readingsPeriod = new Date(Date.UTC(parsedYear, parsedMonth - 2, 1)) // Previous month

    // Get all electric readings for the PREVIOUS month's billing period
    // Readings are linked to units which have tenantId, so we filter via unit relation
    const electricReadings = await prisma.electricReading.findMany({
      where: {
        billingPeriod: readingsPeriod,
        unit: {
          tenantId,
        },
      },
    })

    // Get all water readings for the PREVIOUS month's billing period
    const waterReadings = await prisma.waterReading.findMany({
      where: {
        billingPeriod: readingsPeriod,
        unit: {
          tenantId,
        },
      },
    })

    // Get billing adjustments for this period (SP Assessment, Discounts)
    const billingAdjustments = await prisma.billingAdjustment.findMany({
      where: {
        tenantId,
        billingPeriod,
      },
    })

    // ===== VALIDATION WARNINGS =====
    // Calculate previous month for payment checks
    const prevMonthDate = new Date(Date.UTC(parsedYear, parsedMonth - 2, 1))
    const prevMonthLabel = prevMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

    // Check if any payments were recorded in the previous month's billing period
    const previousMonthPayments = await prisma.payment.findMany({
      where: {
        tenantId,
        paymentDate: {
          gte: new Date(Date.UTC(parsedYear, parsedMonth - 2, 1)),
          lt: new Date(Date.UTC(parsedYear, parsedMonth - 1, 1)),
        },
      },
    })

    // Check if previous month's bills exist and how many are unpaid
    const previousMonthBills = await prisma.bill.findMany({
      where: {
        tenantId,
        billingMonth: prevMonthDate,
      },
    })
    const previousMonthUnpaidBills = previousMonthBills.filter(b =>
      Number(b.balance) > 0 && b.status !== 'PAID'
    )

    // Count adjustments that have values
    const adjustmentsWithValues = billingAdjustments.filter(a =>
      Number(a.spAssessment || 0) > 0 || Number(a.discounts || 0) > 0
    )

    // Build validation warnings object
    const validationWarnings = {
      noPaymentsRecorded: previousMonthBills.length > 0 && previousMonthPayments.length === 0,
      previousMonthLabel: prevMonthLabel,
      previousMonthPaymentsCount: previousMonthPayments.length,
      previousMonthUnpaidCount: previousMonthUnpaidBills.length,
      noAdjustments: adjustmentsWithValues.length === 0,
      adjustmentsCount: adjustmentsWithValues.length,
    }

    // Get advance balances from payments (UnitAdvanceBalance)
    const advanceBalances = await prisma.unitAdvanceBalance.findMany({
      where: {
        tenantId,
      },
    })

    // Calculate billing period dates
    const year = billingPeriod.getFullYear()
    const month = billingPeriod.getMonth()

    // Period: Previous month 27th to Current month 26th
    const periodFrom = new Date(year, month - 1, 27)
    const periodTo = new Date(year, month, 26)

    // Statement date: Current month 27th
    const statementDate = new Date(year, month, 27)

    // Due date: Next month 6th
    const dueDate = new Date(year, month + 1, 6)

    // Build bill previews for each unit
    const previews: BillPreview[] = []
    const errors: string[] = []

    for (const unit of units) {
      const warnings: string[] = []

      // Find readings for this unit
      const electricReading = electricReadings.find((r) => r.unitId === unit.id)
      const waterReading = waterReadings.find((r) => r.unitId === unit.id)

      // Find billing adjustments for this unit
      const adjustment = billingAdjustments.find((a) => a.unitId === unit.id)

      // Find advance balance from payments
      const advanceBalance = advanceBalances.find((a) => a.unitId === unit.id)

      // Check for missing readings
      if (!electricReading) {
        warnings.push("Missing electric meter reading")
      }
      if (!waterReading) {
        warnings.push("Missing water meter reading")
      }

      // Calculate parking fee
      const parkingArea = Number(unit.parkingArea || 0)
      const parkingRate = parseFloat(tenant.settings.parkingRate?.toString() || "60")
      const parkingFee = parkingArea * parkingRate

      // Get adjustment values (SP Assessment, Discounts from BillingAdjustment)
      // SP Assessment only comes from BillingAdjustment (applied via "Apply SP Assessment" button)
      const spAssessment = Number(adjustment?.spAssessment || 0)
      const discounts = Number(adjustment?.discounts || 0)

      // Get advance values from UnitAdvanceBalance (from payments)
      const availableAdvanceDues = Number(advanceBalance?.advanceDues || 0)
      const availableAdvanceUtil = Number(advanceBalance?.advanceUtilities || 0)

      // Get previous unpaid balance and calculate penalties
      // IMPORTANT: Only include bills BEFORE the current billing period
      const previousBills = await prisma.bill.findMany({
        where: {
          unitId: unit.id,
          billingMonth: { lt: billingPeriod }, // Exclude current and future periods
          status: {
            in: ["UNPAID", "PARTIAL"],
          },
        },
        orderBy: {
          dueDate: "asc",
        },
      })

      let previousBalance = 0
      let totalPenalties = 0
      const penaltyRate = Number(tenant.settings.penaltyRate)  // e.g., 0.10 for 10% (stored as decimal)

      // Sort bills by billing month (oldest first) for Ma'am Rose's cumulative calculation
      const sortedPrevBills = [...previousBills].sort((a, b) =>
        a.billingMonth.getTime() - b.billingMonth.getTime()
      )

      // Calculate cumulative compound interest using Ma'am Rose's Excel formula:
      // 1st month overdue: NO interest (grace period)
      // 2nd month overdue: totalInterest = principal × 10%
      // 3rd month+: totalInterest = (prevTotalInterest + newPrincipal × 10%) × 1.10
      let cumulativeInterest = 0
      let interestAppliedCount = 0  // Track how many bills have had interest applied

      for (const prevBill of sortedPrevBills) {
        // Use actual bill balance (what's still owed)
        const unpaidBalance = Math.max(0, Number(prevBill.balance))

        // Add to previous balance (the actual unpaid amount from the bill)
        previousBalance += unpaidBalance

        // Calculate months overdue based on billing month difference
        // November bill unpaid in December = 1 month overdue (gets 10% penalty)
        // November bill unpaid in January = 2 months overdue (compound penalty)
        const billMonth = prevBill.billingMonth
        const currentMonth = billingPeriod
        const monthsOverdue = (currentMonth.getFullYear() - billMonth.getFullYear()) * 12 +
                             (currentMonth.getMonth() - billMonth.getMonth())

        // For OPENING_BALANCE bills, exclude migrated debt from penalty calculation
        // Migrated debt = bill total - current charges (electric + water + dues + parking)
        // Only apply penalty to unpaid CURRENT charges, not migrated debt
        let penaltyEligibleBalance = unpaidBalance

        if (prevBill.billType === 'OPENING_BALANCE') {
          // Calculate current charges from the bill
          // If duesAmount not stored, calculate from unit area × rate
          const duesRate = Number(tenant.settings.associationDuesRate)
          const calculatedDues = prevBill.duesAmount ? Number(prevBill.duesAmount) : (Number(unit.area) * duesRate)
          const calculatedParking = prevBill.parkingFee ? Number(prevBill.parkingFee) : (Number(unit.parkingArea || 0) * duesRate)

          const currentCharges = Number(prevBill.electricAmount || 0) +
                                 Number(prevBill.waterAmount || 0) +
                                 calculatedDues +
                                 calculatedParking
          const migratedDebt = Math.max(0, Number(prevBill.totalAmount) - currentCharges)

          // If balance is entirely migrated debt, no penalty
          // If balance includes some current charges, only penalize that portion
          penaltyEligibleBalance = Math.max(0, unpaidBalance - migratedDebt)
        }

        // Calculate unpaid principal (bill total minus any penalty already included)
        const billPrincipal = Number(prevBill.totalAmount) - Number(prevBill.penaltyAmount)
        const paidAmount = Number(prevBill.paidAmount)
        const totalWithPenalty = Number(prevBill.totalAmount)
        const unpaidRatio = totalWithPenalty > 0 ? Math.max(0, totalWithPenalty - paidAmount) / totalWithPenalty : 1
        const unpaidPrincipal = penaltyEligibleBalance > 0 ? penaltyEligibleBalance : 0

        // Apply interest based on months overdue
        // 1st month overdue = 10% penalty (matches Excel "1st MONTH" column)
        // 2nd month+ = compound penalty
        if (monthsOverdue >= 1 && unpaidPrincipal > 0) {
          if (interestAppliedCount === 0) {
            // First bill getting interest: simple 10%
            cumulativeInterest = unpaidPrincipal * penaltyRate
          } else {
            // Subsequent bills: compound formula
            // totalInterest = (previousTotalInterest + currentPrincipal × 10%) × 1.10
            cumulativeInterest = (cumulativeInterest + unpaidPrincipal * penaltyRate) * (1 + penaltyRate)
          }
          interestAppliedCount++
        }
      }

      totalPenalties = cumulativeInterest

      // Calculate current month's bill
      const billCalculation = calculateBill({
        electricConsumption: Number(electricReading?.consumption || 0),
        waterConsumption: Number(waterReading?.consumption || 0),
        area: Number(unit.area),
        unitType: unit.unitType as "RESIDENTIAL" | "COMMERCIAL",
        settings: {
          electricRate: parseFloat(tenant.settings.electricRate.toString()),
          electricMinCharge: parseFloat(tenant.settings.electricMinCharge.toString()),
          associationDuesRate: parseFloat(tenant.settings.associationDuesRate.toString()),
          penaltyRate: parseFloat(tenant.settings.penaltyRate.toString()),
          waterSettings: {
            // Residential tiers
            waterResTier1Max: parseFloat(tenant.settings.waterResTier1Max.toString()),
            waterResTier1Rate: parseFloat(tenant.settings.waterResTier1Rate.toString()),
            waterResTier2Max: parseFloat(tenant.settings.waterResTier2Max.toString()),
            waterResTier2Rate: parseFloat(tenant.settings.waterResTier2Rate.toString()),
            waterResTier3Max: parseFloat(tenant.settings.waterResTier3Max.toString()),
            waterResTier3Rate: parseFloat(tenant.settings.waterResTier3Rate.toString()),
            waterResTier4Max: parseFloat(tenant.settings.waterResTier4Max.toString()),
            waterResTier4Rate: parseFloat(tenant.settings.waterResTier4Rate.toString()),
            waterResTier5Max: parseFloat(tenant.settings.waterResTier5Max.toString()),
            waterResTier5Rate: parseFloat(tenant.settings.waterResTier5Rate.toString()),
            waterResTier6Max: parseFloat(tenant.settings.waterResTier6Max.toString()),
            waterResTier6Rate: parseFloat(tenant.settings.waterResTier6Rate.toString()),
            waterResTier7Rate: parseFloat(tenant.settings.waterResTier7Rate.toString()),
            // Commercial tiers
            waterComTier1Max: parseFloat(tenant.settings.waterComTier1Max.toString()),
            waterComTier1Rate: parseFloat(tenant.settings.waterComTier1Rate.toString()),
            waterComTier2Max: parseFloat(tenant.settings.waterComTier2Max.toString()),
            waterComTier2Rate: parseFloat(tenant.settings.waterComTier2Rate.toString()),
            waterComTier3Max: parseFloat(tenant.settings.waterComTier3Max.toString()),
            waterComTier3Rate: parseFloat(tenant.settings.waterComTier3Rate.toString()),
            waterComTier4Max: parseFloat(tenant.settings.waterComTier4Max.toString()),
            waterComTier4Rate: parseFloat(tenant.settings.waterComTier4Rate.toString()),
            waterComTier5Max: parseFloat(tenant.settings.waterComTier5Max.toString()),
            waterComTier5Rate: parseFloat(tenant.settings.waterComTier5Rate.toString()),
            waterComTier6Max: parseFloat(tenant.settings.waterComTier6Max.toString()),
            waterComTier6Rate: parseFloat(tenant.settings.waterComTier6Rate.toString()),
            waterComTier7Rate: parseFloat(tenant.settings.waterComTier7Rate.toString()),
          }
        }
      })

      // Calculate how much advance to apply
      // Advance Dues applies to Association Dues only
      const advanceDuesApplied = Math.min(availableAdvanceDues, billCalculation.associationDues)
      // Advance Utilities applies to Electric + Water
      const utilityCharges = billCalculation.electricAmount + billCalculation.waterAmount
      const advanceUtilApplied = Math.min(availableAdvanceUtil, utilityCharges)

      // Calculate total with all charges and deductions
      // Total = Electric + Water + Dues + Parking + SP Assessment + Previous Balance + Penalties - Discounts - Advances
      const currentCharges = billCalculation.electricAmount +
                            billCalculation.waterAmount +
                            billCalculation.associationDues +
                            parkingFee +
                            spAssessment
      const totalDeductions = discounts + advanceDuesApplied + advanceUtilApplied
      const total = currentCharges + previousBalance + totalPenalties - totalDeductions

      previews.push({
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        ownerName: unit.owner ? `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ` ${unit.owner.middleName.charAt(0)}.` : ''}` : 'No Owner',
        ownerEmail: unit.owner?.email || null,
        floorLevel: unit.floorLevel,
        area: Number(unit.area),
        parkingArea,
        unitType: unit.unitType,
        electricReading: electricReading
          ? {
              previous: Number(electricReading.previousReading),
              present: Number(electricReading.presentReading),
              consumption: Number(electricReading.consumption),
            }
          : null,
        waterReading: waterReading
          ? {
              previous: Number(waterReading.previousReading),
              present: Number(waterReading.presentReading),
              consumption: Number(waterReading.consumption),
            }
          : null,
        calculations: {
          electricBill: billCalculation.electricAmount,
          waterBill: billCalculation.waterAmount,
          waterTierBreakdown: billCalculation.breakdown?.water ? [billCalculation.breakdown.water] : [],
          associationDues: billCalculation.associationDues,
          parkingFee,
          spAssessment,
          discounts,
          advanceDuesApplied,
          advanceUtilApplied,
          previousBalance,
          penalties: totalPenalties,
          subtotal: currentCharges,
          total,
        },
        warnings,
      })
    }

    // If preview mode, just return the calculations
    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        billingPeriod: {
          month: billingMonth,
          periodFrom,
          periodTo,
          statementDate,
          dueDate,
        },
        summary: {
          totalUnits: units.length,
          unitsWithElectricReadings: electricReadings.length,
          unitsWithWaterReadings: waterReadings.length,
          unitsWithWarnings: previews.filter((p) => p.warnings.length > 0).length,
          totalAmount: previews.reduce((sum, p) => sum + p.calculations.total, 0),
        },
        validationWarnings,
        bills: previews,
      })
    }

    // Generate actual bills inside transaction to prevent race conditions
    const generatedBills = await prisma.$transaction(async (tx) => {
      // Check if bills already exist for this period (inside transaction for atomic check)
      const existingBills = await tx.bill.findMany({
        where: {
          tenantId,
          billingMonth: billingPeriod,
          billType: { not: "OPENING_BALANCE" }, // Exclude opening balance bills
        },
      })

      if (existingBills.length > 0) {
        if (regenerate) {
          // Delete existing bills for regeneration
          // Note: This only deletes REGULAR bills, not OPENING_BALANCE bills
          await tx.bill.deleteMany({
            where: {
              tenantId,
              billingMonth: billingPeriod,
              billType: { not: "OPENING_BALANCE" },
            },
          })
          console.log(`Deleted ${existingBills.length} existing bills for regeneration`)
        } else {
          throw new Error(`Bills already exist for ${billingMonth}. Found ${existingBills.length} existing bill(s). Use regenerate option to replace them.`)
        }
      }

      // Generate bill numbers
      const lastBill = await tx.bill.findFirst({
        where: { tenantId },
        orderBy: { billNumber: "desc" },
      })

      let billCounter = lastBill
        ? parseInt(lastBill.billNumber.split("-").pop() || "0")
        : 0

      const bills = []

      for (const preview of previews) {
        billCounter++
        const billNumber = `MT-${billingPeriod.getFullYear()}${String(
          billingPeriod.getMonth() + 1
        ).padStart(2, "0")}-${String(billCounter).padStart(4, "0")}`

        const bill = await tx.bill.create({
        data: {
          billNumber,
          tenantId,
          unitId: preview.unitId,
          billingMonth: billingPeriod,
          billingPeriodStart: periodFrom,
          billingPeriodEnd: periodTo,
          statementDate,
          dueDate,
          electricAmount: preview.calculations.electricBill,
          waterAmount: preview.calculations.waterBill,
          associationDues: preview.calculations.associationDues,
          parkingFee: preview.calculations.parkingFee,
          spAssessment: preview.calculations.spAssessment,
          discounts: preview.calculations.discounts,
          advanceDuesApplied: preview.calculations.advanceDuesApplied,
          advanceUtilApplied: preview.calculations.advanceUtilApplied,
          penaltyAmount: preview.calculations.penalties,
          totalAmount: preview.calculations.total,
          paidAmount: 0,
          balance: preview.calculations.total,
          status: "UNPAID",
        },
      })

        // NOTE: Cumulative penalty is stored on the NEW bill only (penaltyAmount field)
        // We no longer update individual previous bills with per-bill penalties
        // This matches Ma'am Rose's Excel approach where interest compounds cumulatively
        // across all unpaid months, not separately per bill

        bills.push(bill)

        // Deduct applied advances from UnitAdvanceBalance (inside transaction)
        if (preview.calculations.advanceDuesApplied > 0 || preview.calculations.advanceUtilApplied > 0) {
          const existingBalance = advanceBalances.find((a) => a.unitId === preview.unitId)
          if (existingBalance) {
            await tx.unitAdvanceBalance.update({
              where: { id: existingBalance.id },
              data: {
                advanceDues: {
                  decrement: preview.calculations.advanceDuesApplied,
                },
                advanceUtilities: {
                  decrement: preview.calculations.advanceUtilApplied,
                },
              },
            })
          }
        }
      }

      return bills
    })

    return NextResponse.json({
      success: true,
      preview: false,
      message: `Successfully generated ${generatedBills.length} bill(s) for ${billingMonth}`,
      billingPeriod: {
        month: billingMonth,
        periodFrom,
        periodTo,
        statementDate,
        dueDate,
      },
      summary: {
        totalBills: generatedBills.length,
        totalAmount: generatedBills.reduce((sum, b) => sum + Number(b.totalAmount), 0),
      },
      bills: generatedBills,
    })
  } catch (error: any) {
    console.error("Error generating bills:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate bills" },
      { status: 500 }
    )
  }
}
