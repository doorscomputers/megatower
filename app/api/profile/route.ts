import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET /api/profile - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(await headers())

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        username: true,
        displayUsername: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }
}

// PUT /api/profile - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAuth(await headers())
    const body = await request.json()
    const { firstName, lastName, phoneNumber, email, username } = body

    // Validate required fields
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      )
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findFirst({
        where: { email, id: { not: user.id } },
      })
      if (existingUser) {
        return NextResponse.json(
          { error: "Email is already taken" },
          { status: 400 }
        )
      }
    }

    // Check if username is being changed and if it's already taken
    if (username) {
      const normalizedUsername = username.toLowerCase()
      const existingUser = await prisma.user.findFirst({
        where: { username: normalizedUsername, id: { not: user.id } },
      })
      if (existingUser) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        phoneNumber: phoneNumber || null,
        email: email || user.email,
        username: username ? username.toLowerCase() : null,
        displayUsername: username || null,
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
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
