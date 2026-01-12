import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - List all SOA batches
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
    const status = searchParams.get("status")
    const year = searchParams.get("year")
    const month = searchParams.get("month")

    // Build filter
    const where: any = { tenantId }

    if (status) {
      where.status = status
    }

    if (year) {
      const startOfYear = new Date(Date.UTC(parseInt(year), 0, 1))
      const endOfYear = new Date(Date.UTC(parseInt(year), 11, 31, 23, 59, 59, 999))
      where.createdAt = { gte: startOfYear, lte: endOfYear }
    }

    if (month && year) {
      const startOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1))
      const endOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59, 999))
      where.createdAt = { gte: startOfMonth, lte: endOfMonth }
    }

    const batches = await prisma.sOABatch.findMany({
      where,
      include: {
        _count: {
          select: { documents: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({
      success: true,
      batches: batches.map(b => ({
        id: b.id,
        batchNumber: b.batchNumber,
        asOfDate: b.asOfDate,
        billingMonth: b.billingMonth,
        filterType: b.filterType,
        filterValue: b.filterValue,
        status: b.status,
        distributedAt: b.distributedAt,
        totalUnits: b.totalUnits,
        totalAmount: Number(b.totalAmount),
        totalBalance: Number(b.totalBalance),
        documentCount: b._count.documents,
        generatedBy: b.generatedBy,
        createdAt: b.createdAt
      }))
    })
  } catch (error: any) {
    console.error("Error listing SOA batches:", error)
    return NextResponse.json(
      { error: error.message || "Failed to list SOA batches" },
      { status: 500 }
    )
  }
}

/**
 * POST - Create a new SOA batch (generates and archives SOAs)
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, user } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { filterType = "ALL", filterValue, asOfDate, billingMonth, remarks } = body

    // Determine cutoff date
    const cutoffDate = asOfDate ? new Date(asOfDate) : new Date()

    // Build unit filter
    const unitWhere: any = {
      tenantId,
      isActive: true,
    }

    if (filterType === "FLOOR" && filterValue) {
      unitWhere.floorLevel = filterValue
    } else if (filterType === "UNIT" && filterValue) {
      unitWhere.id = filterValue
    }

    // Get all units matching filter
    const units = await prisma.unit.findMany({
      where: unitWhere,
      include: {
        owner: true,
      },
      orderBy: [{ floorLevel: "asc" }, { unitNumber: "asc" }],
    })

    if (units.length === 0) {
      return NextResponse.json(
        { error: "No units found matching the filter" },
        { status: 400 }
      )
    }

    // Generate batch number
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const existingBatches = await prisma.sOABatch.count({
      where: {
        tenantId,
        batchNumber: { startsWith: `SOA-${yearMonth}` }
      }
    })
    const batchNumber = `SOA-${yearMonth}-${String(existingBatches + 1).padStart(3, '0')}`

    // Generate SOA for each unit and collect data
    const soaDocumentsData: Array<{
      unitId: string
      unitNumber: string
      ownerName: string
      floorLevel: string
      totalBilled: number
      totalPaid: number
      currentBalance: number
      current: number
      days31to60: number
      days61to90: number
      over90days: number
      soaData: string
      billIds: string[]
    }> = []

    let totalAmount = 0
    let totalBalance = 0

    for (const unit of units) {
      // Get all bills for this unit up to the cutoff date
      const bills = await prisma.bill.findMany({
        where: {
          unitId: unit.id,
          tenantId,
          statementDate: { lte: cutoffDate },
        },
        orderBy: { billingMonth: "asc" },
      })

      // Get all payments for this unit up to the cutoff date
      const payments = await prisma.payment.findMany({
        where: {
          unitId: unit.id,
          tenantId,
          paymentDate: { lte: cutoffDate },
        },
        orderBy: { paymentDate: "asc" },
      })

      // Calculate summary
      const unitTotalBilled = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
      const unitTotalPaid = payments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
      const unitBalance = unitTotalBilled - unitTotalPaid

      totalAmount += unitTotalBilled
      totalBalance += unitBalance

      // Get unpaid bills for aging analysis
      const unpaidBills = bills.filter((b) => b.status !== "PAID")
      const aging = {
        current: 0,
        days31to60: 0,
        days61to90: 0,
        over90days: 0,
      }

      for (const bill of unpaidBills) {
        const balance = Number(bill.totalAmount) - Number(bill.paidAmount)
        if (balance <= 0) continue

        const daysOverdue = Math.floor(
          (cutoffDate.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysOverdue <= 30) {
          aging.current += balance
        } else if (daysOverdue <= 60) {
          aging.days31to60 += balance
        } else if (daysOverdue <= 90) {
          aging.days61to90 += balance
        } else {
          aging.over90days += balance
        }
      }

      // Build transactions for SOA data
      let runningBalance = 0
      const transactions: Array<{
        date: string
        type: "BILL" | "PAYMENT"
        description: string
        billNumber?: string
        orNumber?: string
        debit: number
        credit: number
        balance: number
      }> = []

      const allTransactions = [
        ...bills.map((b) => ({ date: b.statementDate, type: "BILL" as const, data: b })),
        ...payments.map((p) => ({ date: p.paymentDate, type: "PAYMENT" as const, data: p })),
      ].sort((a, b) => a.date.getTime() - b.date.getTime())

      for (const transaction of allTransactions) {
        if (transaction.type === "BILL") {
          const bill = transaction.data as any
          runningBalance += Number(bill.totalAmount)
          transactions.push({
            date: bill.statementDate.toISOString(),
            type: "BILL",
            description: `Bill for ${new Date(bill.billingMonth).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
            billNumber: bill.billNumber,
            debit: Number(bill.totalAmount),
            credit: 0,
            balance: runningBalance,
          })
        } else {
          const payment = transaction.data as any
          runningBalance -= Number(payment.totalAmount)
          transactions.push({
            date: payment.paymentDate.toISOString(),
            type: "PAYMENT",
            description: `Payment - ${payment.paymentMethod.replace("_", " ")}`,
            orNumber: payment.orNumber,
            debit: 0,
            credit: Number(payment.totalAmount),
            balance: runningBalance,
          })
        }
      }

      const ownerName = unit.owner
        ? `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ` ${unit.owner.middleName.charAt(0)}.` : ''}`
        : 'No Owner'

      // Full SOA data snapshot
      const soaData = {
        unit: {
          id: unit.id,
          unitNumber: unit.unitNumber,
          floorLevel: unit.floorLevel,
          area: Number(unit.area),
          unitType: unit.unitType,
        },
        owner: unit.owner ? {
          id: unit.owner.id,
          name: ownerName,
          email: unit.owner.email,
          phone: unit.owner.phone,
        } : null,
        summary: {
          totalBilled: unitTotalBilled,
          totalPaid: unitTotalPaid,
          currentBalance: unitBalance,
          billsCount: bills.length,
          paymentsCount: payments.length,
        },
        aging,
        transactions,
        asOfDate: cutoffDate.toISOString(),
      }

      soaDocumentsData.push({
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        ownerName,
        floorLevel: unit.floorLevel,
        totalBilled: unitTotalBilled,
        totalPaid: unitTotalPaid,
        currentBalance: unitBalance,
        current: aging.current,
        days31to60: aging.days31to60,
        days61to90: aging.days61to90,
        over90days: aging.over90days,
        soaData: JSON.stringify(soaData),
        billIds: bills.map(b => b.id),
      })
    }

    // Create the batch and documents in a transaction
    const batch = await prisma.$transaction(async (tx) => {
      // Create the batch
      const newBatch = await tx.sOABatch.create({
        data: {
          tenantId,
          batchNumber,
          asOfDate: cutoffDate,
          billingMonth: billingMonth ? new Date(billingMonth) : null,
          filterType,
          filterValue,
          status: "GENERATED",
          totalUnits: soaDocumentsData.length,
          totalAmount,
          totalBalance,
          generatedBy: user?.id || "system",
          remarks,
        }
      })

      // Create all documents
      for (const doc of soaDocumentsData) {
        await tx.sOADocument.create({
          data: {
            batchId: newBatch.id,
            unitId: doc.unitId,
            unitNumber: doc.unitNumber,
            ownerName: doc.ownerName,
            floorLevel: doc.floorLevel,
            totalBilled: doc.totalBilled,
            totalPaid: doc.totalPaid,
            currentBalance: doc.currentBalance,
            current: doc.current,
            days31to60: doc.days31to60,
            days61to90: doc.days61to90,
            over90days: doc.over90days,
            soaData: doc.soaData,
            bills: {
              connect: doc.billIds.map(id => ({ id }))
            }
          }
        })
      }

      return newBatch
    })

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        asOfDate: batch.asOfDate,
        status: batch.status,
        totalUnits: batch.totalUnits,
        totalAmount: Number(batch.totalAmount),
        totalBalance: Number(batch.totalBalance),
        createdAt: batch.createdAt
      }
    })
  } catch (error: any) {
    console.error("Error creating SOA batch:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create SOA batch" },
      { status: 500 }
    )
  }
}
