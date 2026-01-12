import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization, username } from "better-auth/plugins";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => {
        const hashedPassword = await bcrypt.hash(password, 10);
        return hashedPassword;
      },
      verify: async ({ hash, password }) => {
        const isCorrectPassword = await bcrypt.compare(password, hash);
        return isCorrectPassword;
      },
    },
    async sendResetPassword({ user, url }) {
      // TODO: Implement email sending for password reset
      console.log(`Password reset for ${user.email}: ${url}`);
    },
  },

  // Use database sessions for security (best for multi-tenant)
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache session in cookie for 5 minutes
    },
  },

  // Plugins for authentication
  plugins: [
    // Username plugin for username-based login
    username(),
    // Organization plugin for multi-tenant support
    organization({
      // Allow creating organizations (tenants)
      allowUserToCreateOrganization: false, // Only admins can create tenants

      // Send invitations via email
      async sendInvitationEmail(data) {
        // TODO: Implement email sending
        console.log(`Invitation for ${data.email} to ${data.organization.name}`);
      },
    }),
  ],

  // Custom user fields
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: true,
      },
      lastName: {
        type: "string",
        required: true,
      },
      phoneNumber: {
        type: "string",
        required: false,
      },
      role: {
        type: "string",
        required: true,
        defaultValue: "UNIT_OWNER",
      },
      tenantId: {
        type: "string",
        required: false,
      },
      ownerId: {
        type: "string",
        required: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
      },
      lastLoginAt: {
        type: "date",
        required: false,
      },
      createdBy: {
        type: "string",
        required: false,
      },
    },
  },

  // Advanced configuration
  advanced: {
    database: {
      // Generate longer session tokens
      generateId: () => {
        return Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
      },
    },
  },

  // Account linking (for multiple auth providers)
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["credential"],
    },
  },

  // Rate limiting for security
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 10, // 10 requests per minute
    storage: "memory", // Use memory for now, can switch to Redis
  },

  // CSRF protection
  csrf: {
    enabled: true,
  },

  // Trusted origins
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ],
});

// Helper to get session with organization context
export async function getSessionWithOrg(headers: Headers) {
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return null;
  }

  // Use tenantId from user record (simpler approach)
  return {
    session,
    user: session.user,
    member: null,
    tenantId: session.user.tenantId || null,
    role: session.user.role || "UNIT_OWNER",
  };
}

// Helper to check permissions
export async function hasPermission(
  headers: Headers,
  permission: string
): Promise<boolean> {
  const data = await getSessionWithOrg(headers);

  if (!data?.session) {
    return false;
  }

  // SUPER_ADMIN has all permissions
  if (data.role === "SUPER_ADMIN") {
    return true;
  }

  // ADMIN has most permissions
  if (data.role === "ADMIN" && !permission.startsWith("super:")) {
    return true;
  }

  // Basic role-based permissions
  const rolePermissions: Record<string, string[]> = {
    MANAGER: ["reports:*", "payments:approve", "bills:view"],
    ACCOUNTANT: ["billing:*", "payments:*", "reports:*", "bills:*"],
    BOOKKEEPER: ["payments:create", "payments:view", "bills:view"],
    CLERK: ["readings:create", "readings:view"],
    UNIT_OWNER: ["bills:view:own", "payments:view:own"],
  };

  const permissions = rolePermissions[data.role] || [];

  // Check if permission matches (supports wildcards)
  return permissions.some(p => {
    if (p.endsWith(":*")) {
      return permission.startsWith(p.replace(":*", ":"));
    }
    return p === permission;
  });
}

// Helper to require authentication
export async function requireAuth(headers: Headers): Promise<{
  session: any;
  user: any;
  member: null;
  tenantId: string;
  role: string;
}> {
  const data = await getSessionWithOrg(headers);

  if (!data) {
    throw new Error("Unauthorized");
  }

  // If no tenantId, try to get default tenant
  if (!data.tenantId) {
    const prismaClient = new PrismaClient();
    const defaultTenant = await prismaClient.tenant.findFirst();
    if (defaultTenant) {
      data.tenantId = defaultTenant.id;
    }
  }

  // Ensure tenantId is always set
  if (!data.tenantId) {
    throw new Error("No tenant found");
  }

  return data as {
    session: any;
    user: any;
    member: null;
    tenantId: string;
    role: string;
  };
}

// Helper to require specific role
export async function requireRole(headers: Headers, roles: string[]) {
  const data = await requireAuth(headers);

  if (!roles.includes(data.role)) {
    throw new Error("Forbidden: insufficient permissions");
  }

  return data;
}

// Export types for TypeScript
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
