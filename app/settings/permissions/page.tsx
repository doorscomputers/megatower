"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Shield, Loader2, Save, RotateCcw } from "lucide-react"
import { toast } from "sonner"

interface Menu {
  id: string
  name: string
  label: string
  icon: string | null
  path: string | null
  parentId: string | null
  order: number
  children?: Menu[]
}

interface RolePermissions {
  role: string
  permissions: Record<string, {
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canExport: boolean
  }>
}

interface Role {
  id: string
  name: string
  label: string
  color: string
  isSystem: boolean
}

const PERMISSION_TYPES = ["canView", "canCreate", "canEdit", "canDelete", "canExport"] as const

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [menus, setMenus] = useState<Menu[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [rolesData, setRolesData] = useState<RolePermissions[]>([])
  const [selectedRole, setSelectedRole] = useState("")
  const [changes, setChanges] = useState<Record<string, any>>({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchRoles()
    fetchPermissions()
  }, [])

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles")
      if (!res.ok) throw new Error("Failed to fetch roles")
      const data = await res.json()
      setRoles(data)
      // Set default selected role to first non-SUPER_ADMIN role
      if (data.length > 0 && !selectedRole) {
        const defaultRole = data.find((r: Role) => r.name === "ADMIN") || data[0]
        setSelectedRole(defaultRole.name)
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error)
    }
  }

  const fetchPermissions = async () => {
    try {
      const res = await fetch("/api/permissions/roles")
      if (!res.ok) throw new Error("Failed to fetch permissions")
      const data = await res.json()
      setMenus(data.menus)
      setRolesData(data.roles)
    } catch (error) {
      toast.error("Failed to load permissions")
    } finally {
      setLoading(false)
    }
  }

  const getCurrentRoleData = () => {
    return rolesData.find((r) => r.role === selectedRole)
  }

  const getPermission = (menuId: string, permType: string): boolean => {
    // Check changes first
    if (changes[menuId]?.[permType] !== undefined) {
      return changes[menuId][permType]
    }
    // Fall back to original data
    const roleData = getCurrentRoleData()
    return roleData?.permissions[menuId]?.[permType as keyof typeof roleData.permissions[string]] ?? false
  }

  const handlePermissionChange = (menuId: string, permType: string, value: boolean) => {
    setChanges((prev) => ({
      ...prev,
      [menuId]: {
        ...prev[menuId],
        menuId,
        [permType]: value,
      },
    }))
    setHasChanges(true)
  }

  const handleSelectAll = (menuId: string, checked: boolean) => {
    const newPerms: any = { menuId }
    for (const perm of PERMISSION_TYPES) {
      newPerms[perm] = checked
    }
    setChanges((prev) => ({
      ...prev,
      [menuId]: newPerms,
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (Object.keys(changes).length === 0) {
      toast.info("No changes to save")
      return
    }

    setSaving(true)
    try {
      const permissions = Object.values(changes).map((change: any) => {
        const roleData = getCurrentRoleData()
        const original: any = roleData?.permissions[change.menuId] || {}
        return {
          menuId: change.menuId,
          canView: change.canView ?? original.canView ?? false,
          canCreate: change.canCreate ?? original.canCreate ?? false,
          canEdit: change.canEdit ?? original.canEdit ?? false,
          canDelete: change.canDelete ?? original.canDelete ?? false,
          canExport: change.canExport ?? original.canExport ?? false,
        }
      })

      const res = await fetch("/api/permissions/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole, permissions }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save")
      }

      toast.success("Permissions saved successfully")
      setChanges({})
      setHasChanges(false)
      fetchPermissions() // Refresh data
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setChanges({})
    setHasChanges(false)
  }

  const handleRoleChange = (role: string) => {
    if (hasChanges) {
      if (!confirm("You have unsaved changes. Discard them?")) {
        return
      }
    }
    setSelectedRole(role)
    setChanges({})
    setHasChanges(false)
  }

  const getRoleInfo = (roleName: string) => {
    const role = roles.find((r) => r.name === roleName)
    return role || { name: roleName, label: roleName, color: "bg-gray-600" }
  }

  const renderMenuRow = (menu: Menu, level: number = 0) => {
    const allChecked = PERMISSION_TYPES.every((p) => getPermission(menu.id, p))
    const someChecked = PERMISSION_TYPES.some((p) => getPermission(menu.id, p))

    return (
      <div key={menu.id}>
        <div
          className={`grid grid-cols-7 gap-2 py-2 px-3 border-b hover:bg-gray-50 ${
            level === 0 ? "bg-gray-50 font-medium" : ""
          }`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          <div className="col-span-2 flex items-center gap-2">
            <Checkbox
              checked={allChecked}
              ref={(el) => {
                if (el) {
                  (el as any).indeterminate = someChecked && !allChecked
                }
              }}
              onCheckedChange={(checked) => handleSelectAll(menu.id, checked as boolean)}
            />
            <span className="text-sm">{menu.label}</span>
            {menu.path && (
              <span className="text-xs text-gray-400">{menu.path}</span>
            )}
          </div>
          {PERMISSION_TYPES.map((perm) => (
            <div key={perm} className="flex items-center justify-center">
              <Checkbox
                checked={getPermission(menu.id, perm)}
                onCheckedChange={(checked) =>
                  handlePermissionChange(menu.id, perm, checked as boolean)
                }
              />
            </div>
          ))}
        </div>
        {menu.children?.map((child) => renderMenuRow(child, level + 1))}
      </div>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  const roleInfo = getRoleInfo(selectedRole)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Role Permissions</h1>
            <p className="text-gray-500">
              Configure default menu permissions for each role
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Role Selector */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-4">
            <Shield className="h-5 w-5 text-gray-500" />
            <span className="font-medium">Select Role:</span>
            <Select value={selectedRole} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.name} value={role.name}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${role.color}`} />
                      {role.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className={`${roleInfo.color} text-white`}>
              {roleInfo.label}
            </Badge>
            {hasChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Unsaved Changes
              </Badge>
            )}
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-7 gap-2 py-3 px-3 bg-gray-100 font-medium text-sm border-b">
            <div className="col-span-2">Menu</div>
            <div className="text-center">View</div>
            <div className="text-center">Create</div>
            <div className="text-center">Edit</div>
            <div className="text-center">Delete</div>
            <div className="text-center">Export</div>
          </div>

          {/* Menu rows */}
          <div className="max-h-[60vh] overflow-y-auto">
            {menus.map((menu) => renderMenuRow(menu))}
          </div>
        </div>

        {/* Help text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">How permissions work:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>View</strong> - Can see the menu and access the page</li>
            <li><strong>Create</strong> - Can add new records</li>
            <li><strong>Edit</strong> - Can modify existing records</li>
            <li><strong>Delete</strong> - Can remove records</li>
            <li><strong>Export</strong> - Can download/export data</li>
          </ul>
          <p className="mt-2 text-blue-600">
            Note: Individual users can have custom overrides set from the User Management page.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
