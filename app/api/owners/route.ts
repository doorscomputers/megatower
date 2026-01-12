import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/owners - Get all owners
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    const owners = await prisma.owner.findMany({
      where: {
        tenantId: tenantId,
      },
      include: {
        units: true,
        _count: {
          select: { units: true },
        },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    })

    // Transform to include computed name field
    const transformedOwners = owners.map((owner) => ({
      ...owner,
      name: `${owner.lastName}, ${owner.firstName}${owner.middleName ? ` ${owner.middleName.charAt(0)}.` : ''}`,
    }))

    return NextResponse.json(transformedOwners)
  } catch (error) {
    console.error("Error fetching owners:", error)
    return NextResponse.json(
      { error: "Failed to fetch owners" },
      { status: 500 }
    )
  }
}

// POST /api/owners - Create new owner
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { lastName, firstName, middleName, email, phone, address } = body

    // Validation
    if (!lastName || !firstName) {
      return NextResponse.json(
        { error: "Last name and first name are required" },
        { status: 400 }
      )
    }

    const owner = await prisma.owner.create({
      data: {
        tenantId: tenantId,
        lastName,
        firstName,
        middleName: middleName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
      },
    })

    return NextResponse.json(owner, { status: 201 })
  } catch (error) {
    console.error("Error creating owner:", error)
    return NextResponse.json(
      { error: "Failed to create owner" },
      { status: 500 }
    )
  }
}
