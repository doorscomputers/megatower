import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { getUserAccessibleMenus } from "@/lib/permissions"
import { UserRole } from "@prisma/client"

// GET /api/menus/user - Get menus for current user based on role and permissions
export async function GET(request: NextRequest) {
  try {
    const { user, role } = await requireAuth(await headers())

    const menus = await getUserAccessibleMenus(user.id, role as UserRole)

    return NextResponse.json(menus)
  } catch (error) {
    console.error("Error fetching user menus:", error)
    return NextResponse.json(
      { error: "Failed to fetch menus" },
      { status: 500 }
    )
  }
}
