import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

// GET - Fetch current rates
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const settings = await prisma.tenantSettings.findFirst({
      where: { tenantId },
    })

    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 })
    }

    return NextResponse.json({
      electricRate: settings.electricRate.toString(),
      electricMinCharge: settings.electricMinCharge.toString(),
      associationDuesRate: settings.associationDuesRate.toString(),
      parkingRate: settings.parkingRate.toString(),
      penaltyRate: settings.penaltyRate.toString(),
      spAssessmentRate: settings.spAssessmentRate.toString(),

      // Water - Residential
      waterResTier1Max: settings.waterResTier1Max.toString(),
      waterResTier1Rate: settings.waterResTier1Rate.toString(),
      waterResTier2Max: settings.waterResTier2Max.toString(),
      waterResTier2Rate: settings.waterResTier2Rate.toString(),
      waterResTier3Max: settings.waterResTier3Max.toString(),
      waterResTier3Rate: settings.waterResTier3Rate.toString(),
      waterResTier4Max: settings.waterResTier4Max.toString(),
      waterResTier4Rate: settings.waterResTier4Rate.toString(),
      waterResTier5Max: settings.waterResTier5Max.toString(),
      waterResTier5Rate: settings.waterResTier5Rate.toString(),
      waterResTier6Max: settings.waterResTier6Max.toString(),
      waterResTier6Rate: settings.waterResTier6Rate.toString(),
      waterResTier7Rate: settings.waterResTier7Rate.toString(),

      // Water - Commercial
      waterComTier1Max: settings.waterComTier1Max.toString(),
      waterComTier1Rate: settings.waterComTier1Rate.toString(),
      waterComTier2Max: settings.waterComTier2Max.toString(),
      waterComTier2Rate: settings.waterComTier2Rate.toString(),
      waterComTier3Max: settings.waterComTier3Max.toString(),
      waterComTier3Rate: settings.waterComTier3Rate.toString(),
      waterComTier4Max: settings.waterComTier4Max.toString(),
      waterComTier4Rate: settings.waterComTier4Rate.toString(),
      waterComTier5Max: settings.waterComTier5Max.toString(),
      waterComTier5Rate: settings.waterComTier5Rate.toString(),
      waterComTier6Max: settings.waterComTier6Max.toString(),
      waterComTier6Rate: settings.waterComTier6Rate.toString(),
      waterComTier7Rate: settings.waterComTier7Rate.toString(),
    })
  } catch (error) {
    console.error("Error fetching rates:", error)
    return NextResponse.json({ error: "Failed to fetch rates" }, { status: 500 })
  }
}

// PUT - Update rates
export async function PUT(request: NextRequest) {
  try {
    const { tenantId, role } = await requireAuth(await headers())

    // Check permissions - ADMIN can edit basic rates, SUPER_ADMIN can edit water tiers
    if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    // Build update data based on role
    const updateData: any = {}

    // Basic rates - ADMIN and SUPER_ADMIN can edit
    if (body.electricRate !== undefined) {
      updateData.electricRate = parseFloat(body.electricRate)
    }
    if (body.electricMinCharge !== undefined) {
      updateData.electricMinCharge = parseFloat(body.electricMinCharge)
    }
    if (body.associationDuesRate !== undefined) {
      updateData.associationDuesRate = parseFloat(body.associationDuesRate)
    }
    if (body.parkingRate !== undefined) {
      updateData.parkingRate = parseFloat(body.parkingRate)
    }
    if (body.penaltyRate !== undefined) {
      updateData.penaltyRate = parseFloat(body.penaltyRate)
    }
    if (body.spAssessmentRate !== undefined) {
      updateData.spAssessmentRate = parseFloat(body.spAssessmentRate)
    }

    // Water tiers - SUPER_ADMIN only
    if (role === "SUPER_ADMIN") {
      // Residential water tiers
      const resTierFields = [
        "waterResTier1Max", "waterResTier1Rate",
        "waterResTier2Max", "waterResTier2Rate",
        "waterResTier3Max", "waterResTier3Rate",
        "waterResTier4Max", "waterResTier4Rate",
        "waterResTier5Max", "waterResTier5Rate",
        "waterResTier6Max", "waterResTier6Rate",
        "waterResTier7Rate",
      ]

      // Commercial water tiers
      const comTierFields = [
        "waterComTier1Max", "waterComTier1Rate",
        "waterComTier2Max", "waterComTier2Rate",
        "waterComTier3Max", "waterComTier3Rate",
        "waterComTier4Max", "waterComTier4Rate",
        "waterComTier5Max", "waterComTier5Rate",
        "waterComTier6Max", "waterComTier6Rate",
        "waterComTier7Rate",
      ]

      for (const field of [...resTierFields, ...comTierFields]) {
        if (body[field] !== undefined) {
          updateData[field] = parseFloat(body[field])
        }
      }
    }

    const settings = await prisma.tenantSettings.updateMany({
      where: { tenantId },
      data: updateData,
    })

    return NextResponse.json({ success: true, updated: settings.count })
  } catch (error) {
    console.error("Error updating rates:", error)
    return NextResponse.json({ error: "Failed to update rates" }, { status: 500 })
  }
}
