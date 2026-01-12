"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  FileCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import DataGrid, {
  Column,
  Sorting,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Paging,
  Summary,
  TotalItem,
} from "devextreme-react/data-grid"
import "devextreme/dist/css/dx.light.css"

interface BillData {
  id: string
  billNumber: string
  billingMonth: string
  unitNumber: string
  floorLevel: string
  ownerName: string
  status: string
  totalAmount: number
  balance: number
  dueDate: string | null
  electric: number
  water: number
  dues: number
  penalty: number
  spAssessment: number
  isOverdue: boolean
}

interface ReportData {
  year: number
  month: number | null
  bills: BillData[]
  statusSummary: {
    PAID: { count: number; total: number }
    PARTIAL: { count: number; total: number; balance: number }
    PENDING: { count: number; total: number; balance: number }
    UNPAID: { count: number; total: number; balance: number }
    OVERDUE: { count: number; total: number; balance: number }
    DRAFT: { count: number; total: number }
  }
  floorBreakdown: Record<string, { total: number; paid: number; unpaid: number; balance: number }>
  monthlyBreakdown: Array<{
    month: number
    monthName: string
    total: number
    paid: number
    partial: number
    unpaid: number
    overdue: number
    totalAmount: number
    collectedAmount: number
  }>
  summary: {
    totalBills: number
    totalAmount: number
    totalBalance: number
    paidPercentage: number
    overdueBills: number
    overdueAmount: number
  }
  generatedAt: string
}

// Floor order for sorting
const floorOrder: Record<string, number> = {
  'LG': 0, 'GF': 1, '1F': 2, '2F': 3, '3F': 4, '4F': 5, '5F': 6, '6F': 7, '7F': 8, '8F': 9, '9F': 10
}

// Custom sort function for unit numbers (M1-1F-1, M2-LG-1, M2-2F-1, etc.)
const getUnitSortValue = (unitNumber: string): number => {
  const match = unitNumber.match(/^([A-Z]+)(\d*)-([A-Z0-9]+)-(\d+)$/i)
  if (match) {
    const bldgNum = parseInt(match[2]) || 0
    const floor = match[3].toUpperCase()
    const unitNum = parseInt(match[4])
    const floorVal = floorOrder[floor] ?? 99
    return bldgNum * 1000000 + floorVal * 10000 + unitNum
  }
  return 0
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

const statusColors: Record<string, string> = {
  PAID: "bg-green-100 text-green-800 border-green-300",
  PARTIAL: "bg-yellow-100 text-yellow-800 border-yellow-300",
  PENDING: "bg-blue-100 text-blue-800 border-blue-300",
  UNPAID: "bg-gray-100 text-gray-800 border-gray-300",
  OVERDUE: "bg-red-100 text-red-800 border-red-300",
  DRAFT: "bg-purple-100 text-purple-800 border-purple-300",
}

const statusLabels: Record<string, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  PENDING: "Pending",
  UNPAID: "Unpaid",
  OVERDUE: "Overdue",
  DRAFT: "Draft",
}

const STATUSES = ["", "PAID", "PARTIAL", "PENDING", "UNPAID", "OVERDUE"]
const MONTHS = [
  { value: "all", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

export default function BillStatusReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [year, setYear] = useState(currentYear.toString())
  const [month, setMonth] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [floorFilter, setFloorFilter] = useState("")
  const [floors, setFloors] = useState<string[]>([])

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
      let url = `/api/reports/bill-status?year=${year}`
      if (month) url += `&month=${month}`
      if (statusFilter) url += `&status=${statusFilter}`
      if (floorFilter) url += `&floor=${floorFilter}`

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
  }, [year, month, statusFilter, floorFilter])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push(["Bill Status Report"])
    wsData.push([`Year: ${report.year}${report.month ? ` - Month: ${report.month}` : ''}`])
    wsData.push([])
    wsData.push(["Bill#", "Month", "Unit", "Floor", "Owner", "Status", "Total", "Balance", "Due Date"])

    report.bills.forEach((b) => {
      wsData.push([
        b.billNumber,
        new Date(b.billingMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        b.unitNumber,
        b.floorLevel,
        b.ownerName,
        statusLabels[b.status] || b.status,
        b.totalAmount,
        b.balance,
        b.dueDate ? new Date(b.dueDate).toLocaleDateString() : ''
      ])
    })

    wsData.push([])
    wsData.push(["Summary"])
    wsData.push(["Total Bills", report.summary.totalBills])
    wsData.push(["Total Amount", report.summary.totalAmount])
    wsData.push(["Total Balance", report.summary.totalBalance])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 6 }, { wch: 20 },
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Bill Status")

    XLSX.writeFile(wb, `Bill_Status_${year}${month ? `_${month}` : ''}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text("Bill Status Report", 14, 15)
    doc.setFontSize(10)
    doc.text(`Year: ${report.year}${report.month ? ` - Month: ${report.month}` : ''}`, 14, 22)

    const tableData = report.bills.slice(0, 50).map((b) => [
      b.billNumber,
      b.unitNumber,
      b.ownerName.slice(0, 15),
      statusLabels[b.status] || b.status,
      formatCurrency(b.totalAmount),
      formatCurrency(b.balance)
    ])

    autoTable(doc, {
      head: [["Bill#", "Unit", "Owner", "Status", "Total", "Balance"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`Bill_Status_${year}${month ? `_${month}` : ''}.pdf`)
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
            <h1 className="text-3xl font-bold text-gray-900">Bill Status Report</h1>
            <p className="text-gray-500">Detailed breakdown of all bills by status</p>
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
              <div className="w-28">
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
              <div className="w-36">
                <Label>Month</Label>
                <Select value={month || "all"} onValueChange={(v) => setMonth(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Label>Status</Label>
                <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUSES.slice(1).map((s) => (
                      <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <Label>Floor</Label>
                <Select value={floorFilter || "all"} onValueChange={(v) => setFloorFilter(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Floors</SelectItem>
                    {floors.filter(f => f !== "").map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
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

        {/* Status Summary Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-5">
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">{report.statusSummary.PAID.count}</div>
                <p className="text-xs text-green-600">
                  {formatCurrency(report.statusSummary.PAID.total)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Partial</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-700">{report.statusSummary.PARTIAL.count}</div>
                <p className="text-xs text-yellow-600">
                  Balance: {formatCurrency(report.statusSummary.PARTIAL.balance)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <FileCheck className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">{report.statusSummary.PENDING.count}</div>
                <p className="text-xs text-blue-600">
                  {formatCurrency(report.statusSummary.PENDING.total)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
                <XCircle className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.statusSummary.UNPAID.count}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(report.statusSummary.UNPAID.balance)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">{report.statusSummary.OVERDUE.count}</div>
                <p className="text-xs text-red-600">
                  {formatCurrency(report.statusSummary.OVERDUE.balance)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Status Distribution Bar */}
        {report && report.summary.totalBills > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-8 rounded overflow-hidden">
                <div
                  className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(report.statusSummary.PAID.count / report.summary.totalBills) * 100}%` }}
                >
                  {report.statusSummary.PAID.count > 0 && `${Math.round((report.statusSummary.PAID.count / report.summary.totalBills) * 100)}%`}
                </div>
                <div
                  className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(report.statusSummary.PARTIAL.count / report.summary.totalBills) * 100}%` }}
                />
                <div
                  className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(report.statusSummary.PENDING.count / report.summary.totalBills) * 100}%` }}
                />
                <div
                  className="bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(report.statusSummary.UNPAID.count / report.summary.totalBills) * 100}%` }}
                />
                <div
                  className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(report.statusSummary.OVERDUE.count / report.summary.totalBills) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>Paid ({report.statusSummary.PAID.count})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded" />
                  <span>Partial ({report.statusSummary.PARTIAL.count})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span>Pending ({report.statusSummary.PENDING.count})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded" />
                  <span>Unpaid ({report.statusSummary.UNPAID.count})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded" />
                  <span>Overdue ({report.statusSummary.OVERDUE.count})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Breakdown (if year view) */}
        {report && report.monthlyBreakdown.length > 0 && (
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
                      <th className="text-right py-3 px-2 font-medium">Total</th>
                      <th className="text-right py-3 px-2 font-medium">Paid</th>
                      <th className="text-right py-3 px-2 font-medium">Partial</th>
                      <th className="text-right py-3 px-2 font-medium">Unpaid</th>
                      <th className="text-right py-3 px-2 font-medium">Overdue</th>
                      <th className="text-right py-3 px-2 font-medium">Amount</th>
                      <th className="text-right py-3 px-2 font-medium">Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthlyBreakdown.map((m) => (
                      <tr key={m.month} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{m.monthName}</td>
                        <td className="py-2 px-2 text-right">{m.total}</td>
                        <td className="py-2 px-2 text-right text-green-600">{m.paid}</td>
                        <td className="py-2 px-2 text-right text-yellow-600">{m.partial}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{m.unpaid}</td>
                        <td className="py-2 px-2 text-right text-red-600">{m.overdue}</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(m.totalAmount)}</td>
                        <td className="py-2 px-2 text-right text-green-600">{formatCurrency(m.collectedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bills DataGrid */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Bill Details ({report.bills.length} bills)</CardTitle>
            </CardHeader>
            <CardContent>
              <DataGrid
                dataSource={report.bills}
                keyExpr="id"
                showBorders={true}
                showRowLines={true}
                rowAlternationEnabled={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                wordWrapEnabled={true}
              >
                <SearchPanel visible={true} placeholder="Search all columns..." width={300} />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <Sorting mode="multiple" />
                <Paging enabled={true} defaultPageSize={20} />

                <Column
                  dataField="billNumber"
                  caption="Bill#"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  cellRender={(cellData: any) => (
                    <span className="font-medium">{cellData.value}</span>
                  )}
                />
                <Column
                  dataField="billingMonth"
                  caption="Month"
                  dataType="date"
                  allowSorting={true}
                  allowFiltering={true}
                  sortOrder="desc"
                  sortIndex={0}
                  cellRender={(cellData: any) => (
                    <span>
                      {new Date(cellData.value).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                />
                <Column
                  dataField="unitNumber"
                  caption="Unit"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  calculateSortValue={(rowData: BillData) => getUnitSortValue(rowData.unitNumber)}
                  cellRender={(cellData: any) => (
                    <span className="font-medium">{cellData.value}</span>
                  )}
                />
                <Column
                  dataField="floorLevel"
                  caption="Floor"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  width={80}
                />
                <Column
                  dataField="ownerName"
                  caption="Owner"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                />
                <Column
                  dataField="status"
                  caption="Status"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  cellRender={(cellData: any) => (
                    <Badge variant="outline" className={statusColors[cellData.value]}>
                      {statusLabels[cellData.value] || cellData.value}
                    </Badge>
                  )}
                />
                <Column
                  dataField="totalAmount"
                  caption="Total"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span>{formatNumber(cellData.value)}</span>
                  )}
                />
                <Column
                  dataField="balance"
                  caption="Balance"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span className={cellData.value > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                      {cellData.value > 0 ? formatNumber(cellData.value) : "-"}
                    </span>
                  )}
                />
                <Column
                  dataField="dueDate"
                  caption="Due Date"
                  dataType="date"
                  allowSorting={true}
                  allowFiltering={true}
                  cellRender={(cellData: any) => {
                    if (!cellData.value) return <span>-</span>
                    const isOverdue = cellData.data.isOverdue
                    return (
                      <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                        {new Date(cellData.value).toLocaleDateString()}
                      </span>
                    )
                  }}
                />

                <Summary>
                  <TotalItem
                    column="billNumber"
                    summaryType="count"
                    displayFormat="{0} bills"
                  />
                  <TotalItem
                    column="totalAmount"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="balance"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                </Summary>
              </DataGrid>
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
