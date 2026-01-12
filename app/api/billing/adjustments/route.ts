import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - Get billing adjustments for a billing period
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

    const billingPeriod = new Date(billingMonth + "-01")

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Get all units with their adjustments for this period
    const units = await prisma.unit.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ floorLevel: "asc" }, { unitNumber: "asc" }],
    })

    // Get existing adjustments for this period
    const adjustments = await prisma.billingAdjustment.findMany({
      where: {
        tenantId,
        billingPeriod,
      },
    })

    // Build response with units and their adjustments
    const result = units.map((unit) => {
      const adjustment = adjustments.find((a) => a.unitId === unit.id)
      return {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        floorLevel: unit.floorLevel,
        ownerName: unit.owner
          ? `${unit.owner.lastName}, ${unit.owner.firstName}`
          : "No Owner",
        area: Number(unit.area),
        parkingArea: Number(unit.parkingArea || 0),
        spAssessment: Number(adjustment?.spAssessment || 0),
        discounts: Number(adjustment?.discounts || 0),
        advanceDues: Number(adjustment?.advanceDues || 0),
        advanceUtilities: Number(adjustment?.advanceUtilities || 0),
        remarks: adjustment?.remarks || "",
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error fetching adjustments:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch adjustments" },
      { status: 500 }
    )
  }
}

// POST - Save billing adjustments for multiple units
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const body = await request.json()
    const { billingMonth, adjustments } = body as {
      billingMonth: string
      adjustments: Array<{
        unitId: string
        spAssessment: number
        discounts: number
        advanceDues: number
        advanceUtilities: number
        remarks?: string
      }>
    }

    if (!billingMonth || !adjustments) {
      return NextResponse.json(
        { error: "Billing month and adjustments are required" },
        { status: 400 }
      )
    }

    const billingPeriod = new Date(billingMonth + "-01")

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Upsert each adjustment
    let saved = 0
    for (const adj of adjustments) {
      // Skip if all values are zero
      if (
        adj.spAssessment === 0 &&
        adj.discounts === 0 &&
        adj.advanceDues === 0 &&
        adj.advanceUtilities === 0
      ) {
        // Delete if exists
        await prisma.billingAdjustment.deleteMany({
          where: {
            tenantId,
            unitId: adj.unitId,
            billingPeriod,
          },
        })
        continue
      }

      await prisma.billingAdjustment.upsert({
        where: {
          tenantId_unitId_billingPeriod: {
            tenantId,
            unitId: adj.unitId,
            billingPeriod,
          },
        },
        update: {
          spAssessment: adj.spAssessment,
          discounts: adj.discounts,
          advanceDues: adj.advanceDues,
          advanceUtilities: adj.advanceUtilities,
          remarks: adj.remarks || null,
        },
        create: {
          tenantId,
          unitId: adj.unitId,
          billingPeriod,
          spAssessment: adj.spAssessment,
          discounts: adj.discounts,
          advanceDues: adj.advanceDues,
          advanceUtilities: adj.advanceUtilities,
          remarks: adj.remarks || null,
        },
      })
      saved++
    }

    return NextResponse.json({
      success: true,
      message: `Saved ${saved} adjustment(s) for ${billingMonth}`,
      saved,
    })
  } catch (error: any) {
    console.error("Error saving adjustments:", error)
    return NextResponse.json(
      { error: error.message || "Failed to save adjustments" },
      { status: 500 }
    )
  }
}
