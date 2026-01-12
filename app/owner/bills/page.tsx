"use client"

import { useEffect, useState } from "react"
import { OwnerLayout } from "@/components/layouts/owner-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Bill {
  id: string
  billNumber: string
  billingMonth: string
  billingPeriodStart: string
  billingPeriodEnd: string
  statementDate: string
  dueDate: string
  electricAmount: number
  waterAmount: number
  associationDues: number
  penaltyAmount: number
  otherCharges: number
  totalAmount: number
  paidAmount: number
  balance: number
  status: string
  unit: {
    unitNumber: string
    floorLevel: string
  }
}

export default function OwnerBillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchBills()
  }, [])

  const fetchBills = async () => {
    try {
      const res = await fetch("/api/owner/bills")
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to fetch bills")
      }
      const data = await res.json()
      setBills(data.bills)
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-500 text-white">Paid</Badge>
      case "PARTIAL":
        return <Badge className="bg-yellow-500 text-white">Partial</Badge>
      case "OVERDUE":
        return <Badge variant="danger">Overdue</Badge>
      case "UNPAID":
        return <Badge variant="secondary">Unpaid</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const toggleExpand = (billId: string) => {
    setExpandedBills((prev) => {
      const next = new Set(prev)
      if (next.has(billId)) {
        next.delete(billId)
      } else {
        next.add(billId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <OwnerLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading bills...</div>
        </div>
      </OwnerLayout>
    )
  }

  return (
    <OwnerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Bills</h1>
          <p className="text-gray-500">View all your billing statements</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Bills</p>
              <p className="text-2xl font-bold">{bills.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Unpaid</p>
              <p className="text-2xl font-bold text-yellow-600">
                {bills.filter((b) => b.status === "UNPAID" || b.status === "PARTIAL").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Overdue</p>
              <p className="text-2xl font-bold text-red-600">
                {bills.filter((b) => b.status === "OVERDUE").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Balance</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(
                  bills.reduce((sum, b) => sum + b.balance, 0)
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bills List */}
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>Click on a bill to see details</CardDescription>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No bills found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bills.map((bill) => (
                  <div key={bill.id} className="border rounded-lg overflow-hidden">
                    {/* Bill Header - Always Visible */}
                    <div
                      className={`p-4 cursor-pointer transition-colors ${
                        bill.status === "OVERDUE"
                          ? "bg-red-50 hover:bg-red-100"
                          : bill.status === "PAID"
                          ? "bg-green-50 hover:bg-green-100"
                          : "bg-gray-50 hover:bg-gray-100"
                      }`}
                      onClick={() => toggleExpand(bill.id)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {format(new Date(bill.billingMonth), "MMMM yyyy")}
                            </p>
                            {getStatusBadge(bill.status)}
                          </div>
                          <p className="text-sm text-gray-500">
                            {bill.unit.unitNumber} • Bill #{bill.billNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatCurrency(bill.totalAmount)}
                            </p>
                            {bill.balance > 0 && bill.balance !== bill.totalAmount && (
                              <p className="text-sm text-red-600">
                                Balance: {formatCurrency(bill.balance)}
                              </p>
                            )}
                          </div>
                          {expandedBills.has(bill.id) ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bill Details - Expandable */}
                    {expandedBills.has(bill.id) && (
                      <div className="p-4 border-t bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Billing Period */}
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Billing Period</p>
                            <p className="text-sm">
                              {format(new Date(bill.billingPeriodStart), "MMM dd")} -{" "}
                              {format(new Date(bill.billingPeriodEnd), "MMM dd, yyyy")}
                            </p>
                          </div>

                          {/* Dates */}
                          <div>
                            <p className="text-sm text-gray-500 mb-2">Important Dates</p>
                            <p className="text-sm">
                              Statement: {format(new Date(bill.statementDate), "MMM dd, yyyy")}
                            </p>
                            <p className="text-sm">
                              Due: {format(new Date(bill.dueDate), "MMM dd, yyyy")}
                            </p>
                          </div>

                          {/* Breakdown */}
                          <div className="md:col-span-2">
                            <p className="text-sm text-gray-500 mb-2">Breakdown</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                              <div className="flex justify-between p-2 bg-gray-50 rounded">
                                <span>Electric:</span>
                                <span className="font-medium">
                                  {formatCurrency(bill.electricAmount)}
                                </span>
                              </div>
                              <div className="flex justify-between p-2 bg-gray-50 rounded">
                                <span>Water:</span>
                                <span className="font-medium">
                                  {formatCurrency(bill.waterAmount)}
                                </span>
                              </div>
                              <div className="flex justify-between p-2 bg-gray-50 rounded">
                                <span>Assoc. Dues:</span>
                                <span className="font-medium">
                                  {formatCurrency(bill.associationDues)}
                                </span>
                              </div>
                              {bill.penaltyAmount > 0 && (
                                <div className="flex justify-between p-2 bg-red-50 rounded">
                                  <span>Penalty:</span>
                                  <span className="font-medium text-red-600">
                                    {formatCurrency(bill.penaltyAmount)}
                                  </span>
                                </div>
                              )}
                              {bill.otherCharges > 0 && (
                                <div className="flex justify-between p-2 bg-gray-50 rounded">
                                  <span>Other:</span>
                                  <span className="font-medium">
                                    {formatCurrency(bill.otherCharges)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Payment Status */}
                          <div className="md:col-span-2 pt-2 border-t">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <p className="text-sm text-gray-500">Payment Status</p>
                                <p className="text-sm">
                                  Paid: {formatCurrency(bill.paidAmount)} of{" "}
                                  {formatCurrency(bill.totalAmount)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-500">Balance Due</p>
                                <p
                                  className={`text-lg font-bold ${
                                    bill.balance > 0 ? "text-red-600" : "text-green-600"
                                  }`}
                                >
                                  {formatCurrency(bill.balance)}
                                </p>
                              </div>
                            </div>
                          </div>
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
