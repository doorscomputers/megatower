import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UnitType, OccupancyStatus } from "@prisma/client"

// GET /api/units - Get all units
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const { searchParams } = new URL(request.url)
    const floor = searchParams.get("floor")
    const type = searchParams.get("type")

    const units = await prisma.unit.findMany({
      where: {
        tenantId,
        ...(floor && { floorLevel: floor }),
        ...(type && { unitType: type as UnitType }),
      },
      include: {
        owner: true,
      },
      orderBy: [{ floorLevel: "asc" }, { unitNumber: "asc" }],
    })

    // Transform owner data to include computed name field
    const transformedUnits = units.map((unit) => ({
      ...unit,
      owner: unit.owner ? {
        ...unit.owner,
        name: `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ` ${unit.owner.middleName.charAt(0)}.` : ''}`,
      } : null,
    }))

    return NextResponse.json(transformedUnits)
  } catch (error) {
    console.error("Error fetching units:", error)
    return NextResponse.json(
      { error: "Failed to fetch units" },
      { status: 500 }
    )
  }
}

// POST /api/units - Create new unit
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const body = await request.json()
    const { unitNumber, floorLevel, area, parkingArea, unitType, ownerId, occupancyStatus } =
      body

    // Validation
    if (!unitNumber || !floorLevel || !area || !unitType || !ownerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if unit number already exists within tenant
    const existing = await prisma.unit.findUnique({
      where: {
        tenantId_unitNumber: {
          tenantId,
          unitNumber,
        }
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Unit number already exists" },
        { status: 400 }
      )
    }

    const unit = await prisma.unit.create({
      data: {
        tenantId,
        unitNumber,
        floorLevel,
        area: parseFloat(area),
        parkingArea: parkingArea ? parseFloat(parkingArea) : 0,
        unitType: unitType as UnitType,
        ownerId,
        occupancyStatus: (occupancyStatus as OccupancyStatus) || "OCCUPIED",
        isActive: true,
      },
      include: {
        owner: true,
      },
    })

    return NextResponse.json(unit, { status: 201 })
  } catch (error) {
    console.error("Error creating unit:", error)
    return NextResponse.json(
      { error: "Failed to create unit" },
      { status: 500 }
    )
  }
}
