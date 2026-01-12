"use client"

import { useEffect, useState, useRef } from "react"
import ExcelJS from "exceljs"
import { exportDataGrid } from "devextreme/excel_exporter"
import { saveAs } from "file-saver"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Toolbar,
  Item,
  Export,
  Summary,
  TotalItem,
} from "devextreme-react/data-grid"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Trash2, AlertCircle, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { format } from "date-fns"

interface Bill {
  id: string
  billNumber: string
  billingPeriod: string
  periodFrom: string
  periodTo: string
  statementDate: string
  dueDate: string
  electricConsumption: number
  electricAmount: number
  waterConsumption: number
  waterAmount: number
  associationDues: number
  parkingFee: number
  spAssessment: number
  previousBalance: number
  penaltyAmount: number
  otherCharges: number
  discounts: number
  subtotal: number
  totalAmount: number
  paidAmount: number
  status: string
  unit: {
    id: string
    unitNumber: string
    owner: {
      name: string
      email: string | null
    }
  }
}

interface EditBillFormData {
  electricAmount: string
  waterAmount: string
  associationDues: string
  parkingFee: string
  spAssessment: string
  penaltyAmount: string
  otherCharges: string
  discounts: string
}

const initialEditFormData: EditBillFormData = {
  electricAmount: "",
  waterAmount: "",
  associationDues: "",
  parkingFee: "",
  spAssessment: "",
  penaltyAmount: "",
  otherCharges: "",
  discounts: "",
}

export default function BillsListPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const gridRef = useRef<any>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteBillingMonth, setDeleteBillingMonth] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Edit bill state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [editFormData, setEditFormData] = useState<EditBillFormData>(initialEditFormData)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchBills()
  }, [])

  const fetchBills = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/billing")
      if (!res.ok) throw new Error("Failed to fetch bills")
      const data = await res.json()
      setBills(data)
    } catch (error) {
      toast.error("Failed to load bills")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBills = async () => {
    if (!deleteBillingMonth) {
      toast.error("Please select a billing month")
      return
    }

    try {
      setDeleting(true)
      const res = await fetch("/api/billing/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMonth: deleteBillingMonth }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete bills")
      }

      toast.success(data.message)
      setShowDeleteDialog(false)
      setDeleteBillingMonth("")
      fetchBills() // Refresh the list
    } catch (error: any) {
      toast.error(error.message, { duration: 6000 })
    } finally {
      setDeleting(false)
    }
  }

  const openEditDialog = (bill: Bill) => {
    setEditingBill(bill)
    setEditFormData({
      electricAmount: (bill.electricAmount || 0).toString(),
      waterAmount: (bill.waterAmount || 0).toString(),
      associationDues: (bill.associationDues || 0).toString(),
      parkingFee: (bill.parkingFee || 0).toString(),
      spAssessment: (bill.spAssessment || 0).toString(),
      penaltyAmount: (bill.penaltyAmount || 0).toString(),
      otherCharges: (bill.otherCharges || 0).toString(),
      discounts: (bill.discounts || 0).toString(),
    })
    setShowEditDialog(true)
  }

  const calculateEditTotal = () => {
    const electric = parseFloat(editFormData.electricAmount) || 0
    const water = parseFloat(editFormData.waterAmount) || 0
    const dues = parseFloat(editFormData.associationDues) || 0
    const parking = parseFloat(editFormData.parkingFee) || 0
    const sp = parseFloat(editFormData.spAssessment) || 0
    const penalty = parseFloat(editFormData.penaltyAmount) || 0
    const other = parseFloat(editFormData.otherCharges) || 0
    const discount = parseFloat(editFormData.discounts) || 0
    return electric + water + dues + parking + sp + penalty + other - discount
  }

  const handleSaveBill = async () => {
    if (!editingBill) return

    try {
      setSaving(true)
      const res = await fetch(`/api/billing/${editingBill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update bill")
      }

      toast.success("Bill updated successfully")
      setShowEditDialog(false)
      setEditingBill(null)
      setEditFormData(initialEditFormData)
      fetchBills() // Refresh the list
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const actionsCellRender = (data: any) => {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => openEditDialog(data.data)}
        className="h-7 px-2"
      >
        <Pencil className="h-3 w-3 mr-1" />
        Edit
      </Button>
    )
  }

  const statusCellRender = (data: any) => {
    const status = data.value
    const variants: Record<
      string,
      "default" | "secondary" | "success" | "warning" | "danger"
    > = {
      PAID: "success",
      UNPAID: "danger",
      PARTIAL: "warning",
      OVERDUE: "danger",
      CANCELLED: "secondary",
    }
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>
  }

  const currencyCellRender = (data: any) => {
    const value = data.value ?? 0
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(value)
  }

  const dateCellRender = (data: any) => {
    if (!data.value) return "-"
    return format(new Date(data.value), "MMM dd, yyyy")
  }

  const periodCellRender = (data: any) => {
    if (!data.value) return "-"
    return format(new Date(data.value), "MMM yyyy")
  }

  const balanceCellRender = (data: any) => {
    const balance = (data.data.totalAmount ?? 0) - (data.data.paidAmount ?? 0)
    return (
      <span
        className={`font-mono ${balance > 0 ? "text-red-600" : "text-green-600"}`}
      >
        {new Intl.NumberFormat("en-PH", {
          style: "currency",
          currency: "PHP",
        }).format(balance)}
      </span>
    )
  }

  const unitCellRender = (data: any) => {
    return (
      <div>
        <p className="font-medium">{data.data.unit.unitNumber}</p>
        <p className="text-xs text-gray-500">{data.data.unit.owner.name}</p>
      </div>
    )
  }

  // Helper function to parse unit number for natural sorting
  const parseUnitNumber = (unitNumber: string) => {
    // Parse format like "M2-2F-1" into parts
    const parts = unitNumber.split('-')
    if (parts.length === 3) {
      const building = parts[0] // "M2"
      const floor = parts[1].replace(/[^\d]/g, '') // "2F" -> "2"
      const unit = parts[2] // "1"

      // Create a sortable string: building as string, floor and unit as padded numbers
      return `${building}-${floor.padStart(3, '0')}-${unit.padStart(3, '0')}`
    }
    return unitNumber
  }

  const onExporting = (e: any) => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Bills")

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer: any) => {
        saveAs(
          new Blob([buffer], { type: "application/octet-stream" }),
          `Bills_${format(new Date(), "yyyy-MM-dd")}.xlsx`
        )
      })
    })
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bills List</h1>
            <p className="text-gray-500">View and manage all billing statements</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Bills
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Total Bills</p>
            <p className="text-2xl font-bold">{bills.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-600">Paid</p>
            <p className="text-2xl font-bold text-green-700">
              {bills.filter((b) => b.status === "PAID").length}
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-sm text-red-600">Unpaid</p>
            <p className="text-2xl font-bold text-red-700">
              {bills.filter((b) => b.status === "UNPAID").length}
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-600">Partial</p>
            <p className="text-2xl font-bold text-yellow-700">
              {bills.filter((b) => b.status === "PARTIAL").length}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-600">Total Amount</p>
            <p className="text-xl font-bold text-purple-700">
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
                minimumFractionDigits: 0,
              }).format(bills.reduce((sum, b) => sum + (b.totalAmount ?? 0), 0))}
            </p>
          </div>
        </div>

        {/* DataGrid */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <DataGrid
            ref={gridRef}
            dataSource={bills}
            keyExpr="id"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            columnAutoWidth={true}
            allowColumnReordering={true}
            allowColumnResizing={true}
          >
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
            />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel visible={true} placeholder="Search bills..." />
            <Export enabled={true} />

            <Column
              dataField="billNumber"
              caption="Bill Number"
              width={140}
              fixed={true}
            />

            <Column
              dataField="unit.unitNumber"
              caption="Unit / Owner"
              width={180}
              cellRender={unitCellRender}
              calculateCellValue={(rowData: Bill) =>
                `${rowData.unit.unitNumber} ${rowData.unit.owner.name}`
              }
              calculateSortValue={(rowData: Bill) =>
                parseUnitNumber(rowData.unit.unitNumber)
              }
            />

            <Column
              dataField="billingPeriod"
              caption="Billing Period"
              width={120}
              cellRender={periodCellRender}
              dataType="date"
            />

            <Column
              dataField="statementDate"
              caption="Statement Date"
              width={130}
              cellRender={dateCellRender}
              dataType="date"
            />

            <Column
              dataField="dueDate"
              caption="Due Date"
              width={120}
              cellRender={dateCellRender}
              dataType="date"
            />

            <Column
              dataField="electricAmount"
              caption="Electric"
              width={110}
              cellRender={currencyCellRender}
              dataType="number"
              format="currency"
              alignment="right"
            />

            <Column
              dataField="waterAmount"
              caption="Water"
              width={110}
              cellRender={currencyCellRender}
              dataType="number"
              format="currency"
              alignment="right"
            />

            <Column
              dataField="associationDues"
              caption="Dues"
              width={110}
              cellRender={currencyCellRender}
              dataType="number"
              format="currency"
              alignment="right"
            />

            <Column
              dataField="previousBalance"
              caption="Prev Balance"
              width={120}
              cellRender={currencyCellRender}
              dataType="number"
              format="currency"
              alignment="right"
            />

            <Column
              dataField="penaltyAmount"
              caption="Penalty"
              width={110}
              cellRender={currencyCellRender}
              dataType="number"
              format="currency"
              alignment="right"
            />

            <Column
              dataField="totalAmount"
              caption="Total"
              width={120}
              cellRender={currencyCellRender}
              dataType="number"
              format="currency"
              alignment="right"
            />

            <Column
              dataField="paidAmount"
              caption="Paid"
              width={120}
              cellRender={currencyCellRender}
              dataType="number"
              format="currency"
              alignment="right"
            />

            <Column
              caption="Balance"
              width={120}
              cellRender={balanceCellRender}
              calculateCellValue={(rowData: Bill) =>
                rowData.totalAmount - rowData.paidAmount
              }
              dataType="number"
              alignment="right"
            />

            <Column
              dataField="status"
              caption="Status"
              width={100}
              cellRender={statusCellRender}
            />

            <Column
              caption="Actions"
              width={80}
              cellRender={actionsCellRender}
              allowFiltering={false}
              allowSorting={false}
              fixed={true}
              fixedPosition="right"
            />

            <Toolbar>
              <Item name="searchPanel" />
              <Item name="exportButton" />
            </Toolbar>

            <Summary>
              <TotalItem column="billNumber" summaryType="count" />
              <TotalItem
                column="totalAmount"
                summaryType="sum"
                valueFormat={{ style: "currency", currency: "PHP" }}
              />
              <TotalItem
                column="paidAmount"
                summaryType="sum"
                valueFormat={{ style: "currency", currency: "PHP" }}
              />
            </Summary>
          </DataGrid>
        </div>

        {/* Delete Bills Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Delete Bills for a Billing Period
              </DialogTitle>
              <DialogDescription>
                Select the billing month to delete all bills
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="deleteBillingMonth">Billing Month *</Label>
                <Input
                  id="deleteBillingMonth"
                  type="month"
                  value={deleteBillingMonth}
                  onChange={(e) => setDeleteBillingMonth(e.target.value)}
                  disabled={deleting}
                />
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900">Safety Protection</p>
                    <p className="text-sm text-red-800 mt-1">
                      Only bills with ZERO payments can be deleted. Bills with
                      recorded payments are protected and cannot be removed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900 font-medium mb-1">
                  When to use this:
                </p>
                <p className="text-sm text-yellow-800">
                  Use this to correct meter reading errors or fix billing
                  mistakes BEFORE any payments have been recorded.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setDeleteBillingMonth("")
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteBills}
                disabled={!deleteBillingMonth || deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? (
                  <>Deleting...</>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Bills
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Bill Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Edit Bill
              </DialogTitle>
              <DialogDescription>
                {editingBill && (
                  <>
                    {editingBill.billNumber} | {editingBill.unit.unitNumber} | {editingBill.unit.owner.name}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="electricAmount">Electric Amount</Label>
                <Input
                  id="electricAmount"
                  type="number"
                  step="0.01"
                  value={editFormData.electricAmount}
                  onChange={(e) => setEditFormData({ ...editFormData, electricAmount: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="waterAmount">Water Amount</Label>
                <Input
                  id="waterAmount"
                  type="number"
                  step="0.01"
                  value={editFormData.waterAmount}
                  onChange={(e) => setEditFormData({ ...editFormData, waterAmount: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="associationDues">Association Dues</Label>
                <Input
                  id="associationDues"
                  type="number"
                  step="0.01"
                  value={editFormData.associationDues}
                  onChange={(e) => setEditFormData({ ...editFormData, associationDues: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parkingFee">Parking Fee</Label>
                <Input
                  id="parkingFee"
                  type="number"
                  step="0.01"
                  value={editFormData.parkingFee}
                  onChange={(e) => setEditFormData({ ...editFormData, parkingFee: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="spAssessment">SP Assessment</Label>
                <Input
                  id="spAssessment"
                  type="number"
                  step="0.01"
                  value={editFormData.spAssessment}
                  onChange={(e) => setEditFormData({ ...editFormData, spAssessment: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="penaltyAmount">Penalty Amount</Label>
                <Input
                  id="penaltyAmount"
                  type="number"
                  step="0.01"
                  value={editFormData.penaltyAmount}
                  onChange={(e) => setEditFormData({ ...editFormData, penaltyAmount: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="otherCharges">Other Charges</Label>
                <Input
                  id="otherCharges"
                  type="number"
                  step="0.01"
                  value={editFormData.otherCharges}
                  onChange={(e) => setEditFormData({ ...editFormData, otherCharges: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discounts">Discounts</Label>
                <Input
                  id="discounts"
                  type="number"
                  step="0.01"
                  value={editFormData.discounts}
                  onChange={(e) => setEditFormData({ ...editFormData, discounts: e.target.value })}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Total Preview */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-blue-900">New Total Amount:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(calculateEditTotal())}
                </span>
              </div>
              {editingBill && (
                <div className="flex justify-between items-center mt-2 text-sm text-blue-700">
                  <span>Previous Total:</span>
                  <span>
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(editingBill.totalAmount)}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false)
                  setEditingBill(null)
                  setEditFormData(initialEditFormData)
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveBill} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
