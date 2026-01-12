"use client"

import { useState, useEffect, use } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import {
  FileText,
  Printer,
  Download,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react"
import Link from "next/link"

interface SOADocumentData {
  id: string
  batchNumber: string
  asOfDate: string
  batchStatus: string
  distributedAt: string | null
  unitNumber: string
  ownerName: string
  floorLevel: string
  summary: {
    totalBilled: number
    totalPaid: number
    currentBalance: number
  }
  aging: {
    current: number
    days31to60: number
    days61to90: number
    over90days: number
  }
  soaData: {
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
    } | null
    summary: {
      totalBilled: number
      totalPaid: number
      currentBalance: number
      billsCount: number
      paymentsCount: number
    }
    aging: {
      current: number
      days31to60: number
      days61to90: number
      over90days: number
    }
    transactions: Array<{
      date: string
      type: "BILL" | "PAYMENT"
      description: string
      billNumber?: string
      orNumber?: string
      debit: number
      credit: number
      balance: number
    }>
    asOfDate: string
  }
  createdAt: string
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function ViewSOADocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [document, setDocument] = useState<SOADocumentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDocument()
  }, [id])

  const fetchDocument = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/billing/soa/archive/document/${id}`)
      if (response.ok) {
        const data = await response.json()
        setDocument(data.document)
      } else {
        const err = await response.json()
        setError(err.error || "Failed to load document")
      }
    } catch (error) {
      console.error("Error fetching document:", error)
      setError("Failed to load document")
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !document) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error || "Document not found"}</p>
          <Link href="/billing/soa/archive">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Archive
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const soa = document.soaData

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header - Hidden on print */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4">
            <Link href="/billing/soa/archive">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Archive
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">SOA Document</h1>
              <p className="text-sm text-gray-500">
                Batch: {document.batchNumber} | Unit: {document.unitNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {document.batchStatus === "DISTRIBUTED" ? (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Distributed
              </Badge>
            ) : (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                <Clock className="w-3 h-3 mr-1" />
                Not Distributed
              </Badge>
            )}
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Printable SOA */}
        <Card className="print:shadow-none print:border-none">
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center border-b pb-6 mb-6">
              <h1 className="text-2xl font-bold text-gray-900">MEGA TOWER RESIDENCES</h1>
              <p className="text-gray-600">Statement of Account</p>
              <p className="text-sm text-gray-500 mt-2">
                As of {format(new Date(soa.asOfDate), "MMMM dd, yyyy")}
              </p>
            </div>

            {/* Unit/Owner Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Unit Information</h3>
                <div className="space-y-1">
                  <p><span className="text-gray-500">Unit Number:</span> <strong>{soa.unit.unitNumber}</strong></p>
                  <p><span className="text-gray-500">Floor:</span> {soa.unit.floorLevel}</p>
                  <p><span className="text-gray-500">Area:</span> {soa.unit.area} sqm</p>
                  <p><span className="text-gray-500">Type:</span> {soa.unit.unitType}</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Owner Information</h3>
                {soa.owner ? (
                  <div className="space-y-1">
                    <p><strong>{soa.owner.name}</strong></p>
                    {soa.owner.email && <p className="text-sm text-gray-600">{soa.owner.email}</p>}
                    {soa.owner.phone && <p className="text-sm text-gray-600">{soa.owner.phone}</p>}
                  </div>
                ) : (
                  <p className="text-gray-500">No owner assigned</p>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-sm text-blue-600 font-medium">Total Billed</p>
                <p className="text-xl font-bold text-blue-900">{formatCurrency(soa.summary.totalBilled)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-green-600 font-medium">Total Paid</p>
                <p className="text-xl font-bold text-green-900">{formatCurrency(soa.summary.totalPaid)}</p>
              </div>
              <div className={`p-4 rounded-lg text-center ${soa.summary.currentBalance > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <p className={`text-sm font-medium ${soa.summary.currentBalance > 0 ? 'text-red-600' : 'text-gray-600'}`}>Current Balance</p>
                <p className={`text-xl font-bold ${soa.summary.currentBalance > 0 ? 'text-red-900' : 'text-gray-900'}`}>
                  {formatCurrency(soa.summary.currentBalance)}
                </p>
              </div>
            </div>

            {/* Aging Analysis */}
            {soa.summary.currentBalance > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Aging Analysis</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded text-center">
                    <p className="text-gray-500">Current (0-30)</p>
                    <p className="font-semibold">{formatCurrency(soa.aging.current)}</p>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded text-center">
                    <p className="text-yellow-600">31-60 Days</p>
                    <p className="font-semibold text-yellow-700">{formatCurrency(soa.aging.days31to60)}</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded text-center">
                    <p className="text-orange-600">61-90 Days</p>
                    <p className="font-semibold text-orange-700">{formatCurrency(soa.aging.days61to90)}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded text-center">
                    <p className="text-red-600">Over 90 Days</p>
                    <p className="font-semibold text-red-700">{formatCurrency(soa.aging.over90days)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction History */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Transaction History</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Description</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Reference</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">Debit</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">Credit</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {soa.transactions.map((tx, index) => (
                      <tr key={index} className={tx.type === "PAYMENT" ? "bg-green-50" : ""}>
                        <td className="px-4 py-2 text-gray-600">
                          {format(new Date(tx.date), "MM/dd/yyyy")}
                        </td>
                        <td className="px-4 py-2 text-gray-900">{tx.description}</td>
                        <td className="px-4 py-2 text-gray-600">
                          {tx.billNumber || tx.orNumber || "-"}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          {tx.debit > 0 ? formatCurrency(tx.debit) : "-"}
                        </td>
                        <td className="px-4 py-2 text-right text-green-600">
                          {tx.credit > 0 ? formatCurrency(tx.credit) : "-"}
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${tx.balance > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatCurrency(tx.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500">
              <p>This is a computer-generated statement from SOA Archive</p>
              <p>Batch: {document.batchNumber} | Generated: {format(new Date(document.createdAt), "MMMM dd, yyyy")}</p>
              {document.distributedAt && (
                <p className="text-green-600 mt-1">
                  Distributed: {format(new Date(document.distributedAt), "MMMM dd, yyyy")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}
