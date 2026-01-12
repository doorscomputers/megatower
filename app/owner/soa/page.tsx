"use client"

import { useEffect, useState } from "react"
import { OwnerLayout } from "@/components/layouts/owner-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Printer, Download, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface SOAData {
  asOfDate: string
  availableUnits: Array<{
    id: string
    unitNumber: string
    floorLevel: string
  }>
  unit: {
    id: string
    unitNumber: string
    floorLevel: string
    area: number
    unitType: string
  }
  owner: {
    id: string
    name: string
    email: string | null
    phone: string | null
    address: string | null
  }
  summary: {
    totalBilled: number
    totalPaid: number
    currentBalance: number
    billsCount: number
    paymentsCount: number
    unpaidBillsCount: number
  }
  aging: {
    current: number
    days31to60: number
    days61to90: number
    over90: number
  }
  transactions: Array<{
    date: string
    type: "BILL" | "PAYMENT"
    description: string
    billNumber?: string
    orNumber?: string
    reference?: string
    debit: number
    credit: number
    balance: number
    details?: any
  }>
}

export default function OwnerSOAPage() {
  const [soa, setSOA] = useState<SOAData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUnitId, setSelectedUnitId] = useState("")
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"))

  useEffect(() => {
    fetchSOA()
  }, [])

  const fetchSOA = async (unitId?: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (unitId) params.set("unitId", unitId)
      params.set("asOfDate", asOfDate)

      const res = await fetch(`/api/owner/soa?${params}`)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate SOA")
      }

      const data = await res.json()
      setSOA(data)
      if (!selectedUnitId && data.unit) {
        setSelectedUnitId(data.unit.id)
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId)
    fetchSOA(unitId)
  }

  const handleRefresh = () => {
    fetchSOA(selectedUnitId)
  }

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  if (loading && !soa) {
    return (
      <OwnerLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading Statement of Account...</div>
        </div>
      </OwnerLayout>
    )
  }

  return (
    <OwnerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="print:hidden">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Statement of Account
          </h1>
          <p className="text-gray-500">
            View your complete billing history
          </p>
        </div>

        {/* Controls */}
        {soa && soa.availableUnits.length > 1 && (
          <Card className="print:hidden">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="unit">Select Unit</Label>
                  <Select value={selectedUnitId} onValueChange={handleUnitChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {soa.availableUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.unitNumber} ({unit.floorLevel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-48">
                  <Label htmlFor="asOfDate">As of Date</Label>
                  <Input
                    id="asOfDate"
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <Button onClick={handleRefresh} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Print/Download Buttons */}
        {soa && (
          <div className="flex justify-end gap-2 print:hidden">
            <Button onClick={handlePrint} variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Print SOA
            </Button>
          </div>
        )}

        {/* SOA Content */}
        {soa && (
          <div className="bg-white p-4 md:p-8 rounded-lg border border-gray-200">
            {/* SOA Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                MEGA TOWER RESIDENCES
              </h2>
              <p className="text-gray-600">Condominium Corporation</p>
              <p className="text-sm text-gray-500 mt-2">
                Statement of Account
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6">
              {/* Unit Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Unit Information
                </h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Unit Number:</span>{" "}
                    {soa.unit.unitNumber}
                  </p>
                  <p>
                    <span className="font-medium">Floor:</span>{" "}
                    {soa.unit.floorLevel}
                  </p>
                  <p>
                    <span className="font-medium">Area:</span> {soa.unit.area}{" "}
                    sqm
                  </p>
                  <p>
                    <span className="font-medium">Type:</span>{" "}
                    {soa.unit.unitType}
                  </p>
                </div>
              </div>

              {/* Owner Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Owner Information
                </h3>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Name:</span> {soa.owner.name}
                  </p>
                  {soa.owner.email && (
                    <p>
                      <span className="font-medium">Email:</span>{" "}
                      {soa.owner.email}
                    </p>
                  )}
                  {soa.owner.phone && (
                    <p>
                      <span className="font-medium">Phone:</span>{" "}
                      {soa.owner.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mb-6">
              <p className="text-sm text-gray-600">
                <span className="font-medium">As of Date:</span>{" "}
                {format(new Date(soa.asOfDate), "MMMM dd, yyyy")}
              </p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
              <div className="bg-blue-50 p-3 md:p-4 rounded-lg border border-blue-200">
                <p className="text-xs md:text-sm text-blue-600 font-medium">
                  Total Billed
                </p>
                <p className="text-lg md:text-xl font-bold text-blue-900">
                  {formatCurrency(soa.summary.totalBilled)}
                </p>
              </div>

              <div className="bg-green-50 p-3 md:p-4 rounded-lg border border-green-200">
                <p className="text-xs md:text-sm text-green-600 font-medium">
                  Total Paid
                </p>
                <p className="text-lg md:text-xl font-bold text-green-900">
                  {formatCurrency(soa.summary.totalPaid)}
                </p>
              </div>

              <div
                className={`p-3 md:p-4 rounded-lg border ${
                  soa.summary.currentBalance > 0
                    ? "bg-red-50 border-red-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <p
                  className={`text-xs md:text-sm font-medium ${
                    soa.summary.currentBalance > 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  Balance Due
                </p>
                <p
                  className={`text-lg md:text-xl font-bold ${
                    soa.summary.currentBalance > 0
                      ? "text-red-900"
                      : "text-gray-900"
                  }`}
                >
                  {formatCurrency(soa.summary.currentBalance)}
                </p>
              </div>

              <div className="bg-purple-50 p-3 md:p-4 rounded-lg border border-purple-200">
                <p className="text-xs md:text-sm text-purple-600 font-medium">Status</p>
                <div className="mt-1">
                  {soa.summary.currentBalance === 0 ? (
                    <Badge className="bg-green-500 text-white">Paid in Full</Badge>
                  ) : soa.summary.currentBalance > 0 ? (
                    <Badge variant="danger">Outstanding</Badge>
                  ) : (
                    <Badge variant="secondary">Overpaid</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Aging Analysis */}
            {soa.summary.currentBalance > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Aging Analysis
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-gray-600">Current (0-30 days)</p>
                    <p className="text-base md:text-lg font-semibold text-gray-900">
                      {formatCurrency(soa.aging.current)}
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-gray-600">31-60 days</p>
                    <p className="text-base md:text-lg font-semibold text-yellow-700">
                      {formatCurrency(soa.aging.days31to60)}
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-gray-600">61-90 days</p>
                    <p className="text-base md:text-lg font-semibold text-orange-700">
                      {formatCurrency(soa.aging.days61to90)}
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-gray-600">Over 90 days</p>
                    <p className="text-base md:text-lg font-semibold text-red-700">
                      {formatCurrency(soa.aging.over90)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Transaction History
              </h3>
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-left p-3 font-medium">Reference</th>
                      <th className="text-right p-3 font-medium">Debit</th>
                      <th className="text-right p-3 font-medium">Credit</th>
                      <th className="text-right p-3 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soa.transactions.map((transaction, index) => (
                      <tr
                        key={index}
                        className={`border-b ${
                          transaction.type === "BILL"
                            ? "bg-red-50"
                            : "bg-green-50"
                        }`}
                      >
                        <td className="p-3">
                          {format(new Date(transaction.date), "MMM dd, yyyy")}
                        </td>
                        <td className="p-3">{transaction.description}</td>
                        <td className="p-3 text-xs text-gray-600">
                          {transaction.billNumber || transaction.orNumber || "-"}
                        </td>
                        <td className="p-3 text-right font-mono text-red-600">
                          {transaction.debit > 0
                            ? formatCurrency(transaction.debit)
                            : "-"}
                        </td>
                        <td className="p-3 text-right font-mono text-green-600">
                          {transaction.credit > 0
                            ? formatCurrency(transaction.credit)
                            : "-"}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {formatCurrency(transaction.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold">
                    <tr>
                      <td colSpan={3} className="p-3 text-right">
                        Total:
                      </td>
                      <td className="p-3 text-right font-mono text-red-600">
                        {formatCurrency(soa.summary.totalBilled)}
                      </td>
                      <td className="p-3 text-right font-mono text-green-600">
                        {formatCurrency(soa.summary.totalPaid)}
                      </td>
                      <td className="p-3 text-right font-mono text-blue-600">
                        {formatCurrency(soa.summary.currentBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center text-xs text-gray-500">
              <p>
                This is a computer-generated statement. No signature required.
              </p>
              <p className="mt-1">
                Generated on {format(new Date(), "MMMM dd, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!soa && !loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 text-center">
                Unable to load Statement of Account. Please try again later.
              </p>
              <Button onClick={() => fetchSOA()} className="mt-4">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </OwnerLayout>
  )
}
