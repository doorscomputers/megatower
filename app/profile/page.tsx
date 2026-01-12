"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { User, Lock, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

interface Profile {
  id: string
  email: string
  username: string | null
  displayUsername: string | null
  firstName: string
  lastName: string
  phoneNumber: string | null
  role: string
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
}

const ROLES: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: "Super Admin", color: "bg-red-600" },
  ADMIN: { label: "Admin", color: "bg-purple-600" },
  MANAGER: { label: "Manager", color: "bg-blue-600" },
  ACCOUNTANT: { label: "Accountant", color: "bg-green-600" },
  BOOKKEEPER: { label: "Bookkeeper", color: "bg-yellow-600" },
  CLERK: { label: "Clerk", color: "bg-gray-600" },
  UNIT_OWNER: { label: "Unit Owner", color: "bg-teal-600" },
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)

  // Profile form
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")

  // Password form
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile")
      if (!res.ok) throw new Error("Failed to fetch profile")
      const data = await res.json()
      setProfile(data)
      setFirstName(data.firstName)
      setLastName(data.lastName)
      setEmail(data.email)
      setUsername(data.displayUsername || "")
      setPhoneNumber(data.phoneNumber || "")
    } catch (error) {
      toast.error("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!firstName || !lastName) {
      toast.error("First name and last name are required")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          username: username || null,
          phoneNumber: phoneNumber || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update profile")
      }

      const data = await res.json()
      setProfile((prev) => (prev ? { ...prev, ...data } : null))
      toast.success("Profile updated successfully")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All password fields are required")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to change password")
      }

      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setChangingPassword(false)
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

  const roleInfo = ROLES[profile?.role || "CLERK"]

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500">Manage your account settings</p>
        </div>

        {/* Profile Info Card */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-gray-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {profile?.firstName} {profile?.lastName}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`${roleInfo.color} text-white`}>
                  {roleInfo.label}
                </Badge>
                {profile?.isActive ? (
                  <Badge className="bg-green-600 text-white">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="09171234567"
              />
            </div>

            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="h-6 w-6 text-gray-500" />
            <h2 className="text-xl font-semibold">Change Password</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Change Password
            </Button>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
          <p>
            <strong>Account created:</strong>{" "}
            {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "N/A"}
          </p>
          {profile?.lastLoginAt && (
            <p>
              <strong>Last login:</strong>{" "}
              {new Date(profile.lastLoginAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
