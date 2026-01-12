import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

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

    // Parse billing period
    const [parsedYear, parsedMonth] = billingMonth.split("-").map(Number)
    const billingPeriod = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1))

    // Get tenant settings to get SP Assessment rate
    const settings = await prisma.tenantSettings.findFirst({
      where: { tenantId },
    })

    if (!settings) {
      return NextResponse.json(
        { error: "Tenant settings not found" },
        { status: 404 }
      )
    }

    const spAssessmentRate = Number(settings.spAssessmentRate)

    if (spAssessmentRate <= 0) {
      return NextResponse.json(
        { error: "SP Assessment rate is not set. Please configure it in Settings → Rates & Charges first." },
        { status: 400 }
      )
    }

    // Get all active units
    const units = await prisma.unit.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: { id: true, unitNumber: true },
    })

    if (units.length === 0) {
      return NextResponse.json(
        { error: "No active units found" },
        { status: 404 }
      )
    }

    // Get existing billing adjustments for this period
    const existingAdjustments = await prisma.billingAdjustment.findMany({
      where: {
        tenantId,
        billingPeriod,
      },
    })

    const existingMap = new Map(existingAdjustments.map(a => [a.unitId, a]))

    let created = 0
    let updated = 0

    // Update or create billing adjustments with SP Assessment
    for (const unit of units) {
      const existing = existingMap.get(unit.id)

      if (existing) {
        // Update existing adjustment
        await prisma.billingAdjustment.update({
          where: { id: existing.id },
          data: { spAssessment: spAssessmentRate },
        })
        updated++
      } else {
        // Create new adjustment
        await prisma.billingAdjustment.create({
          data: {
            tenantId,
            unitId: unit.id,
            billingPeriod,
            spAssessment: spAssessmentRate,
            discounts: 0,
            advanceDues: 0,
            advanceUtilities: 0,
          },
        })
        created++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Applied SP Assessment (₱${spAssessmentRate.toFixed(2)}) to ${created + updated} units`,
      details: {
        rate: spAssessmentRate,
        created,
        updated,
        totalUnits: units.length,
      },
    })
  } catch (error: any) {
    console.error("Error applying SP Assessment:", error)
    return NextResponse.json(
      { error: error.message || "Failed to apply SP Assessment" },
      { status: 500 }
    )
  }
}

// DELETE - Remove SP Assessment from all units for a billing period
export async function DELETE(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const { searchParams } = new URL(request.url)
    const billingMonth = searchParams.get("billingMonth")

    if (!billingMonth) {
      return NextResponse.json(
        { error: "Billing month is required" },
        { status: 400 }
      )
    }

    // Parse billing period
    const [parsedYear, parsedMonth] = billingMonth.split("-").map(Number)
    const billingPeriod = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1))

    // Clear SP Assessment from all adjustments for this period
    const result = await prisma.billingAdjustment.updateMany({
      where: {
        tenantId,
        billingPeriod,
      },
      data: {
        spAssessment: 0,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Removed SP Assessment from ${result.count} units`,
      cleared: result.count,
    })
  } catch (error: any) {
    console.error("Error clearing SP Assessment:", error)
    return NextResponse.json(
      { error: error.message || "Failed to clear SP Assessment" },
      { status: 500 }
    )
  }
}
