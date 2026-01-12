import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Get billing checklist status for a specific month
 * Also auto-detects completion status for certain items
 */
export async function GET(request: NextRequest) {
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

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Parse billing period
    const [year, month] = billingMonth.split("-").map(Number)
    const billingPeriod = new Date(Date.UTC(year, month - 1, 1))

    // Get existing checklist record
    let checklist = await prisma.billingChecklist.findUnique({
      where: {
        tenantId_billingMonth: {
          tenantId,
          billingMonth: billingPeriod,
        },
      },
    })

    // Auto-detect status for certain items
    const totalUnits = await prisma.unit.count({
      where: { tenantId, isActive: true },
    })

    // Check electric readings
    const electricReadingsCount = await prisma.electricReading.count({
      where: {
        billingPeriod,
        unit: { tenantId },
      },
    })

    // Check water readings
    const waterReadingsCount = await prisma.waterReading.count({
      where: {
        billingPeriod,
        unit: { tenantId },
      },
    })

    // Check if previous month has payments
    const prevMonthDate = new Date(Date.UTC(year, month - 2, 1))
    const paymentsCount = await prisma.payment.count({
      where: {
        tenantId,
        paymentDate: {
          gte: new Date(Date.UTC(year, month - 2, 1)),
          lt: new Date(Date.UTC(year, month - 1, 1)),
        },
      },
    })

    // Check adjustments
    const adjustmentsCount = await prisma.billingAdjustment.count({
      where: {
        tenantId,
        billingPeriod,
      },
    })

    // Check if bills generated
    const billsCount = await prisma.bill.count({
      where: {
        tenantId,
        billingMonth: billingPeriod,
      },
    })

    // Auto-detection results
    const autoDetect = {
      meterReadings: {
        electricCount: electricReadingsCount,
        waterCount: waterReadingsCount,
        totalUnits,
        complete: electricReadingsCount >= totalUnits && waterReadingsCount >= totalUnits,
      },
      payments: {
        count: paymentsCount,
        hasPayments: paymentsCount > 0,
      },
      adjustments: {
        count: adjustmentsCount,
      },
      bills: {
        count: billsCount,
        generated: billsCount > 0,
      },
    }

    // If no checklist exists, return defaults with auto-detection
    if (!checklist) {
      return NextResponse.json({
        success: true,
        checklist: {
          tenantId,
          billingMonth: billingPeriod.toISOString(),
          meterReadingsComplete: autoDetect.meterReadings.complete,
          paymentsRecorded: autoDetect.payments.hasPayments,
          adjustmentsEntered: false,
          billsGenerated: autoDetect.bills.generated,
          soaExported: false,
          notes: null,
        },
        autoDetect,
        isNew: true,
      })
    }

    return NextResponse.json({
      success: true,
      checklist: {
        ...checklist,
        // Override with auto-detected values for some fields
        meterReadingsComplete: checklist.meterReadingsComplete || autoDetect.meterReadings.complete,
        paymentsRecorded: checklist.paymentsRecorded || autoDetect.payments.hasPayments,
        billsGenerated: checklist.billsGenerated || autoDetect.bills.generated,
      },
      autoDetect,
      isNew: false,
    })
  } catch (error: any) {
    console.error("Error fetching billing checklist:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch billing checklist" },
      { status: 500 }
    )
  }
}

/**
 * POST - Create or update billing checklist
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, user } = await requireAuth(await headers())

    const body = await request.json()
    const {
      billingMonth,
      meterReadingsComplete,
      paymentsRecorded,
      adjustmentsEntered,
      billsGenerated,
      soaExported,
      notes,
    } = body

    if (!billingMonth) {
      return NextResponse.json(
        { error: "Billing month is required" },
        { status: 400 }
      )
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Parse billing period
    const [year, month] = billingMonth.split("-").map(Number)
    const billingPeriod = new Date(Date.UTC(year, month - 1, 1))

    // Check if all items are complete
    const allComplete = meterReadingsComplete && paymentsRecorded && adjustmentsEntered && billsGenerated && soaExported

    // Upsert the checklist
    const checklist = await prisma.billingChecklist.upsert({
      where: {
        tenantId_billingMonth: {
          tenantId,
          billingMonth: billingPeriod,
        },
      },
      update: {
        meterReadingsComplete: meterReadingsComplete ?? false,
        paymentsRecorded: paymentsRecorded ?? false,
        adjustmentsEntered: adjustmentsEntered ?? false,
        billsGenerated: billsGenerated ?? false,
        soaExported: soaExported ?? false,
        notes: notes || null,
        completedBy: allComplete ? user.id : null,
        completedAt: allComplete ? new Date() : null,
      },
      create: {
        tenantId,
        billingMonth: billingPeriod,
        meterReadingsComplete: meterReadingsComplete ?? false,
        paymentsRecorded: paymentsRecorded ?? false,
        adjustmentsEntered: adjustmentsEntered ?? false,
        billsGenerated: billsGenerated ?? false,
        soaExported: soaExported ?? false,
        notes: notes || null,
        completedBy: allComplete ? user.id : null,
        completedAt: allComplete ? new Date() : null,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Checklist updated successfully",
      checklist,
    })
  } catch (error: any) {
    console.error("Error updating billing checklist:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update billing checklist" },
      { status: 500 }
    )
  }
}
