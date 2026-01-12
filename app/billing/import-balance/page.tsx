"use client"

import { useState, useRef } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  Summary,
  TotalItem,
} from "devextreme-react/data-grid"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Save, X } from "lucide-react"
import { toast } from "sonner"

interface MatchedUnit {
  unitNumber: string
  ownerName: string
  newBalance: number
  previousBalance: number | null
  action: "create" | "update" | "skip"
  electricPrevReading: number | null
  electricPresReading: number | null
  waterPrevReading: number | null
  waterPresReading: number | null
}

interface UnmatchedUnit {
  unitNumber: string
  ownerName: string
  balance: number
  electricPrevReading: number | null
  waterPrevReading: number | null
}

interface ParseResult {
  filename: string
  buildingPrefix: string
  matched: MatchedUnit[]
  unmatched: UnmatchedUnit[]
}

export default function ImportBalancePage() {
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [buildingPrefix, setBuildingPrefix] = useState("M1")
  const [billingPeriod, setBillingPeriod] = useState(() => {
    // Default to current month
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<any>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      await processFile(files[0])
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await processFile(files[0])
    }
  }

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please select an Excel file (.xlsx or .xls)")
      return
    }

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append("file", file)
      formData.append("buildingPrefix", buildingPrefix)

      const res = await fetch("/api/billing/import-balance", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to parse file")
      }

      const result = await res.json()
      setParseResult(result)
      toast.success(`Found ${result.matched.length} matching units`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!parseResult) return

    // Include ALL matched units - balances will only update if action != skip
    // but readings will always be saved/updated
    const dataToApply = parseResult.matched.map((m) => ({
      unitNumber: m.unitNumber,
      balance: m.newBalance,
      action: m.action,
      electricPrevReading: m.electricPrevReading,
      electricPresReading: m.electricPresReading,
      waterPrevReading: m.waterPrevReading,
      waterPresReading: m.waterPresReading,
    }))

    if (dataToApply.length === 0) {
      toast.warning("No data to apply")
      return
    }

    try {
      setApplying(true)
      const res = await fetch("/api/billing/import-balance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balances: dataToApply,
          billingPeriod,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to apply changes")
      }

      const result = await res.json()
      const readingsMsg = result.readingsCreated > 0
        ? `, ${result.readingsCreated} readings`
        : ""
      toast.success(
        `Created ${result.created}, Updated ${result.updated} balances${readingsMsg}`
      )

      // Clear the result after applying
      setParseResult(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setApplying(false)
    }
  }

  const handleClear = () => {
    setParseResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const actionCellRender = (cellData: any) => {
    const action = cellData.value
    if (action === "create") {
      return (
        <Badge className="bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle className="w-3 h-3 mr-1" />
          New
        </Badge>
      )
    }
    if (action === "update") {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
          <AlertCircle className="w-3 h-3 mr-1" />
          Update
        </Badge>
      )
    }
    return (
      <Badge variant="secondary">
        No Change
      </Badge>
    )
  }

  const currencyFormat = (value: number | null) => {
    if (value === null || value === undefined) return "-"
    return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
  }

  const balanceCellRender = (cellData: any) => {
    const value = cellData.value
    return <span className="font-medium">{currencyFormat(value)}</span>
  }

  // Calculate stats
  const toCreate = parseResult?.matched.filter((m) => m.action === "create").length || 0
  const toUpdate = parseResult?.matched.filter((m) => m.action === "update").length || 0
  const noChange = parseResult?.matched.filter((m) => m.action === "skip").length || 0
  const unmatched = parseResult?.unmatched.length || 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import Balances from Excel</h1>
            <p className="text-muted-foreground">
              Upload an Excel billing file to update opening balances
            </p>
          </div>
        </div>

        {/* Upload Section */}
        {!parseResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Upload Excel File
              </CardTitle>
              <CardDescription>
                Select the building and upload the Excel billing file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Building and Billing Period Selection */}
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Label htmlFor="building">Building:</Label>
                  <Select value={buildingPrefix} onValueChange={setBuildingPrefix}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M1">Megatower I (M1)</SelectItem>
                      <SelectItem value="M2">Megatower II (M2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="billingPeriod">Billing Period:</Label>
                  <Input
                    id="billingPeriod"
                    type="month"
                    value={billingPeriod}
                    onChange={(e) => setBillingPeriod(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
              </div>

              {/* Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Upload
                  className={`w-12 h-12 mx-auto mb-4 ${
                    isDragging ? "text-primary" : "text-gray-400"
                  }`}
                />
                <p className="text-lg font-medium">
                  {loading ? "Processing..." : "Drop Excel file here"}
                </p>
                <p className="text-muted-foreground mt-1">
                  or{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    browse files
                  </button>
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Supported formats: .xlsx, .xls
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {parseResult && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">{toCreate}</div>
                  <p className="text-sm text-muted-foreground">New Balances</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-blue-600">{toUpdate}</div>
                  <p className="text-sm text-muted-foreground">To Update</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-gray-600">{noChange}</div>
                  <p className="text-sm text-muted-foreground">No Change</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-orange-600">{unmatched}</div>
                  <p className="text-sm text-muted-foreground">Unmatched</p>
                </CardContent>
              </Card>
            </div>

            {/* File Info */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-medium">{parseResult.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    Building: {parseResult.buildingPrefix === "M1" ? "Megatower I" : "Megatower II"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClear}>
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
                <Button
                  onClick={handleApply}
                  disabled={applying || parseResult.matched.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {applying ? "Applying..." : `Apply to ${parseResult.matched.length} Units`}
                </Button>
              </div>
            </div>

            {/* Matched Units Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Matched Units ({parseResult.matched.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <DataGrid
                  ref={gridRef}
                  dataSource={parseResult.matched}
                  keyExpr="unitNumber"
                  showBorders={true}
                  rowAlternationEnabled={true}
                  allowColumnResizing={true}
                  columnAutoWidth={true}
                >
                  <FilterRow visible={true} />
                  <HeaderFilter visible={true} />
                  <Paging defaultPageSize={20} />
                  <Pager
                    showPageSizeSelector={true}
                    allowedPageSizes={[10, 20, 50, 100]}
                    showInfo={true}
                  />

                  <Column
                    dataField="unitNumber"
                    caption="Unit"
                    width={120}
                  />
                  <Column
                    dataField="ownerName"
                    caption="Owner"
                    width={250}
                  />
                  <Column
                    dataField="previousBalance"
                    caption="Previous Balance"
                    width={150}
                    cellRender={balanceCellRender}
                    alignment="right"
                  />
                  <Column
                    dataField="newBalance"
                    caption="New Balance"
                    width={150}
                    cellRender={balanceCellRender}
                    alignment="right"
                  />
                  <Column
                    dataField="electricPresReading"
                    caption="Elec Pres"
                    width={100}
                    alignment="right"
                    cellRender={(data: any) => data.value ?? "-"}
                  />
                  <Column
                    dataField="electricPrevReading"
                    caption="Elec Prev"
                    width={100}
                    alignment="right"
                    cellRender={(data: any) => data.value ?? "-"}
                  />
                  <Column
                    dataField="waterPresReading"
                    caption="Water Pres"
                    width={100}
                    alignment="right"
                    cellRender={(data: any) => data.value ?? "-"}
                  />
                  <Column
                    dataField="waterPrevReading"
                    caption="Water Prev"
                    width={100}
                    alignment="right"
                    cellRender={(data: any) => data.value ?? "-"}
                  />
                  <Column
                    dataField="action"
                    caption="Action"
                    width={120}
                    cellRender={actionCellRender}
                    alignment="center"
                  />

                  <Summary>
                    <TotalItem
                      column="newBalance"
                      summaryType="sum"
                      customizeText={(data: any) => `Total: ${currencyFormat(data.value)}`}
                    />
                  </Summary>
                </DataGrid>
              </CardContent>
            </Card>

            {/* Unmatched Units */}
            {parseResult.unmatched.length > 0 && (
              <Card className="border-orange-200">
                <CardHeader>
                  <CardTitle className="text-orange-600">
                    Unmatched Units ({parseResult.unmatched.length})
                  </CardTitle>
                  <CardDescription>
                    These units from the Excel file could not be matched to existing units in the database.
                    Check if the unit numbers are correct or if they need to be added first.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataGrid
                    dataSource={parseResult.unmatched}
                    keyExpr="unitNumber"
                    showBorders={true}
                    rowAlternationEnabled={true}
                  >
                    <Paging defaultPageSize={10} />

                    <Column dataField="unitNumber" caption="Unit" width={150} />
                    <Column dataField="ownerName" caption="Owner" />
                    <Column
                      dataField="balance"
                      caption="Balance"
                      width={150}
                      cellRender={balanceCellRender}
                      alignment="right"
                    />
                  </DataGrid>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
