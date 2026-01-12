"use client"

import { useState, useEffect, useMemo } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Receipt,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth } from "date-fns"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface PaymentRecord {
  id: string
  orNumber: string | null
  arNumber: string | null
  paymentDate: string
  unitNumber: string
  floorLevel: string
  paymentMethod: string
  checkNumber: string | null
  bankName: string | null
  referenceNumber: string | null
  electric: number
  water: number
  dues: number
  penalty: number
  spAssessment: number
  advance: number
  totalAmount: number
  remarks: string | null
}

interface ReportData {
  data: PaymentRecord[]
  summary: {
    totalPayments: number
    totalAmount: number
    byMethod: Record<string, { count: number; total: number }>
    byComponent: {
      electric: number
      water: number
      dues: number
      penalty: number
      spAssessment: number
    }
    dateRange: { start: string; end: string }
  }
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
  generatedAt: string
}

const METHODS = ["", "CASH", "CHECK", "BANK_TRANSFER", "GCASH", "PAYMAYA", "CREDIT_CARD", "DEBIT_CARD"]

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank Transfer",
  GCASH: "GCash",
  PAYMAYA: "PayMaya",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
}

type SortField = "orNumber" | "paymentDate" | "unitNumber" | "paymentMethod" | "electric" | "water" | "dues" | "totalAmount"
type SortOrder = "asc" | "desc"

export default function PaymentHistoryPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"))
  const [floorFilter, setFloorFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("")
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
  const [floors, setFloors] = useState<string[]>([])

  // Filter and sort payments
  const filteredPayments = useMemo(() => {
    if (!report) return []

    let filtered = report.data

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((p) =>
        (p.orNumber?.toLowerCase() || "").includes(term) ||
        p.unitNumber.toLowerCase().includes(term) ||
        (methodLabels[p.paymentMethod] || p.paymentMethod).toLowerCase().includes(term)
      )
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any, bVal: any
        switch (sortField) {
          case "orNumber": aVal = a.orNumber || ""; bVal = b.orNumber || ""; break
          case "paymentDate": aVal = new Date(a.paymentDate).getTime(); bVal = new Date(b.paymentDate).getTime(); break
          case "unitNumber": aVal = a.unitNumber; bVal = b.unitNumber; break
          case "paymentMethod": aVal = a.paymentMethod; bVal = b.paymentMethod; break
          case "electric": aVal = a.electric; bVal = b.electric; break
          case "water": aVal = a.water; bVal = b.water; break
          case "dues": aVal = a.dues; bVal = b.dues; break
          case "totalAmount": aVal = a.totalAmount; bVal = b.totalAmount; break
          default: return 0
        }
        if (typeof aVal === "string") {
          return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        }
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal
      })
    }

    return filtered
  }, [report, searchTerm, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    return sortOrder === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
  }

  const fetchFloors = async () => {
    try {
      const res = await fetch("/api/floors")
      if (!res.ok) throw new Error("Failed to fetch floors")
      const data = await res.json()
      setFloors(["", ...data])
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const fetchReport = async () => {
    try {
      setLoading(true)
      let url = `/api/reports/payment-history?startDate=${startDate}&endDate=${endDate}&page=${page}`
      if (floorFilter) url += `&floor=${floorFilter}`
      if (methodFilter) url += `&method=${methodFilter}`

      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch report")
      const data = await res.json()
      setReport(data)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFloors()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [startDate, endDate, floorFilter, methodFilter, page])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push(["Payment History Report"])
    wsData.push([`Period: ${new Date(report.summary.dateRange.start).toLocaleDateString()} - ${new Date(report.summary.dateRange.end).toLocaleDateString()}`])
    wsData.push([])
    wsData.push(["OR#", "Date", "Unit", "Floor", "Method", "Electric", "Water", "Dues", "Penalty", "Total"])

    report.data.forEach((p) => {
      wsData.push([
        p.orNumber || "",
        new Date(p.paymentDate).toLocaleDateString(),
        p.unitNumber,
        p.floorLevel,
        methodLabels[p.paymentMethod] || p.paymentMethod,
        p.electric,
        p.water,
        p.dues,
        p.penalty,
        p.totalAmount
      ])
    })

    wsData.push([])
    wsData.push(["TOTAL", "", "", "", "", report.summary.byComponent.electric, report.summary.byComponent.water, report.summary.byComponent.dues, report.summary.byComponent.penalty, report.summary.totalAmount])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Payment History")

    XLSX.writeFile(wb, `Payment_History_${startDate}_${endDate}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text("Payment History Report", 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${new Date(report.summary.dateRange.start).toLocaleDateString()} - ${new Date(report.summary.dateRange.end).toLocaleDateString()}`, 14, 22)

    const tableData = report.data.map((p) => [
      p.orNumber || "",
      new Date(p.paymentDate).toLocaleDateString(),
      p.unitNumber,
      methodLabels[p.paymentMethod] || p.paymentMethod,
      formatCurrency(p.electric),
      formatCurrency(p.water),
      formatCurrency(p.dues),
      formatCurrency(p.totalAmount)
    ])

    autoTable(doc, {
      head: [["OR#", "Date", "Unit", "Method", "Electric", "Water", "Dues", "Total"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`Payment_History_${startDate}_${endDate}.pdf`)
    toast.success("PDF file downloaded")
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payment History</h1>
            <p className="text-gray-500">Detailed payment records</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportExcel} disabled={!report}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={!report}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!report}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="w-40">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="w-40">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="w-32">
                <Label>Floor</Label>
                <Select value={floorFilter || "all"} onValueChange={(v) => setFloorFilter(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {floors.filter(f => f !== "").map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label>Method</Label>
                <Select value={methodFilter || "all"} onValueChange={(v) => setMethodFilter(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {METHODS.slice(1).map((m) => (
                      <SelectItem key={m} value={m}>{methodLabels[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={fetchReport} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Search Input */}
            <div className="mt-4 relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search OR#, unit, method..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                <Receipt className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(report.summary.totalAmount)}
                </div>
                <p className="text-xs text-green-600">
                  {report.summary.totalPayments} payments
                </p>
              </CardContent>
            </Card>

            {Object.entries(report.summary.byMethod).slice(0, 3).map(([method, data]) => (
              <Card key={method}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{methodLabels[method] || method}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(data.total)}</div>
                  <p className="text-xs text-muted-foreground">{data.count} payments</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Payment Table */}
        {report && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Payment Records</CardTitle>
                {searchTerm && (
                  <p className="text-sm text-gray-500">
                    Showing {filteredPayments.length} of {report.data.length} records
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-2 font-medium">
                        <button type="button" onClick={() => handleSort("orNumber")} className="flex items-center hover:text-blue-600">
                          OR# <SortIcon field="orNumber" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-2 font-medium">
                        <button type="button" onClick={() => handleSort("paymentDate")} className="flex items-center hover:text-blue-600">
                          Date <SortIcon field="paymentDate" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-2 font-medium">
                        <button type="button" onClick={() => handleSort("unitNumber")} className="flex items-center hover:text-blue-600">
                          Unit <SortIcon field="unitNumber" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-2 font-medium">
                        <button type="button" onClick={() => handleSort("paymentMethod")} className="flex items-center hover:text-blue-600">
                          Method <SortIcon field="paymentMethod" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-2 font-medium">
                        <button type="button" onClick={() => handleSort("electric")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Electric <SortIcon field="electric" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-2 font-medium">
                        <button type="button" onClick={() => handleSort("water")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Water <SortIcon field="water" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-2 font-medium">
                        <button type="button" onClick={() => handleSort("dues")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Dues <SortIcon field="dues" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-2 font-medium">Penalty</th>
                      <th className="text-right py-3 px-2 font-medium">
                        <button type="button" onClick={() => handleSort("totalAmount")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Total <SortIcon field="totalAmount" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{p.orNumber || "-"}</td>
                        <td className="py-2 px-2">{new Date(p.paymentDate).toLocaleDateString()}</td>
                        <td className="py-2 px-2">{p.unitNumber}</td>
                        <td className="py-2 px-2">{methodLabels[p.paymentMethod] || p.paymentMethod}</td>
                        <td className="py-2 px-2 text-right">{p.electric > 0 ? formatCurrency(p.electric) : "-"}</td>
                        <td className="py-2 px-2 text-right">{p.water > 0 ? formatCurrency(p.water) : "-"}</td>
                        <td className="py-2 px-2 text-right">{p.dues > 0 ? formatCurrency(p.dues) : "-"}</td>
                        <td className="py-2 px-2 text-right">{p.penalty > 0 ? formatCurrency(p.penalty) : "-"}</td>
                        <td className="py-2 px-2 text-right font-bold text-green-600">{formatCurrency(p.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {report.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    Showing {(report.pagination.page - 1) * report.pagination.limit + 1} to{" "}
                    {Math.min(report.pagination.page * report.pagination.limit, report.pagination.totalCount)} of{" "}
                    {report.pagination.totalCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(report.pagination.totalPages, p + 1))}
                      disabled={page === report.pagination.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {report && (
          <p className="text-xs text-gray-400 text-center">
            Report generated: {new Date(report.generatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
