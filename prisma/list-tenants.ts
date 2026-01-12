import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function listTenants() {
  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          units: true,
          owners: true,
          users: true,
        }
      }
    }
  })

  console.log("\n=== TENANTS ===\n")
  tenants.forEach(tenant => {
    console.log(`ID: ${tenant.id}`)
    console.log(`Name: ${tenant.name}`)
    console.log(`Address: ${tenant.address || 'N/A'}`)
    console.log(`Email: ${tenant.email || 'N/A'}`)
    console.log(`Phone: ${tenant.phone || 'N/A'}`)
    console.log(`Active: ${tenant.isActive}`)
    console.log(`Units: ${tenant._count.units}`)
    console.log(`Owners: ${tenant._count.owners}`)
    console.log(`Users: ${tenant._count.users}`)
    console.log("---")
  })

  await prisma.$disconnect()
}

listTenants()
