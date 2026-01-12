import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Comparative Analysis Report
 * Month-over-Month and Year-over-Year comparisons
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
    const type = searchParams.get("type") || "mom" // mom = month-over-month, yoy = year-over-year
    const currentYear = parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const currentMonth = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString())

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]

    // Helper to get period data
    const getPeriodData = async (year: number, month?: number) => {
      let startDate: Date, endDate: Date

      if (month !== undefined) {
        startDate = new Date(Date.UTC(year, month - 1, 1))
        endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
      } else {
        startDate = new Date(Date.UTC(year, 0, 1))
        endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
      }

      const [bills, payments] = await Promise.all([
        prisma.bill.findMany({
          where: {
            tenantId,
            billingMonth: { gte: startDate, lte: endDate }
          },
          select: {
            totalAmount: true,
            balance: true,
            status: true,
            electricAmount: true,
            waterAmount: true,
            associationDues: true,
            penaltyAmount: true
          }
        }),
        prisma.payment.findMany({
          where: {
            tenantId,
            status: 'CONFIRMED',
            paymentDate: { gte: startDate, lte: endDate }
          },
          select: {
            totalAmount: true,
            electricAmount: true,
            waterAmount: true,
            duesAmount: true,
            pastDuesAmount: true
          }
        })
      ])

      return {
        billed: {
          total: bills.reduce((sum, b) => sum + Number(b.totalAmount), 0),
          electric: bills.reduce((sum, b) => sum + Number(b.electricAmount), 0),
          water: bills.reduce((sum, b) => sum + Number(b.waterAmount), 0),
          dues: bills.reduce((sum, b) => sum + Number(b.associationDues), 0),
          penalty: bills.reduce((sum, b) => sum + Number(b.penaltyAmount), 0)
        },
        collected: {
          total: payments.reduce((sum, p) => sum + Number(p.totalAmount), 0),
          electric: payments.reduce((sum, p) => sum + Number(p.electricAmount), 0),
          water: payments.reduce((sum, p) => sum + Number(p.waterAmount), 0),
          dues: payments.reduce((sum, p) => sum + Number(p.duesAmount), 0),
          penalty: payments.reduce((sum, p) => sum + Number(p.pastDuesAmount), 0)
        },
        billCount: bills.length,
        paymentCount: payments.length,
        paidBills: bills.filter(b => b.status === 'PAID').length,
        outstanding: bills.reduce((sum, b) => sum + Number(b.balance), 0)
      }
    }

    let comparison: any

    if (type === 'mom') {
      // Month-over-Month comparison
      const currentPeriod = await getPeriodData(currentYear, currentMonth)

      // Previous month
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
      const previousPeriod = await getPeriodData(prevYear, prevMonth)

      // Calculate changes
      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0
        return Math.round(((current - previous) / previous) * 100)
      }

      comparison = {
        type: 'mom',
        currentPeriod: {
          year: currentYear,
          month: currentMonth,
          monthName: monthNames[currentMonth - 1],
          label: `${monthNames[currentMonth - 1]} ${currentYear}`,
          ...currentPeriod
        },
        previousPeriod: {
          year: prevYear,
          month: prevMonth,
          monthName: monthNames[prevMonth - 1],
          label: `${monthNames[prevMonth - 1]} ${prevYear}`,
          ...previousPeriod
        },
        changes: {
          billed: {
            total: calcChange(currentPeriod.billed.total, previousPeriod.billed.total),
            electric: calcChange(currentPeriod.billed.electric, previousPeriod.billed.electric),
            water: calcChange(currentPeriod.billed.water, previousPeriod.billed.water),
            dues: calcChange(currentPeriod.billed.dues, previousPeriod.billed.dues),
            penalty: calcChange(currentPeriod.billed.penalty, previousPeriod.billed.penalty)
          },
          collected: {
            total: calcChange(currentPeriod.collected.total, previousPeriod.collected.total),
            electric: calcChange(currentPeriod.collected.electric, previousPeriod.collected.electric),
            water: calcChange(currentPeriod.collected.water, previousPeriod.collected.water),
            dues: calcChange(currentPeriod.collected.dues, previousPeriod.collected.dues),
            penalty: calcChange(currentPeriod.collected.penalty, previousPeriod.collected.penalty)
          },
          billCount: calcChange(currentPeriod.billCount, previousPeriod.billCount),
          paymentCount: calcChange(currentPeriod.paymentCount, previousPeriod.paymentCount),
          outstanding: calcChange(currentPeriod.outstanding, previousPeriod.outstanding)
        }
      }
    } else {
      // Year-over-Year comparison
      const currentPeriod = await getPeriodData(currentYear)
      const previousPeriod = await getPeriodData(currentYear - 1)

      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0
        return Math.round(((current - previous) / previous) * 100)
      }

      // Get monthly trends for both years
      const getMonthlyTrends = async (year: number) => {
        const trends: Array<{
          month: number
          monthName: string
          billed: number
          collected: number
        }> = []

        for (let m = 1; m <= 12; m++) {
          const data = await getPeriodData(year, m)
          trends.push({
            month: m,
            monthName: monthNames[m - 1],
            billed: data.billed.total,
            collected: data.collected.total
          })
        }

        return trends
      }

      const currentTrends = await getMonthlyTrends(currentYear)
      const previousTrends = await getMonthlyTrends(currentYear - 1)

      comparison = {
        type: 'yoy',
        currentPeriod: {
          year: currentYear,
          label: `${currentYear}`,
          ...currentPeriod,
          monthlyTrends: currentTrends
        },
        previousPeriod: {
          year: currentYear - 1,
          label: `${currentYear - 1}`,
          ...previousPeriod,
          monthlyTrends: previousTrends
        },
        changes: {
          billed: {
            total: calcChange(currentPeriod.billed.total, previousPeriod.billed.total),
            electric: calcChange(currentPeriod.billed.electric, previousPeriod.billed.electric),
            water: calcChange(currentPeriod.billed.water, previousPeriod.billed.water),
            dues: calcChange(currentPeriod.billed.dues, previousPeriod.billed.dues),
            penalty: calcChange(currentPeriod.billed.penalty, previousPeriod.billed.penalty)
          },
          collected: {
            total: calcChange(currentPeriod.collected.total, previousPeriod.collected.total),
            electric: calcChange(currentPeriod.collected.electric, previousPeriod.collected.electric),
            water: calcChange(currentPeriod.collected.water, previousPeriod.collected.water),
            dues: calcChange(currentPeriod.collected.dues, previousPeriod.collected.dues),
            penalty: calcChange(currentPeriod.collected.penalty, previousPeriod.collected.penalty)
          },
          billCount: calcChange(currentPeriod.billCount, previousPeriod.billCount),
          paymentCount: calcChange(currentPeriod.paymentCount, previousPeriod.paymentCount),
          outstanding: calcChange(currentPeriod.outstanding, previousPeriod.outstanding)
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...comparison,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating comparative report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
