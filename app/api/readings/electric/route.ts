import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parsePhilippineDate } from "@/lib/timezone"

// GET /api/readings/electric - Get electric readings
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const { searchParams } = new URL(request.url)
    const billingPeriod = searchParams.get("billingPeriod")
    const unitId = searchParams.get("unitId")

    const readings = await prisma.electricReading.findMany({
      where: {
        unit: {
          tenantId,
        },
        ...(billingPeriod && {
          billingPeriod: parsePhilippineDate(billingPeriod.substring(0, 10))
        }),
        ...(unitId && { unitId }),
      },
      include: {
        unit: {
          include: {
            owner: true,
          },
        },
      },
      orderBy: [
        { billingPeriod: "desc" },
        { unit: { unitNumber: "asc" } },
      ],
    })

    return NextResponse.json(readings)
  } catch (error) {
    console.error("Error fetching electric readings:", error)
    return NextResponse.json(
      { error: "Failed to fetch electric readings" },
      { status: 500 }
    )
  }
}

// POST /api/readings/electric - Create or update electric reading
export async function POST(request: NextRequest) {
  try {
    const { tenantId, user } = await requireAuth(await headers())

    const body = await request.json()
    const { unitId, billingPeriod, presentReading, remarks } = body

    // Validation
    if (!unitId || !billingPeriod || presentReading === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Parse billing period using Philippine timezone
    const billingPeriodDate = parsePhilippineDate(billingPeriod.substring(0, 10))

    // Get the last reading for this unit
    const lastReading = await prisma.electricReading.findFirst({
      where: {
        unitId,
        billingPeriod: {
          lt: billingPeriodDate,
        },
      },
      orderBy: {
        billingPeriod: "desc",
      },
    })

    const previousReading = lastReading?.presentReading || 0
    const consumption = parseFloat(presentReading) - parseFloat(previousReading.toString())

    // Validation: present must be >= previous
    if (consumption < 0) {
      return NextResponse.json(
        { error: "Present reading must be greater than or equal to previous reading" },
        { status: 400 }
      )
    }

    // Check if reading already exists
    const existing = await prisma.electricReading.findUnique({
      where: {
        unitId_billingPeriod: {
          unitId,
          billingPeriod: billingPeriodDate,
        },
      },
    })

    let reading
    if (existing) {
      // Update existing
      reading = await prisma.electricReading.update({
        where: {
          id: existing.id,
        },
        data: {
          presentReading: parseFloat(presentReading),
          consumption,
          remarks,
          readingDate: new Date(),
          readBy: user?.id,
        },
        include: {
          unit: true,
        },
      })
    } else {
      // Create new
      reading = await prisma.electricReading.create({
        data: {
          unitId,
          billingPeriod: billingPeriodDate,
          readingDate: new Date(),
          previousReading: parseFloat(previousReading.toString()),
          presentReading: parseFloat(presentReading),
          consumption,
          remarks,
          readBy: user?.id,
        },
        include: {
          unit: true,
        },
      })
    }

    return NextResponse.json(reading, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error("Error saving electric reading:", error)
    return NextResponse.json(
      { error: "Failed to save electric reading" },
      { status: 500 }
    )
  }
}
