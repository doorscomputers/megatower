import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/owners/[id] - Get single owner
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    const owner = await prisma.owner.findUnique({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        units: true,
        _count: {
          select: { units: true },
        },
      },
    })

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 })
    }

    // Include computed name field
    return NextResponse.json({
      ...owner,
      name: `${owner.lastName}, ${owner.firstName}${owner.middleName ? ` ${owner.middleName.charAt(0)}.` : ''}`,
    })
  } catch (error) {
    console.error("Error fetching owner:", error)
    return NextResponse.json(
      { error: "Failed to fetch owner" },
      { status: 500 }
    )
  }
}

// PUT /api/owners/[id] - Update owner
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { lastName, firstName, middleName, email, phone, address, unitIds } = body

    // Check if owner exists
    const existing = await prisma.owner.findUnique({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        units: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 })
    }

    // Update owner basic info (only if provided)
    const updateData: any = {}
    if (lastName !== undefined) updateData.lastName = lastName
    if (firstName !== undefined) updateData.firstName = firstName
    if (middleName !== undefined) updateData.middleName = middleName || null
    if (email !== undefined) updateData.email = email || null
    if (phone !== undefined) updateData.phone = phone || null
    if (address !== undefined) updateData.address = address || null

    if (Object.keys(updateData).length > 0) {
      await prisma.owner.update({
        where: { id: params.id },
        data: updateData,
      })
    }

    // Handle unit assignments if unitIds is provided
    if (unitIds !== undefined) {
      const newUnitIds = unitIds as string[]

      // Assign selected units to this owner
      if (newUnitIds.length > 0) {
        await prisma.unit.updateMany({
          where: {
            id: { in: newUnitIds },
            tenantId: tenantId,
          },
          data: {
            ownerId: params.id,
          },
        })
      }
    }

    // Fetch updated owner with units
    const updatedOwner = await prisma.owner.findUnique({
      where: {
        id: params.id,
      },
      include: {
        units: true,
        _count: {
          select: { units: true },
        },
      },
    })

    // Include computed name field
    return NextResponse.json(updatedOwner ? {
      ...updatedOwner,
      name: `${updatedOwner.lastName}, ${updatedOwner.firstName}${updatedOwner.middleName ? ` ${updatedOwner.middleName.charAt(0)}.` : ''}`,
    } : null)
  } catch (error) {
    console.error("Error updating owner:", error)
    return NextResponse.json(
      { error: "Failed to update owner" },
      { status: 500 }
    )
  }
}

// DELETE /api/owners/[id] - Delete owner (only if no units)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Check if owner exists
    const existing = await prisma.owner.findUnique({
      where: {
        id: params.id,
        tenantId: tenantId,
      },
      include: {
        _count: {
          select: { units: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 })
    }

    // Check if owner has units
    if (existing._count.units > 0) {
      return NextResponse.json(
        { error: "Cannot delete owner with assigned units" },
        { status: 400 }
      )
    }

    await prisma.owner.delete({
      where: {
        id: params.id,
      },
    })

    return NextResponse.json({ message: "Owner deleted successfully" })
  } catch (error) {
    console.error("Error deleting owner:", error)
    return NextResponse.json(
      { error: "Failed to delete owner" },
      { status: 500 }
    )
  }
}
