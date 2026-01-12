import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Annual Summary Report
 * Comprehensive yearly financial summary
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

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]

    // Get all bills for the year
    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        billingMonth: { gte: startOfYear, lte: endOfYear }
      },
      select: {
        billingMonth: true,
        totalAmount: true,
        balance: true,
        status: true,
        electricAmount: true,
        waterAmount: true,
        associationDues: true,
        penaltyAmount: true,
        spAssessment: true,
        otherCharges: true
      }
    })

    // Get all payments for the year
    const payments = await prisma.payment.findMany({
      where: {
        tenantId,
        status: 'CONFIRMED',
        paymentDate: { gte: startOfYear, lte: endOfYear }
      },
      select: {
        paymentDate: true,
        totalAmount: true,
        paymentMethod: true,
        electricAmount: true,
        waterAmount: true,
        duesAmount: true,
        pastDuesAmount: true,
        spAssessmentAmount: true
      }
    })

    // Monthly breakdown
    const monthlyData: Array<{
      month: number
      monthName: string
      billed: {
        electric: number
        water: number
        dues: number
        penalty: number
        spAssessment: number
        other: number
        total: number
      }
      collected: {
        electric: number
        water: number
        dues: number
        penalty: number
        spAssessment: number
        total: number
      }
      outstanding: number
      efficiency: number
    }> = []

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(Date.UTC(year, month, 1))
      const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))

      const monthBills = bills.filter(b => {
        const bMonth = new Date(b.billingMonth)
        return bMonth.getUTCMonth() === month && bMonth.getUTCFullYear() === year
      })

      const monthPayments = payments.filter(p => {
        const pDate = new Date(p.paymentDate)
        return pDate.getUTCMonth() === month && pDate.getUTCFullYear() === year
      })

      const billed = {
        electric: monthBills.reduce((sum, b) => sum + Number(b.electricAmount), 0),
        water: monthBills.reduce((sum, b) => sum + Number(b.waterAmount), 0),
        dues: monthBills.reduce((sum, b) => sum + Number(b.associationDues), 0),
        penalty: monthBills.reduce((sum, b) => sum + Number(b.penaltyAmount), 0),
        spAssessment: monthBills.reduce((sum, b) => sum + Number(b.spAssessment), 0),
        other: monthBills.reduce((sum, b) => sum + Number(b.otherCharges), 0),
        total: monthBills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
      }

      const collected = {
        electric: monthPayments.reduce((sum, p) => sum + Number(p.electricAmount), 0),
        water: monthPayments.reduce((sum, p) => sum + Number(p.waterAmount), 0),
        dues: monthPayments.reduce((sum, p) => sum + Number(p.duesAmount), 0),
        penalty: monthPayments.reduce((sum, p) => sum + Number(p.pastDuesAmount), 0),
        spAssessment: monthPayments.reduce((sum, p) => sum + Number(p.spAssessmentAmount), 0),
        total: monthPayments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
      }

      const outstanding = monthBills.reduce((sum, b) => sum + Number(b.balance), 0)
      const efficiency = billed.total > 0 ? Math.round((collected.total / billed.total) * 100) : 0

      monthlyData.push({
        month: month + 1,
        monthName: monthNames[month],
        billed,
        collected,
        outstanding,
        efficiency
      })
    }

    // Yearly totals
    const yearlyTotals = {
      billed: {
        electric: monthlyData.reduce((sum, m) => sum + m.billed.electric, 0),
        water: monthlyData.reduce((sum, m) => sum + m.billed.water, 0),
        dues: monthlyData.reduce((sum, m) => sum + m.billed.dues, 0),
        penalty: monthlyData.reduce((sum, m) => sum + m.billed.penalty, 0),
        spAssessment: monthlyData.reduce((sum, m) => sum + m.billed.spAssessment, 0),
        other: monthlyData.reduce((sum, m) => sum + m.billed.other, 0),
        total: monthlyData.reduce((sum, m) => sum + m.billed.total, 0)
      },
      collected: {
        electric: monthlyData.reduce((sum, m) => sum + m.collected.electric, 0),
        water: monthlyData.reduce((sum, m) => sum + m.collected.water, 0),
        dues: monthlyData.reduce((sum, m) => sum + m.collected.dues, 0),
        penalty: monthlyData.reduce((sum, m) => sum + m.collected.penalty, 0),
        spAssessment: monthlyData.reduce((sum, m) => sum + m.collected.spAssessment, 0),
        total: monthlyData.reduce((sum, m) => sum + m.collected.total, 0)
      }
    }

    // Payment method breakdown
    const paymentMethods: Record<string, { count: number; total: number }> = {}
    for (const p of payments) {
      const method = p.paymentMethod || 'CASH'
      if (!paymentMethods[method]) {
        paymentMethods[method] = { count: 0, total: 0 }
      }
      paymentMethods[method].count++
      paymentMethods[method].total += Number(p.totalAmount)
    }

    // Bill status breakdown
    const billStatus = {
      paid: bills.filter(b => b.status === 'PAID').length,
      partial: bills.filter(b => b.status === 'PARTIAL').length,
      unpaid: bills.filter(b => ['UNPAID', 'PENDING'].includes(b.status)).length,
      overdue: bills.filter(b => b.status === 'OVERDUE').length
    }

    // Key metrics
    const avgMonthlyBilled = yearlyTotals.billed.total / 12
    const avgMonthlyCollected = yearlyTotals.collected.total / 12
    const overallEfficiency = yearlyTotals.billed.total > 0
      ? Math.round((yearlyTotals.collected.total / yearlyTotals.billed.total) * 100)
      : 0

    // Best and worst months
    const monthsWithData = monthlyData.filter(m => m.billed.total > 0)
    const bestMonth = monthsWithData.length > 0
      ? monthsWithData.reduce((best, m) => m.collected.total > best.collected.total ? m : best, monthsWithData[0])
      : null
    const worstMonth = monthsWithData.length > 0
      ? monthsWithData.reduce((worst, m) => m.collected.total < worst.collected.total ? m : worst, monthsWithData[0])
      : null

    // Component breakdown percentages
    const componentBreakdown = {
      electric: yearlyTotals.billed.total > 0
        ? Math.round((yearlyTotals.billed.electric / yearlyTotals.billed.total) * 100)
        : 0,
      water: yearlyTotals.billed.total > 0
        ? Math.round((yearlyTotals.billed.water / yearlyTotals.billed.total) * 100)
        : 0,
      dues: yearlyTotals.billed.total > 0
        ? Math.round((yearlyTotals.billed.dues / yearlyTotals.billed.total) * 100)
        : 0,
      penalty: yearlyTotals.billed.total > 0
        ? Math.round((yearlyTotals.billed.penalty / yearlyTotals.billed.total) * 100)
        : 0,
      spAssessment: yearlyTotals.billed.total > 0
        ? Math.round((yearlyTotals.billed.spAssessment / yearlyTotals.billed.total) * 100)
        : 0,
      other: yearlyTotals.billed.total > 0
        ? Math.round((yearlyTotals.billed.other / yearlyTotals.billed.total) * 100)
        : 0
    }

    return NextResponse.json({
      success: true,
      year,
      monthlyData,
      yearlyTotals,
      paymentMethods,
      billStatus,
      summary: {
        totalBilled: yearlyTotals.billed.total,
        totalCollected: yearlyTotals.collected.total,
        totalOutstanding: bills.reduce((sum, b) => sum + Number(b.balance), 0),
        avgMonthlyBilled,
        avgMonthlyCollected,
        overallEfficiency,
        totalBills: bills.length,
        totalPayments: payments.length,
        bestMonth,
        worstMonth,
        componentBreakdown
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating annual summary report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
