import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

export interface MenuWithPermissions {
  id: string
  name: string
  label: string
  icon: string | null
  path: string | null
  parentId: string | null
  order: number
  isActive: boolean
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canExport: boolean
  children?: MenuWithPermissions[]
}

/**
 * Get all menus with permissions for a user based on their role and any user-specific overrides
 */
export async function getUserMenusWithPermissions(
  userId: string,
  role: UserRole
): Promise<MenuWithPermissions[]> {
  // Get all active menus
  const menus = await prisma.menu.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }],
  })

  // Get role-based permissions for this role
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role },
  })

  // Get user-specific permission overrides
  const userPermissions = await prisma.menuPermission.findMany({
    where: { userId },
  })

  // Create lookup maps
  const rolePermMap = new Map(rolePermissions.map((rp) => [rp.menuId, rp]))
  const userPermMap = new Map(userPermissions.map((up) => [up.menuId, up]))

  // Build menu list with permissions
  const menusWithPerms: MenuWithPermissions[] = menus.map((menu) => {
    const rolePerm = rolePermMap.get(menu.id)
    const userPerm = userPermMap.get(menu.id)

    // User permissions override role permissions if they exist
    const canView = userPerm?.canView ?? rolePerm?.canView ?? false
    const canCreate = userPerm?.canCreate ?? rolePerm?.canCreate ?? false
    const canEdit = userPerm?.canEdit ?? rolePerm?.canEdit ?? false
    const canDelete = userPerm?.canDelete ?? rolePerm?.canDelete ?? false
    const canExport = userPerm?.canExport ?? rolePerm?.canExport ?? false

    return {
      id: menu.id,
      name: menu.name,
      label: menu.label,
      icon: menu.icon,
      path: menu.path,
      parentId: menu.parentId,
      order: menu.order,
      isActive: menu.isActive,
      canView,
      canCreate,
      canEdit,
      canDelete,
      canExport,
    }
  })

  // Build hierarchical structure
  const menuMap = new Map(menusWithPerms.map((m) => [m.id, m]))
  const rootMenus: MenuWithPermissions[] = []

  for (const menu of menusWithPerms) {
    if (menu.parentId) {
      const parent = menuMap.get(menu.parentId)
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(menu)
      }
    } else {
      rootMenus.push(menu)
    }
  }

  // Sort children by order
  for (const menu of rootMenus) {
    if (menu.children) {
      menu.children.sort((a, b) => a.order - b.order)
    }
  }

  return rootMenus
}

/**
 * Get only the menus a user can view (for sidebar)
 */
export async function getUserAccessibleMenus(
  userId: string,
  role: UserRole
): Promise<MenuWithPermissions[]> {
  const allMenus = await getUserMenusWithPermissions(userId, role)

  // Filter to only menus with canView permission
  function filterViewable(menus: MenuWithPermissions[]): MenuWithPermissions[] {
    return menus
      .filter((menu) => {
        // Parent menus are viewable if they or any child is viewable
        if (menu.children && menu.children.length > 0) {
          const viewableChildren = filterViewable(menu.children)
          if (viewableChildren.length > 0) {
            menu.children = viewableChildren
            return true
          }
          return false
        }
        return menu.canView
      })
      .map((menu) => ({
        ...menu,
        children: menu.children ? filterViewable(menu.children) : undefined,
      }))
  }

  return filterViewable(allMenus)
}

/**
 * Check if user has a specific permission on a menu
 */
export async function hasMenuPermission(
  userId: string,
  role: UserRole,
  menuName: string,
  permission: "canView" | "canCreate" | "canEdit" | "canDelete" | "canExport"
): Promise<boolean> {
  // SUPER_ADMIN has all permissions
  if (role === "SUPER_ADMIN") return true

  // Find the menu
  const menu = await prisma.menu.findUnique({
    where: { name: menuName },
  })

  if (!menu) return false

  // Check for user-specific override first
  const userPerm = await prisma.menuPermission.findUnique({
    where: {
      userId_menuId: {
        userId,
        menuId: menu.id,
      },
    },
  })

  if (userPerm) {
    return userPerm[permission]
  }

  // Fall back to role permission
  const rolePerm = await prisma.rolePermission.findUnique({
    where: {
      menuId_role: {
        menuId: menu.id,
        role,
      },
    },
  })

  return rolePerm?.[permission] ?? false
}
