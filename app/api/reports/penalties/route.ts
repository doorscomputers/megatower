import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Penalty Report
 * Track penalty charges and collections
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

    const startOfYear = new Date(Date.UTC(year, 0, 1))
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

    // Get all bills with penalties for the year
    const billsWithPenalties = await prisma.bill.findMany({
      where: {
        tenantId,
        billingMonth: {
          gte: startOfYear,
          lte: endOfYear
        },
        penaltyAmount: { gt: 0 }
      },
      include: {
        unit: {
          select: {
            unitNumber: true,
            floorLevel: true
          }
        }
      },
      orderBy: {
        billingMonth: 'asc'
      }
    })

    // Get penalty payments for the year
    const penaltyPayments = await prisma.payment.findMany({
      where: {
        tenantId,
        status: 'CONFIRMED',
        paymentDate: {
          gte: startOfYear,
          lte: endOfYear
        },
        pastDuesAmount: { gt: 0 }
      },
      select: {
        paymentDate: true,
        pastDuesAmount: true
      }
    })

    // Group by month
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]

    const monthlyData: Array<{
      month: number
      monthName: string
      charged: number
      collected: number
      outstanding: number
      billsCount: number
    }> = []

    for (let month = 0; month < 12; month++) {
      const monthBills = billsWithPenalties.filter(b => {
        const billMonth = new Date(b.billingMonth)
        return billMonth.getUTCMonth() === month
      })

      const charged = monthBills.reduce((sum, b) => sum + Number(b.penaltyAmount), 0)

      const monthPayments = penaltyPayments.filter(p => {
        const payDate = new Date(p.paymentDate)
        return payDate.getMonth() === month
      })

      const collected = monthPayments.reduce((sum, p) => sum + Number(p.pastDuesAmount), 0)

      monthlyData.push({
        month: month + 1,
        monthName: monthNames[month],
        charged,
        collected,
        outstanding: charged - collected,
        billsCount: monthBills.length
      })
    }

    // Get units with outstanding penalties
    const unitsWithPenalties = await prisma.bill.findMany({
      where: {
        tenantId,
        penaltyAmount: { gt: 0 },
        balance: { gt: 0 },
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
      },
      include: {
        unit: {
          include: {
            owner: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        penaltyAmount: 'desc'
      },
      take: 20
    })

    const topPenaltyUnits = unitsWithPenalties.map(bill => ({
      unitNumber: bill.unit.unitNumber,
      ownerName: bill.unit.owner
        ? `${bill.unit.owner.lastName}, ${bill.unit.owner.firstName}`
        : 'No Owner',
      billingMonth: bill.billingMonth,
      penaltyAmount: Number(bill.penaltyAmount),
      balance: Number(bill.balance)
    }))

    // Year totals
    const ytdCharged = monthlyData.reduce((sum, m) => sum + m.charged, 0)
    const ytdCollected = monthlyData.reduce((sum, m) => sum + m.collected, 0)
    const totalBillsWithPenalty = monthlyData.reduce((sum, m) => sum + m.billsCount, 0)

    // Total outstanding penalties (all time)
    const allOutstandingPenalties = await prisma.bill.findMany({
      where: {
        tenantId,
        penaltyAmount: { gt: 0 },
        balance: { gt: 0 },
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
      },
      select: {
        penaltyAmount: true,
        balance: true,
        totalAmount: true
      }
    })

    // Estimate outstanding penalty portion
    let totalOutstandingPenalties = 0
    for (const bill of allOutstandingPenalties) {
      const total = Number(bill.totalAmount)
      if (total > 0) {
        const ratio = Number(bill.balance) / total
        totalOutstandingPenalties += Number(bill.penaltyAmount) * ratio
      }
    }

    return NextResponse.json({
      success: true,
      year,
      monthlyData,
      topPenaltyUnits,
      summary: {
        ytdCharged,
        ytdCollected,
        totalOutstandingPenalties,
        totalBillsWithPenalty,
        collectionRate: ytdCharged > 0 ? Math.round((ytdCollected / ytdCharged) * 100) : 0
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating penalty report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
