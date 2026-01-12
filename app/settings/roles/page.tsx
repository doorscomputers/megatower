"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Shield, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Role {
  id: string
  name: string
  label: string
  description: string | null
  color: string
  isSystem: boolean
  isActive: boolean
  order: number
  createdAt: string
}

const COLORS = [
  { value: "bg-red-600", label: "Red" },
  { value: "bg-purple-600", label: "Purple" },
  { value: "bg-blue-600", label: "Blue" },
  { value: "bg-green-600", label: "Green" },
  { value: "bg-yellow-600", label: "Yellow" },
  { value: "bg-orange-600", label: "Orange" },
  { value: "bg-teal-600", label: "Teal" },
  { value: "bg-pink-600", label: "Pink" },
  { value: "bg-indigo-600", label: "Indigo" },
  { value: "bg-gray-600", label: "Gray" },
]

const emptyRole = {
  name: "",
  label: "",
  description: "",
  color: "bg-gray-600",
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog states
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Form state
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState(emptyRole)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles")
      if (!res.ok) throw new Error("Failed to fetch roles")
      const data = await res.json()
      setRoles(data)
    } catch (error) {
      toast.error("Failed to load roles")
    } finally {
      setLoading(false)
    }
  }

  const openAddDialog = () => {
    setEditingRole(null)
    setFormData(emptyRole)
    setRoleDialogOpen(true)
  }

  const openEditDialog = (role: Role) => {
    setEditingRole(role)
    setFormData({
      name: role.name,
      label: role.label,
      description: role.description || "",
      color: role.color,
    })
    setRoleDialogOpen(true)
  }

  const openDeleteDialog = (role: Role) => {
    setRoleToDelete(role)
    setDeleteDialogOpen(true)
  }

  const handleSaveRole = async () => {
    if (!formData.name || !formData.label) {
      toast.error("Name and label are required")
      return
    }

    setSaving(true)
    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles"
      const method = editingRole ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save role")
      }

      toast.success(editingRole ? "Role updated successfully" : "Role created successfully")
      setRoleDialogOpen(false)
      fetchRoles()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!roleToDelete) return

    setSaving(true)
    try {
      const res = await fetch(`/api/roles/${roleToDelete.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete role")
      }

      toast.success("Role deleted successfully")
      setDeleteDialogOpen(false)
      fetchRoles()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
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
            <h1 className="text-3xl font-bold text-gray-900">Roles Management</h1>
            <p className="text-gray-500">Create and manage user roles</p>
          </div>
          <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        </div>

        {/* Roles List */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="grid grid-cols-6 gap-4 p-4 bg-gray-50 border-b font-medium text-sm text-gray-600">
            <div>Name</div>
            <div>Label</div>
            <div>Description</div>
            <div>Color</div>
            <div>Type</div>
            <div>Actions</div>
          </div>

          {roles.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No roles found. Click "Add Role" to create one.
            </div>
          ) : (
            <div className="divide-y">
              {roles.map((role) => (
                <div key={role.id} className="grid grid-cols-6 gap-4 p-4 items-center">
                  <div className="font-mono text-sm">{role.name}</div>
                  <div className="font-medium">{role.label}</div>
                  <div className="text-sm text-gray-500 truncate">
                    {role.description || "-"}
                  </div>
                  <div>
                    <Badge className={`${role.color} text-white`}>Sample</Badge>
                  </div>
                  <div>
                    {role.isSystem ? (
                      <Badge variant="secondary">System</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700">Custom</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(role)}
                      title="Edit Role"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(role)}
                        title="Delete Role"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">About Roles</h3>
              <p className="text-sm text-blue-700 mt-1">
                Roles define what permissions users have in the system. After creating a role,
                go to <strong>Menu Permissions</strong> to configure what each role can access.
                System roles cannot be deleted but can be edited.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Role Add/Edit Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Add New Role"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "Update role information" : "Create a new role for the system"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., SUPERVISOR"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                Will be converted to UPPERCASE_WITH_UNDERSCORES
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Display Label *</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Supervisor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this role can do..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Badge Color</Label>
              <Select
                value={formData.color}
                onValueChange={(value) => setFormData({ ...formData, color: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded ${color.value}`} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-3 bg-gray-50 rounded-lg">
                <Badge className={`${formData.color} text-white`}>
                  {formData.label || "Role Label"}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRole ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role{" "}
              <strong>{roleToDelete?.label}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
