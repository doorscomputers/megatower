import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Bill Status Report
 * Detailed breakdown of all bills by status
 */
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : null
    const statusFilter = searchParams.get("status") || ""
    const floorFilter = searchParams.get("floor") || ""

    // Build date range
    let startDate: Date, endDate: Date
    if (month) {
      startDate = new Date(Date.UTC(year, month - 1, 1))
      endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
    } else {
      startDate = new Date(Date.UTC(year, 0, 1))
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
    }

    // Build where clause
    const where: any = {
      tenantId,
      billingMonth: { gte: startDate, lte: endDate }
    }

    if (statusFilter) {
      where.status = statusFilter
    }

    if (floorFilter) {
      where.unit = { floorLevel: floorFilter }
    }

    // Get bills with unit info
    const bills = await prisma.bill.findMany({
      where,
      include: {
        unit: {
          select: {
            unitNumber: true,
            floorLevel: true,
            owner: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: [
        { billingMonth: 'desc' },
        { unit: { unitNumber: 'asc' } }
      ]
    })

    // Process bills
    const billData = bills.map(b => ({
      id: b.id,
      billNumber: b.billNumber,
      billingMonth: b.billingMonth.toISOString(),
      unitNumber: b.unit?.unitNumber || 'N/A',
      floorLevel: b.unit?.floorLevel || 'N/A',
      ownerName: `${b.unit?.owner?.firstName || ''} ${b.unit?.owner?.lastName || ''}`.trim() || 'N/A',
      status: b.status,
      totalAmount: Number(b.totalAmount),
      balance: Number(b.balance),
      dueDate: b.dueDate?.toISOString() || null,
      electric: Number(b.electricAmount),
      water: Number(b.waterAmount),
      dues: Number(b.associationDues),
      penalty: Number(b.penaltyAmount),
      spAssessment: Number(b.spAssessment),
      isOverdue: b.dueDate && new Date() > new Date(b.dueDate) && Number(b.balance) > 0
    }))

    // Status summary
    const statusSummary = {
      PAID: { count: 0, total: 0 },
      PARTIAL: { count: 0, total: 0, balance: 0 },
      PENDING: { count: 0, total: 0, balance: 0 },
      UNPAID: { count: 0, total: 0, balance: 0 },
      OVERDUE: { count: 0, total: 0, balance: 0 },
      DRAFT: { count: 0, total: 0 }
    }

    for (const bill of billData) {
      const status = bill.status as keyof typeof statusSummary
      if (statusSummary[status]) {
        statusSummary[status].count++
        statusSummary[status].total += bill.totalAmount
        if ('balance' in statusSummary[status]) {
          (statusSummary[status] as any).balance += bill.balance
        }
      }
    }

    // Floor breakdown
    const floorBreakdown: Record<string, {
      total: number
      paid: number
      unpaid: number
      balance: number
    }> = {}

    for (const bill of billData) {
      if (!floorBreakdown[bill.floorLevel]) {
        floorBreakdown[bill.floorLevel] = { total: 0, paid: 0, unpaid: 0, balance: 0 }
      }
      floorBreakdown[bill.floorLevel].total++
      if (bill.status === 'PAID') {
        floorBreakdown[bill.floorLevel].paid++
      } else {
        floorBreakdown[bill.floorLevel].unpaid++
        floorBreakdown[bill.floorLevel].balance += bill.balance
      }
    }

    // Monthly breakdown (if year view)
    const monthlyBreakdown: Array<{
      month: number
      monthName: string
      total: number
      paid: number
      partial: number
      unpaid: number
      overdue: number
      totalAmount: number
      collectedAmount: number
    }> = []

    if (!month) {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ]

      for (let m = 0; m < 12; m++) {
        const monthBills = billData.filter(b => {
          const bMonth = new Date(b.billingMonth)
          return bMonth.getUTCMonth() === m
        })

        const totalAmount = monthBills.reduce((sum, b) => sum + b.totalAmount, 0)
        const collectedAmount = monthBills.reduce((sum, b) => sum + (b.totalAmount - b.balance), 0)

        monthlyBreakdown.push({
          month: m + 1,
          monthName: monthNames[m],
          total: monthBills.length,
          paid: monthBills.filter(b => b.status === 'PAID').length,
          partial: monthBills.filter(b => b.status === 'PARTIAL').length,
          unpaid: monthBills.filter(b => ['UNPAID', 'PENDING'].includes(b.status)).length,
          overdue: monthBills.filter(b => b.status === 'OVERDUE').length,
          totalAmount,
          collectedAmount
        })
      }
    }

    // Summary
    const summary = {
      totalBills: billData.length,
      totalAmount: billData.reduce((sum, b) => sum + b.totalAmount, 0),
      totalBalance: billData.reduce((sum, b) => sum + b.balance, 0),
      paidPercentage: billData.length > 0
        ? Math.round((statusSummary.PAID.count / billData.length) * 100)
        : 0,
      overdueBills: billData.filter(b => b.isOverdue).length,
      overdueAmount: billData.filter(b => b.isOverdue).reduce((sum, b) => sum + b.balance, 0)
    }

    return NextResponse.json({
      success: true,
      year,
      month,
      bills: billData,
      statusSummary,
      floorBreakdown,
      monthlyBreakdown,
      summary,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating bill status report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
