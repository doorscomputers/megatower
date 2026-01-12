import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

// GET /api/permissions/user/[id] - Get all menus with permissions for a user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, role } = await requireAuth(await headers())
    const { id: userId } = await params

    // Only SUPER_ADMIN and ADMIN can view permissions
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      )
    }

    // Get the user and their role
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, role: true, firstName: true, lastName: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get all menus
    const menus = await prisma.menu.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
    })

    // Get role-based permissions for user's role
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role: user.role },
    })

    // Get user-specific permission overrides
    const userPermissions = await prisma.menuPermission.findMany({
      where: { userId },
    })

    // Create lookup maps
    const rolePermMap = new Map(rolePermissions.map((rp) => [rp.menuId, rp]))
    const userPermMap = new Map(userPermissions.map((up) => [up.menuId, up]))

    // Build response with both role and user permissions
    const menusWithPermissions = menus.map((menu) => {
      const rolePerm = rolePermMap.get(menu.id)
      const userPerm = userPermMap.get(menu.id)

      return {
        id: menu.id,
        name: menu.name,
        label: menu.label,
        icon: menu.icon,
        path: menu.path,
        parentId: menu.parentId,
        order: menu.order,
        // Role default permissions
        rolePermissions: {
          canView: rolePerm?.canView ?? false,
          canCreate: rolePerm?.canCreate ?? false,
          canEdit: rolePerm?.canEdit ?? false,
          canDelete: rolePerm?.canDelete ?? false,
          canExport: rolePerm?.canExport ?? false,
        },
        // User overrides (null if no override)
        userOverrides: userPerm
          ? {
              id: userPerm.id,
              canView: userPerm.canView,
              canCreate: userPerm.canCreate,
              canEdit: userPerm.canEdit,
              canDelete: userPerm.canDelete,
              canExport: userPerm.canExport,
            }
          : null,
        // Effective permissions (user override or role default)
        effectivePermissions: {
          canView: userPerm?.canView ?? rolePerm?.canView ?? false,
          canCreate: userPerm?.canCreate ?? rolePerm?.canCreate ?? false,
          canEdit: userPerm?.canEdit ?? rolePerm?.canEdit ?? false,
          canDelete: userPerm?.canDelete ?? rolePerm?.canDelete ?? false,
          canExport: userPerm?.canExport ?? rolePerm?.canExport ?? false,
        },
      }
    })

    // Build hierarchical structure
    const menuMap = new Map(menusWithPermissions.map((m) => [m.id, { ...m, children: [] as any[] }]))
    const rootMenus: any[] = []

    for (const menu of menusWithPermissions) {
      if (menu.parentId) {
        const parent = menuMap.get(menu.parentId)
        if (parent) {
          parent.children.push(menu)
        }
      } else {
        rootMenus.push(menuMap.get(menu.id))
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
      },
      menus: rootMenus,
    })
  } catch (error) {
    console.error("Error fetching user permissions:", error)
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    )
  }
}

// PUT /api/permissions/user/[id] - Update user permission overrides
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, role, user: currentUser } = await requireAuth(await headers())
    const { id: userId } = await params

    // Only SUPER_ADMIN and ADMIN can update permissions
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      )
    }

    // Get the target user
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Prevent modifying SUPER_ADMIN permissions by non-SUPER_ADMIN
    if (targetUser.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can modify Super Admin permissions" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { permissions } = body

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { error: "Permissions must be an array" },
        { status: 400 }
      )
    }

    // Process each permission update
    for (const perm of permissions) {
      const { menuId, canView, canCreate, canEdit, canDelete, canExport, remove } = perm

      if (!menuId) continue

      if (remove) {
        // Remove the user override (revert to role default)
        await prisma.menuPermission.deleteMany({
          where: { userId, menuId },
        })
      } else {
        // Upsert the user permission override
        await prisma.menuPermission.upsert({
          where: {
            userId_menuId: { userId, menuId },
          },
          update: {
            canView: canView ?? false,
            canCreate: canCreate ?? false,
            canEdit: canEdit ?? false,
            canDelete: canDelete ?? false,
            canExport: canExport ?? false,
          },
          create: {
            userId,
            menuId,
            canView: canView ?? false,
            canCreate: canCreate ?? false,
            canEdit: canEdit ?? false,
            canDelete: canDelete ?? false,
            canExport: canExport ?? false,
            grantedBy: currentUser.id,
          },
        })
      }
    }

    return NextResponse.json({ message: "Permissions updated successfully" })
  } catch (error) {
    console.error("Error updating permissions:", error)
    return NextResponse.json(
      { error: "Failed to update permissions" },
      { status: 500 }
    )
  }
}
