import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Generate Statement of Account for a unit
 * Matches the Excel SOA format with OR# tracking
 */
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get("unitId")
    const asOfDate = searchParams.get("asOfDate")

    if (!unitId) {
      return NextResponse.json(
        { error: "Unit ID is required" },
        { status: 400 }
      )
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Get unit with owner details
    const unit = await prisma.unit.findUnique({
      where: {
        id: unitId,
        tenantId: tenantId,
      },
      include: {
        owner: true,
      },
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // Determine cutoff date
    const cutoffDate = asOfDate ? new Date(asOfDate) : new Date()

    // Get all bills for this unit up to the cutoff date
    const bills = await prisma.bill.findMany({
      where: {
        unitId,
        tenantId: tenantId,
        statementDate: {
          lte: cutoffDate,
        },
      },
      orderBy: {
        billingMonth: "asc",
      },
    })

    // Get all payments for this unit up to the cutoff date
    const payments = await prisma.payment.findMany({
      where: {
        unitId,
        tenantId: tenantId,
        paymentDate: {
          lte: cutoffDate,
        },
      },
      include: {
        billPayments: {
          include: {
            bill: {
              select: {
                billNumber: true,
                billingMonth: true,
              },
            },
          },
        },
      },
      orderBy: {
        paymentDate: "asc",
      },
    })

    // Calculate balances
    let runningBalance = 0
    const transactions: Array<{
      date: Date
      type: "BILL" | "PAYMENT"
      description: string
      billNumber?: string
      orNumber?: string
      reference?: string
      debit: number
      credit: number
      balance: number
      details?: any
    }> = []

    // Merge bills and payments chronologically
    const allTransactions = [
      ...bills.map((b) => ({
        date: b.statementDate,
        type: "BILL" as const,
        data: b,
      })),
      ...payments.map((p) => ({
        date: p.paymentDate,
        type: "PAYMENT" as const,
        data: p,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime())

    // Build transaction list with running balance
    for (const transaction of allTransactions) {
      if (transaction.type === "BILL") {
        const bill = transaction.data as any
        runningBalance += Number(bill.totalAmount)

        transactions.push({
          date: bill.statementDate,
          type: "BILL",
          description: `Bill for ${new Date(bill.billingMonth).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
          billNumber: bill.billNumber,
          debit: Number(bill.totalAmount),
          credit: 0,
          balance: runningBalance,
          details: {
            electric: Number(bill.electricAmount),
            water: Number(bill.waterAmount),
            dues: Number(bill.associationDues),
            penalty: Number(bill.penaltyAmount),
            other: Number(bill.otherCharges),
            dueDate: bill.dueDate,
            billingPeriodStart: bill.billingPeriodStart,
            billingPeriodEnd: bill.billingPeriodEnd,
          },
        })
      } else {
        const payment = transaction.data as any
        const paymentTotal = Number(payment.totalAmount)
        runningBalance -= paymentTotal

        // Get bill numbers this payment applies to
        const appliedToBills = payment.billPayments.map(
          (bp: any) => bp.bill.billNumber
        )

        transactions.push({
          date: payment.paymentDate,
          type: "PAYMENT",
          description: `Payment - ${payment.paymentMethod.replace("_", " ")}`,
          orNumber: payment.orNumber,
          reference: payment.referenceNumber || payment.checkNumber,
          billNumber: appliedToBills.join(", ") || undefined,
          debit: 0,
          credit: paymentTotal,
          balance: runningBalance,
          details: {
            method: payment.paymentMethod,
            orNumber: payment.orNumber,
            checkNumber: payment.checkNumber,
            checkDate: payment.checkDate,
            bankName: payment.bankName,
            remarks: payment.remarks,
            componentBreakdown: {
              electric: Number(payment.electricAmount),
              water: Number(payment.waterAmount),
              dues: Number(payment.duesAmount),
              pastDues: Number(payment.pastDuesAmount),
              spAssessment: Number(payment.spAssessmentAmount),
              advanceDues: Number(payment.advanceDuesAmount),
              advanceUtil: Number(payment.advanceUtilAmount),
            },
          },
        })
      }
    }

    // Calculate summary
    const totalBilled = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
    const currentBalance = totalBilled - totalPaid

    // Get unpaid bills for aging analysis
    const unpaidBills = bills.filter((b) => b.status !== "PAID")

    // Calculate aging
    const now = cutoffDate
    const aging = {
      current: 0, // 0-30 days
      days31to60: 0,
      days61to90: 0,
      over90: 0,
    }

    for (const bill of unpaidBills) {
      const balance = Number(bill.totalAmount) - Number(bill.paidAmount)
      if (balance <= 0) continue

      const daysOverdue = Math.floor(
        (now.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysOverdue <= 30) {
        aging.current += balance
      } else if (daysOverdue <= 60) {
        aging.days31to60 += balance
      } else if (daysOverdue <= 90) {
        aging.days61to90 += balance
      } else {
        aging.over90 += balance
      }
    }

    // Build payment breakdown array matching Excel SOA format
    const paymentBreakdown: Array<{ component: string; orNumber: string | null; amount: number }> = []

    // Aggregate payments by component with their OR#s
    const componentTotals = {
      ELECTRIC: new Map<string, number>(),
      WATER: new Map<string, number>(),
      "ASSOC. DUES": new Map<string, number>(),
      "PAST DUES": new Map<string, number>(),
      "SP ASSESSMENT": new Map<string, number>(),
      "ADVANCE PAYMENT": new Map<string, number>(),
    }

    for (const payment of payments) {
      const orNum = payment.orNumber || null
      const orKey = orNum || "0"

      if (Number(payment.electricAmount) > 0) {
        const current = componentTotals.ELECTRIC.get(orKey) || 0
        componentTotals.ELECTRIC.set(orKey, current + Number(payment.electricAmount))
      }
      if (Number(payment.waterAmount) > 0) {
        const current = componentTotals.WATER.get(orKey) || 0
        componentTotals.WATER.set(orKey, current + Number(payment.waterAmount))
      }
      if (Number(payment.duesAmount) > 0) {
        const current = componentTotals["ASSOC. DUES"].get(orKey) || 0
        componentTotals["ASSOC. DUES"].set(orKey, current + Number(payment.duesAmount))
      }
      if (Number(payment.pastDuesAmount) > 0) {
        const current = componentTotals["PAST DUES"].get(orKey) || 0
        componentTotals["PAST DUES"].set(orKey, current + Number(payment.pastDuesAmount))
      }
      if (Number(payment.spAssessmentAmount) > 0) {
        const current = componentTotals["SP ASSESSMENT"].get(orKey) || 0
        componentTotals["SP ASSESSMENT"].set(orKey, current + Number(payment.spAssessmentAmount))
      }
      const advanceTotal = Number(payment.advanceDuesAmount) + Number(payment.advanceUtilAmount)
      if (advanceTotal > 0) {
        const current = componentTotals["ADVANCE PAYMENT"].get(orKey) || 0
        componentTotals["ADVANCE PAYMENT"].set(orKey, current + advanceTotal)
      }
    }

    // Build payment breakdown in the order shown in Excel SOA
    const componentOrder = ["ELECTRIC", "WATER", "ASSOC. DUES", "PAST DUES", "SP ASSESSMENT", "ADVANCE PAYMENT"]

    for (const component of componentOrder) {
      const totals = componentTotals[component as keyof typeof componentTotals]
      if (totals.size > 0) {
        // Group by OR#
        for (const [orKey, amount] of Array.from(totals.entries())) {
          paymentBreakdown.push({
            component,
            orNumber: orKey === "0" ? null : orKey,
            amount,
          })
        }
      } else {
        // Show zero entry for component with no payment
        paymentBreakdown.push({
          component,
          orNumber: null,
          amount: 0,
        })
      }
    }

    return NextResponse.json({
      success: true,
      asOfDate: cutoffDate,
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        floorLevel: unit.floorLevel,
        area: Number(unit.area),
        unitType: unit.unitType,
      },
      owner: unit.owner ? {
        id: unit.owner.id,
        name: `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ` ${unit.owner.middleName.charAt(0)}.` : ''}`,
        email: unit.owner.email,
        phone: unit.owner.phone,
        address: unit.owner.address,
      } : null,
      summary: {
        totalBilled,
        totalPaid,
        currentBalance,
        billsCount: bills.length,
        paymentsCount: payments.length,
        unpaidBillsCount: unpaidBills.length,
      },
      aging,
      paymentBreakdown, // Excel-style payment breakdown with OR#
      transactions,
    })
  } catch (error: any) {
    console.error("Error generating SOA:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate SOA" },
      { status: 500 }
    )
  }
}
