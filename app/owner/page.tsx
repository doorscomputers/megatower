"use client"

import { useEffect, useState } from "react"
import { OwnerLayout } from "@/components/layouts/owner-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Building2,
  DollarSign,
  AlertCircle,
  FileText,
  CreditCard,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import Link from "next/link"

interface OwnerData {
  owner: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
  units: Array<{
    id: string
    unitNumber: string
    floorLevel: string
    area: number
    unitType: string
  }>
  summary: {
    totalUnits: number
    totalBalance: number
    unpaidBillsCount: number
    overdueCount: number
    totalPaidThisYear: number
  }
  unpaidBills: Array<{
    id: string
    billNumber: string
    billingMonth: string
    totalAmount: number
    paidAmount: number
    balance: number
    status: string
    dueDate: string
    unit: { unitNumber: string }
  }>
  recentPayments: Array<{
    id: string
    orNumber: string | null
    paymentDate: string
    amount: number
    paymentMethod: string
    unit: { unitNumber: string }
  }>
}

export default function OwnerDashboardPage() {
  const [data, setData] = useState<OwnerData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOwnerData()
  }, [])

  const fetchOwnerData = async () => {
    try {
      const res = await fetch("/api/owner")
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to fetch data")
      }
      const result = await res.json()
      setData(result)
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

  if (loading) {
    return (
      <OwnerLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </OwnerLayout>
    )
  }

  if (!data) {
    return (
      <OwnerLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Failed to load data</div>
        </div>
      </OwnerLayout>
    )
  }

  return (
    <OwnerLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Welcome, {data.owner.name}
          </h1>
          <p className="text-gray-500">
            Here's an overview of your account
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Units</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalUnits}</div>
              <p className="text-xs text-gray-500">
                {data.units.map((u) => u.unitNumber).join(", ")}
              </p>
            </CardContent>
          </Card>

          <Card className={data.summary.totalBalance > 0 ? "border-red-200" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <DollarSign className={`h-4 w-4 ${data.summary.totalBalance > 0 ? "text-red-600" : "text-green-600"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.summary.totalBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                {formatCurrency(data.summary.totalBalance)}
              </div>
              <p className="text-xs text-gray-500">
                {data.summary.unpaidBillsCount} unpaid bill(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className={`h-4 w-4 ${data.summary.overdueCount > 0 ? "text-red-600" : "text-gray-400"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.summary.overdueCount > 0 ? "text-red-600" : "text-gray-900"}`}>
                {data.summary.overdueCount}
              </div>
              <p className="text-xs text-gray-500">
                {data.summary.overdueCount > 0 ? "Requires attention" : "All current"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid This Year</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(data.summary.totalPaidThisYear)}
              </div>
              <p className="text-xs text-gray-500">
                Year {new Date().getFullYear()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/owner/soa">
            <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">View Statement of Account</h3>
                  <p className="text-sm text-gray-500">See your complete billing history</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/owner/bills">
            <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">View All Bills</h3>
                  <p className="text-sm text-gray-500">Check all your billing statements</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Unpaid Bills */}
        {data.unpaidBills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Unpaid Bills</CardTitle>
              <CardDescription>Bills requiring payment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.unpaidBills.slice(0, 5).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg gap-2"
                  >
                    <div>
                      <p className="font-medium">
                        {bill.unit.unitNumber} - {format(new Date(bill.billingMonth), "MMMM yyyy")}
                      </p>
                      <p className="text-sm text-gray-500">
                        Bill #{bill.billNumber} • Due: {format(new Date(bill.dueDate), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={bill.status === "OVERDUE" ? "danger" : "secondary"}
                      >
                        {bill.status}
                      </Badge>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(bill.balance)}
                      </span>
                    </div>
                  </div>
                ))}
                {data.unpaidBills.length > 5 && (
                  <Link href="/owner/bills">
                    <Button variant="outline" className="w-full">
                      View All Bills ({data.unpaidBills.length})
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Payments */}
        {data.recentPayments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
              <CardDescription>Your latest payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-green-50 rounded-lg gap-2"
                  >
                    <div>
                      <p className="font-medium">
                        {payment.unit.unitNumber} - {payment.paymentMethod.replace("_", " ")}
                      </p>
                      <p className="text-sm text-gray-500">
                        {payment.orNumber ? `OR# ${payment.orNumber}` : "No OR#"} •{" "}
                        {format(new Date(payment.paymentDate), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                ))}
                <Link href="/owner/payments">
                  <Button variant="outline" className="w-full">
                    View All Payments
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Data State */}
        {data.unpaidBills.length === 0 && data.recentPayments.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-green-500 mb-4">
                <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">All Caught Up!</h3>
              <p className="text-gray-500 text-center">
                You have no outstanding bills. Great job staying current!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </OwnerLayout>
  )
}
