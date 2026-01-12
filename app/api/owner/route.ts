import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Get owner's dashboard data (units, balances, summary)
 * Auto-filtered to the logged-in owner's data
 */
export async function GET() {
  try {
    const { user, tenantId } = await requireAuth(await headers())

    // Get owner ID from user
    const ownerId = user.ownerId

    if (!ownerId) {
      return NextResponse.json(
        { error: "No owner account linked to this user" },
        { status: 400 }
      )
    }

    // Get owner with units
    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      include: {
        units: {
          where: { isActive: true },
          select: {
            id: true,
            unitNumber: true,
            floorLevel: true,
            area: true,
            unitType: true,
          },
        },
      },
    })

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 })
    }

    const unitIds = owner.units.map((u) => u.id)

    // Get all unpaid/partial bills for owner's units
    const unpaidBills = await prisma.bill.findMany({
      where: {
        unitId: { in: unitIds },
        status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
      },
      select: {
        id: true,
        billNumber: true,
        billingMonth: true,
        totalAmount: true,
        paidAmount: true,
        balance: true,
        status: true,
        dueDate: true,
        unitId: true,
        unit: {
          select: { unitNumber: true },
        },
      },
      orderBy: { billingMonth: "desc" },
    })

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      where: {
        unitId: { in: unitIds },
        status: "CONFIRMED",
      },
      select: {
        id: true,
        orNumber: true,
        paymentDate: true,
        totalAmount: true,
        paymentMethod: true,
        unit: {
          select: { unitNumber: true },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: 5,
    })

    // Calculate summary
    const totalBalance = unpaidBills.reduce(
      (sum, bill) => sum + Number(bill.balance),
      0
    )
    const overdueCount = unpaidBills.filter((b) => b.status === "OVERDUE").length

    // Get total paid this year
    const startOfYear = new Date(new Date().getFullYear(), 0, 1)
    const totalPaidThisYear = await prisma.payment.aggregate({
      where: {
        unitId: { in: unitIds },
        status: "CONFIRMED",
        paymentDate: { gte: startOfYear },
      },
      _sum: { totalAmount: true },
    })

    // Format owner name
    const ownerName = `${owner.lastName}, ${owner.firstName}${owner.middleName ? ` ${owner.middleName.charAt(0)}.` : ''}`

    return NextResponse.json({
      owner: {
        id: owner.id,
        name: ownerName,
        lastName: owner.lastName,
        firstName: owner.firstName,
        middleName: owner.middleName,
        email: owner.email,
        phone: owner.phone,
      },
      units: owner.units.map((u) => ({
        ...u,
        area: Number(u.area),
      })),
      summary: {
        totalUnits: owner.units.length,
        totalBalance,
        unpaidBillsCount: unpaidBills.length,
        overdueCount,
        totalPaidThisYear: Number(totalPaidThisYear._sum.totalAmount || 0),
      },
      unpaidBills: unpaidBills.map((b) => ({
        ...b,
        totalAmount: Number(b.totalAmount),
        paidAmount: Number(b.paidAmount),
        balance: Number(b.balance),
      })),
      recentPayments: recentPayments.map((p) => ({
        ...p,
        amount: Number(p.totalAmount),
      })),
    })
  } catch (error: any) {
    console.error("Error fetching owner data:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch owner data" },
      { status: 500 }
    )
  }
}
