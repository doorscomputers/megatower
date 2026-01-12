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
import { Badge } from "@/components/ui/badge"
import {
  Trophy,
  Medal,
  Award,
  Star,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Printer,
  TrendingUp,
  AlertTriangle,
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

interface UnitMetric {
  unitId: string
  unitNumber: string
  floorLevel: string
  ownerName: string
  totalPaid: number
  totalBilled: number
  paymentCount: number
  billCount: number
  onTimePayments: number
  latePayments: number
  fullyPaidBills: number
  currentBalance: number
  paymentScore: number
  rank: number
}

interface ReportData {
  year: number
  topPayers: UnitMetric[]
  bottomPayers: UnitMetric[]
  allUnits: UnitMetric[]
  summary: {
    totalUnits: number
    avgPaymentScore: number
    excellentPayers: number
    goodPayers: number
    fairPayers: number
    poorPayers: number
    perfectScoreUnits: number
    zeroBalanceUnits: number
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

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />
    case 3:
      return <Medal className="h-5 w-5 text-amber-600" />
    default:
      return <span className="text-sm font-medium text-gray-500">#{rank}</span>
  }
}

const getScoreColor = (score: number) => {
  if (score >= 90) return "bg-green-100 text-green-800 border-green-300"
  if (score >= 70) return "bg-blue-100 text-blue-800 border-blue-300"
  if (score >= 50) return "bg-yellow-100 text-yellow-800 border-yellow-300"
  return "bg-red-100 text-red-800 border-red-300"
}

const getScoreLabel = (score: number) => {
  if (score >= 90) return "Excellent"
  if (score >= 70) return "Good"
  if (score >= 50) return "Fair"
  return "Needs Improvement"
}

export default function TopPayersReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [year, setYear] = useState(currentYear.toString())

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/reports/top-payers?year=${year}`)
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

    wsData.push(["Top Payers Report"])
    wsData.push([`Year: ${report.year}`])
    wsData.push([])
    wsData.push(["Rank", "Unit", "Floor", "Owner", "Total Paid", "Total Billed", "Balance", "Score", "Rating"])

    report.allUnits.forEach((u) => {
      wsData.push([
        u.rank,
        u.unitNumber,
        u.floorLevel,
        u.ownerName,
        u.totalPaid,
        u.totalBilled,
        u.currentBalance,
        u.paymentScore,
        getScoreLabel(u.paymentScore)
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 6 }, { wch: 10 }, { wch: 6 }, { wch: 20 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 16 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Top Payers")

    XLSX.writeFile(wb, `Top_Payers_${year}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text("Top Payers Report", 14, 15)
    doc.setFontSize(10)
    doc.text(`Year: ${report.year}`, 14, 22)

    const tableData = report.topPayers.map((u) => [
      `#${u.rank}`,
      u.unitNumber,
      u.ownerName,
      formatCurrency(u.totalPaid),
      formatCurrency(u.currentBalance),
      `${u.paymentScore}%`,
      getScoreLabel(u.paymentScore)
    ])

    autoTable(doc, {
      head: [["Rank", "Unit", "Owner", "Total Paid", "Balance", "Score", "Rating"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`Top_Payers_${year}.pdf`)
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
            <h1 className="text-3xl font-bold text-gray-900">Top Payers Report</h1>
            <p className="text-gray-500">Best paying units ranked by payment performance</p>
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

        {/* Summary Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Excellent Payers</CardTitle>
                <Star className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">{report.summary.excellentPayers}</div>
                <p className="text-xs text-green-600">Score 90%+</p>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Good Payers</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">{report.summary.goodPayers}</div>
                <p className="text-xs text-blue-600">Score 70-89%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <Award className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.summary.avgPaymentScore}%</div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.perfectScoreUnits} perfect scores
                </p>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">{report.summary.poorPayers}</div>
                <p className="text-xs text-red-600">Score below 50%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Score Distribution */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 h-8">
                <div
                  className="bg-green-500 rounded-l flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(report.summary.excellentPayers / report.summary.totalUnits) * 100}%` }}
                >
                  {report.summary.excellentPayers > 0 && `${report.summary.excellentPayers}`}
                </div>
                <div
                  className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(report.summary.goodPayers / report.summary.totalUnits) * 100}%` }}
                >
                  {report.summary.goodPayers > 0 && `${report.summary.goodPayers}`}
                </div>
                <div
                  className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(report.summary.fairPayers / report.summary.totalUnits) * 100}%` }}
                >
                  {report.summary.fairPayers > 0 && `${report.summary.fairPayers}`}
                </div>
                <div
                  className="bg-red-500 rounded-r flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(report.summary.poorPayers / report.summary.totalUnits) * 100}%` }}
                >
                  {report.summary.poorPayers > 0 && `${report.summary.poorPayers}`}
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Excellent (90%+)</span>
                <span>Good (70-89%)</span>
                <span>Fair (50-69%)</span>
                <span>Poor (&lt;50%)</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Payers Podium */}
        {report && report.topPayers.length >= 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top 3 Payers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center items-end gap-4">
                {/* 2nd Place */}
                <div className="flex flex-col items-center">
                  <Medal className="h-8 w-8 text-gray-400 mb-2" />
                  <div className="bg-gray-100 rounded-t-lg p-4 w-32 text-center h-24">
                    <p className="font-bold">{report.topPayers[1].unitNumber}</p>
                    <p className="text-xs text-gray-500">{report.topPayers[1].ownerName}</p>
                    <p className="text-lg font-bold text-gray-600">{report.topPayers[1].paymentScore}%</p>
                  </div>
                </div>
                {/* 1st Place */}
                <div className="flex flex-col items-center">
                  <Trophy className="h-10 w-10 text-yellow-500 mb-2" />
                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-t-lg p-4 w-36 text-center h-32">
                    <p className="font-bold text-lg">{report.topPayers[0].unitNumber}</p>
                    <p className="text-sm text-gray-600">{report.topPayers[0].ownerName}</p>
                    <p className="text-2xl font-bold text-yellow-600">{report.topPayers[0].paymentScore}%</p>
                  </div>
                </div>
                {/* 3rd Place */}
                <div className="flex flex-col items-center">
                  <Medal className="h-8 w-8 text-amber-600 mb-2" />
                  <div className="bg-amber-50 rounded-t-lg p-4 w-32 text-center h-20">
                    <p className="font-bold">{report.topPayers[2].unitNumber}</p>
                    <p className="text-xs text-gray-500">{report.topPayers[2].ownerName}</p>
                    <p className="text-lg font-bold text-amber-600">{report.topPayers[2].paymentScore}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Units Ranking DataGrid */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>All Units Ranking ({report.allUnits.length} units)</CardTitle>
            </CardHeader>
            <CardContent>
              <DataGrid
                dataSource={report.allUnits}
                keyExpr="unitId"
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
                  dataField="rank"
                  caption="Rank"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  width={80}
                  sortOrder="asc"
                  sortIndex={0}
                  cellRender={(cellData: any) => (
                    <div className="flex items-center justify-center">
                      {getRankIcon(cellData.value)}
                    </div>
                  )}
                />
                <Column
                  dataField="unitNumber"
                  caption="Unit"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  calculateSortValue={(rowData: UnitMetric) => getUnitSortValue(rowData.unitNumber)}
                  cellRender={(cellData: any) => (
                    <div>
                      <span className="font-medium">{cellData.value}</span>
                      <div className="text-xs text-gray-500">{cellData.data.floorLevel}</div>
                    </div>
                  )}
                />
                <Column
                  dataField="floorLevel"
                  caption="Floor"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  width={80}
                  visible={false}
                />
                <Column
                  dataField="ownerName"
                  caption="Owner"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                />
                <Column
                  dataField="totalPaid"
                  caption="Total Paid"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span className="text-green-600 font-medium">{formatNumber(cellData.value)}</span>
                  )}
                />
                <Column
                  dataField="totalBilled"
                  caption="Total Billed"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span>{formatNumber(cellData.value)}</span>
                  )}
                />
                <Column
                  dataField="currentBalance"
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
                  dataField="paymentScore"
                  caption="Score"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="center"
                  width={100}
                  cellRender={(cellData: any) => (
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getScoreColor(cellData.value)}`}>
                      {cellData.value}%
                    </span>
                  )}
                />
                <Column
                  caption="Rating"
                  allowSorting={false}
                  allowFiltering={false}
                  alignment="center"
                  width={140}
                  cellRender={(cellData: any) => (
                    <Badge variant="outline" className={getScoreColor(cellData.data.paymentScore)}>
                      {getScoreLabel(cellData.data.paymentScore)}
                    </Badge>
                  )}
                />

                <Summary>
                  <TotalItem
                    column="unitNumber"
                    summaryType="count"
                    displayFormat="{0} units"
                  />
                  <TotalItem
                    column="totalPaid"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="totalBilled"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="currentBalance"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="paymentScore"
                    summaryType="avg"
                    valueFormat={{ type: "fixedPoint", precision: 0 }}
                    displayFormat="Avg: {0}%"
                  />
                </Summary>
              </DataGrid>
            </CardContent>
          </Card>
        )}

        {/* Units Needing Attention */}
        {report && report.bottomPayers.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Units Needing Attention (Bottom 10)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataGrid
                dataSource={report.bottomPayers}
                keyExpr="unitId"
                showBorders={true}
                showRowLines={true}
                rowAlternationEnabled={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
              >
                <Sorting mode="single" />

                <Column
                  dataField="unitNumber"
                  caption="Unit"
                  allowSorting={true}
                  calculateSortValue={(rowData: UnitMetric) => getUnitSortValue(rowData.unitNumber)}
                  cellRender={(cellData: any) => (
                    <span className="font-medium">{cellData.value}</span>
                  )}
                />
                <Column
                  dataField="ownerName"
                  caption="Owner"
                  allowSorting={true}
                />
                <Column
                  dataField="currentBalance"
                  caption="Outstanding"
                  dataType="number"
                  allowSorting={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span className="text-red-600 font-bold">{formatCurrency(cellData.value)}</span>
                  )}
                />
                <Column
                  dataField="paymentScore"
                  caption="Score"
                  dataType="number"
                  allowSorting={true}
                  alignment="center"
                  sortOrder="asc"
                  sortIndex={0}
                  cellRender={(cellData: any) => (
                    <span className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-800">
                      {cellData.value}%
                    </span>
                  )}
                />
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
