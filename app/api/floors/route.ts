import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DEFAULT_FLOORS = ["GF", "2F", "3F", "4F", "5F", "6F"]

// GET /api/floors - Get all floors (default + custom)
export async function GET() {
  try {
    const { tenantId } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Get custom floors from tenant settings
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: tenantId },
      select: { customFloors: true },
    })

    // Get floors from existing units
    const units = await prisma.unit.findMany({
      where: { tenantId: tenantId },
      select: { floorLevel: true },
      distinct: ["floorLevel"],
    })

    const unitFloors = units.map((u) => u.floorLevel)
    const customFloors = settings?.customFloors || []

    // Combine all floors
    const allFloors = Array.from(new Set([...DEFAULT_FLOORS, ...customFloors, ...unitFloors]))

    // Sort floors: GF first, then numeric order, then alphabetic
    allFloors.sort((a, b) => {
      if (a === "GF") return -1
      if (b === "GF") return 1
      const numA = parseInt(a.replace(/[^0-9]/g, "")) || 999
      const numB = parseInt(b.replace(/[^0-9]/g, "")) || 999
      if (numA !== numB) return numA - numB
      return a.localeCompare(b)
    })

    return NextResponse.json(allFloors)
  } catch (error) {
    console.error("Error fetching floors:", error)
    return NextResponse.json(
      { error: "Failed to fetch floors" },
      { status: 500 }
    )
  }
}

// POST /api/floors - Add a custom floor
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
    const { floorName } = body

    if (!floorName || typeof floorName !== "string") {
      return NextResponse.json(
        { error: "Floor name is required" },
        { status: 400 }
      )
    }

    const floor = floorName.trim().toUpperCase()

    if (!floor) {
      return NextResponse.json(
        { error: "Floor name cannot be empty" },
        { status: 400 }
      )
    }

    // Get current custom floors
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: tenantId },
      select: { customFloors: true },
    })

    const currentCustomFloors = settings?.customFloors || []

    // Check if floor already exists in defaults or custom
    if (DEFAULT_FLOORS.includes(floor) || currentCustomFloors.includes(floor)) {
      return NextResponse.json(
        { error: "Floor already exists" },
        { status: 400 }
      )
    }

    // Add the new floor
    await prisma.tenantSettings.update({
      where: { tenantId: tenantId },
      data: {
        customFloors: [...currentCustomFloors, floor],
      },
    })

    return NextResponse.json({ success: true, floor }, { status: 201 })
  } catch (error) {
    console.error("Error adding floor:", error)
    return NextResponse.json(
      { error: "Failed to add floor" },
      { status: 500 }
    )
  }
}
