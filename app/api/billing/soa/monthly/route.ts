import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { format } from "date-fns"

/**
 * GET - Generate Monthly Statement of Account matching Excel format
 * Returns data structured exactly like the Excel SOA template
 */
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get("unitId")
    const billingMonth = searchParams.get("billingMonth") // Format: 2025-11

    if (!unitId || !billingMonth) {
      return NextResponse.json(
        { error: "Unit ID and billing month are required" },
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

    // Get unit with owner
    const unit = await prisma.unit.findUnique({
      where: { id: unitId, tenantId },
      include: { owner: true }
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // Get the bill for this billing month
    const currentBill = await prisma.bill.findFirst({
      where: {
        unitId,
        tenantId,
        billingMonth: billingDate
      }
    })

    // Get payments for the previous month (payments made toward previous bills)
    const prevMonthStart = new Date(Date.UTC(year, month - 2, 1))
    const prevMonthEnd = new Date(Date.UTC(year, month - 1, 0))
    const prevMonthName = format(prevMonthStart, "MMMM yyyy").toUpperCase()

    const payments = await prisma.payment.findMany({
      where: {
        unitId,
        tenantId,
        paymentDate: {
          gte: prevMonthStart,
          lte: prevMonthEnd
        }
      },
      orderBy: { paymentDate: "asc" }
    })

    // Get past due bills (unpaid bills from previous months)
    const pastDueBills = await prisma.bill.findMany({
      where: {
        unitId,
        tenantId,
        billingMonth: { lt: billingDate },
        status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] }
      },
      orderBy: { billingMonth: "desc" },
      take: 3
    })

    // Get advance balance
    const advanceBalance = await prisma.unitAdvanceBalance.findFirst({
      where: { unitId }
    })

    // Get rates from settings
    const electricRate = Number(tenant.settings.electricRate)
    const duesRate = Number(tenant.settings.associationDuesRate)

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
        presentReading: 0,
        previousReading: 0,
        consumption: 0,
        rate: electricRate,
        amount: electricAmount
      },
      water: {
        period: currentBill ? `${format(currentBill.billingPeriodStart, "M-d")} TO ${format(currentBill.billingPeriodEnd, "M-d")}` : "",
        presentReading: 0,
        previousReading: 0,
        consumption: 0,
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

    // Payment breakdown with OR numbers
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
    const adjustments = {
      spAssessment: spAssessment,
      discount: currentBill ? Number(currentBill.discounts) : 0,
      advanceDues: advanceBalance ? Number(advanceBalance.advanceDues) : 0,
      advanceUtilities: advanceBalance ? Number(advanceBalance.advanceUtilities) : 0,
      otherAdvance: 0
    }

    // Total Amount Due = Current Charges + Past Dues (payments shown are historical)
    // Don't subtract payments here - they were for previous bills
    const totalAmountDue = calculatedTotal + totalPastDues - adjustments.discount - adjustments.advanceDues - adjustments.advanceUtilities

    // Generate SOA number
    const soaNumber = currentBill?.billNumber || `SOA-${unit.unitNumber}-${billingMonth}`

    // Dates
    const soaDate = new Date(Date.UTC(year, month - 1, 5))
    const dueDate = new Date(Date.UTC(year, month - 1, 15))

    return NextResponse.json({
      success: true,
      soa: {
        soaNumber,
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
      }
    })
  } catch (error: any) {
    console.error("Error generating monthly SOA:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate monthly SOA" },
      { status: 500 }
    )
  }
}
