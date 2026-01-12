import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Collection Summary Report
 * Summarize payments received over a period
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
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const period = searchParams.get("period") || "month" // month, week, custom

    // Calculate date range based on period
    const now = new Date()
    let start: Date
    let end: Date

    if (startDate && endDate) {
      start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
    } else if (period === "week") {
      const dayOfWeek = now.getDay()
      start = new Date(now)
      start.setDate(now.getDate() - dayOfWeek)
      start.setHours(0, 0, 0, 0)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
    } else {
      // Default to current month
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
    }

    // Get payments for the date range
    const payments = await prisma.payment.findMany({
      where: {
        tenantId,
        status: 'CONFIRMED',
        paymentDate: {
          gte: start,
          lte: end,
        }
      },
      include: {
        unit: true,
        billPayments: {
          include: {
            bill: {
              select: {
                billNumber: true,
                billingMonth: true
              }
            }
          }
        }
      },
      orderBy: {
        paymentDate: 'asc'
      }
    })

    // Calculate totals by component
    const byComponent = {
      electric: 0,
      water: 0,
      dues: 0,
      penalty: 0,
      spAssessment: 0,
      advance: 0,
      total: 0
    }

    // Calculate totals by payment method
    const byMethod: Record<string, number> = {}

    // Calculate daily totals
    const byDay: Record<string, number> = {}

    for (const payment of payments) {
      // By component
      byComponent.electric += Number(payment.electricAmount)
      byComponent.water += Number(payment.waterAmount)
      byComponent.dues += Number(payment.duesAmount)
      byComponent.penalty += Number(payment.pastDuesAmount)
      byComponent.spAssessment += Number(payment.spAssessmentAmount)
      byComponent.advance += Number(payment.advanceDuesAmount) + Number(payment.advanceUtilAmount)
      byComponent.total += Number(payment.totalAmount)

      // By method
      const method = payment.paymentMethod || 'CASH'
      byMethod[method] = (byMethod[method] || 0) + Number(payment.totalAmount)

      // By day
      const dateKey = new Date(payment.paymentDate).toISOString().split('T')[0]
      byDay[dateKey] = (byDay[dateKey] || 0) + Number(payment.totalAmount)
    }

    // Get previous period for comparison
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - periodDays)
    const prevEnd = new Date(start)
    prevEnd.setDate(prevEnd.getDate() - 1)
    prevEnd.setHours(23, 59, 59, 999)

    const prevPayments = await prisma.payment.findMany({
      where: {
        tenantId,
        status: 'CONFIRMED',
        paymentDate: {
          gte: prevStart,
          lte: prevEnd,
        }
      },
      select: {
        totalAmount: true
      }
    })

    const prevTotal = prevPayments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
    const percentChange = prevTotal > 0
      ? Math.round(((byComponent.total - prevTotal) / prevTotal) * 100)
      : 0

    // Daily breakdown for chart
    const dailyData: Array<{ date: string, amount: number }> = []
    const currentDate = new Date(start)
    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split('T')[0]
      dailyData.push({
        date: dateKey,
        amount: byDay[dateKey] || 0
      })
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Calculate averages
    const avgDaily = byComponent.total / periodDays
    const paymentCount = payments.length

    return NextResponse.json({
      success: true,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
        days: periodDays
      },
      summary: {
        totalCollected: byComponent.total,
        paymentCount,
        avgDaily,
        prevPeriodTotal: prevTotal,
        percentChange
      },
      byComponent,
      byMethod,
      dailyData,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating collection summary report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
