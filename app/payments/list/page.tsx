"use client"

import { useEffect, useState, useRef } from "react"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Trash2, AlertCircle, Receipt } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Payment {
  id: string
  orNumber: string | null
  paymentDate: string
  paymentMethod: string
  referenceNumber: string | null
  remarks: string | null
  // Component amounts
  electricAmount: number
  waterAmount: number
  duesAmount: number
  pastDuesAmount: number
  spAssessmentAmount: number
  advanceDuesAmount: number
  advanceUtilAmount: number
  totalAmount: number
  // Relations
  unit: {
    unitNumber: string
    owner: {
      name: string
    } | null
  }
  billPayments: {
    bill: {
      billNumber: string
      billingMonth: string
    }
    totalAmount: number
  }[]
  status: string
}

export default function PaymentsListPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const gridRef = useRef<any>(null)
  const [showVoidDialog, setShowVoidDialog] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [voiding, setVoiding] = useState(false)

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/payments")
      if (!res.ok) throw new Error("Failed to fetch payments")
      const data = await res.json()
      setPayments(data)
    } catch (error) {
      toast.error("Failed to load payments")
    } finally {
      setLoading(false)
    }
  }

  const handleVoidPayment = async () => {
    if (!selectedPayment) return

    try {
      setVoiding(true)
      const res = await fetch(`/api/payments/${selectedPayment.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to void payment")
      }

      toast.success("Payment voided successfully")
      setShowVoidDialog(false)
      setSelectedPayment(null)
      fetchPayments()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setVoiding(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(value)
  }

  const currencyCellRender = (data: any) => {
    if (data.value === 0 || data.value === null || data.value === undefined) {
      return <span className="text-gray-300">-</span>
    }
    return formatCurrency(data.value)
  }

  const dateCellRender = (data: any) => {
    if (!data.value) return "-"
    return format(new Date(data.value), "MMM dd, yyyy")
  }

  const unitCellRender = (data: any) => {
    return (
      <div>
        <p className="font-medium">{data.data.unit.unitNumber}</p>
        <p className="text-xs text-gray-500">
          {data.data.unit.owner?.name || "No Owner"}
        </p>
      </div>
    )
  }

  const methodCellRender = (data: any) => {
    const method = data.value
    return (
      <Badge variant="secondary">{method.replace("_", " ")}</Badge>
    )
  }

  const orNumberCellRender = (data: any) => {
    return (
      <span className="font-mono font-medium">
        {data.value || "-"}
      </span>
    )
  }

  const actionsCellRender = (data: any) => {
    const isCancelled = data.data.status === "CANCELLED"
    if (isCancelled) {
      return (
        <span className="text-xs text-gray-400 italic">Voided</span>
      )
    }
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSelectedPayment(data.data)
          setShowVoidDialog(true)
        }}
        className="text-red-600 border-red-300 hover:bg-red-50"
      >
        <Trash2 className="h-3 w-3 mr-1" />
        Void
      </Button>
    )
  }

  // Calculate totals for stats (exclude cancelled payments)
  const activePayments = payments.filter((p) => p.status !== "CANCELLED")
  const getTotalAmount = () => activePayments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
  const getThisMonthCount = () => {
    const now = new Date()
    return activePayments.filter((p) => {
      const paymentDate = new Date(p.paymentDate)
      return (
        paymentDate.getMonth() === now.getMonth() &&
        paymentDate.getFullYear() === now.getFullYear()
      )
    }).length
  }

  const statusCellRender = (data: any) => {
    const status = data.value || "CONFIRMED"
    if (status === "CANCELLED") {
      return <Badge variant="danger">VOID</Badge>
    }
    return <Badge variant="success">Active</Badge>
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payments List</h1>
          <p className="text-gray-500">View and manage all recorded payments with component breakdown</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Active Payments</p>
            <p className="text-2xl font-bold">{activePayments.length}</p>
            {payments.length !== activePayments.length && (
              <p className="text-xs text-gray-400">{payments.length - activePayments.length} voided</p>
            )}
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-green-600">Total Amount</p>
            <p className="text-xl font-bold text-green-700">
              {formatCurrency(getTotalAmount())}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-600">This Month</p>
            <p className="text-xl font-bold text-blue-700">
              {getThisMonthCount()}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-600">Average Payment</p>
            <p className="text-lg font-bold text-purple-700">
              {payments.length > 0
                ? formatCurrency(getTotalAmount() / payments.length)
                : "₱0"}
            </p>
          </div>
        </div>

        {/* DataGrid */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <DataGrid
            ref={gridRef}
            dataSource={payments}
            keyExpr="id"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            columnAutoWidth={false}
            allowColumnReordering={true}
            allowColumnResizing={true}
            wordWrapEnabled={false}
          >
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
            />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel visible={true} placeholder="Search payments..." />
            <Export enabled={true} />

            <Column
              dataField="paymentDate"
              caption="Date"
              width={100}
              cellRender={dateCellRender}
              dataType="date"
              sortOrder="desc"
            />

            <Column
              dataField="unit.unitNumber"
              caption="Unit / Owner"
              width={140}
              cellRender={unitCellRender}
              calculateCellValue={(rowData: Payment) =>
                `${rowData.unit.unitNumber} ${rowData.unit.owner?.name || "No Owner"}`
              }
              calculateSortValue={(rowData: Payment) =>
                parseUnitNumber(rowData.unit.unitNumber)
              }
            />

            <Column
              dataField="orNumber"
              caption="OR#"
              width={80}
              cellRender={orNumberCellRender}
            />

            <Column
              dataField="electricAmount"
              caption="Electric"
              width={100}
              cellRender={currencyCellRender}
              dataType="number"
              alignment="right"
            />

            <Column
              dataField="waterAmount"
              caption="Water"
              width={90}
              cellRender={currencyCellRender}
              dataType="number"
              alignment="right"
            />

            <Column
              dataField="duesAmount"
              caption="Dues"
              width={100}
              cellRender={currencyCellRender}
              dataType="number"
              alignment="right"
            />

            <Column
              dataField="pastDuesAmount"
              caption="Past Dues"
              width={100}
              cellRender={currencyCellRender}
              dataType="number"
              alignment="right"
            />

            <Column
              dataField="spAssessmentAmount"
              caption="SP Assess"
              width={100}
              cellRender={currencyCellRender}
              dataType="number"
              alignment="right"
            />

            <Column
              dataField="advanceDuesAmount"
              caption="Adv Dues"
              width={90}
              cellRender={currencyCellRender}
              dataType="number"
              alignment="right"
            />

            <Column
              dataField="advanceUtilAmount"
              caption="Adv Util"
              width={90}
              cellRender={currencyCellRender}
              dataType="number"
              alignment="right"
            />

            <Column
              dataField="totalAmount"
              caption="Total"
              width={110}
              cellRender={currencyCellRender}
              dataType="number"
              alignment="right"
              cssClass="font-bold"
            />

            <Column
              dataField="paymentMethod"
              caption="Method"
              width={100}
              cellRender={methodCellRender}
            />

            <Column
              dataField="status"
              caption="Status"
              width={80}
              cellRender={statusCellRender}
              alignment="center"
            />

            <Column
              caption="Actions"
              width={80}
              cellRender={actionsCellRender}
              allowFiltering={false}
              allowSorting={false}
            />

            <Toolbar>
              <Item name="searchPanel" />
              <Item name="exportButton" />
            </Toolbar>

            <Summary>
              <TotalItem column="paymentDate" summaryType="count" displayFormat="{0} payments" />
              <TotalItem
                column="totalAmount"
                summaryType="sum"
                valueFormat="currency"
                displayFormat="Total: {0}"
              />
            </Summary>
          </DataGrid>
        </div>

        {/* Void Payment Dialog */}
        <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Void Payment
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to void this payment?
              </DialogDescription>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4 py-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-red-900">Warning</p>
                      <p className="text-sm text-red-800 mt-1">
                        This will reverse the payment and update bill statuses.
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">OR#:</span>
                    <span className="font-mono font-medium">
                      {selectedPayment.orNumber || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Unit:</span>
                    <span className="font-medium">
                      {selectedPayment.unit.unitNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Amount:</span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(Number(selectedPayment.totalAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Payment Date:</span>
                    <span className="font-medium">
                      {format(new Date(selectedPayment.paymentDate), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Method:</span>
                    <span className="font-medium">
                      {selectedPayment.paymentMethod.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Component breakdown */}
                <div className="border rounded-lg p-3 space-y-1 text-sm">
                  <p className="font-medium text-gray-700 mb-2">Payment Breakdown:</p>
                  {Number(selectedPayment.electricAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Electric:</span>
                      <span>{formatCurrency(Number(selectedPayment.electricAmount))}</span>
                    </div>
                  )}
                  {Number(selectedPayment.waterAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Water:</span>
                      <span>{formatCurrency(Number(selectedPayment.waterAmount))}</span>
                    </div>
                  )}
                  {Number(selectedPayment.duesAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Assoc. Dues:</span>
                      <span>{formatCurrency(Number(selectedPayment.duesAmount))}</span>
                    </div>
                  )}
                  {Number(selectedPayment.spAssessmentAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">SP Assessment:</span>
                      <span>{formatCurrency(Number(selectedPayment.spAssessmentAmount))}</span>
                    </div>
                  )}
                  {Number(selectedPayment.advanceDuesAmount) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Advance (Dues):</span>
                      <span>{formatCurrency(Number(selectedPayment.advanceDuesAmount))}</span>
                    </div>
                  )}
                  {Number(selectedPayment.advanceUtilAmount) > 0 && (
                    <div className="flex justify-between text-teal-600">
                      <span>Advance (Utilities):</span>
                      <span>{formatCurrency(Number(selectedPayment.advanceUtilAmount))}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowVoidDialog(false)
                  setSelectedPayment(null)
                }}
                disabled={voiding}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVoidPayment}
                disabled={voiding}
                className="bg-red-600 hover:bg-red-700"
              >
                {voiding ? "Voiding..." : "Void Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
