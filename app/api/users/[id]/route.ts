import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET /api/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, role } = await requireAuth(await headers())
    const { id } = await params

    // Only SUPER_ADMIN and ADMIN can view users
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      )
    }

    const user = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayUsername: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        ownerId: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        menuPermissions: {
          include: {
            menu: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    )
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, role, user: currentUser } = await requireAuth(await headers())
    const { id } = await params

    // Only SUPER_ADMIN and ADMIN can update users
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      )
    }

    // Check if user exists and belongs to tenant
    const existingUser = await prisma.user.findFirst({
      where: { id, tenantId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Prevent editing SUPER_ADMIN by non-SUPER_ADMIN
    if (existingUser.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can edit another Super Admin" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      phoneNumber,
      role: userRole,
      ownerId,
      isActive,
    } = body

    // Validation
    if (!email || !firstName || !lastName || !userRole) {
      return NextResponse.json(
        { error: "Email, first name, last name, and role are required" },
        { status: 400 }
      )
    }

    // Check if email is being changed and already exists
    if (email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      })
      if (emailExists) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 400 }
        )
      }
    }

    // Check if username is being changed and already exists
    if (username && username.toLowerCase() !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      })
      if (usernameExists) {
        return NextResponse.json(
          { error: "A user with this username already exists" },
          { status: 400 }
        )
      }
    }

    // Only SUPER_ADMIN can change role to SUPER_ADMIN
    if (userRole === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can assign Super Admin role" },
        { status: 403 }
      )
    }

    // Build update data
    const updateData: any = {
      email,
      username: username?.toLowerCase() || null,
      displayUsername: username || null,
      firstName,
      lastName,
      phoneNumber: phoneNumber || null,
      role: userRole,
      ownerId: ownerId || null,
      isActive: isActive ?? true,
    }

    // If password is being changed, hash it
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)

      // Also update the Account record
      await prisma.account.updateMany({
        where: {
          userId: id,
          providerId: "credential",
        },
        data: {
          password: updateData.password,
        },
      })
    }

    // If email is being changed, update Account record
    if (email !== existingUser.email) {
      await prisma.account.updateMany({
        where: {
          userId: id,
          providerId: "credential",
        },
        data: {
          accountId: email,
        },
      })
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        ownerId: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, role, user: currentUser } = await requireAuth(await headers())
    const { id } = await params

    // Only SUPER_ADMIN and ADMIN can delete users
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      )
    }

    // Check if user exists and belongs to tenant
    const existingUser = await prisma.user.findFirst({
      where: { id, tenantId },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Cannot delete yourself
    if (id === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      )
    }

    // Prevent deleting SUPER_ADMIN by non-SUPER_ADMIN
    if (existingUser.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can delete another Super Admin" },
        { status: 403 }
      )
    }

    // Delete related records first
    await prisma.menuPermission.deleteMany({
      where: { userId: id },
    })

    await prisma.session.deleteMany({
      where: { userId: id },
    })

    await prisma.account.deleteMany({
      where: { userId: id },
    })

    await prisma.member.deleteMany({
      where: { userId: id },
    })

    // Delete the user
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}
