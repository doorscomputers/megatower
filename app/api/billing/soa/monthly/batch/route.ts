import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { format } from "date-fns"

// Natural sort function for unit numbers (M2-2F-1, M2-2F-2, ... M2-2F-10, M2-2F-11)
function naturalSort(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g
  const aParts = a.match(regex) || []
  const bParts = b.match(regex) || []

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || ""
    const bPart = bParts[i] || ""

    const aNum = parseInt(aPart, 10)
    const bNum = parseInt(bPart, 10)

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum
    } else {
      if (aPart !== bPart) return aPart.localeCompare(bPart)
    }
  }
  return 0
}

/**
 * GET - Generate Monthly SOA for multiple units (batch mode)
 * Supports filtering by floor, building, or all units
 */
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const { searchParams } = new URL(request.url)
    const billingMonth = searchParams.get("billingMonth") // Format: 2025-11
    const floor = searchParams.get("floor") // Optional: 2F, 3F, etc.
    const building = searchParams.get("building") // Optional: M1, M2
    const filter = searchParams.get("filter") || "all" // all, with_balance, floor, building

    if (!billingMonth) {
      return NextResponse.json(
        { error: "Billing month is required" },
        { status: 400 }
      )
    }

    // Parse billing month - use UTC to match database dates
    const [year, month] = billingMonth.split("-").map(Number)
    const billingDate = new Date(Date.UTC(year, month - 1, 1))

    // Get tenant settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true }
    })

    if (!tenant?.settings) {
      return NextResponse.json(
        { error: "Tenant settings not found" },
        { status: 400 }
      )
    }

    // Build unit filter
    const unitFilter: any = { tenantId, isActive: true }
    if (filter === "floor" && floor) {
      unitFilter.floorLevel = floor
    }
    if (filter === "building" && building) {
      unitFilter.unitNumber = { startsWith: `${building}-` }
    }

    // Get all units with owners and sort naturally
    const unitsUnsorted = await prisma.unit.findMany({
      where: unitFilter,
      include: { owner: true }
    })
    const units = unitsUnsorted.sort((a, b) => naturalSort(a.unitNumber, b.unitNumber))

    const electricRate = Number(tenant.settings.electricRate)
    const duesRate = Number(tenant.settings.associationDuesRate)

    // Previous month for payments
    const prevMonthStart = new Date(Date.UTC(year, month - 2, 1))
    const prevMonthEnd = new Date(Date.UTC(year, month - 1, 0))
    const prevMonthName = format(prevMonthStart, "MMMM yyyy").toUpperCase()

    // Readings period - SOA for Month X uses readings from Month X-1
    // December SOA uses November readings (Oct 27 - Nov 26 consumption)
    const readingsPeriod = new Date(Date.UTC(year, month - 2, 1))

    // Generate SOA for each unit
    const soaList = []

    for (const unit of units) {
      // Get the bill for this billing month
      const currentBill = await prisma.bill.findFirst({
        where: {
          unitId: unit.id,
          tenantId,
          billingMonth: billingDate
        }
      })

      // Get readings for the previous month (November readings for December SOA)
      const electricReading = await prisma.electricReading.findFirst({
        where: {
          unitId: unit.id,
          billingPeriod: readingsPeriod
        }
      })

      const waterReading = await prisma.waterReading.findFirst({
        where: {
          unitId: unit.id,
          billingPeriod: readingsPeriod
        }
      })

      // Get payments for the previous month
      const payments = await prisma.payment.findMany({
        where: {
          unitId: unit.id,
          tenantId,
          paymentDate: {
            gte: prevMonthStart,
            lte: prevMonthEnd
          }
        },
        orderBy: { paymentDate: "asc" }
      })

      // Get past due bills
      const pastDueBills = await prisma.bill.findMany({
        where: {
          unitId: unit.id,
          tenantId,
          billingMonth: { lt: billingDate },
          status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] }
        },
        orderBy: { billingMonth: "desc" },
        take: 3
      })

      // Get advance balance
      const advanceBalance = await prisma.unitAdvanceBalance.findFirst({
        where: { unitId: unit.id }
      })

      // Calculate current charges - use bill data if exists, otherwise calculate
      const electricAmount = currentBill ? Number(currentBill.electricAmount) : 0
      const waterAmount = currentBill ? Number(currentBill.waterAmount) : 0
      const duesAmount = currentBill ? Number(currentBill.associationDues) : Number(unit.area) * duesRate
      const parkingAmount = currentBill ? Number(currentBill.parkingFee) : Number(unit.parkingArea || 0) * duesRate
      const spAssessment = currentBill ? Number(currentBill.spAssessment) : 0

      // Calculate total from individual amounts (NOT from bill.totalAmount which might be wrong)
      const calculatedTotal = electricAmount + waterAmount + duesAmount + parkingAmount + spAssessment

      const currentCharges = {
        electric: {
          period: currentBill ? `${format(currentBill.billingPeriodStart, "M-d")} TO ${format(currentBill.billingPeriodEnd, "M-d")}` : "",
          presentReading: electricReading ? Number(electricReading.presentReading) : 0,
          previousReading: electricReading ? Number(electricReading.previousReading) : 0,
          consumption: electricReading ? Number(electricReading.consumption) : 0,
          rate: electricRate,
          amount: electricAmount
        },
        water: {
          period: currentBill ? `${format(currentBill.billingPeriodStart, "M-d")} TO ${format(currentBill.billingPeriodEnd, "M-d")}` : "",
          presentReading: waterReading ? Number(waterReading.presentReading) : 0,
          previousReading: waterReading ? Number(waterReading.previousReading) : 0,
          consumption: waterReading ? Number(waterReading.consumption) : 0,
          rate: 0,
          amount: waterAmount
        },
        associationDues: {
          rate: duesRate,
          area: Number(unit.area),
          amount: duesAmount
        },
        parking: {
          rate: duesRate,
          area: Number(unit.parkingArea || 0),
          amount: parkingAmount
        },
        totalAmount: calculatedTotal
      }

      // Past dues breakdown
      const pastDues = pastDueBills.map((bill, index) => {
        const balance = Number(bill.totalAmount) - Number(bill.paidAmount)
        const monthsOverdue = index + 1
        const penalty1 = monthsOverdue >= 1 ? balance * 0.10 : 0
        const penalty2 = monthsOverdue >= 2 ? (balance + penalty1) * 0.10 : 0
        const penalty3 = monthsOverdue >= 3 ? (balance + penalty1 + penalty2) * 0.10 : 0

        return {
          month: format(bill.billingMonth, "MMM yyyy"),
          dues: Number(bill.associationDues),
          electric: Number(bill.electricAmount),
          water: Number(bill.waterAmount),
          total: balance,
          penalty1Month: penalty1,
          penalty2Month: penalty2,
          penalty3Month: penalty3,
          totalPenalty: penalty1 + penalty2 + penalty3
        }
      })

      const totalPastDues = pastDues.reduce((sum, pd) => sum + pd.total + pd.totalPenalty, 0)

      // Payment breakdown
      const paymentBreakdown = {
        electric: { orNumber: "", amount: 0 },
        water: { orNumber: "", amount: 0 },
        associationDues: { orNumber: "", amount: 0 },
        pastDues: { orNumber: "", amount: 0 },
        specialAssessment: { orNumber: "", amount: 0 },
        advancePayment: { orNumber: "", amount: 0 },
        totalPayment: 0
      }

      for (const payment of payments) {
        if (Number(payment.electricAmount) > 0) {
          paymentBreakdown.electric.amount += Number(payment.electricAmount)
          paymentBreakdown.electric.orNumber = payment.orNumber || ""
        }
        if (Number(payment.waterAmount) > 0) {
          paymentBreakdown.water.amount += Number(payment.waterAmount)
          paymentBreakdown.water.orNumber = payment.orNumber || ""
        }
        if (Number(payment.duesAmount) > 0) {
          paymentBreakdown.associationDues.amount += Number(payment.duesAmount)
          paymentBreakdown.associationDues.orNumber = payment.orNumber || ""
        }
        if (Number(payment.pastDuesAmount) > 0) {
          paymentBreakdown.pastDues.amount += Number(payment.pastDuesAmount)
          paymentBreakdown.pastDues.orNumber = payment.orNumber || ""
        }
        if (Number(payment.spAssessmentAmount) > 0) {
          paymentBreakdown.specialAssessment.amount += Number(payment.spAssessmentAmount)
          paymentBreakdown.specialAssessment.orNumber = payment.orNumber || ""
        }
        const advanceTotal = Number(payment.advanceDuesAmount || 0) + Number(payment.advanceUtilAmount || 0)
        if (advanceTotal > 0) {
          paymentBreakdown.advancePayment.amount += advanceTotal
          paymentBreakdown.advancePayment.orNumber = payment.orNumber || ""
        }
        paymentBreakdown.totalPayment += Number(payment.totalAmount)
      }

      // Adjustments
      const discount = currentBill ? Number(currentBill.discounts) : 0
      const advanceDues = advanceBalance ? Number(advanceBalance.advanceDues) : 0
      const advanceUtilities = advanceBalance ? Number(advanceBalance.advanceUtilities) : 0

      const adjustments = {
        spAssessment,
        discount,
        advanceDues,
        advanceUtilities,
        otherAdvance: 0
      }

      // Total Amount Due = Current Charges + Past Dues - Adjustments
      // NOTE: pastDuesPayment in paymentBreakdown is INFORMATIONAL ONLY (shows what was paid last month)
      // It does NOT affect the total calculation - bill statuses handle this correctly
      const totalAmountDue = calculatedTotal + totalPastDues - discount - advanceDues - advanceUtilities

      // Filter based on balance if needed
      if (filter === "with_balance" && totalAmountDue <= 0) {
        continue
      }

      // Dates
      const soaDate = new Date(Date.UTC(year, month - 1, 5))
      const dueDate = new Date(Date.UTC(year, month - 1, 15))

      soaList.push({
        soaNumber: currentBill?.billNumber || `SOA-${unit.unitNumber}-${billingMonth}`,
        billingMonth: format(billingDate, "MMMM, yyyy").toUpperCase(),
        unitNumber: unit.unitNumber,
        building: "Megatower 2",
        ownerName: unit.owner ? `${unit.owner.firstName} ${unit.owner.lastName}` : "No Owner",
        soaDate: format(soaDate, "MMM d, yyyy").toUpperCase(),
        dueDate: format(dueDate, "MMM d, yyyy").toUpperCase(),
        currentCharges,
        pastDues,
        totalPastDues,
        paymentMonth: prevMonthName,
        paymentBreakdown,
        adjustments,
        totalAmountDue
      })
    }

    // Calculate summary
    const summary = {
      totalUnits: soaList.length,
      totalCurrentCharges: soaList.reduce((sum, soa) => sum + soa.currentCharges.totalAmount, 0),
      totalPastDues: soaList.reduce((sum, soa) => sum + soa.totalPastDues, 0),
      totalPayments: soaList.reduce((sum, soa) => sum + soa.paymentBreakdown.totalPayment, 0),
      totalAmountDue: soaList.reduce((sum, soa) => sum + soa.totalAmountDue, 0),
      unitsWithBalance: soaList.filter(soa => soa.totalAmountDue > 0).length
    }

    return NextResponse.json({
      success: true,
      billingMonth: format(billingDate, "MMMM, yyyy").toUpperCase(),
      filter,
      floor: floor || null,
      building: building || null,
      summary,
      soaList
    })
  } catch (error: any) {
    console.error("Error generating batch monthly SOA:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate batch SOA" },
      { status: 500 }
    )
  }
}
