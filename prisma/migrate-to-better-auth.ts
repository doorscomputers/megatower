import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Better Auth data migration...\n");

  try {
    // Step 1: Migrate Tenants to Organizations
    console.log("Step 1: Migrating Tenants to Organizations...");
    const tenants = await prisma.tenant.findMany();

    for (const tenant of tenants) {
      // Check if organization already exists for this tenant
      const existingOrg = await prisma.organization.findFirst({
        where: { name: tenant.name },
      });

      if (!existingOrg) {
        // Create slug from name
        const slug = tenant.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        // Find a super admin user for this tenant to be the creator
        const superAdmin = await prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            role: "SUPER_ADMIN",
          },
        });

        // If no super admin, find any admin
        const creator = superAdmin || await prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            role: "ADMIN",
          },
        });

        if (!creator) {
          console.log(`  ⚠️  Warning: No admin found for tenant "${tenant.name}", skipping...`);
          continue;
        }

        const organization = await prisma.organization.create({
          data: {
            id: tenant.id, // Keep same ID for easy mapping
            name: tenant.name,
            slug,
            address: tenant.address,
            phone: tenant.phone,
            email: tenant.email,
            isActive: tenant.isActive,
            createdBy: creator.id,
          },
        });

        console.log(`  ✓ Created organization: ${organization.name} (${organization.id})`);
      } else {
        console.log(`  ⊙ Organization already exists: ${existingOrg.name}`);
      }
    }

    // Step 2: Create Member records for all users
    console.log("\nStep 2: Creating Member records for users...");
    const users = await prisma.user.findMany({
      where: {
        tenantId: { not: null },
      },
    });

    let memberCount = 0;
    for (const user of users) {
      if (!user.tenantId) continue;

      // Check if member already exists
      const existingMember = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: user.tenantId,
            userId: user.id,
          },
        },
      });

      if (!existingMember) {
        await prisma.member.create({
          data: {
            organizationId: user.tenantId,
            userId: user.id,
            role: user.role,
          },
        });

        memberCount++;
        if (memberCount % 10 === 0) {
          console.log(`  Created ${memberCount} members...`);
        }
      }
    }

    console.log(`  ✓ Created ${memberCount} total members`);

    // Step 3: Create Account records for users (for credentials provider)
    console.log("\nStep 3: Creating Account records for credentials...");
    const usersWithoutAccounts = await prisma.user.findMany({
      where: {
        accounts: {
          none: {},
        },
      },
    });

    let accountCount = 0;
    for (const user of usersWithoutAccounts) {
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.email,
          providerId: "credential",
          password: user.password, // Copy existing bcrypt hash
        },
      });

      accountCount++;
      if (accountCount % 10 === 0) {
        console.log(`  Created ${accountCount} accounts...`);
      }
    }

    console.log(`  ✓ Created ${accountCount} total accounts`);

    // Summary
    console.log("\n✅ Migration completed successfully!");
    console.log(`\nSummary:`);
    console.log(`  - Organizations: ${tenants.length}`);
    console.log(`  - Members: ${memberCount}`);
    console.log(`  - Accounts: ${accountCount}`);
    console.log(`\n⚠️  Important: All users will need to log in again.`);

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
