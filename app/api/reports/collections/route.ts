import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Daily/Date Range Collection Report
 */
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const floorLevel = searchParams.get("floorLevel")

    if (!startDate) {
      return NextResponse.json(
        { error: "Start date is required" },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)

    const end = endDate ? new Date(endDate) : new Date(startDate)
    end.setHours(23, 59, 59, 999)

    // Build query filters
    const where: any = {
      tenantId,
      status: 'CONFIRMED',
      paymentDate: {
        gte: start,
        lte: end,
      },
    }

    if (floorLevel) {
      where.unit = {
        floorLevel,
      }
    }

    // Get all payments for the date range
    const payments = await prisma.payment.findMany({
      where,
      include: {
        unit: {
          include: {
            owner: true,
          },
        },
        billPayments: {
          include: {
            bill: {
              select: {
                billNumber: true,
                billingMonth: true,
              },
            },
          },
        },
      },
      orderBy: [
        { paymentDate: "asc" },
        { unit: { unitNumber: "asc" } },
      ],
    })

    // Calculate totals
    const totals = {
      totalAmount: 0,
      totalElectric: 0,
      totalWater: 0,
      totalDues: 0,
      totalPenalty: 0,
      totalOther: 0,
      totalAdvance: 0,
      paymentCount: payments.length,
      byMethod: {} as Record<string, number>,
    }

    const collectionDetails = payments.map((payment) => {
      const componentBreakdown = {
        electric: 0,
        water: 0,
        dues: 0,
        penalty: 0,
        other: 0,
      }

      for (const bp of payment.billPayments) {
        componentBreakdown.electric += Number(bp.electricAmount)
        componentBreakdown.water += Number(bp.waterAmount)
        componentBreakdown.dues += Number(bp.duesAmount)
        componentBreakdown.penalty += Number(bp.penaltyAmount)
        componentBreakdown.other += Number(bp.otherAmount)
      }

      const amount = Number(payment.totalAmount)
      const advanceAmount = Number(payment.advanceDuesAmount) + Number(payment.advanceUtilAmount)

      // Update totals
      totals.totalAmount += amount
      totals.totalElectric += componentBreakdown.electric
      totals.totalWater += componentBreakdown.water
      totals.totalDues += componentBreakdown.dues
      totals.totalPenalty += componentBreakdown.penalty
      totals.totalOther += componentBreakdown.other
      totals.totalAdvance += advanceAmount

      // Track by payment method
      totals.byMethod[payment.paymentMethod] =
        (totals.byMethod[payment.paymentMethod] || 0) + amount

      return {
        id: payment.id,
        orNumber: payment.orNumber,
        paymentDate: payment.paymentDate,
        unit: {
          unitNumber: payment.unit.unitNumber,
          floorLevel: payment.unit.floorLevel,
        },
        owner: payment.unit.owner ? `${payment.unit.owner.lastName}, ${payment.unit.owner.firstName}${payment.unit.owner.middleName ? ` ${payment.unit.owner.middleName.charAt(0)}.` : ''}` : 'No Owner',
        amount,
        advanceAmount,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        checkNumber: payment.checkNumber,
        bankName: payment.bankName,
        componentBreakdown,
        appliedToBills: payment.billPayments.map((bp) => ({
          billNumber: bp.bill.billNumber,
          billingMonth: bp.bill.billingMonth,
          amount: Number(bp.totalAmount),
        })),
      }
    })

    // Group by floor for summary
    const byFloor: Record<
      string,
      {
        count: number
        amount: number
        electric: number
        water: number
        dues: number
      }
    > = {}

    for (const collection of collectionDetails) {
      const floor = collection.unit.floorLevel
      if (!byFloor[floor]) {
        byFloor[floor] = { count: 0, amount: 0, electric: 0, water: 0, dues: 0 }
      }
      byFloor[floor].count++
      byFloor[floor].amount += collection.amount
      byFloor[floor].electric += collection.componentBreakdown.electric
      byFloor[floor].water += collection.componentBreakdown.water
      byFloor[floor].dues += collection.componentBreakdown.dues
    }

    return NextResponse.json({
      success: true,
      reportDate: {
        start,
        end,
        isSingleDay: startDate === (endDate || startDate),
      },
      totals,
      byFloor,
      collections: collectionDetails,
    })
  } catch (error: any) {
    console.error("Error generating collection report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
