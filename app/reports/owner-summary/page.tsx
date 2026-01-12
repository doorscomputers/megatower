"use client"

import { useState, useEffect, useMemo } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  UserCheck,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Users,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface UnitData {
  unitId: string
  unitNumber: string
  floorLevel: string
  balance: number
  penalty: number
  overdueCount: number
  billsCount: number
  lastPaymentDate: string | null
  lastPaymentAmount: number | null
}

interface OwnerSummary {
  ownerId: string
  ownerName: string
  phone: string | null
  email: string | null
  address: string | null
  unitsCount: number
  units: UnitData[]
  totalBalance: number
  totalPenalty: number
  totalOverdue: number
  lastPaymentDate: string | null
}

interface ReportData {
  data: OwnerSummary[]
  summary: {
    totalOwners: number
    totalOutstanding: number
    totalPenalty: number
    totalUnitsWithBalance: number
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

export default function OwnerSummaryPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")

  // Filter owners
  const filteredOwners = useMemo(() => {
    if (!report) return []

    if (!searchTerm) return report.data

    const term = searchTerm.toLowerCase()
    return report.data.filter((o) =>
      o.ownerName.toLowerCase().includes(term) ||
      (o.phone?.toLowerCase() || "").includes(term) ||
      (o.email?.toLowerCase() || "").includes(term) ||
      o.units.some(u => u.unitNumber.toLowerCase().includes(term))
    )
  }, [report, searchTerm])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const url = `/api/reports/owner-summary?showAll=${showAll}`
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
  }, [showAll])

  const toggleOwner = (ownerId: string) => {
    const newExpanded = new Set(expandedOwners)
    if (newExpanded.has(ownerId)) {
      newExpanded.delete(ownerId)
    } else {
      newExpanded.add(ownerId)
    }
    setExpandedOwners(newExpanded)
  }

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push(["Owner Summary Report"])
    wsData.push([])
    wsData.push([
      "Owner",
      "Phone",
      "Email",
      "Units",
      "Total Balance",
      "Penalty",
      "Last Payment",
    ])

    report.data.forEach((owner) => {
      wsData.push([
        owner.ownerName,
        owner.phone || "",
        owner.email || "",
        owner.unitsCount,
        owner.totalBalance,
        owner.totalPenalty,
        owner.lastPaymentDate ? new Date(owner.lastPaymentDate).toLocaleDateString() : "Never",
      ])

      // Add unit details
      owner.units.forEach((unit) => {
        wsData.push([
          `  - ${unit.unitNumber}`,
          unit.floorLevel,
          "",
          "",
          unit.balance,
          unit.penalty,
          unit.lastPaymentDate ? new Date(unit.lastPaymentDate).toLocaleDateString() : "",
        ])
      })
    })

    wsData.push([])
    wsData.push([
      "GRAND TOTAL",
      "",
      "",
      report.summary.totalUnitsWithBalance,
      report.summary.totalOutstanding,
      report.summary.totalPenalty,
      "",
    ])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 25 },
      { wch: 8 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Owner Summary")

    XLSX.writeFile(wb, `Owner_Summary_${new Date().toISOString().split("T")[0]}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text("Owner Summary Report", 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 14, 22)

    const tableData = report.data.map((owner) => [
      owner.ownerName,
      owner.unitsCount.toString(),
      formatNumber(owner.totalBalance),
      formatNumber(owner.totalPenalty),
      owner.lastPaymentDate ? new Date(owner.lastPaymentDate).toLocaleDateString() : "Never",
    ])

    tableData.push([
      { content: "GRAND TOTAL", styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: report.summary.totalUnitsWithBalance.toString(), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.summary.totalOutstanding), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.summary.totalPenalty), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: "", styles: { fillColor: [220, 220, 220] } } as any,
    ])

    autoTable(doc, {
      head: [["Owner", "Units", "Balance", "Penalty", "Last Payment"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    })

    doc.save(`Owner_Summary_${new Date().toISOString().split("T")[0]}.pdf`)
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
            <h1 className="text-3xl font-bold text-gray-900">Owner Summary Report</h1>
            <p className="text-gray-500">
              Outstanding balances grouped by property owner
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showAll"
                  checked={showAll}
                  onCheckedChange={(checked) => setShowAll(checked as boolean)}
                />
                <Label htmlFor="showAll" className="cursor-pointer">
                  Show all owners (including zero balance)
                </Label>
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
                placeholder="Search owner, phone, email, unit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchTerm && report && (
              <p className="text-sm text-gray-500 mt-2">
                Showing {filteredOwners.length} of {report.data.length} owners
              </p>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Owners with Balance</CardTitle>
                <Users className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">
                  {report.summary.totalOwners}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Units with Balance</CardTitle>
                <UserCheck className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {report.summary.totalUnitsWithBalance}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                <DollarSign className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">
                  {formatCurrency(report.summary.totalOutstanding)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 border-orange-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Penalties</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-700">
                  {formatCurrency(report.summary.totalPenalty)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Owner List */}
        {report && filteredOwners.length > 0 && (
          <div className="space-y-4">
            {filteredOwners.map((owner) => {
              const isExpanded = expandedOwners.has(owner.ownerId)

              return (
                <Card key={owner.ownerId}>
                  <CardHeader
                    className="cursor-pointer hover:bg-gray-50 py-4"
                    onClick={() => toggleOwner(owner.ownerId)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        )}
                        <div>
                          <p className="font-semibold text-lg">{owner.ownerName}</p>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
                            {owner.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {owner.phone}
                              </span>
                            )}
                            {owner.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {owner.email}
                              </span>
                            )}
                            <span>{owner.unitsCount} unit(s)</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Balance</p>
                          <p className="font-bold text-red-600">
                            {formatCurrency(owner.totalBalance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Penalty</p>
                          <p className="font-bold text-orange-600">
                            {formatCurrency(owner.totalPenalty)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Last Payment</p>
                          <p className="font-medium text-sm">
                            {owner.lastPaymentDate
                              ? new Date(owner.lastPaymentDate).toLocaleDateString()
                              : "Never"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && owner.units.length > 0 && (
                    <CardContent className="pt-0 border-t">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm mt-4">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left py-2 px-3 font-medium">Unit</th>
                              <th className="text-left py-2 px-3 font-medium">Floor</th>
                              <th className="text-right py-2 px-3 font-medium">Balance</th>
                              <th className="text-right py-2 px-3 font-medium">Penalty</th>
                              <th className="text-right py-2 px-3 font-medium">Overdue Bills</th>
                              <th className="text-left py-2 px-3 font-medium">Last Payment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {owner.units.map((unit) => (
                              <tr key={unit.unitId} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-3 font-medium">{unit.unitNumber}</td>
                                <td className="py-2 px-3">{unit.floorLevel}</td>
                                <td className="py-2 px-3 text-right text-red-600">
                                  {formatNumber(unit.balance)}
                                </td>
                                <td className="py-2 px-3 text-right text-orange-600">
                                  {formatNumber(unit.penalty)}
                                </td>
                                <td className="py-2 px-3 text-right">{unit.overdueCount}</td>
                                <td className="py-2 px-3">
                                  {unit.lastPaymentDate
                                    ? new Date(unit.lastPaymentDate).toLocaleDateString()
                                    : "Never"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {report && filteredOwners.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              {searchTerm
                ? `No owners found matching "${searchTerm}"`
                : "No owners with outstanding balances found."}
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
