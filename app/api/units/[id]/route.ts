import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UnitType, OccupancyStatus } from "@prisma/client"

// GET /api/units/[id] - Get single unit
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const unit = await prisma.unit.findUnique({
      where: {
        id: params.id,
        tenantId,
      },
      include: {
        owner: true,
      },
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // Transform owner data to include computed name field
    return NextResponse.json({
      ...unit,
      owner: unit.owner ? {
        ...unit.owner,
        name: `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ` ${unit.owner.middleName.charAt(0)}.` : ''}`,
      } : null,
    })
  } catch (error) {
    console.error("Error fetching unit:", error)
    return NextResponse.json(
      { error: "Failed to fetch unit" },
      { status: 500 }
    )
  }
}

// PUT /api/units/[id] - Update unit
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const body = await request.json()
    const { unitNumber, floorLevel, area, parkingArea, unitType, ownerId, occupancyStatus } = body

    // Check if unit exists and belongs to tenant
    const existing = await prisma.unit.findUnique({
      where: {
        id: params.id,
        tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // If changing unit number, check it's unique within tenant
    if (unitNumber && unitNumber !== existing.unitNumber) {
      const duplicate = await prisma.unit.findUnique({
        where: {
          tenantId_unitNumber: {
            tenantId,
            unitNumber,
          }
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "Unit number already exists" },
          { status: 400 }
        )
      }
    }

    const unit = await prisma.unit.update({
      where: {
        id: params.id,
      },
      data: {
        ...(unitNumber && { unitNumber }),
        ...(floorLevel && { floorLevel }),
        ...(area && { area: parseFloat(area) }),
        ...(typeof parkingArea !== 'undefined' && { parkingArea: parseFloat(parkingArea) || 0 }),
        ...(unitType && { unitType: unitType as UnitType }),
        ...(ownerId && { ownerId }),
        ...(occupancyStatus && { occupancyStatus: occupancyStatus as OccupancyStatus }),
      },
      include: {
        owner: true,
      },
    })

    // Transform owner data to include computed name field
    return NextResponse.json({
      ...unit,
      owner: unit.owner ? {
        ...unit.owner,
        name: `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ` ${unit.owner.middleName.charAt(0)}.` : ''}`,
      } : null,
    })
  } catch (error) {
    console.error("Error updating unit:", error)
    return NextResponse.json(
      { error: "Failed to update unit" },
      { status: 500 }
    )
  }
}

// DELETE /api/units/[id] - Soft delete unit
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    // Check if unit exists
    const existing = await prisma.unit.findUnique({
      where: {
        id: params.id,
        tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // Soft delete by setting isActive to false
    await prisma.unit.update({
      where: {
        id: params.id,
      },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json({ message: "Unit deleted successfully" })
  } catch (error) {
    console.error("Error deleting unit:", error)
    return NextResponse.json(
      { error: "Failed to delete unit" },
      { status: 500 }
    )
  }
}
