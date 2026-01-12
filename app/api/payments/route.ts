import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - List all payments
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get("unitId")
    const billId = searchParams.get("billId")

    const where: any = {
      tenantId,
    }

    if (unitId) {
      where.unitId = unitId
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        unit: {
          include: {
            owner: true,
          },
        },
        billPayments: {
          include: {
            bill: true,
          },
        },
      },
      orderBy: {
        paymentDate: "desc",
      },
    })

    // If filtering by billId, filter the results
    let filteredPayments = payments
    if (billId) {
      filteredPayments = payments.filter((p) =>
        p.billPayments.some((bp) => bp.billId === billId)
      )
    }

    // Transform owner data to include computed name field
    const transformedPayments = filteredPayments.map((payment) => ({
      ...payment,
      unit: {
        ...payment.unit,
        owner: payment.unit.owner ? {
          ...payment.unit.owner,
          name: `${payment.unit.owner.lastName}, ${payment.unit.owner.firstName}${payment.unit.owner.middleName ? ` ${payment.unit.owner.middleName.charAt(0)}.` : ''}`,
        } : null,
      },
    }))

    return NextResponse.json(transformedPayments)
  } catch (error: any) {
    console.error("Error fetching payments:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch payments" },
      { status: 500 }
    )
  }
}

// POST - Record new payment with component amounts
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const body = await request.json()
    const {
      unitId,
      orNumber,
      paymentDate,
      paymentMethod,
      referenceNumber,
      checkNumber,
      checkDate,
      bankName,
      remarks,
      // Component amounts
      electricAmount = 0,
      waterAmount = 0,
      duesAmount = 0,
      pastDuesAmount = 0,
      spAssessmentAmount = 0,
      advanceDuesAmount = 0,
      advanceUtilAmount = 0,
      otherAdvanceAmount = 0,
    } = body

    // Validate required fields
    if (!unitId || !paymentDate || !paymentMethod) {
      return NextResponse.json(
        { error: "Missing required fields: unitId, paymentDate, paymentMethod" },
        { status: 400 }
      )
    }

    // Validate no negative amounts
    const componentAmounts = [
      { name: "electricAmount", value: electricAmount },
      { name: "waterAmount", value: waterAmount },
      { name: "duesAmount", value: duesAmount },
      { name: "pastDuesAmount", value: pastDuesAmount },
      { name: "spAssessmentAmount", value: spAssessmentAmount },
      { name: "advanceDuesAmount", value: advanceDuesAmount },
      { name: "advanceUtilAmount", value: advanceUtilAmount },
      { name: "otherAdvanceAmount", value: otherAdvanceAmount },
    ]

    for (const { name, value } of componentAmounts) {
      if (value < 0) {
        return NextResponse.json(
          { error: `${name} cannot be negative` },
          { status: 400 }
        )
      }
    }

    // Calculate total
    const totalAmount =
      electricAmount +
      waterAmount +
      duesAmount +
      pastDuesAmount +
      spAssessmentAmount +
      advanceDuesAmount +
      advanceUtilAmount +
      otherAdvanceAmount

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "Total payment amount must be greater than zero" },
        { status: 400 }
      )
    }

    // Validate unit belongs to tenant
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, tenantId },
    })

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found or unauthorized" },
        { status: 404 }
      )
    }

    // Check if OR# already exists for this tenant
    if (orNumber) {
      const existingPayment = await prisma.payment.findFirst({
        where: { tenantId, orNumber },
      })
      if (existingPayment) {
        return NextResponse.json(
          { error: `OR# ${orNumber} already exists` },
          { status: 400 }
        )
      }
    }

    // Transaction to create payment and allocate to bills
    const result = await prisma.$transaction(async (tx) => {
      // Create the payment with component amounts
      const payment = await tx.payment.create({
        data: {
          tenantId,
          unitId,
          orNumber: orNumber || null,
          paymentDate: new Date(paymentDate),
          paymentMethod,
          referenceNumber: referenceNumber || null,
          checkNumber: checkNumber || null,
          checkDate: checkDate ? new Date(checkDate) : null,
          bankName: bankName || null,
          remarks: remarks || null,
          // Component amounts
          electricAmount,
          waterAmount,
          duesAmount,
          pastDuesAmount,
          spAssessmentAmount,
          advanceDuesAmount,
          advanceUtilAmount,
          otherAdvanceAmount,
          totalAmount,
          status: "CONFIRMED",
        },
      })

      const billPaymentsCreated = []

      // Get unpaid bills for FIFO allocation
      const unpaidBills = await tx.bill.findMany({
        where: {
          unitId,
          tenantId,
          status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
        },
        orderBy: { billingMonth: "asc" },
        include: {
          payments: {
            select: {
              electricAmount: true,
              waterAmount: true,
              duesAmount: true,
              penaltyAmount: true,
              spAssessmentAmount: true,
            },
          },
        },
      })

      // Track remaining amounts to allocate
      let remainingElectric = electricAmount
      let remainingWater = waterAmount
      let remainingDues = duesAmount
      let remainingPenalty = pastDuesAmount
      let remainingSP = spAssessmentAmount

      // Allocate each component to bills (FIFO)
      for (const bill of unpaidBills) {
        if (
          remainingElectric <= 0 &&
          remainingWater <= 0 &&
          remainingDues <= 0 &&
          remainingPenalty <= 0 &&
          remainingSP <= 0
        ) {
          break
        }

        // Calculate what's already been paid for each component on this bill
        const paidElectric = bill.payments.reduce(
          (sum, p) => sum + Number(p.electricAmount),
          0
        )
        const paidWater = bill.payments.reduce(
          (sum, p) => sum + Number(p.waterAmount),
          0
        )
        const paidDues = bill.payments.reduce(
          (sum, p) => sum + Number(p.duesAmount),
          0
        )
        const paidPenalty = bill.payments.reduce(
          (sum, p) => sum + Number(p.penaltyAmount),
          0
        )
        const paidSP = bill.payments.reduce(
          (sum, p) => sum + Number(p.spAssessmentAmount),
          0
        )

        // Calculate outstanding for each component on this bill
        const outstandingElectric = Math.max(
          0,
          Number(bill.electricAmount) - paidElectric
        )
        const outstandingWater = Math.max(
          0,
          Number(bill.waterAmount) - paidWater
        )
        const outstandingDues = Math.max(
          0,
          Number(bill.associationDues) - paidDues
        )
        const outstandingPenalty = Math.max(
          0,
          Number(bill.penaltyAmount) - paidPenalty
        )
        const outstandingSP = Math.max(
          0,
          Number(bill.spAssessment) - paidSP
        )

        // Allocate what we can to this bill
        const allocElectric = Math.min(remainingElectric, outstandingElectric)
        const allocWater = Math.min(remainingWater, outstandingWater)
        const allocDues = Math.min(remainingDues, outstandingDues)
        const allocPenalty = Math.min(remainingPenalty, outstandingPenalty)
        const allocSP = Math.min(remainingSP, outstandingSP)

        const allocTotal =
          allocElectric + allocWater + allocDues + allocPenalty + allocSP

        if (allocTotal > 0) {
          // Create BillPayment record
          const billPayment = await tx.billPayment.create({
            data: {
              paymentId: payment.id,
              billId: bill.id,
              electricAmount: allocElectric,
              waterAmount: allocWater,
              duesAmount: allocDues,
              penaltyAmount: allocPenalty,
              spAssessmentAmount: allocSP,
              otherAmount: 0,
              totalAmount: allocTotal,
            },
          })

          billPaymentsCreated.push(billPayment)

          // Update bill paid amount and status
          const newPaidAmount = Number(bill.paidAmount) + allocTotal
          const newBalance = Number(bill.totalAmount) - newPaidAmount
          const newStatus =
            newBalance <= 0.01
              ? "PAID"
              : newPaidAmount > 0
              ? "PARTIAL"
              : "UNPAID"

          await tx.bill.update({
            where: { id: bill.id },
            data: {
              paidAmount: newPaidAmount,
              balance: Math.max(0, newBalance),
              status: newStatus,
            },
          })

          // Reduce remaining amounts
          remainingElectric -= allocElectric
          remainingWater -= allocWater
          remainingDues -= allocDues
          remainingPenalty -= allocPenalty
          remainingSP -= allocSP
        }
      }

      // Handle advance payments AND leftover amounts from overpayment
      // Leftover utilities (electric + water) go to advanceUtilities
      // Leftover dues go to advanceDues
      const leftoverUtilities = remainingElectric + remainingWater
      const leftoverDues = remainingDues

      // Total advance = explicit advance + leftover from overpayment
      const totalAdvanceDues = advanceDuesAmount + leftoverDues
      const totalAdvanceUtilities = advanceUtilAmount + leftoverUtilities

      if (totalAdvanceDues > 0 || totalAdvanceUtilities > 0) {
        await tx.unitAdvanceBalance.upsert({
          where: {
            tenantId_unitId: {
              tenantId,
              unitId,
            },
          },
          update: {
            advanceDues: {
              increment: totalAdvanceDues,
            },
            advanceUtilities: {
              increment: totalAdvanceUtilities,
            },
          },
          create: {
            tenantId,
            unitId,
            advanceDues: totalAdvanceDues,
            advanceUtilities: totalAdvanceUtilities,
          },
        })
      }

      return {
        payment,
        billPayments: billPaymentsCreated,
        totalAdvanceDues,
        totalAdvanceUtilities,
      }
    })

    // Build success message
    let message = "Payment recorded successfully"
    const totalAdvanceCredit = result.totalAdvanceDues + result.totalAdvanceUtilities
    if (totalAdvanceCredit > 0) {
      message = `Payment recorded. ₱${totalAdvanceCredit.toFixed(2)} added as advance credit.`
    }

    return NextResponse.json({
      success: true,
      payment: result.payment,
      billPayments: result.billPayments,
      message,
    })
  } catch (error: any) {
    console.error("Error creating payment:", error)
    return NextResponse.json(
      { error: error.message || "Failed to record payment" },
      { status: 500 }
    )
  }
}
