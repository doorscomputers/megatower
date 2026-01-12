"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Calendar,
  TrendingUp,
  DollarSign,
  FileCheck,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Printer,
  Zap,
  Droplets,
  Building,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface MonthlyData {
  month: number
  monthName: string
  billed: {
    electric: number
    water: number
    dues: number
    penalty: number
    spAssessment: number
    other: number
    total: number
  }
  collected: {
    electric: number
    water: number
    dues: number
    penalty: number
    spAssessment: number
    total: number
  }
  outstanding: number
  efficiency: number
}

interface ReportData {
  year: number
  monthlyData: MonthlyData[]
  yearlyTotals: {
    billed: {
      electric: number
      water: number
      dues: number
      penalty: number
      spAssessment: number
      other: number
      total: number
    }
    collected: {
      electric: number
      water: number
      dues: number
      penalty: number
      spAssessment: number
      total: number
    }
  }
  paymentMethods: Record<string, { count: number; total: number }>
  billStatus: {
    paid: number
    partial: number
    unpaid: number
    overdue: number
  }
  summary: {
    totalBilled: number
    totalCollected: number
    totalOutstanding: number
    avgMonthlyBilled: number
    avgMonthlyCollected: number
    overallEfficiency: number
    totalBills: number
    totalPayments: number
    bestMonth: MonthlyData | null
    worstMonth: MonthlyData | null
    componentBreakdown: {
      electric: number
      water: number
      dues: number
      penalty: number
      spAssessment: number
      other: number
    }
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

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank Transfer",
  GCASH: "GCash",
  PAYMAYA: "PayMaya",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
}

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

export default function AnnualSummaryReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [year, setYear] = useState(currentYear.toString())

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/reports/annual-summary?year=${year}`)
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

    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ["Annual Summary Report"],
      [`Year: ${report.year}`],
      [],
      ["Key Metrics"],
      ["Total Billed", report.summary.totalBilled],
      ["Total Collected", report.summary.totalCollected],
      ["Total Outstanding", report.summary.totalOutstanding],
      ["Collection Efficiency", `${report.summary.overallEfficiency}%`],
      ["Total Bills Generated", report.summary.totalBills],
      ["Total Payments Received", report.summary.totalPayments],
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary")

    // Monthly data sheet
    const monthlyHeader = ["Month", "Billed", "Collected", "Outstanding", "Efficiency"]
    const monthlyRows = report.monthlyData.map(m => [
      m.monthName,
      m.billed.total,
      m.collected.total,
      m.outstanding,
      `${m.efficiency}%`
    ])
    const monthlySheet = XLSX.utils.aoa_to_sheet([monthlyHeader, ...monthlyRows])
    XLSX.utils.book_append_sheet(wb, monthlySheet, "Monthly Data")

    // Component breakdown sheet
    const componentHeader = ["Month", "Electric", "Water", "Dues", "Penalty", "SP Assessment", "Other", "Total"]
    const componentRows = report.monthlyData.map(m => [
      m.monthName,
      m.billed.electric,
      m.billed.water,
      m.billed.dues,
      m.billed.penalty,
      m.billed.spAssessment,
      m.billed.other,
      m.billed.total
    ])
    const componentSheet = XLSX.utils.aoa_to_sheet([componentHeader, ...componentRows])
    XLSX.utils.book_append_sheet(wb, componentSheet, "Component Breakdown")

    XLSX.writeFile(wb, `Annual_Summary_${year}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text(`Annual Summary Report - ${report.year}`, 14, 15)

    doc.setFontSize(12)
    doc.text("Key Metrics", 14, 28)

    doc.setFontSize(10)
    doc.text(`Total Billed: ${formatCurrency(report.summary.totalBilled)}`, 14, 36)
    doc.text(`Total Collected: ${formatCurrency(report.summary.totalCollected)}`, 14, 42)
    doc.text(`Collection Efficiency: ${report.summary.overallEfficiency}%`, 14, 48)

    const tableData = report.monthlyData.map((m) => [
      m.monthName,
      formatCurrency(m.billed.total),
      formatCurrency(m.collected.total),
      formatCurrency(m.outstanding),
      `${m.efficiency}%`
    ])

    autoTable(doc, {
      head: [["Month", "Billed", "Collected", "Outstanding", "Efficiency"]],
      body: tableData,
      startY: 56,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`Annual_Summary_${year}.pdf`)
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
            <h1 className="text-3xl font-bold text-gray-900">Annual Summary Report</h1>
            <p className="text-gray-500">Comprehensive yearly financial overview</p>
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
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
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

        {/* Key Metrics */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(report.summary.totalBilled)}
                </div>
                <p className="text-xs text-blue-600">
                  Avg {formatCurrency(report.summary.avgMonthlyBilled)}/month
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(report.summary.totalCollected)}
                </div>
                <p className="text-xs text-green-600">
                  {report.summary.overallEfficiency}% collection rate
                </p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">
                  {formatCurrency(report.summary.totalOutstanding)}
                </div>
                <p className="text-xs text-red-600">
                  {report.billStatus.overdue} overdue bills
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bills & Payments</CardTitle>
                <FileCheck className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.summary.totalBills}</div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.totalPayments} payments received
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Row */}
        {report && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Monthly Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Billing vs Collection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-end gap-1">
                  {report.monthlyData.map((m) => {
                    const maxAmount = Math.max(...report.monthlyData.map(d => Math.max(d.billed.total, d.collected.total)))
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-0.5">
                          <div
                            className="flex-1 bg-blue-400 rounded-t"
                            style={{ height: `${(m.billed.total / maxAmount) * 150}px` }}
                            title={`Billed: ${formatCurrency(m.billed.total)}`}
                          />
                          <div
                            className="flex-1 bg-green-400 rounded-t"
                            style={{ height: `${(m.collected.total / maxAmount) * 150}px` }}
                            title={`Collected: ${formatCurrency(m.collected.total)}`}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{m.monthName.slice(0, 1)}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-400 rounded" />
                    <span className="text-sm">Billed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-400 rounded" />
                    <span className="text-sm">Collected</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Component Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span>Electric</span>
                        <span className="font-medium">{report.summary.componentBreakdown.electric}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded mt-1">
                        <div
                          className="h-full bg-yellow-500 rounded"
                          style={{ width: `${report.summary.componentBreakdown.electric}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium w-24 text-right">
                      {formatCurrency(report.yearlyTotals.billed.electric)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Droplets className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span>Water</span>
                        <span className="font-medium">{report.summary.componentBreakdown.water}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded mt-1">
                        <div
                          className="h-full bg-blue-500 rounded"
                          style={{ width: `${report.summary.componentBreakdown.water}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium w-24 text-right">
                      {formatCurrency(report.yearlyTotals.billed.water)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-purple-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span>Association Dues</span>
                        <span className="font-medium">{report.summary.componentBreakdown.dues}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded mt-1">
                        <div
                          className="h-full bg-purple-500 rounded"
                          style={{ width: `${report.summary.componentBreakdown.dues}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium w-24 text-right">
                      {formatCurrency(report.yearlyTotals.billed.dues)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span>Penalties</span>
                        <span className="font-medium">{report.summary.componentBreakdown.penalty}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded mt-1">
                        <div
                          className="h-full bg-red-500 rounded"
                          style={{ width: `${report.summary.componentBreakdown.penalty}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium w-24 text-right">
                      {formatCurrency(report.yearlyTotals.billed.penalty)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Payment Methods & Bill Status */}
        {report && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(report.paymentMethods)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([method, data]) => (
                      <div key={method} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">{methodLabels[method] || method}</p>
                          <p className="text-xs text-gray-500">{data.count} payments</p>
                        </div>
                        <p className="font-bold">{formatCurrency(data.total)}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bill Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-8 rounded overflow-hidden mb-4">
                  <div
                    className="bg-green-500"
                    style={{ width: `${(report.billStatus.paid / report.summary.totalBills) * 100}%` }}
                    title={`Paid: ${report.billStatus.paid}`}
                  />
                  <div
                    className="bg-yellow-500"
                    style={{ width: `${(report.billStatus.partial / report.summary.totalBills) * 100}%` }}
                    title={`Partial: ${report.billStatus.partial}`}
                  />
                  <div
                    className="bg-gray-400"
                    style={{ width: `${(report.billStatus.unpaid / report.summary.totalBills) * 100}%` }}
                    title={`Unpaid: ${report.billStatus.unpaid}`}
                  />
                  <div
                    className="bg-red-500"
                    style={{ width: `${(report.billStatus.overdue / report.summary.totalBills) * 100}%` }}
                    title={`Overdue: ${report.billStatus.overdue}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded" />
                    <span className="text-sm">Paid: {report.billStatus.paid}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded" />
                    <span className="text-sm">Partial: {report.billStatus.partial}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded" />
                    <span className="text-sm">Unpaid: {report.billStatus.unpaid}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded" />
                    <span className="text-sm">Overdue: {report.billStatus.overdue}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly Data Table */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-2 font-medium">Month</th>
                      <th className="text-right py-3 px-2 font-medium">Billed</th>
                      <th className="text-right py-3 px-2 font-medium">Collected</th>
                      <th className="text-right py-3 px-2 font-medium">Outstanding</th>
                      <th className="text-right py-3 px-2 font-medium">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthlyData.map((m) => (
                      <tr key={m.month} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{m.monthName}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(m.billed.total)}</td>
                        <td className="py-2 px-2 text-right text-green-600">{formatCurrency(m.collected.total)}</td>
                        <td className="py-2 px-2 text-right text-red-600">
                          {m.outstanding > 0 ? formatCurrency(m.outstanding) : "-"}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            m.efficiency >= 90 ? 'bg-green-100 text-green-800' :
                            m.efficiency >= 70 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {m.efficiency}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td className="py-2 px-2">TOTAL</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.yearlyTotals.billed.total)}</td>
                      <td className="py-2 px-2 text-right text-green-600">{formatCurrency(report.yearlyTotals.collected.total)}</td>
                      <td className="py-2 px-2 text-right text-red-600">{formatCurrency(report.summary.totalOutstanding)}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          {report.summary.overallEfficiency}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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
