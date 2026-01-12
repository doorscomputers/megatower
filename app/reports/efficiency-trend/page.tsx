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
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Printer,
  Target,
  Award,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface MonthlyData {
  month: number
  monthName: string
  totalBilled: number
  totalCollected: number
  efficiency: number
  billCount: number
  paidBillCount: number
  partialBillCount: number
  unpaidBillCount: number
}

interface ReportData {
  year: number
  monthlyData: MonthlyData[]
  compareYear: {
    year: number
    monthlyData: MonthlyData[]
  } | null
  summary: {
    totalBilled: number
    totalCollected: number
    avgEfficiency: number
    overallEfficiency: number
    totalBills: number
    totalPaid: number
    totalPartial: number
    totalUnpaid: number
    bestMonth: MonthlyData | null
    worstMonth: MonthlyData | null
    trend: number
    trendDirection: "improving" | "declining" | "stable"
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

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

export default function EfficiencyTrendReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [year, setYear] = useState(currentYear.toString())
  const [compareYear, setCompareYear] = useState("")

  const fetchReport = async () => {
    try {
      setLoading(true)
      let url = `/api/reports/efficiency-trend?year=${year}`
      if (compareYear) url += `&compareYear=${compareYear}`

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
  }, [year, compareYear])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push(["Collection Efficiency Trend Report"])
    wsData.push([`Year: ${report.year}`])
    wsData.push([])
    wsData.push(["Month", "Billed", "Collected", "Efficiency %", "Bills", "Paid", "Partial", "Unpaid"])

    report.monthlyData.forEach((m) => {
      wsData.push([
        m.monthName,
        m.totalBilled,
        m.totalCollected,
        `${m.efficiency}%`,
        m.billCount,
        m.paidBillCount,
        m.partialBillCount,
        m.unpaidBillCount
      ])
    })

    wsData.push([])
    wsData.push([
      "TOTAL",
      report.summary.totalBilled,
      report.summary.totalCollected,
      `${report.summary.overallEfficiency}%`,
      report.summary.totalBills,
      report.summary.totalPaid,
      report.summary.totalPartial,
      report.summary.totalUnpaid
    ])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Efficiency Trend")

    XLSX.writeFile(wb, `Efficiency_Trend_${year}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text("Collection Efficiency Trend Report", 14, 15)
    doc.setFontSize(10)
    doc.text(`Year: ${report.year}`, 14, 22)

    const tableData = report.monthlyData.map((m) => [
      m.monthName,
      formatCurrency(m.totalBilled),
      formatCurrency(m.totalCollected),
      `${m.efficiency}%`,
      m.billCount.toString(),
      m.paidBillCount.toString()
    ])

    autoTable(doc, {
      head: [["Month", "Billed", "Collected", "Efficiency", "Bills", "Paid"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`Efficiency_Trend_${year}.pdf`)
    toast.success("PDF file downloaded")
  }

  const handlePrint = () => {
    window.print()
  }

  const getTrendIcon = () => {
    if (!report) return null
    switch (report.summary.trendDirection) {
      case "improving":
        return <TrendingUp className="h-5 w-5 text-green-600" />
      case "declining":
        return <TrendingDown className="h-5 w-5 text-red-600" />
      default:
        return <Minus className="h-5 w-5 text-gray-600" />
    }
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "text-green-600 bg-green-100"
    if (efficiency >= 70) return "text-yellow-600 bg-yellow-100"
    return "text-red-600 bg-red-100"
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Collection Efficiency Trend</h1>
            <p className="text-gray-500">Monthly collection performance analysis</p>
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
              <div className="w-40">
                <Label>Compare With</Label>
                <Select value={compareYear || "none"} onValueChange={(v) => setCompareYear(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No comparison" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No comparison</SelectItem>
                    {years.filter(y => y.toString() !== year).map((y) => (
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

        {/* Summary Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Efficiency</CardTitle>
                <Target className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {report.summary.overallEfficiency}%
                </div>
                <p className="text-xs text-blue-600">
                  {formatCurrency(report.summary.totalCollected)} of {formatCurrency(report.summary.totalBilled)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Trend</CardTitle>
                {getTrendIcon()}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  report.summary.trend > 0 ? 'text-green-600' :
                  report.summary.trend < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {report.summary.trend > 0 ? '+' : ''}{report.summary.trend}%
                </div>
                <p className="text-xs text-muted-foreground capitalize">
                  {report.summary.trendDirection} (H1 vs H2)
                </p>
              </CardContent>
            </Card>

            {report.summary.bestMonth && (
              <Card className="bg-green-50 border-green-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Best Month</CardTitle>
                  <Award className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">
                    {report.summary.bestMonth.monthName}
                  </div>
                  <p className="text-xs text-green-600">
                    {report.summary.bestMonth.efficiency}% efficiency
                  </p>
                </CardContent>
              </Card>
            )}

            {report.summary.worstMonth && (
              <Card className="bg-red-50 border-red-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Needs Improvement</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-700">
                    {report.summary.worstMonth.monthName}
                  </div>
                  <p className="text-xs text-red-600">
                    {report.summary.worstMonth.efficiency}% efficiency
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Chart */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Efficiency Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-2">
                {report.monthlyData.map((m, idx) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="relative w-full flex justify-center gap-1">
                      {/* Current year bar */}
                      <div
                        className="w-8 bg-blue-500 rounded-t transition-all"
                        style={{ height: `${(m.efficiency / 100) * 200}px` }}
                        title={`${m.monthName} ${report.year}: ${m.efficiency}%`}
                      />
                      {/* Comparison year bar */}
                      {report.compareYear && (
                        <div
                          className="w-8 bg-gray-300 rounded-t transition-all"
                          style={{ height: `${(report.compareYear.monthlyData[idx].efficiency / 100) * 200}px` }}
                          title={`${m.monthName} ${report.compareYear.year}: ${report.compareYear.monthlyData[idx].efficiency}%`}
                        />
                      )}
                    </div>
                    <span className="text-xs font-medium">{m.efficiency}%</span>
                    <span className="text-xs text-gray-500">{m.monthName.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
              {report.compareYear && (
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded" />
                    <span className="text-sm">{report.year}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-300 rounded" />
                    <span className="text-sm">{report.compareYear.year}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Monthly Data Table */}
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
                      <th className="text-left py-3 px-2 font-medium">Month</th>
                      <th className="text-right py-3 px-2 font-medium">Total Billed</th>
                      <th className="text-right py-3 px-2 font-medium">Total Collected</th>
                      <th className="text-right py-3 px-2 font-medium">Efficiency</th>
                      <th className="text-right py-3 px-2 font-medium">Bills</th>
                      <th className="text-right py-3 px-2 font-medium">Paid</th>
                      <th className="text-right py-3 px-2 font-medium">Partial</th>
                      <th className="text-right py-3 px-2 font-medium">Unpaid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthlyData.map((m) => (
                      <tr key={m.month} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{m.monthName}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(m.totalBilled)}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(m.totalCollected)}</td>
                        <td className="py-2 px-2 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getEfficiencyColor(m.efficiency)}`}>
                            {m.efficiency}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">{m.billCount}</td>
                        <td className="py-2 px-2 text-right text-green-600">{m.paidBillCount}</td>
                        <td className="py-2 px-2 text-right text-yellow-600">{m.partialBillCount}</td>
                        <td className="py-2 px-2 text-right text-red-600">{m.unpaidBillCount}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td className="py-2 px-2">TOTAL</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.summary.totalBilled)}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.summary.totalCollected)}</td>
                      <td className="py-2 px-2 text-right">
                        <span className={`px-2 py-1 rounded text-xs ${getEfficiencyColor(report.summary.overallEfficiency)}`}>
                          {report.summary.overallEfficiency}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">{report.summary.totalBills}</td>
                      <td className="py-2 px-2 text-right text-green-600">{report.summary.totalPaid}</td>
                      <td className="py-2 px-2 text-right text-yellow-600">{report.summary.totalPartial}</td>
                      <td className="py-2 px-2 text-right text-red-600">{report.summary.totalUnpaid}</td>
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
