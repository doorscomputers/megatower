import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Top Payers Report
 * Identifies best paying units based on payment history
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
    const limit = parseInt(searchParams.get("limit") || "20")

    const startOfYear = new Date(Date.UTC(year, 0, 1))
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

    // Get all units with their payment history
    const units = await prisma.unit.findMany({
      where: { tenantId, isActive: true },
      include: {
        owner: {
          select: { firstName: true, lastName: true }
        }
      }
    })

    // Get all payments and bills for the year
    const [payments, bills] = await Promise.all([
      prisma.payment.findMany({
        where: {
          tenantId,
          status: 'CONFIRMED',
          paymentDate: { gte: startOfYear, lte: endOfYear }
        },
        select: {
          unitId: true,
          totalAmount: true,
          paymentDate: true
        }
      }),
      prisma.bill.findMany({
        where: {
          tenantId,
          billingMonth: { gte: startOfYear, lte: endOfYear }
        },
        select: {
          unitId: true,
          totalAmount: true,
          balance: true,
          status: true,
          dueDate: true
        }
      })
    ])

    // Calculate metrics per unit
    const unitMetrics: Array<{
      unitId: string
      unitNumber: string
      floorLevel: string
      ownerName: string
      totalPaid: number
      totalBilled: number
      paymentCount: number
      billCount: number
      onTimePayments: number
      latePayments: number
      fullyPaidBills: number
      currentBalance: number
      paymentScore: number
      rank: number
    }> = []

    for (const unit of units) {
      const unitPayments = payments.filter(p => p.unitId === unit.id)
      const unitBills = bills.filter(b => b.unitId === unit.id)

      const totalPaid = unitPayments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
      const totalBilled = unitBills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
      const currentBalance = unitBills.reduce((sum, b) => sum + Number(b.balance), 0)

      const fullyPaidBills = unitBills.filter(b => b.status === 'PAID').length

      // Calculate on-time vs late payments (simplified - checking if paid before due)
      let onTimePayments = 0
      let latePayments = 0

      for (const bill of unitBills) {
        if (bill.status === 'PAID') {
          // Find payments that could have paid this bill
          const billPaymentDate = unitPayments
            .filter(p => new Date(p.paymentDate) <= new Date(bill.dueDate))
            .length > 0

          if (billPaymentDate) {
            onTimePayments++
          } else {
            latePayments++
          }
        }
      }

      // Calculate payment score (0-100)
      // Factors: payment rate, on-time rate, current balance
      const paymentRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 100
      const onTimeRate = (onTimePayments + latePayments) > 0
        ? (onTimePayments / (onTimePayments + latePayments)) * 100
        : 100
      const balanceScore = totalBilled > 0
        ? Math.max(0, 100 - (currentBalance / totalBilled) * 100)
        : 100

      const paymentScore = Math.round((paymentRate * 0.4) + (onTimeRate * 0.3) + (balanceScore * 0.3))

      unitMetrics.push({
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        floorLevel: unit.floorLevel,
        ownerName: `${unit.owner?.firstName || ''} ${unit.owner?.lastName || ''}`.trim() || 'N/A',
        totalPaid,
        totalBilled,
        paymentCount: unitPayments.length,
        billCount: unitBills.length,
        onTimePayments,
        latePayments,
        fullyPaidBills,
        currentBalance,
        paymentScore: Math.min(100, Math.max(0, paymentScore)),
        rank: 0
      })
    }

    // Sort by payment score descending
    unitMetrics.sort((a, b) => b.paymentScore - a.paymentScore)

    // Assign ranks
    unitMetrics.forEach((u, idx) => {
      u.rank = idx + 1
    })

    // Get top payers
    const topPayers = unitMetrics.slice(0, limit)

    // Get bottom payers (units needing attention)
    const bottomPayers = [...unitMetrics]
      .filter(u => u.billCount > 0)
      .sort((a, b) => a.paymentScore - b.paymentScore)
      .slice(0, 10)

    // Summary stats
    const summary = {
      totalUnits: unitMetrics.length,
      avgPaymentScore: Math.round(
        unitMetrics.reduce((sum, u) => sum + u.paymentScore, 0) / Math.max(unitMetrics.length, 1)
      ),
      excellentPayers: unitMetrics.filter(u => u.paymentScore >= 90).length,
      goodPayers: unitMetrics.filter(u => u.paymentScore >= 70 && u.paymentScore < 90).length,
      fairPayers: unitMetrics.filter(u => u.paymentScore >= 50 && u.paymentScore < 70).length,
      poorPayers: unitMetrics.filter(u => u.paymentScore < 50).length,
      perfectScoreUnits: unitMetrics.filter(u => u.paymentScore === 100).length,
      zeroBalanceUnits: unitMetrics.filter(u => u.currentBalance === 0).length
    }

    return NextResponse.json({
      success: true,
      year,
      topPayers,
      bottomPayers,
      allUnits: unitMetrics,
      summary,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating top payers report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
