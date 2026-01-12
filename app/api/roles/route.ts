import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/roles - Get all roles
export async function GET(request: NextRequest) {
  try {
    await requireAuth(await headers())

    const roles = await prisma.role.findMany({
      orderBy: { order: "asc" },
    })

    return NextResponse.json(roles)
  } catch (error) {
    console.error("Error fetching roles:", error)
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 })
  }
}

// POST /api/roles - Create new role
export async function POST(request: NextRequest) {
  try {
    const { role } = await requireAuth(await headers())

    // Only SUPER_ADMIN can create roles
    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const { name, label, description, color } = body

    if (!name || !label) {
      return NextResponse.json(
        { error: "Name and label are required" },
        { status: 400 }
      )
    }

    // Normalize name to uppercase with underscores
    const normalizedName = name.toUpperCase().replace(/\s+/g, "_")

    // Check if role name already exists
    const existing = await prisma.role.findUnique({
      where: { name: normalizedName },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Role with this name already exists" },
        { status: 400 }
      )
    }

    // Get max order
    const maxOrder = await prisma.role.aggregate({
      _max: { order: true },
    })

    const newRole = await prisma.role.create({
      data: {
        name: normalizedName,
        label,
        description: description || null,
        color: color || "bg-gray-600",
        isSystem: false,
        order: (maxOrder._max.order || 0) + 1,
      },
    })

    return NextResponse.json(newRole, { status: 201 })
  } catch (error) {
    console.error("Error creating role:", error)
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 })
  }
}
