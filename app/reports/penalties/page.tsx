"use client"

import { useState, useEffect, useMemo } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Receipt,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  AlertTriangle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface MonthData {
  month: number
  monthName: string
  charged: number
  collected: number
  outstanding: number
  billsCount: number
}

interface PenaltyUnit {
  unitNumber: string
  ownerName: string
  billingMonth: string
  penaltyAmount: number
  balance: number
}

interface ReportData {
  year: number
  monthlyData: MonthData[]
  topPenaltyUnits: PenaltyUnit[]
  summary: {
    ytdCharged: number
    ytdCollected: number
    totalOutstandingPenalties: number
    totalBillsWithPenalty: number
    collectionRate: number
  }
  generatedAt: string
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
}

const formatNumber = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

type SortField = "unitNumber" | "ownerName" | "penaltyAmount" | "balance"
type SortOrder = "asc" | "desc"

export default function PenaltyReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const availableYears = Array.from({ length: 5 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  )

  // Filter and sort top penalty units
  const filteredPenaltyUnits = useMemo(() => {
    if (!report) return []

    let filtered = report.topPenaltyUnits

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((u) =>
        u.unitNumber.toLowerCase().includes(term) ||
        u.ownerName.toLowerCase().includes(term)
      )
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]
        if (typeof aVal === "string") {
          return sortOrder === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
        }
        return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
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

  const fetchReport = async () => {
    try {
      setLoading(true)
      const url = `/api/reports/penalties?year=${year}`
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
    fetchReport()
  }, [year])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push([`Penalty Report - ${report.year}`])
    wsData.push([])
    wsData.push(["Monthly Summary"])
    wsData.push(["Month", "Charged", "Collected", "Outstanding", "Bills Count"])

    report.monthlyData.forEach((m) => {
      wsData.push([m.monthName, m.charged, m.collected, m.outstanding, m.billsCount])
    })

    wsData.push([])
    wsData.push(["YTD TOTAL", report.summary.ytdCharged, report.summary.ytdCollected, report.summary.totalOutstandingPenalties, report.summary.totalBillsWithPenalty])

    wsData.push([])
    wsData.push(["Top Units with Outstanding Penalties"])
    wsData.push(["Unit", "Owner", "Billing Month", "Penalty", "Balance"])

    report.topPenaltyUnits.forEach((u) => {
      wsData.push([
        u.unitNumber,
        u.ownerName,
        new Date(u.billingMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        u.penaltyAmount,
        u.balance
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Penalties")

    XLSX.writeFile(wb, `Penalty_Report_${report.year}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text(`Penalty Report - ${report.year}`, 14, 15)

    const tableData = report.monthlyData.map((m) => [
      m.monthName,
      formatNumber(m.charged),
      formatNumber(m.collected),
      formatNumber(m.outstanding),
      m.billsCount.toString(),
    ])

    tableData.push([
      { content: "YTD TOTAL", styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.summary.ytdCharged), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.summary.ytdCollected), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.summary.totalOutstandingPenalties), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: report.summary.totalBillsWithPenalty.toString(), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
    ])

    autoTable(doc, {
      head: [["Month", "Charged", "Collected", "Outstanding", "Bills"]],
      body: tableData,
      startY: 22,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [236, 72, 153] },
    })

    doc.save(`Penalty_Report_${report.year}.pdf`)
    toast.success("PDF file downloaded")
  }

  const handlePrint = () => {
    window.print()
  }

  const maxPenalty = report ? Math.max(...report.monthlyData.map((m) => m.charged), 1) : 1

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Penalty Report</h1>
            <p className="text-gray-500">
              Track penalty charges and collections by month
            </p>
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
              <div className="w-32">
                <Label htmlFor="year">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={fetchReport} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-red-50 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">YTD Charged</CardTitle>
                <Receipt className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">
                  {formatCurrency(report.summary.ytdCharged)}
                </div>
                <p className="text-xs text-red-600">
                  {report.summary.totalBillsWithPenalty} bills with penalty
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">YTD Collected</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(report.summary.ytdCollected)}
                </div>
                <p className="text-xs text-green-600">
                  {report.summary.collectionRate}% collection rate
                </p>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 border-orange-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-700">
                  {formatCurrency(report.summary.totalOutstandingPenalties)}
                </div>
                <p className="text-xs text-orange-600">
                  All outstanding penalties
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  report.summary.collectionRate >= 80 ? "text-green-600" :
                  report.summary.collectionRate >= 50 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {report.summary.collectionRate}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly Chart */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Penalties ({report.year})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-2">
                {report.monthlyData.map((m) => (
                  <div
                    key={m.month}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${m.monthName}: Charged ${formatCurrency(m.charged)}, Collected ${formatCurrency(m.collected)}`}
                  >
                    <div className="w-full flex gap-1" style={{ height: "160px" }}>
                      <div
                        className="flex-1 bg-red-400 rounded-t"
                        style={{
                          height: `${(m.charged / maxPenalty) * 100}%`,
                          marginTop: "auto",
                        }}
                      />
                      <div
                        className="flex-1 bg-green-400 rounded-t"
                        style={{
                          height: `${(m.collected / maxPenalty) * 100}%`,
                          marginTop: "auto",
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {m.monthName.substring(0, 3)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-red-400 rounded"></span> Charged
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-green-400 rounded"></span> Collected
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Table */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-3 font-medium">Month</th>
                      <th className="text-right py-3 px-3 font-medium">Charged</th>
                      <th className="text-right py-3 px-3 font-medium">Collected</th>
                      <th className="text-right py-3 px-3 font-medium">Outstanding</th>
                      <th className="text-right py-3 px-3 font-medium">Bills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthlyData.map((m) => (
                      <tr key={m.month} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{m.monthName}</td>
                        <td className="py-2 px-3 text-right text-red-600">
                          {formatNumber(m.charged)}
                        </td>
                        <td className="py-2 px-3 text-right text-green-600">
                          {formatNumber(m.collected)}
                        </td>
                        <td className="py-2 px-3 text-right text-orange-600">
                          {formatNumber(m.outstanding)}
                        </td>
                        <td className="py-2 px-3 text-right">{m.billsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td className="py-3 px-3">YTD TOTAL</td>
                      <td className="py-3 px-3 text-right text-red-600">
                        {formatNumber(report.summary.ytdCharged)}
                      </td>
                      <td className="py-3 px-3 text-right text-green-600">
                        {formatNumber(report.summary.ytdCollected)}
                      </td>
                      <td className="py-3 px-3 text-right text-orange-600">
                        {formatNumber(report.summary.totalOutstandingPenalties)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {report.summary.totalBillsWithPenalty}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Units with Penalties */}
        {report && report.topPenaltyUnits.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Top Units with Outstanding Penalties</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search unit, owner..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              {searchTerm && (
                <p className="text-sm text-gray-500 mt-2">
                  Showing {filteredPenaltyUnits.length} of {report.topPenaltyUnits.length} units
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("unitNumber")} className="flex items-center hover:text-blue-600">
                          Unit <SortIcon field="unitNumber" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("ownerName")} className="flex items-center hover:text-blue-600">
                          Owner <SortIcon field="ownerName" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-medium">Billing Month</th>
                      <th className="text-right py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("penaltyAmount")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Penalty <SortIcon field="penaltyAmount" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("balance")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Balance <SortIcon field="balance" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPenaltyUnits.map((u, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{u.unitNumber}</td>
                        <td className="py-2 px-3">{u.ownerName}</td>
                        <td className="py-2 px-3">
                          {new Date(u.billingMonth).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-2 px-3 text-right text-red-600">
                          {formatNumber(u.penaltyAmount)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {formatNumber(u.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generated timestamp */}
        {report && (
          <p className="text-xs text-gray-400 text-center">
            Report generated: {new Date(report.generatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
