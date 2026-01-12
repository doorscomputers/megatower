import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * POST - Update existing bills with adjustments (SP Assessment, Discounts)
 * This applies adjustment values to already-generated bills
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const body = await request.json()
    const { billingMonth } = body

    if (!billingMonth) {
      return NextResponse.json(
        { error: "Billing month is required" },
        { status: 400 }
      )
    }

    // Parse billing period - use UTC to match database
    const [year, month] = billingMonth.split("-").map(Number)
    const billingPeriod = new Date(Date.UTC(year, month - 1, 1))

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Get all adjustments for this billing period
    const adjustments = await prisma.billingAdjustment.findMany({
      where: {
        tenantId,
        billingPeriod,
      },
    })

    if (adjustments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No adjustments found for this period",
        updated: 0,
      })
    }

    // Get all bills for this billing period
    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        billingMonth: billingPeriod,
      },
    })

    let updatedCount = 0

    for (const adjustment of adjustments) {
      const bill = bills.find(b => b.unitId === adjustment.unitId)
      if (!bill) continue

      const spAssessment = Number(adjustment.spAssessment || 0)
      const discounts = Number(adjustment.discounts || 0)

      // Calculate new total
      // Current charges without old adjustments
      const baseCharges = Number(bill.electricAmount) +
                         Number(bill.waterAmount) +
                         Number(bill.associationDues) +
                         Number(bill.parkingFee)

      // Add SP Assessment, subtract discounts
      const newTotal = baseCharges + spAssessment - discounts +
                      Number(bill.penaltyAmount || 0) -
                      Number(bill.advanceDuesApplied || 0) -
                      Number(bill.advanceUtilApplied || 0)

      const newBalance = newTotal - Number(bill.paidAmount)

      // Update the bill
      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          spAssessment,
          discounts,
          totalAmount: newTotal,
          balance: newBalance,
        },
      })

      updatedCount++
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} bill(s) with adjustments for ${billingMonth}`,
      updated: updatedCount,
      totalAdjustments: adjustments.length,
    })
  } catch (error: any) {
    console.error("Error updating bills with adjustments:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update bills" },
      { status: 500 }
    )
  }
}
