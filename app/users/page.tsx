"use client"

import { useEffect, useState, useRef } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Toolbar,
  Item,
} from "devextreme-react/data-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Plus, Pencil, Trash2, Shield, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Owner {
  id: string
  firstName: string
  lastName: string
}

interface User {
  id: string
  email: string
  username: string | null
  displayUsername: string | null
  firstName: string
  lastName: string
  phoneNumber: string | null
  role: string
  ownerId: string | null
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  name: string
  ownerName: string | null
  owner?: Owner | null
}

interface MenuPermission {
  id: string
  name: string
  label: string
  icon: string | null
  path: string | null
  parentId: string | null
  order: number
  rolePermissions: {
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canExport: boolean
  }
  userOverrides: {
    id: string
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canExport: boolean
  } | null
  effectivePermissions: {
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canExport: boolean
  }
  children?: MenuPermission[]
}

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin", color: "bg-red-600" },
  { value: "ADMIN", label: "Admin", color: "bg-purple-600" },
  { value: "MANAGER", label: "Manager", color: "bg-blue-600" },
  { value: "ACCOUNTANT", label: "Accountant", color: "bg-green-600" },
  { value: "BOOKKEEPER", label: "Bookkeeper", color: "bg-yellow-600" },
  { value: "CLERK", label: "Clerk", color: "bg-gray-600" },
  { value: "UNIT_OWNER", label: "Unit Owner", color: "bg-teal-600" },
]

const DEFAULT_PASSWORD = "Megatower@123"

const emptyUser = {
  email: "",
  username: "",
  password: "",
  firstName: "",
  lastName: "",
  phoneNumber: "",
  role: "CLERK",
  ownerId: "",
  isActive: true,
  useDefaultPassword: true,
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const gridRef = useRef<any>(null)

  // Dialog states
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false)

  // Form state
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState(emptyUser)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  // Permission state
  const [permissionUser, setPermissionUser] = useState<User | null>(null)
  const [menuPermissions, setMenuPermissions] = useState<MenuPermission[]>([])
  const [permissionChanges, setPermissionChanges] = useState<Record<string, any>>({})
  const [loadingPermissions, setLoadingPermissions] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchOwners()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const fetchOwners = async () => {
    try {
      const res = await fetch("/api/owners")
      if (!res.ok) throw new Error("Failed to fetch owners")
      const data = await res.json()
      setOwners(data)
    } catch (error) {
      console.error("Failed to load owners")
    }
  }

  const openAddDialog = () => {
    setEditingUser(null)
    setFormData(emptyUser)
    setUserDialogOpen(true)
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      username: user.displayUsername || "",
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber || "",
      role: user.role,
      ownerId: user.ownerId || "",
      isActive: user.isActive,
      useDefaultPassword: false,
    })
    setUserDialogOpen(true)
  }

  const openDeleteDialog = (user: User) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const openPermissionDialog = async (user: User) => {
    setPermissionUser(user)
    setPermissionChanges({})
    setLoadingPermissions(true)
    setPermissionDialogOpen(true)

    try {
      const res = await fetch(`/api/permissions/user/${user.id}`)
      if (!res.ok) throw new Error("Failed to fetch permissions")
      const data = await res.json()
      setMenuPermissions(data.menus)
    } catch (error) {
      toast.error("Failed to load permissions")
    } finally {
      setLoadingPermissions(false)
    }
  }

  const handleSaveUser = async () => {
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.role) {
      toast.error("Please fill in all required fields")
      return
    }

    // For new users, require either default password or custom password
    if (!editingUser && !(formData as any).useDefaultPassword && !formData.password) {
      toast.error("Password is required for new users")
      return
    }

    setSaving(true)
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users"
      const method = editingUser ? "PUT" : "POST"

      const payload: any = {
        email: formData.email,
        username: formData.username || null,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber || null,
        role: formData.role,
        ownerId: formData.ownerId || null,
        isActive: formData.isActive,
      }

      // Use default password or custom password
      if (!editingUser && (formData as any).useDefaultPassword) {
        payload.password = DEFAULT_PASSWORD
      } else if (formData.password) {
        payload.password = formData.password
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save user")
      }

      toast.success(editingUser ? "User updated successfully" : "User created successfully")
      setUserDialogOpen(false)
      fetchUsers()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    setSaving(true)
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete user")
      }

      toast.success("User deleted successfully")
      setDeleteDialogOpen(false)
      fetchUsers()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePermissionChange = (menuId: string, permission: string, value: boolean) => {
    setPermissionChanges((prev) => ({
      ...prev,
      [menuId]: {
        ...prev[menuId],
        menuId,
        [permission]: value,
      },
    }))
  }

  const handleSavePermissions = async () => {
    if (!permissionUser || Object.keys(permissionChanges).length === 0) {
      setPermissionDialogOpen(false)
      return
    }

    setSaving(true)
    try {
      const permissions = Object.values(permissionChanges)

      const res = await fetch(`/api/permissions/user/${permissionUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save permissions")
      }

      toast.success("Permissions updated successfully")
      setPermissionDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const getRoleInfo = (role: string) => ROLES.find((r) => r.value === role) || ROLES[5]

  const roleCellRender = (data: any) => {
    const roleInfo = getRoleInfo(data.value)
    return <Badge className={`${roleInfo.color} text-white`}>{roleInfo.label}</Badge>
  }

  const statusCellRender = (data: any) => {
    return data.value ? (
      <Badge className="bg-green-600 text-white">Active</Badge>
    ) : (
      <Badge variant="secondary">Inactive</Badge>
    )
  }

  const actionsCellRender = (data: any) => {
    const user = data.data
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} title="Edit User">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openPermissionDialog(user)}
          title="Manage Permissions"
        >
          <Shield className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openDeleteDialog(user)}
          title="Delete User"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const renderPermissionRow = (menu: MenuPermission, level: number = 0) => {
    const changes = permissionChanges[menu.id] || {}
    const getEffective = (perm: string) => {
      if (changes[perm] !== undefined) return changes[perm]
      return menu.effectivePermissions[perm as keyof typeof menu.effectivePermissions]
    }

    const isOverridden = (perm: string) => {
      return changes[perm] !== undefined || menu.userOverrides !== null
    }

    return (
      <div key={menu.id}>
        <div
          className={`grid grid-cols-6 gap-2 py-2 px-2 ${level > 0 ? "ml-6" : ""} ${
            level === 0 ? "bg-gray-50 font-medium" : ""
          }`}
        >
          <div className="col-span-1 text-sm">{menu.label}</div>
          {["canView", "canCreate", "canEdit", "canDelete", "canExport"].map((perm) => (
            <div key={perm} className="flex items-center justify-center">
              <Checkbox
                checked={getEffective(perm)}
                onCheckedChange={(checked) =>
                  handlePermissionChange(menu.id, perm, checked as boolean)
                }
                className={isOverridden(perm) ? "border-blue-500" : ""}
              />
            </div>
          ))}
        </div>
        {menu.children?.map((child) => renderPermissionRow(child, level + 1))}
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-500">Manage users, roles, and permissions</p>
          </div>
          <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-500">Active Users</p>
                <p className="text-2xl font-bold">{users.filter((u) => u.isActive).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Admins</p>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.role === "SUPER_ADMIN" || u.role === "ADMIN").length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-teal-600" />
              <div>
                <p className="text-sm text-gray-500">Unit Owners</p>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.role === "UNIT_OWNER").length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <DataGrid
            ref={gridRef}
            dataSource={users}
            keyExpr="id"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            columnAutoWidth={true}
          >
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
            />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel visible={true} placeholder="Search users..." />

            <Column dataField="firstName" caption="First Name" width={120} />
            <Column dataField="lastName" caption="Last Name" width={120} />
            <Column dataField="email" caption="Email" width={200} />
            <Column dataField="displayUsername" caption="Username" width={120} />
            <Column dataField="role" caption="Role" width={130} cellRender={roleCellRender} />
            <Column
              dataField="ownerName"
              caption="Linked Owner"
              width={150}
              cellRender={(data: any) =>
                data.value ? (
                  <span className="text-sm">{data.value}</span>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )
              }
            />
            <Column
              dataField="isActive"
              caption="Status"
              width={100}
              cellRender={statusCellRender}
            />
            <Column
              caption="Actions"
              width={130}
              cellRender={actionsCellRender}
              allowFiltering={false}
              allowSorting={false}
            />

            <Toolbar>
              <Item location="before">
                <span className="text-gray-600 font-medium">Users</span>
              </Item>
              <Item name="searchPanel" />
            </Toolbar>
          </DataGrid>
        </div>
      </div>

      {/* User Add/Edit Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user information and settings"
                : "Create a new user account"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Dela Cruz"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="juan@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="juandc"
              />
            </div>

            {!editingUser && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useDefaultPassword"
                  checked={(formData as any).useDefaultPassword}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, useDefaultPassword: checked as boolean, password: "" } as any)
                  }
                />
                <Label htmlFor="useDefaultPassword" className="text-sm font-normal">
                  Use default password ({DEFAULT_PASSWORD})
                </Label>
              </div>
            )}

            {(editingUser || !(formData as any).useDefaultPassword) && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {editingUser ? "(leave blank to keep current)" : "*"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "••••••••" : "Enter password"}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="09171234567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.role === "UNIT_OWNER" && (
              <div className="space-y-2">
                <Label htmlFor="ownerId">Link to Owner</Label>
                <Select
                  value={formData.ownerId}
                  onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No owner linked</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.lastName}, {owner.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Link this user to an owner to allow them to view their SOA
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked as boolean })
                }
              />
              <Label htmlFor="isActive" className="text-sm font-normal">
                Active (user can login)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {userToDelete?.firstName} {userToDelete?.lastName}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Management Dialog */}
      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Manage Permissions - {permissionUser?.firstName} {permissionUser?.lastName}
            </DialogTitle>
            <DialogDescription>
              Role: <Badge className={getRoleInfo(permissionUser?.role || "").color + " text-white ml-1"}>
                {getRoleInfo(permissionUser?.role || "").label}
              </Badge>
              <span className="ml-2 text-xs">
                (Blue checkbox border = custom override)
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {loadingPermissions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-6 gap-2 py-2 px-2 bg-gray-100 font-medium text-sm border-b">
                  <div className="col-span-1">Menu</div>
                  <div className="text-center">View</div>
                  <div className="text-center">Create</div>
                  <div className="text-center">Edit</div>
                  <div className="text-center">Delete</div>
                  <div className="text-center">Export</div>
                </div>
                {/* Menu rows */}
                <div className="divide-y">
                  {menuPermissions.map((menu) => renderPermissionRow(menu))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setPermissionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
