import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ACCOUNTANT",
  "BOOKKEEPER",
  "CLERK",
  "UNIT_OWNER",
] as const

// GET /api/permissions/roles - Get all roles with their menu permissions
export async function GET(request: NextRequest) {
  try {
    const { role } = await requireAuth(await headers())

    // Only SUPER_ADMIN and ADMIN can view role permissions
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      )
    }

    // Get all menus
    const menus = await prisma.menu.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
    })

    // Get all role permissions
    const rolePermissions = await prisma.rolePermission.findMany()

    // Build permission map: role -> menuId -> permissions
    const permMap: Record<string, Record<string, any>> = {}
    for (const rp of rolePermissions) {
      if (!permMap[rp.role]) permMap[rp.role] = {}
      permMap[rp.role][rp.menuId] = {
        canView: rp.canView,
        canCreate: rp.canCreate,
        canEdit: rp.canEdit,
        canDelete: rp.canDelete,
        canExport: rp.canExport,
      }
    }

    // Build hierarchical menu structure
    const menuMap = new Map(menus.map((m) => [m.id, { ...m, children: [] as any[] }]))
    const rootMenus: any[] = []

    for (const menu of menus) {
      if (menu.parentId) {
        const parent = menuMap.get(menu.parentId)
        if (parent) {
          parent.children.push(menuMap.get(menu.id))
        }
      } else {
        rootMenus.push(menuMap.get(menu.id))
      }
    }

    // Build response with roles and their permissions
    const rolesData = ROLES.map((roleName) => ({
      role: roleName,
      permissions: permMap[roleName] || {},
    }))

    return NextResponse.json({
      roles: rolesData,
      menus: rootMenus,
    })
  } catch (error) {
    console.error("Error fetching role permissions:", error)
    return NextResponse.json(
      { error: "Failed to fetch role permissions" },
      { status: 500 }
    )
  }
}

// PUT /api/permissions/roles - Update role permissions
export async function PUT(request: NextRequest) {
  try {
    const { role: currentRole } = await requireAuth(await headers())

    // Only SUPER_ADMIN can edit role permissions
    if (currentRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: only Super Admin can edit role permissions" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { role, permissions } = body

    if (!role || !ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      )
    }

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: "Permissions must be an array" },
        { status: 400 }
      )
    }

    // Update each permission
    for (const perm of permissions) {
      const { menuId, canView, canCreate, canEdit, canDelete, canExport } = perm

      if (!menuId) continue

      await prisma.rolePermission.upsert({
        where: {
          menuId_role: { menuId, role: role as UserRole },
        },
        update: {
          canView: canView ?? false,
          canCreate: canCreate ?? false,
          canEdit: canEdit ?? false,
          canDelete: canDelete ?? false,
          canExport: canExport ?? false,
        },
        create: {
          menuId,
          role: role as UserRole,
          canView: canView ?? false,
          canCreate: canCreate ?? false,
          canEdit: canEdit ?? false,
          canDelete: canDelete ?? false,
          canExport: canExport ?? false,
        },
      })
    }

    return NextResponse.json({ message: "Role permissions updated successfully" })
  } catch (error) {
    console.error("Error updating role permissions:", error)
    return NextResponse.json(
      { error: "Failed to update role permissions" },
      { status: 500 }
    )
  }
}
