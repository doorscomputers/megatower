import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth, requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    const { tenantId, role } = await requireAuth(await headers())

    // Only SUPER_ADMIN and ADMIN can view users
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId: tenantId,
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
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    })

    // Transform to include computed name field
    const transformedUsers = users.map((user) => ({
      ...user,
      name: `${user.firstName} ${user.lastName}`,
      ownerName: user.owner
        ? `${user.owner.lastName}, ${user.owner.firstName}`
        : null,
    }))

    return NextResponse.json(transformedUsers)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const { tenantId, role, user: currentUser } = await requireAuth(await headers())

    // Only SUPER_ADMIN and ADMIN can create users
    if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
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
    if (!email || !password || !firstName || !lastName || !userRole) {
      return NextResponse.json(
        { error: "Email, password, first name, last name, and role are required" },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      )
    }

    // Check if username already exists (if provided)
    if (username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      })

      if (existingUsername) {
        return NextResponse.json(
          { error: "A user with this username already exists" },
          { status: 400 }
        )
      }
    }

    // Only SUPER_ADMIN can create another SUPER_ADMIN
    if (userRole === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only Super Admin can create another Super Admin" },
        { status: 403 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        username: username?.toLowerCase() || null,
        displayUsername: username || null,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber: phoneNumber || null,
        role: userRole,
        tenantId,
        ownerId: ownerId || null,
        isActive: isActive ?? true,
        createdBy: currentUser.id,
      },
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

    // Create Better Auth Account record for login
    await prisma.account.create({
      data: {
        userId: newUser.id,
        accountId: email,
        providerId: "credential",
        password: hashedPassword,
      },
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    )
  }
}
