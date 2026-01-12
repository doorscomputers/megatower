import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // ============================================
  // 1. CREATE DEFAULT TENANT
  // ============================================
  console.log('📊 Creating default tenant...')
  
  const tenant = await prisma.tenant.upsert({
    where: { id: 'default-tenant' },
    update: {},
    create: {
      id: 'default-tenant',
      name: process.env.DEFAULT_TENANT_NAME || 'Mega Tower Residences',
      address: process.env.DEFAULT_TENANT_ADDRESS || 
        'Megatower Residences I, Ground Floor, Property Management Office, Corner Tecson, Sandico St., Salud Mitra, Baguio City, Philippines',
      phone: process.env.DEFAULT_TENANT_PHONE || '(074) 661-02-61',
      email: process.env.DEFAULT_TENANT_EMAIL || 'megatowerpmobillings@gmail.com',
      isActive: true
    }
  })
  
  console.log(`✅ Tenant created: ${tenant.name}`)

  // ============================================
  // 2. CREATE TENANT SETTINGS
  // ============================================
  console.log('⚙️  Creating tenant settings...')
  
  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      
      // Billing Schedule (from Excel analysis)
      billingDayOfMonth: 27,
      readingDay: 26,
      statementDelay: 10,
      dueDateDelay: 10,
      gracePeriodDays: 0,
      
      // Rates (ADMIN can edit)
      electricRate: 8.39,
      electricMinCharge: 50,
      associationDuesRate: 60,
      penaltyRate: 0.10, // 10%
      
      // Water Tiers - Residential (SUPER_ADMIN only)
      // Max values are EXCLUSIVE upper bounds to match Excel: IF(J<6, ...) means 5 is included
      // Excel: <=1 → Tier1, >1 AND <6 → Tier2, >5 AND <11 → Tier3, etc.
      waterResTier1Max: 1,    // <=1 cu.m → ₱80 fixed
      waterResTier1Rate: 80,
      waterResTier2Max: 6,    // <6 means 2,3,4,5 → ₱200 fixed
      waterResTier2Rate: 200,
      waterResTier3Max: 11,   // <11 means 6,7,8,9,10 → ₱370 fixed
      waterResTier3Rate: 370,
      waterResTier4Max: 21,   // <21 means 11-20 → (cons-10)*40+370
      waterResTier4Rate: 40,
      waterResTier5Max: 31,   // <31 means 21-30 → (cons-20)*45+770
      waterResTier5Rate: 45,
      waterResTier6Max: 41,   // <41 means 31-40 → (cons-30)*50+1220
      waterResTier6Rate: 50,
      waterResTier7Rate: 55,  // >40 → (cons-40)*55+1720

      // Water Tiers - Commercial (SUPER_ADMIN only)
      // Same boundary logic as Residential
      waterComTier1Max: 1,    // <=1 cu.m → ₱200 fixed
      waterComTier1Rate: 200,
      waterComTier2Max: 6,    // <6 means 2,3,4,5 → ₱250 fixed
      waterComTier2Rate: 250,
      waterComTier3Max: 11,   // <11 means 6,7,8,9,10 → ₱740 fixed
      waterComTier3Rate: 740,
      waterComTier4Max: 21,   // <21 means 11-20 → (cons-10)*55+740
      waterComTier4Rate: 55,
      waterComTier5Max: 31,   // <31 means 21-30 → (cons-20)*60+1290
      waterComTier5Rate: 60,
      waterComTier6Max: 41,   // <41 means 31-40 → (cons-30)*65+1890
      waterComTier6Rate: 65,
      waterComTier7Rate: 85,  // >40 → (cons-40)*85+2540
      
      // Payment
      paymentAllocationStrategy: 'OLDEST_FIRST',
      
      // SOA
      soaDetailMonths: 4
    }
  })
  
  console.log('✅ Settings created')

  // ============================================
  // 3. CREATE SUPER ADMIN USER
  // ============================================
  console.log('👤 Creating super admin user...')
  
  const hashedPassword = await bcrypt.hash(
    process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456',
    10
  )
  
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@megatower.com'
  const adminUsername = process.env.SUPER_ADMIN_USERNAME || 'admin'

  const superAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      username: adminUsername,
      displayUsername: adminUsername,
    },
    create: {
      email: adminEmail,
      username: adminUsername,
      displayUsername: adminUsername,
      password: hashedPassword, // Legacy field, not used by Better Auth
      role: UserRole.SUPER_ADMIN,
      firstName: process.env.SUPER_ADMIN_FIRSTNAME || 'System',
      lastName: process.env.SUPER_ADMIN_LASTNAME || 'Administrator',
      tenantId: tenant.id,
      isActive: true
    }
  })

  // Create Better Auth Account record (required for username/password login)
  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: 'credential',
        accountId: adminUsername
      }
    },
    update: {
      password: hashedPassword
    },
    create: {
      userId: superAdmin.id,
      accountId: adminUsername,
      providerId: 'credential',
      password: hashedPassword // Better Auth looks for password here
    }
  })

  console.log(`✅ Super Admin created: ${superAdmin.email}`)

  // ============================================
  // 4. CREATE DEFAULT MENUS
  // ============================================
  console.log('📋 Creating default menus...')
  
  const menus = [
    // Dashboard
    { name: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', order: 1 },

    // Master Data
    { name: 'master', label: 'Master Data', icon: 'Database', path: null, order: 2 },
    { name: 'units', label: 'Units', icon: 'Building2', path: '/units', parentName: 'master', order: 1 },
    { name: 'owners', label: 'Owners', icon: 'Users', path: '/owners', parentName: 'master', order: 2 },

    // Readings
    { name: 'readings', label: 'Meter Readings', icon: 'Gauge', path: null, order: 3 },
    { name: 'electric-readings', label: 'Electric Readings', icon: 'Zap', path: '/readings/electric', parentName: 'readings', order: 1 },
    { name: 'water-readings', label: 'Water Readings', icon: 'Droplet', path: '/readings/water', parentName: 'readings', order: 2 },

    // Billing
    { name: 'billing', label: 'Billing', icon: 'FileText', path: null, order: 4 },
    { name: 'billing-adjustments', label: 'Billing Adjustments', icon: 'SlidersHorizontal', path: '/billing/adjustments', parentName: 'billing', order: 1 },
    { name: 'generate-bills', label: 'Generate Bills', icon: 'FilePlus', path: '/billing/generate', parentName: 'billing', order: 2 },
    { name: 'bills-list', label: 'Bills List', icon: 'FileStack', path: '/billing/list', parentName: 'billing', order: 3 },
    { name: 'soa', label: 'Statement of Accounts', icon: 'FileBarChart', path: '/billing/soa', parentName: 'billing', order: 4 },
    { name: 'opening-balance', label: 'Opening Balance', icon: 'DollarSign', path: '/billing/opening-balance', parentName: 'billing', order: 5 },
    { name: 'import-balance', label: 'Import Balances', icon: 'Upload', path: '/billing/import-balance', parentName: 'billing', order: 6 },

    // Payments
    { name: 'payments', label: 'Payments', icon: 'CreditCard', path: null, order: 5 },
    { name: 'record-payment', label: 'Record Payment', icon: 'Plus', path: '/payments/record', parentName: 'payments', order: 1 },
    { name: 'payments-list', label: 'Payments List', icon: 'List', path: '/payments/list', parentName: 'payments', order: 2 },

    // Reports
    { name: 'reports', label: 'Reports', icon: 'BarChart3', path: null, order: 6 },
    { name: 'reports-dashboard', label: 'Reports Dashboard', icon: 'PieChart', path: '/reports', parentName: 'reports', order: 1 },
    { name: 'outstanding-report', label: 'Outstanding Balances', icon: 'DollarSign', path: '/reports/outstanding', parentName: 'reports', order: 2 },
    { name: 'aging-report', label: 'AR Aging', icon: 'Clock', path: '/reports/aging', parentName: 'reports', order: 3 },
    { name: 'collection-summary', label: 'Collection Summary', icon: 'TrendingUp', path: '/reports/collection-summary', parentName: 'reports', order: 4 },
    { name: 'collection-reports', label: 'Daily Collections', icon: 'Receipt', path: '/reports/collections', parentName: 'reports', order: 5 },
    { name: 'unit-status', label: 'Unit Status', icon: 'Home', path: '/reports/unit-status', parentName: 'reports', order: 6 },
    { name: 'bill-status', label: 'Bill Status', icon: 'FileCheck', path: '/reports/bill-status', parentName: 'reports', order: 7 },
    { name: 'delinquency-report', label: 'Delinquency', icon: 'AlertTriangle', path: '/reports/delinquency', parentName: 'reports', order: 8 },
    { name: 'top-payers', label: 'Top Payers', icon: 'Trophy', path: '/reports/top-payers', parentName: 'reports', order: 9 },
    { name: 'efficiency-trend', label: 'Efficiency Trend', icon: 'TrendingUp', path: '/reports/efficiency-trend', parentName: 'reports', order: 10 },
    { name: 'comparative', label: 'Comparative Analysis', icon: 'GitCompare', path: '/reports/comparative', parentName: 'reports', order: 11 },
    { name: 'annual-summary', label: 'Annual Summary', icon: 'Calendar', path: '/reports/annual-summary', parentName: 'reports', order: 12 },

    // Users
    { name: 'users', label: 'User Management', icon: 'UserCog', path: '/users', order: 7 },

    // Settings
    { name: 'settings', label: 'Settings', icon: 'Settings', path: null, order: 8 },
    { name: 'rates', label: 'Rates & Charges', icon: 'DollarSign', path: '/settings/rates', parentName: 'settings', order: 1 },
    { name: 'billing-schedule', label: 'Billing Schedule', icon: 'Calendar', path: '/settings/schedule', parentName: 'settings', order: 2 },
    { name: 'permissions', label: 'Menu Permissions', icon: 'Shield', path: '/settings/permissions', parentName: 'settings', order: 3 },
  ]
  
  for (const menuData of menus) {
    const parent = menuData.parentName
      ? await prisma.menu.findUnique({ where: { name: menuData.parentName } })
      : null
    
    await prisma.menu.upsert({
      where: { name: menuData.name },
      update: {},
      create: {
        name: menuData.name,
        label: menuData.label,
        icon: menuData.icon,
        path: menuData.path,
        parentId: parent?.id,
        order: menuData.order,
        isActive: true
      }
    })
  }
  
  console.log(`✅ ${menus.length} menus created`)

  // ============================================
  // 5. CREATE DEFAULT ROLE PERMISSIONS
  // ============================================
  console.log('🔐 Creating role permissions...')
  
  const allMenus = await prisma.menu.findMany()
  
  // Define default permissions per role
  const rolePermissions = {
    SUPER_ADMIN: { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true },
    ADMIN: { canView: true, canCreate: true, canEdit: true, canDelete: true, canExport: true },
    MANAGER: { canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: true },
    ACCOUNTANT: { canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: true },
    BOOKKEEPER: { canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: false },
    CLERK: { canView: true, canCreate: true, canEdit: true, canDelete: false, canExport: false },
    UNIT_OWNER: { canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: false }
  }
  
  // Clerk can only access readings
  const clerkMenus = ['dashboard', 'readings', 'electric-readings', 'water-readings']

  // Unit Owner can only view their own data
  const unitOwnerMenus = ['dashboard', 'bills-list', 'payments-list', 'soa']

  // Admin-only menus (SUPER_ADMIN and ADMIN only)
  const adminOnlyMenus = ['users', 'settings', 'rates', 'billing-schedule', 'permissions']

  for (const menu of allMenus) {
    for (const [role, permissions] of Object.entries(rolePermissions)) {
      // Skip if role shouldn't have access to this menu
      if (role === 'CLERK' && !clerkMenus.includes(menu.name)) continue
      if (role === 'UNIT_OWNER' && !unitOwnerMenus.includes(menu.name)) continue
      // Skip admin-only menus for non-admin roles
      if (adminOnlyMenus.includes(menu.name) && role !== 'SUPER_ADMIN' && role !== 'ADMIN') continue
      
      await prisma.rolePermission.upsert({
        where: {
          menuId_role: {
            menuId: menu.id,
            role: role as UserRole
          }
        },
        update: {},
        create: {
          menuId: menu.id,
          role: role as UserRole,
          ...permissions
        }
      })
    }
  }
  
  console.log('✅ Role permissions created')

  // ============================================
  // 6. CLEAN AND CREATE OWNERS & UNITS
  // ============================================
  console.log('🏠 Cleaning existing owners and units...')

  // Delete in order due to foreign keys
  await prisma.billPayment.deleteMany({ where: { bill: { unit: { tenantId: tenant.id } } } })
  await prisma.payment.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.bill.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.electricReading.deleteMany({ where: { unit: { tenantId: tenant.id } } })
  await prisma.waterReading.deleteMany({ where: { unit: { tenantId: tenant.id } } })
  await prisma.unit.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.owner.deleteMany({ where: { tenantId: tenant.id } })

  console.log('👥 Creating owners...')

  const ownersData = [
    { lastName: 'Dela Cruz', firstName: 'Juan', middleName: 'Santos', email: 'juan@example.com', phone: '09171234567' },
    { lastName: 'Santos', firstName: 'Maria', middleName: 'Cruz', email: 'maria@example.com', phone: '09181234567' },
    { lastName: 'Mendoza', firstName: 'Jose', middleName: 'Garcia', email: 'jose@example.com', phone: '09191234567' },
    { lastName: 'Garcia', firstName: 'Ana', middleName: 'Reyes', email: 'ana@example.com', phone: '09201234567' },
    { lastName: 'Reyes', firstName: 'Pedro', middleName: 'Lopez', email: 'pedro@example.com', phone: '09211234567' },
    { lastName: 'Lopez', firstName: 'Carmen', middleName: null, email: 'carmen@example.com', phone: '09221234567' },
  ]

  const owners: any[] = []
  for (const ownerData of ownersData) {
    const owner = await prisma.owner.create({
      data: {
        tenantId: tenant.id,
        ...ownerData
      }
    })
    owners.push(owner)
  }

  console.log(`✅ ${owners.length} owners created`)

  console.log('🏢 Creating units...')

  // Create units - each FLOOR owned by ONE owner
  // 6 floors: GF, 2F, 3F, 4F, 5F, 6F
  // 4-5 units per floor, all units on a floor belong to the same owner
  const floorConfig = [
    { floor: 'GF', units: 4, ownerIndex: 0, type: 'COMMERCIAL' },  // Juan Dela Cruz
    { floor: '2F', units: 5, ownerIndex: 1, type: 'RESIDENTIAL' }, // Maria Santos
    { floor: '3F', units: 5, ownerIndex: 2, type: 'RESIDENTIAL' }, // Jose Mendoza
    { floor: '4F', units: 5, ownerIndex: 3, type: 'RESIDENTIAL' }, // Ana Garcia
    { floor: '5F', units: 5, ownerIndex: 4, type: 'RESIDENTIAL' }, // Pedro Reyes
    { floor: '6F', units: 4, ownerIndex: 5, type: 'RESIDENTIAL' }, // Carmen Lopez
  ]

  let unitCount = 0

  for (const config of floorConfig) {
    const owner = owners[config.ownerIndex]

    for (let u = 1; u <= config.units; u++) {
      const unitNumber = `${config.floor}-${u}`

      await prisma.unit.create({
        data: {
          tenantId: tenant.id,
          unitNumber,
          floorLevel: config.floor,
          area: 35 + Math.random() * 20, // 35-55 sqm
          unitType: config.type as any,
          ownerId: owner.id, // All units on this floor belong to this owner
          occupancyStatus: 'OCCUPIED',
          isActive: true
        }
      })

      unitCount++
    }

    console.log(`   ${config.floor}: ${config.units} units → ${owner.firstName} ${owner.lastName}`)
  }

  console.log(`✅ ${unitCount} units created (each floor owned by ONE owner)`)

  console.log('🎉 Database seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
