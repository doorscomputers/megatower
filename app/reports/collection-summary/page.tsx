"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart3,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
} from "lucide-react"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface ReportData {
  dateRange: {
    start: string
    end: string
    days: number
  }
  summary: {
    totalCollected: number
    paymentCount: number
    avgDaily: number
    prevPeriodTotal: number
    percentChange: number
  }
  byComponent: {
    electric: number
    water: number
    dues: number
    penalty: number
    spAssessment: number
    advance: number
    total: number
  }
  byMethod: Record<string, number>
  dailyData: Array<{ date: string; amount: number }>
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

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank Transfer",
  GCASH: "GCash",
  PAYMAYA: "PayMaya",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
}

export default function CollectionSummaryPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [period, setPeriod] = useState("month")
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"))

  const fetchReport = async () => {
    try {
      setLoading(true)
      let url = `/api/reports/collection-summary?period=${period}`
      if (period === "custom") {
        url += `&startDate=${startDate}&endDate=${endDate}`
      }
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
  }, [])

  const handlePeriodChange = (value: string) => {
    setPeriod(value)
    const now = new Date()
    if (value === "month") {
      setStartDate(format(startOfMonth(now), "yyyy-MM-dd"))
      setEndDate(format(endOfMonth(now), "yyyy-MM-dd"))
    } else if (value === "week") {
      setStartDate(format(startOfWeek(now), "yyyy-MM-dd"))
      setEndDate(format(endOfWeek(now), "yyyy-MM-dd"))
    }
  }

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push(["Collection Summary Report"])
    wsData.push([`Period: ${new Date(report.dateRange.start).toLocaleDateString()} - ${new Date(report.dateRange.end).toLocaleDateString()}`])
    wsData.push([])

    // Summary
    wsData.push(["Summary"])
    wsData.push(["Total Collected", report.summary.totalCollected])
    wsData.push(["Payment Count", report.summary.paymentCount])
    wsData.push(["Average Daily", report.summary.avgDaily])
    wsData.push(["Previous Period", report.summary.prevPeriodTotal])
    wsData.push(["Change %", `${report.summary.percentChange}%`])
    wsData.push([])

    // By Component
    wsData.push(["By Component"])
    wsData.push(["Electric", report.byComponent.electric])
    wsData.push(["Water", report.byComponent.water])
    wsData.push(["Association Dues", report.byComponent.dues])
    wsData.push(["Penalty", report.byComponent.penalty])
    wsData.push(["SP Assessment", report.byComponent.spAssessment])
    wsData.push(["Advance", report.byComponent.advance])
    wsData.push([])

    // By Method
    wsData.push(["By Payment Method"])
    Object.entries(report.byMethod).forEach(([method, amount]) => {
      wsData.push([methodLabels[method] || method, amount])
    })
    wsData.push([])

    // Daily Data
    wsData.push(["Daily Breakdown"])
    wsData.push(["Date", "Amount"])
    report.dailyData.forEach((day) => {
      wsData.push([day.date, day.amount])
    })

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [{ wch: 20 }, { wch: 15 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Collection Summary")

    const fileName = `Collection_Summary_${startDate}_${endDate}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text("Collection Summary Report", 14, 15)
    doc.setFontSize(10)
    doc.text(
      `Period: ${new Date(report.dateRange.start).toLocaleDateString()} - ${new Date(report.dateRange.end).toLocaleDateString()}`,
      14,
      22
    )

    // Summary table
    autoTable(doc, {
      head: [["Metric", "Value"]],
      body: [
        ["Total Collected", formatCurrency(report.summary.totalCollected)],
        ["Payment Count", report.summary.paymentCount.toString()],
        ["Average Daily", formatCurrency(report.summary.avgDaily)],
        ["Previous Period", formatCurrency(report.summary.prevPeriodTotal)],
        ["Change", `${report.summary.percentChange > 0 ? "+" : ""}${report.summary.percentChange}%`],
      ],
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    // Component breakdown
    const yPos = (doc as any).lastAutoTable.finalY + 10
    autoTable(doc, {
      head: [["Component", "Amount"]],
      body: [
        ["Electric", formatNumber(report.byComponent.electric)],
        ["Water", formatNumber(report.byComponent.water)],
        ["Association Dues", formatNumber(report.byComponent.dues)],
        ["Penalty", formatNumber(report.byComponent.penalty)],
        ["SP Assessment", formatNumber(report.byComponent.spAssessment)],
        ["Advance", formatNumber(report.byComponent.advance)],
      ],
      startY: yPos,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 197, 94] },
    })

    doc.save(`Collection_Summary_${startDate}_${endDate}.pdf`)
    toast.success("PDF file downloaded")
  }

  const handlePrint = () => {
    window.print()
  }

  // Get max for chart scaling
  const maxDaily = report ? Math.max(...report.dailyData.map((d) => d.amount), 1) : 1

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Collection Summary Report</h1>
            <p className="text-gray-500">
              Analyze payments received by period, component, and method
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
              <div className="w-40">
                <Label htmlFor="period">Period</Label>
                <Select value={period} onValueChange={handlePeriodChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {period === "custom" && (
                <>
                  <div className="w-40">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="w-40">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <Button onClick={fetchReport} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(report.summary.totalCollected)}
                </div>
                <p className="text-xs text-green-600">
                  {report.summary.paymentCount} payments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
                <BarChart3 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(report.summary.avgDaily)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Over {report.dateRange.days} days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Previous Period</CardTitle>
                <CreditCard className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(report.summary.prevPeriodTotal)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Same duration prior
                </p>
              </CardContent>
            </Card>

            <Card className={report.summary.percentChange >= 0 ? "bg-green-50" : "bg-red-50"}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Change</CardTitle>
                {report.summary.percentChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  report.summary.percentChange >= 0 ? "text-green-700" : "text-red-700"
                }`}>
                  {report.summary.percentChange > 0 ? "+" : ""}{report.summary.percentChange}%
                </div>
                <p className="text-xs text-muted-foreground">
                  vs previous period
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Row */}
        {report && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* By Component */}
            <Card>
              <CardHeader>
                <CardTitle>By Component</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { key: "electric", label: "Electric", color: "bg-yellow-500" },
                    { key: "water", label: "Water", color: "bg-blue-500" },
                    { key: "dues", label: "Association Dues", color: "bg-green-500" },
                    { key: "penalty", label: "Penalty", color: "bg-red-500" },
                    { key: "spAssessment", label: "SP Assessment", color: "bg-purple-500" },
                    { key: "advance", label: "Advance", color: "bg-gray-500" },
                  ].map(({ key, label, color }) => {
                    const amount = report.byComponent[key as keyof typeof report.byComponent] as number
                    const pct = report.byComponent.total > 0 ? (amount / report.byComponent.total) * 100 : 0
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="w-32 text-sm">{label}</span>
                        <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-24 text-right text-sm font-medium">
                          {formatNumber(amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* By Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle>By Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(report.byMethod)
                    .sort((a, b) => b[1] - a[1])
                    .map(([method, amount]) => {
                      const pct = report.byComponent.total > 0 ? (amount / report.byComponent.total) * 100 : 0
                      return (
                        <div key={method} className="flex items-center gap-3">
                          <span className="w-32 text-sm">{methodLabels[method] || method}</span>
                          <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-24 text-right text-sm font-medium">
                            {formatNumber(amount)}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Daily Chart */}
        {report && report.dailyData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Collections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-1">
                {report.dailyData.map((day, index) => (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${day.date}: ${formatCurrency(day.amount)}`}
                  >
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                      style={{
                        height: `${(day.amount / maxDaily) * 100}%`,
                        minHeight: day.amount > 0 ? "4px" : "0",
                      }}
                    />
                    {report.dailyData.length <= 14 && (
                      <span className="text-xs text-gray-500 -rotate-45 origin-left">
                        {new Date(day.date).getDate()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-xs text-gray-500">
                <span>{new Date(report.dateRange.start).toLocaleDateString()}</span>
                <span>{new Date(report.dateRange.end).toLocaleDateString()}</span>
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
