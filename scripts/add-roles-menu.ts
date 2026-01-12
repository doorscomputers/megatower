import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding Roles menu and seeding default roles...')

  // 1. Find the Settings parent menu
  const settingsMenu = await prisma.menu.findFirst({
    where: { name: 'settings' }
  })

  if (!settingsMenu) {
    console.error('Settings menu not found!')
    return
  }

  console.log('Settings menu found:', settingsMenu.id)

  // 2. Check if roles menu already exists
  const existingRolesMenu = await prisma.menu.findFirst({
    where: { name: 'roles' }
  })

  let rolesMenu
  if (existingRolesMenu) {
    console.log('Roles menu already exists')
    rolesMenu = existingRolesMenu
  } else {
    // Create the Roles menu
    rolesMenu = await prisma.menu.create({
      data: {
        name: 'roles',
        label: 'Roles',
        icon: 'UserCog',
        path: '/settings/roles',
        parentId: settingsMenu.id,
        order: 2, // Before Menu Permissions
        isActive: true,
      }
    })
    console.log('Roles menu created:', rolesMenu.id)
  }

  // 3. Add role permissions for SUPER_ADMIN and ADMIN
  const roles = ['SUPER_ADMIN', 'ADMIN']
  for (const role of roles) {
    const existingPerm = await prisma.rolePermission.findUnique({
      where: {
        menuId_role: {
          menuId: rolesMenu.id,
          role: role as any
        }
      }
    })

    if (!existingPerm) {
      await prisma.rolePermission.create({
        data: {
          menuId: rolesMenu.id,
          role: role as any,
          canView: true,
          canCreate: role === 'SUPER_ADMIN',
          canEdit: role === 'SUPER_ADMIN',
          canDelete: role === 'SUPER_ADMIN',
          canExport: true,
        }
      })
      console.log(`Added role permission for ${role}`)
    }
  }

  // 4. Seed default roles if Role table is empty
  const roleCount = await prisma.role.count()
  if (roleCount === 0) {
    const defaultRoles = [
      { name: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full system access', color: 'bg-red-600', isSystem: true, order: 1 },
      { name: 'ADMIN', label: 'Admin', description: 'Can manage users and settings', color: 'bg-purple-600', isSystem: true, order: 2 },
      { name: 'MANAGER', label: 'Manager', description: 'View reports, approve payments', color: 'bg-blue-600', isSystem: true, order: 3 },
      { name: 'ACCOUNTANT', label: 'Accountant', description: 'Full billing cycle access', color: 'bg-green-600', isSystem: true, order: 4 },
      { name: 'BOOKKEEPER', label: 'Bookkeeper', description: 'Enter payments', color: 'bg-yellow-600', isSystem: true, order: 5 },
      { name: 'CLERK', label: 'Clerk', description: 'Enter readings only', color: 'bg-gray-600', isSystem: true, order: 6 },
      { name: 'UNIT_OWNER', label: 'Unit Owner', description: 'View own bills only', color: 'bg-teal-600', isSystem: true, order: 7 },
    ]

    for (const role of defaultRoles) {
      await prisma.role.create({ data: role })
    }
    console.log('Default roles seeded:', defaultRoles.length)
  } else {
    console.log('Roles already exist, skipping seed')
  }

  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
