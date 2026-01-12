"use client"

import { useState, useEffect, useMemo } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface DelinquentUnit {
  unitId: string
  unitNumber: string
  floorLevel: string
  ownerName: string
  ownerPhone: string | null
  ownerEmail: string | null
  monthsOverdue: number
  overdueBillsCount: number
  totalOutstanding: number
  totalPenalties: number
  oldestDueDate: string
  lastPaymentDate: string | null
  lastPaymentAmount: number | null
  severity: "critical" | "high" | "medium" | "low"
}

interface ReportData {
  data: DelinquentUnit[]
  summary: {
    totalDelinquentUnits: number
    totalOutstanding: number
    totalPenalties: number
    bySeverity: {
      critical: number
      high: number
      medium: number
      low: number
    }
    avgMonthsOverdue: number
  }
  minMonthsOverdue: number
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

const severityColors = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-gray-100 text-gray-800 border-gray-300",
}

const severityLabels = {
  critical: "Critical (6+ months)",
  high: "High (3-5 months)",
  medium: "Medium (2 months)",
  low: "Low",
}

export default function DelinquencyReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [minMonths, setMinMonths] = useState("2")
  const [searchTerm, setSearchTerm] = useState("")

  // Filter delinquent units
  const filteredUnits = useMemo(() => {
    if (!report) return []

    if (!searchTerm) return report.data

    const term = searchTerm.toLowerCase()
    return report.data.filter((u) =>
      u.unitNumber.toLowerCase().includes(term) ||
      u.ownerName.toLowerCase().includes(term) ||
      (u.ownerPhone?.toLowerCase() || "").includes(term) ||
      (u.ownerEmail?.toLowerCase() || "").includes(term) ||
      u.severity.toLowerCase().includes(term)
    )
  }, [report, searchTerm])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const url = `/api/reports/delinquency?minMonths=${minMonths}`
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
  }, [minMonths])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push(["Delinquency Report"])
    wsData.push([`Minimum ${report.minMonthsOverdue} months overdue`])
    wsData.push([])
    wsData.push([
      "Unit",
      "Owner",
      "Floor",
      "Months Overdue",
      "Overdue Bills",
      "Outstanding",
      "Penalties",
      "Oldest Due",
      "Last Payment",
      "Severity",
    ])

    report.data.forEach((unit) => {
      wsData.push([
        unit.unitNumber,
        unit.ownerName,
        unit.floorLevel,
        unit.monthsOverdue,
        unit.overdueBillsCount,
        unit.totalOutstanding,
        unit.totalPenalties,
        new Date(unit.oldestDueDate).toLocaleDateString(),
        unit.lastPaymentDate ? new Date(unit.lastPaymentDate).toLocaleDateString() : "Never",
        unit.severity.toUpperCase(),
      ])
    })

    wsData.push([])
    wsData.push(["Summary"])
    wsData.push(["Total Delinquent Units", report.summary.totalDelinquentUnits])
    wsData.push(["Total Outstanding", report.summary.totalOutstanding])
    wsData.push(["Total Penalties", report.summary.totalPenalties])
    wsData.push(["Average Months Overdue", report.summary.avgMonthsOverdue])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 8 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Delinquency")

    const fileName = `Delinquency_Report_${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text("Delinquency Report", 14, 15)
    doc.setFontSize(10)
    doc.text(`Minimum ${report.minMonthsOverdue} months overdue`, 14, 22)

    const tableData = report.data.map((unit) => [
      unit.unitNumber,
      unit.ownerName,
      unit.floorLevel,
      unit.monthsOverdue.toString(),
      unit.overdueBillsCount.toString(),
      formatNumber(unit.totalOutstanding),
      formatNumber(unit.totalPenalties),
      new Date(unit.oldestDueDate).toLocaleDateString(),
      unit.severity.toUpperCase(),
    ])

    autoTable(doc, {
      head: [["Unit", "Owner", "Floor", "Months", "Bills", "Outstanding", "Penalties", "Oldest Due", "Severity"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] },
    })

    doc.save(`Delinquency_Report_${new Date().toISOString().split("T")[0]}.pdf`)
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
            <h1 className="text-3xl font-bold text-gray-900">Delinquency Report</h1>
            <p className="text-gray-500">
              Identify units with chronic late payments
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
                <Label htmlFor="minMonths">Minimum Months Overdue</Label>
                <Select value={minMonths} onValueChange={setMinMonths}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1+ month</SelectItem>
                    <SelectItem value="2">2+ months</SelectItem>
                    <SelectItem value="3">3+ months</SelectItem>
                    <SelectItem value="6">6+ months</SelectItem>
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
                placeholder="Search unit, owner, phone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchTerm && report && (
              <p className="text-sm text-gray-500 mt-2">
                Showing {filteredUnits.length} of {report.data.length} delinquent units
              </p>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-5">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto text-red-600 mb-2" />
                  <p className="text-sm text-red-600">Delinquent Units</p>
                  <p className="text-3xl font-bold text-red-700">
                    {report.summary.totalDelinquentUnits}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-red-600 mb-2" />
                  <p className="text-sm text-gray-600">Total Outstanding</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(report.summary.totalOutstanding)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Penalties</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(report.summary.totalPenalties)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Calendar className="h-8 w-8 mx-auto text-gray-600 mb-2" />
                  <p className="text-sm text-gray-600">Avg. Months Overdue</p>
                  <p className="text-2xl font-bold">
                    {report.summary.avgMonthsOverdue}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-red-600">Critical:</span>
                    <span className="font-bold">{report.summary.bySeverity.critical}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-600">High:</span>
                    <span className="font-bold">{report.summary.bySeverity.high}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-600">Medium:</span>
                    <span className="font-bold">{report.summary.bySeverity.medium}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delinquent Units List */}
        {report && filteredUnits.length > 0 && (
          <div className="space-y-4">
            {filteredUnits.map((unit) => (
              <Card key={unit.unitId} className={severityColors[unit.severity]}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold">{unit.unitNumber}</span>
                        <Badge variant="outline" className={severityColors[unit.severity]}>
                          {unit.monthsOverdue} months overdue
                        </Badge>
                      </div>
                      <p className="text-gray-700">{unit.ownerName}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                        {unit.ownerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {unit.ownerPhone}
                          </span>
                        )}
                        {unit.ownerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {unit.ownerEmail}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-500">Outstanding</p>
                        <p className="font-bold text-red-600">
                          {formatCurrency(unit.totalOutstanding)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Penalties</p>
                        <p className="font-bold text-orange-600">
                          {formatCurrency(unit.totalPenalties)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Overdue Bills</p>
                        <p className="font-bold">{unit.overdueBillsCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Last Payment</p>
                        <p className="font-medium text-sm">
                          {unit.lastPaymentDate
                            ? new Date(unit.lastPaymentDate).toLocaleDateString()
                            : "Never"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {report && filteredUnits.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              {searchTerm
                ? `No delinquent units found matching "${searchTerm}"`
                : `No delinquent units found with ${minMonths}+ months overdue.`}
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
