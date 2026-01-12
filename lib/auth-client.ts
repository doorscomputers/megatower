"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient, usernameClient } from "better-auth/client/plugins";
import { useState, useEffect } from "react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",

  plugins: [
    usernameClient(),
    organizationClient(),
  ],
});

// Export hooks for easy use in components
export const { useSession, signIn, signOut, signUp } = authClient;

// Helper hook to get current tenant ID (from session)
export function useTenantId() {
  const { data: session } = useSession();
  return (session?.user as any)?.tenantId || null;
}

// Helper hook to get current user role
export function useUserRole() {
  const { data: session } = useSession();
  return (session?.user as any)?.role || null;
}

// Basic role-based permission map for quick client-side checks
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  ADMIN: ["*"],
  MANAGER: ["reports:*", "payments:approve", "bills:view"],
  ACCOUNTANT: ["billing:*", "payments:*", "reports:*", "bills:*"],
  BOOKKEEPER: ["payments:create", "payments:view", "bills:view"],
  CLERK: ["readings:create", "readings:view"],
  UNIT_OWNER: ["bills:view:own", "payments:view:own"],
};

// Helper hook to check permission (basic role-based)
export function useHasPermission(permission: string): boolean {
  const role = useUserRole();

  if (!role) return false;

  // SUPER_ADMIN and ADMIN have all permissions
  if (role === "SUPER_ADMIN" || role === "ADMIN") {
    return true;
  }

  const permissions = ROLE_PERMISSIONS[role] || [];

  // Check if permission matches (supports wildcards)
  return permissions.some((p) => {
    if (p === "*") return true;
    if (p.endsWith(":*")) {
      return permission.startsWith(p.replace(":*", ":"));
    }
    return p === permission;
  });
}

// Interface for menu permissions from API
interface MenuPermission {
  id: string;
  name: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

// Hook to get user's menu permissions from API
export function useMenuPermissions() {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<MenuPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/menus/user");
        if (res.ok) {
          const data = await res.json();
          // Flatten the hierarchical structure
          const flattenMenus = (menus: any[]): MenuPermission[] => {
            const result: MenuPermission[] = [];
            for (const menu of menus) {
              result.push({
                id: menu.id,
                name: menu.name,
                canView: menu.canView,
                canCreate: menu.canCreate,
                canEdit: menu.canEdit,
                canDelete: menu.canDelete,
                canExport: menu.canExport,
              });
              if (menu.children) {
                result.push(...flattenMenus(menu.children));
              }
            }
            return result;
          };
          setPermissions(flattenMenus(data));
        }
      } catch (error) {
        console.error("Failed to fetch menu permissions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPermissions();
  }, [session]);

  // Helper to check specific menu permission
  const hasPermission = (
    menuName: string,
    permission: "canView" | "canCreate" | "canEdit" | "canDelete" | "canExport"
  ): boolean => {
    const menu = permissions.find((p) => p.name === menuName);
    return menu?.[permission] ?? false;
  };

  return { permissions, loading, hasPermission };
}

// Export the full client for advanced usage
export default authClient;
