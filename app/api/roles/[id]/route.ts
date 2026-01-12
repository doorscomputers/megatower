import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/roles/[id] - Get single role
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(await headers())

    const role = await prisma.role.findUnique({
      where: { id: params.id },
    })

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    return NextResponse.json(role)
  } catch (error) {
    console.error("Error fetching role:", error)
    return NextResponse.json({ error: "Failed to fetch role" }, { status: 500 })
  }
}

// PUT /api/roles/[id] - Update role
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { role: userRole } = await requireAuth(await headers())

    // Only SUPER_ADMIN can update roles
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const { name, label, description, color, isActive, order } = body

    const existingRole = await prisma.role.findUnique({
      where: { id: params.id },
    })

    if (!existingRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    // If changing name, check for duplicates
    if (name && name !== existingRole.name) {
      const normalizedName = name.toUpperCase().replace(/\s+/g, "_")
      const duplicate = await prisma.role.findFirst({
        where: { name: normalizedName, id: { not: params.id } },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: "Role with this name already exists" },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.role.update({
      where: { id: params.id },
      data: {
        name: name ? name.toUpperCase().replace(/\s+/g, "_") : undefined,
        label: label || undefined,
        description: description !== undefined ? description : undefined,
        color: color || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        order: order !== undefined ? order : undefined,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating role:", error)
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
  }
}

// DELETE /api/roles/[id] - Delete role
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { role: userRole } = await requireAuth(await headers())

    // Only SUPER_ADMIN can delete roles
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: params.id },
    })

    if (!existingRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    // Cannot delete system roles
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: "Cannot delete system role" },
        { status: 400 }
      )
    }

    await prisma.role.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Role deleted successfully" })
  } catch (error) {
    console.error("Error deleting role:", error)
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 })
  }
}
