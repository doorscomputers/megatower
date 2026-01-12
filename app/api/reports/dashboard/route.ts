import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Reports Dashboard Metrics
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

    // Get current month date range
    const now = new Date()
    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
    const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))

    // 1. Total Outstanding Balance
    const outstandingBills = await prisma.bill.findMany({
      where: {
        tenantId,
        balance: { gt: 0 },
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
      },
      select: {
        balance: true,
        unitId: true
      }
    })

    const totalOutstanding = outstandingBills.reduce(
      (sum, bill) => sum + Number(bill.balance),
      0
    )

    const unitsWithBalance = new Set(outstandingBills.map(b => b.unitId)).size

    // 2. This Month's Collections
    const thisMonthPayments = await prisma.payment.findMany({
      where: {
        tenantId,
        paymentDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: 'CONFIRMED'
      },
      select: {
        totalAmount: true
      }
    })

    const thisMonthCollections = thisMonthPayments.reduce(
      (sum, p) => sum + Number(p.totalAmount),
      0
    )

    // 3. Total Active Units
    const totalUnits = await prisma.unit.count({
      where: { tenantId, isActive: true }
    })

    // 4. Collection Efficiency (this month)
    // Bills due this month vs payments received this month
    const thisMonthBills = await prisma.bill.findMany({
      where: {
        tenantId,
        dueDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        }
      },
      select: {
        totalAmount: true,
        paidAmount: true
      }
    })

    const totalBilled = thisMonthBills.reduce(
      (sum, b) => sum + Number(b.totalAmount),
      0
    )

    const collectionEfficiency = totalBilled > 0
      ? Math.round((thisMonthCollections / totalBilled) * 100)
      : 0

    // 5. Overdue Bills Count
    const overdueBillsCount = await prisma.bill.count({
      where: {
        tenantId,
        status: 'OVERDUE',
        balance: { gt: 0 }
      }
    })

    // 6. Outstanding by Component
    const allOutstandingBills = await prisma.bill.findMany({
      where: {
        tenantId,
        balance: { gt: 0 },
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
      },
      select: {
        electricAmount: true,
        waterAmount: true,
        associationDues: true,
        penaltyAmount: true,
        spAssessment: true,
        otherCharges: true,
        paidAmount: true,
        balance: true
      }
    })

    // Calculate outstanding by component (proportional to remaining balance)
    let outstandingByComponent = {
      electric: 0,
      water: 0,
      dues: 0,
      penalty: 0,
      spAssessment: 0,
      other: 0
    }

    for (const bill of allOutstandingBills) {
      const total = Number(bill.electricAmount) + Number(bill.waterAmount) +
                    Number(bill.associationDues) + Number(bill.penaltyAmount) +
                    Number(bill.spAssessment) + Number(bill.otherCharges)

      if (total > 0) {
        const ratio = Number(bill.balance) / total
        outstandingByComponent.electric += Number(bill.electricAmount) * ratio
        outstandingByComponent.water += Number(bill.waterAmount) * ratio
        outstandingByComponent.dues += Number(bill.associationDues) * ratio
        outstandingByComponent.penalty += Number(bill.penaltyAmount) * ratio
        outstandingByComponent.spAssessment += Number(bill.spAssessment) * ratio
        outstandingByComponent.other += Number(bill.otherCharges) * ratio
      }
    }

    return NextResponse.json({
      success: true,
      metrics: {
        totalOutstanding,
        unitsWithBalance,
        thisMonthCollections,
        collectionEfficiency,
        totalUnits,
        overdueBillsCount,
        outstandingByComponent
      },
      asOf: now.toISOString()
    })
  } catch (error: any) {
    console.error("Error fetching dashboard metrics:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch dashboard metrics" },
      { status: 500 }
    )
  }
}
