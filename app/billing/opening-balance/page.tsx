"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Editing,
  Toolbar,
  Item,
} from "devextreme-react/data-grid"
import { SelectBox } from "devextreme-react/select-box"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Save, DollarSign, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface UnitBalance {
  id: string
  unitNumber: string
  floorLevel: string
  lastName: string
  firstName: string
  middleName: string
  openingBalance: number | null
  openingBalanceBillId: string | null
  status: "new" | "saved"
}

export default function OpeningBalancePage() {
  const [data, setData] = useState<UnitBalance[]>([])
  const [floors, setFloors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedFloor, setSelectedFloor] = useState("All Floors")
  const gridRef = useRef<any>(null)

  const fetchFloors = async () => {
    try {
      const res = await fetch("/api/floors")
      if (res.ok) {
        const data = await res.json()
        setFloors(["All Floors", ...data])
      }
    } catch (error) {
      console.error("Error fetching floors:", error)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const floor =
        selectedFloor === "All Floors" ? "" : `?floor=${selectedFloor}`
      const res = await fetch(`/api/billing/opening-balance${floor}`)
      if (!res.ok) throw new Error("Failed to fetch data")
      const result = await res.json()
      setData(result)
    } catch (error) {
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [selectedFloor])

  useEffect(() => {
    fetchFloors()
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFloorChange = (e: any) => {
    setSelectedFloor(e.value)
  }

  const handleSave = async () => {
    // Get all rows with balances
    const balances = data
      .filter((row) => row.openingBalance !== null && row.openingBalance > 0)
      .map((row) => ({
        unitId: row.id,
        amount: row.openingBalance,
      }))

    if (balances.length === 0) {
      toast.warning("No balances to save")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/billing/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balances }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save")
      }

      const result = await res.json()
      toast.success(
        `Saved ${result.created} new, updated ${result.updated} existing`
      )
      fetchData() // Refresh to show updated status
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const onCellValueChanged = (e: any) => {
    if (e.column.dataField === "openingBalance") {
      // Update local state when balance is edited
      const newData = [...data]
      const index = newData.findIndex((row) => row.id === e.key)
      if (index !== -1) {
        newData[index] = { ...newData[index], openingBalance: e.value }
        setData(newData)
      }
    }
  }

  const statusCellRender = (cellData: any) => {
    const status = cellData.value
    return (
      <Badge variant={status === "saved" ? "success" : "secondary"}>
        {status === "saved" ? "Saved" : "New"}
      </Badge>
    )
  }

  const balanceCellRender = (cellData: any) => {
    const value = cellData.value
    if (value === null || value === undefined) return "-"
    return (
      <span className="font-medium">
        {Number(value).toLocaleString("en-PH", {
          style: "currency",
          currency: "PHP",
        })}
      </span>
    )
  }

  // Calculate totals
  const totalBalance = data.reduce(
    (sum, row) => sum + (row.openingBalance || 0),
    0
  )
  const unitsWithBalance = data.filter(
    (row) => row.openingBalance && row.openingBalance > 0
  ).length
  const savedCount = data.filter((row) => row.status === "saved").length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Opening Balance Entry
            </h1>
            <p className="text-gray-500 text-sm sm:text-base">
              Enter outstanding balances for each unit
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save All"}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-green-600" />
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Total Balance</p>
                <p className="text-lg sm:text-2xl font-bold">
                  {totalBalance.toLocaleString("en-PH", {
                    style: "currency",
                    currency: "PHP",
                    minimumFractionDigits: 0,
                  })}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs sm:text-sm text-gray-500">Total Units</p>
            <p className="text-lg sm:text-2xl font-bold">{data.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs sm:text-sm text-gray-500">With Balance</p>
            <p className="text-lg sm:text-2xl font-bold">{unitsWithBalance}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs sm:text-sm text-gray-500">Saved</p>
            <p className="text-lg sm:text-2xl font-bold text-green-600">
              {savedCount}
            </p>
          </div>
        </div>

        {/* Floor Filter */}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Filter by Floor:
            </label>
            <SelectBox
              dataSource={floors}
              value={selectedFloor}
              onValueChanged={handleFloorChange}
              width={200}
              stylingMode="outlined"
            />
          </div>
        </div>

        {/* DataGrid */}
        <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <DataGrid
              ref={gridRef}
              dataSource={data}
              keyExpr="id"
              showBorders={true}
              showRowLines={true}
              showColumnLines={true}
              rowAlternationEnabled={true}
              columnAutoWidth={true}
              onSaved={onCellValueChanged}
              repaintChangesOnly={true}
            >
              <Paging defaultPageSize={20} />
              <Pager
                showPageSizeSelector={true}
                allowedPageSizes={[10, 20, 50, 100]}
                showInfo={true}
              />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <SearchPanel visible={true} placeholder="Search by name, unit..." />
              <Editing mode="cell" allowUpdating={true} />

              <Column
                dataField="unitNumber"
                caption="Unit"
                width={100}
                allowEditing={false}
                cssClass="font-medium"
              />

              <Column
                dataField="floorLevel"
                caption="Floor"
                width={80}
                allowEditing={false}
              />

              <Column
                dataField="lastName"
                caption="Last Name"
                minWidth={120}
                allowEditing={false}
              />

              <Column
                dataField="firstName"
                caption="First Name"
                minWidth={120}
                allowEditing={false}
              />

              <Column
                dataField="middleName"
                caption="M.I."
                width={80}
                allowEditing={false}
              />

              <Column
                dataField="openingBalance"
                caption="Outstanding Balance"
                dataType="number"
                format="#,##0.00"
                width={180}
                allowEditing={true}
                cellRender={balanceCellRender}
                cssClass="text-right"
                alignment="right"
              />

              <Column
                dataField="status"
                caption="Status"
                width={100}
                allowEditing={false}
                cellRender={statusCellRender}
                alignment="center"
              />

              <Toolbar>
                <Item name="searchPanel" />
              </Toolbar>
            </DataGrid>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">Instructions</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>
              1. Click on the Outstanding Balance cell to enter the amount
            </li>
            <li>2. Use the floor filter to work floor by floor</li>
            <li>3. Click Save All to save all entered balances</li>
            <li>
              4. Saved entries will show a green Saved badge
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  )
}
