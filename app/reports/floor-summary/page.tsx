"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Building,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface FloorSummary {
  floor: string
  totalUnits: number
  billsGenerated: number
  totalBilled: number
  totalCollected: number
  totalOutstanding: number
  collectionEfficiency: number
  components: {
    electric: number
    water: number
    dues: number
    penalty: number
  }
  statusCounts: {
    paid: number
    partial: number
    unpaid: number
    overdue: number
  }
  allMonthsOutstanding: number
  unitsWithBalance: number
}

interface ReportData {
  billingMonth: string
  billingPeriod: string
  floors: Record<string, FloorSummary>
  grandTotals: {
    totalUnits: number
    billsGenerated: number
    totalBilled: number
    totalCollected: number
    totalOutstanding: number
    allMonthsOutstanding: number
    unitsWithBalance: number
    collectionEfficiency: number
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

export default function FloorSummaryPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [billingMonth, setBillingMonth] = useState(format(new Date(), "yyyy-MM"))

  const fetchReport = async () => {
    try {
      setLoading(true)
      const url = `/api/reports/floor-summary?billingMonth=${billingMonth}`
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
  }, [billingMonth])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push(["Floor Summary Report - " + report.billingMonth])
    wsData.push([])
    wsData.push([
      "Floor",
      "Total Units",
      "Bills Generated",
      "Total Billed",
      "Total Collected",
      "Outstanding (Month)",
      "Outstanding (All)",
      "Collection %",
      "Units w/ Balance",
    ])

    Object.values(report.floors).forEach((floor) => {
      wsData.push([
        floor.floor,
        floor.totalUnits,
        floor.billsGenerated,
        floor.totalBilled,
        floor.totalCollected,
        floor.totalOutstanding,
        floor.allMonthsOutstanding,
        `${floor.collectionEfficiency}%`,
        floor.unitsWithBalance,
      ])
    })

    wsData.push([])
    wsData.push([
      "GRAND TOTAL",
      report.grandTotals.totalUnits,
      report.grandTotals.billsGenerated,
      report.grandTotals.totalBilled,
      report.grandTotals.totalCollected,
      report.grandTotals.totalOutstanding,
      report.grandTotals.allMonthsOutstanding,
      `${report.grandTotals.collectionEfficiency}%`,
      report.grandTotals.unitsWithBalance,
    ])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 10 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Floor Summary")

    const fileName = `Floor_Summary_${billingMonth}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text("Floor Summary Report", 14, 15)
    doc.setFontSize(12)
    doc.text(report.billingMonth, 14, 22)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 14, 28)

    const tableData = Object.values(report.floors).map((floor) => [
      floor.floor,
      floor.totalUnits.toString(),
      floor.billsGenerated.toString(),
      formatNumber(floor.totalBilled),
      formatNumber(floor.totalCollected),
      formatNumber(floor.allMonthsOutstanding),
      `${floor.collectionEfficiency}%`,
      floor.unitsWithBalance.toString(),
    ])

    tableData.push([
      { content: "TOTAL", styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: report.grandTotals.totalUnits.toString(), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: report.grandTotals.billsGenerated.toString(), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.totalBilled), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.totalCollected), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.allMonthsOutstanding), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: `${report.grandTotals.collectionEfficiency}%`, styles: { fontStyle: "bold", fillColor: [220, 220, 220] } },
      { content: report.grandTotals.unitsWithBalance.toString(), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
    ])

    autoTable(doc, {
      head: [["Floor", "Units", "Bills", "Billed", "Collected", "Outstanding", "Efficiency", "w/ Balance"]],
      body: tableData,
      startY: 34,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`Floor_Summary_${billingMonth}.pdf`)
    toast.success("PDF file downloaded")
  }

  const handlePrint = () => {
    window.print()
  }

  const floorColors: Record<string, string> = {
    "GF": "bg-gray-100 border-gray-300",
    "2F": "bg-blue-50 border-blue-200",
    "3F": "bg-green-50 border-green-200",
    "4F": "bg-yellow-50 border-yellow-200",
    "5F": "bg-purple-50 border-purple-200",
    "6F": "bg-pink-50 border-pink-200",
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Floor Summary Report</h1>
            <p className="text-gray-500">
              Aggregated billing and collection metrics by floor
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
              <div className="w-48">
                <Label htmlFor="billingMonth">Billing Month</Label>
                <Input
                  id="billingMonth"
                  type="month"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button onClick={fetchReport} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Overall Summary */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(report.grandTotals.totalBilled)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.billingMonth}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(report.grandTotals.totalCollected)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.grandTotals.collectionEfficiency}% efficiency
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                <DollarSign className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(report.grandTotals.allMonthsOutstanding)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.grandTotals.unitsWithBalance} units with balance
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Units</CardTitle>
                <Users className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {report.grandTotals.totalUnits}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.grandTotals.billsGenerated} bills generated
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Collection Efficiency Chart */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Collection Efficiency by Floor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.values(report.floors).map((floor) => (
                  <div key={floor.floor} className="flex items-center gap-4">
                    <span className="w-8 font-medium">{floor.floor}</span>
                    <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          floor.collectionEfficiency >= 80
                            ? "bg-green-500"
                            : floor.collectionEfficiency >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        } transition-all duration-500`}
                        style={{ width: `${floor.collectionEfficiency}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-medium">
                      {floor.collectionEfficiency}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Floor Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.values(report.floors).map((floor) => (
              <Card key={floor.floor} className={floorColors[floor.floor]}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      {floor.floor}
                    </CardTitle>
                    <span className="text-sm text-gray-500">
                      {floor.totalUnits} units
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Billed</p>
                      <p className="font-semibold">{formatCurrency(floor.totalBilled)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Collected</p>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(floor.totalCollected)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Outstanding (All)</p>
                      <p className="font-semibold text-red-600">
                        {formatCurrency(floor.allMonthsOutstanding)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Efficiency</p>
                      <p className={`font-semibold ${
                        floor.collectionEfficiency >= 80
                          ? "text-green-600"
                          : floor.collectionEfficiency >= 50
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}>
                        {floor.collectionEfficiency}%
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-500 mb-2">Bill Status</p>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                        Paid: {floor.statusCounts.paid}
                      </span>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        Partial: {floor.statusCounts.partial}
                      </span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                        Unpaid: {floor.statusCounts.unpaid}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
