"use client"

import { useEffect, useState } from "react"
import { OwnerLayout } from "@/components/layouts/owner-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreditCard, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Payment {
  id: string
  orNumber: string | null
  arNumber: string | null
  paymentDate: string
  amount: number
  paymentMethod: string
  referenceNumber: string | null
  checkNumber: string | null
  checkDate: string | null
  bankName: string | null
  status: string
  remarks: string | null
  unit: {
    unitNumber: string
    floorLevel: string
  }
  appliedToBills: Array<{
    billNumber: string
    billingMonth: string
    amount: number
  }>
}

export default function OwnerPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/owner/payments")
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to fetch payments")
      }
      const data = await res.json()
      setPayments(data.payments)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      CASH: "bg-green-500",
      CHECK: "bg-blue-500",
      BANK_TRANSFER: "bg-purple-500",
      GCASH: "bg-blue-400",
      PAYMAYA: "bg-green-400",
      CREDIT_CARD: "bg-orange-500",
      DEBIT_CARD: "bg-orange-400",
    }
    return (
      <Badge className={`${colors[method] || "bg-gray-500"} text-white`}>
        {method.replace("_", " ")}
      </Badge>
    )
  }

  const toggleExpand = (paymentId: string) => {
    setExpandedPayments((prev) => {
      const next = new Set(prev)
      if (next.has(paymentId)) {
        next.delete(paymentId)
      } else {
        next.add(paymentId)
      }
      return next
    })
  }

  // Calculate totals
  const totalPaid = payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((sum, p) => sum + p.amount, 0)

  const thisYearPayments = payments.filter(
    (p) =>
      p.status === "CONFIRMED" &&
      new Date(p.paymentDate).getFullYear() === new Date().getFullYear()
  )
  const totalThisYear = thisYearPayments.reduce((sum, p) => sum + p.amount, 0)

  if (loading) {
    return (
      <OwnerLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading payments...</div>
        </div>
      </OwnerLayout>
    )
  }

  return (
    <OwnerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Payment History</h1>
          <p className="text-gray-500">View all your payment transactions</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Payments</p>
              <p className="text-2xl font-bold">{payments.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Paid (All Time)</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(totalPaid)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Paid This Year</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalThisYear)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payments List */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Transactions</CardTitle>
            <CardDescription>Click on a payment to see details</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CreditCard className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No payments found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="border rounded-lg overflow-hidden">
                    {/* Payment Header - Always Visible */}
                    <div
                      className="p-4 bg-green-50 hover:bg-green-100 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(payment.id)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">
                              {format(new Date(payment.paymentDate), "MMMM dd, yyyy")}
                            </p>
                            {getMethodBadge(payment.paymentMethod)}
                          </div>
                          <p className="text-sm text-gray-500">
                            {payment.unit.unitNumber}
                            {payment.orNumber && ` • OR# ${payment.orNumber}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-bold text-green-600">
                            {formatCurrency(payment.amount)}
                          </p>
                          {expandedPayments.has(payment.id) ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Payment Details - Expandable */}
                    {expandedPayments.has(payment.id) && (
                      <div className="p-4 border-t bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Receipt Info */}
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Receipt Information</p>
                            <div className="space-y-1 text-sm">
                              {payment.orNumber && (
                                <p>
                                  <span className="font-medium">OR#:</span> {payment.orNumber}
                                </p>
                              )}
                              {payment.arNumber && (
                                <p>
                                  <span className="font-medium">AR#:</span> {payment.arNumber}
                                </p>
                              )}
                              <p>
                                <span className="font-medium">Method:</span>{" "}
                                {payment.paymentMethod.replace("_", " ")}
                              </p>
                              <p>
                                <span className="font-medium">Status:</span>{" "}
                                <Badge
                                  variant={
                                    payment.status === "CONFIRMED"
                                      ? "default"
                                      : payment.status === "CANCELLED"
                                      ? "danger"
                                      : "secondary"
                                  }
                                >
                                  {payment.status}
                                </Badge>
                              </p>
                            </div>
                          </div>

                          {/* Check/Transfer Info */}
                          {(payment.checkNumber ||
                            payment.referenceNumber ||
                            payment.bankName) && (
                            <div>
                              <p className="text-sm text-gray-500 mb-2">
                                Payment Details
                              </p>
                              <div className="space-y-1 text-sm">
                                {payment.checkNumber && (
                                  <p>
                                    <span className="font-medium">Check#:</span>{" "}
                                    {payment.checkNumber}
                                  </p>
                                )}
                                {payment.checkDate && (
                                  <p>
                                    <span className="font-medium">Check Date:</span>{" "}
                                    {format(new Date(payment.checkDate), "MMM dd, yyyy")}
                                  </p>
                                )}
                                {payment.bankName && (
                                  <p>
                                    <span className="font-medium">Bank:</span>{" "}
                                    {payment.bankName}
                                  </p>
                                )}
                                {payment.referenceNumber && (
                                  <p>
                                    <span className="font-medium">Ref#:</span>{" "}
                                    {payment.referenceNumber}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Applied To Bills */}
                          {payment.appliedToBills.length > 0 && (
                            <div className="md:col-span-2">
                              <p className="text-sm text-gray-500 mb-2">Applied to Bills</p>
                              <div className="space-y-2">
                                {payment.appliedToBills.map((bill, index) => (
                                  <div
                                    key={index}
                                    className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm"
                                  >
                                    <span>
                                      {format(new Date(bill.billingMonth), "MMM yyyy")} (
                                      {bill.billNumber})
                                    </span>
                                    <span className="font-medium">
                                      {formatCurrency(bill.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Remarks */}
                          {payment.remarks && (
                            <div className="md:col-span-2">
                              <p className="text-sm text-gray-500 mb-1">Remarks</p>
                              <p className="text-sm">{payment.remarks}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </OwnerLayout>
  )
}
