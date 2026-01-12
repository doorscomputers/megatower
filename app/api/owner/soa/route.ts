import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Generate Statement of Account for owner's unit(s)
 * Auto-filtered to the logged-in owner
 */
export async function GET(request: NextRequest) {
  try {
    const { user, tenantId } = await requireAuth(await headers())

    const ownerId = user.ownerId
    if (!ownerId) {
      return NextResponse.json(
        { error: "No owner account linked to this user" },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get("unitId")
    const asOfDate = searchParams.get("asOfDate")

    // Get owner's units
    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      include: {
        units: {
          where: { isActive: true },
          select: { id: true, unitNumber: true, floorLevel: true, area: true, unitType: true },
        },
      },
    })

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 })
    }

    // If unitId provided, verify it belongs to this owner
    let targetUnitId = unitId
    if (unitId) {
      const ownsUnit = owner.units.some((u) => u.id === unitId)
      if (!ownsUnit) {
        return NextResponse.json({ error: "Unit not found" }, { status: 404 })
      }
    } else {
      // Default to first unit
      if (owner.units.length === 0) {
        return NextResponse.json({ error: "No units found" }, { status: 404 })
      }
      targetUnitId = owner.units[0].id
    }

    // Get unit details
    const unit = await prisma.unit.findUnique({
      where: { id: targetUnitId! },
      include: { owner: true },
    })

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 })
    }

    // Determine cutoff date
    const cutoffDate = asOfDate ? new Date(asOfDate) : new Date()

    // Get all bills for this unit up to the cutoff date
    const bills = await prisma.bill.findMany({
      where: {
        unitId: targetUnitId!,
        statementDate: { lte: cutoffDate },
      },
      orderBy: { billingMonth: "asc" },
    })

    // Get all payments for this unit up to the cutoff date
    const payments = await prisma.payment.findMany({
      where: {
        unitId: targetUnitId!,
        paymentDate: { lte: cutoffDate },
      },
      include: {
        billPayments: {
          include: {
            bill: {
              select: { billNumber: true, billingMonth: true },
            },
          },
        },
      },
      orderBy: { paymentDate: "asc" },
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
          },
        })
      } else {
        const payment = transaction.data as any
        runningBalance -= Number(payment.totalAmount)

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
          credit: Number(payment.totalAmount),
          balance: runningBalance,
        })
      }
    }

    // Calculate summary
    const totalBilled = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
    const currentBalance = totalBilled - totalPaid

    // Get unpaid bills for aging analysis
    const unpaidBills = bills.filter((b) => b.status !== "PAID")
    const now = cutoffDate
    const aging = {
      current: 0,
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

    return NextResponse.json({
      success: true,
      asOfDate: cutoffDate,
      availableUnits: owner.units,
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        floorLevel: unit.floorLevel,
        area: Number(unit.area),
        unitType: unit.unitType,
      },
      owner: {
        id: owner.id,
        name: `${owner.lastName}, ${owner.firstName}${owner.middleName ? ` ${owner.middleName.charAt(0)}.` : ''}`,
        lastName: owner.lastName,
        firstName: owner.firstName,
        middleName: owner.middleName,
        email: owner.email,
        phone: owner.phone,
        address: owner.address,
      },
      summary: {
        totalBilled,
        totalPaid,
        currentBalance,
        billsCount: bills.length,
        paymentsCount: payments.length,
        unpaidBillsCount: unpaidBills.length,
      },
      aging,
      transactions,
    })
  } catch (error: any) {
    console.error("Error generating owner SOA:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate SOA" },
      { status: 500 }
    )
  }
}
