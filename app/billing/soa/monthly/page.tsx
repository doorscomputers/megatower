"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Printer, Users, FileSpreadsheet, FileDown } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Unit {
  id: string
  unitNumber: string
  floorLevel: string
  isActive: boolean
  owner: {
    name: string
  }
}

interface CurrentCharges {
  electric: {
    period: string
    presentReading: number
    previousReading: number
    consumption: number
    rate: number
    amount: number
  }
  water: {
    period: string
    presentReading: number
    previousReading: number
    consumption: number
    rate: number
    amount: number
  }
  associationDues: {
    rate: number
    area: number
    amount: number
  }
  parking: {
    rate: number
    area: number
    amount: number
  }
  totalAmount: number
}

interface PastDue {
  month: string
  dues: number
  electric: number
  water: number
  total: number
  penalty1Month: number
  penalty2Month: number
  penalty3Month: number
  totalPenalty: number
}

interface PaymentBreakdown {
  electric: { orNumber: string; amount: number }
  water: { orNumber: string; amount: number }
  associationDues: { orNumber: string; amount: number }
  pastDues: { orNumber: string; amount: number }
  specialAssessment: { orNumber: string; amount: number }
  advancePayment: { orNumber: string; amount: number }
  totalPayment: number
}

interface Adjustments {
  spAssessment: number
  discount: number
  advanceDues: number
  advanceUtilities: number
  otherAdvance: number
}

interface SOAData {
  soaNumber: string
  billingMonth: string
  unitNumber: string
  building: string
  ownerName: string
  soaDate: string
  dueDate: string
  currentCharges: CurrentCharges
  pastDues: PastDue[]
  totalPastDues: number
  paymentMonth: string
  paymentBreakdown: PaymentBreakdown
  adjustments: Adjustments
  totalAmountDue: number
}

interface BatchData {
  billingMonth: string
  filter: string
  floor: string | null
  summary: {
    totalUnits: number
    totalCurrentCharges: number
    totalPastDues: number
    totalPayments: number
    totalAmountDue: number
    unitsWithBalance: number
  }
  soaList: SOAData[]
}

// Generate billing months dynamically from Jan 2025 to current month + 1
const generateBillingMonths = () => {
  const months: { value: string; label: string }[] = []
  const startDate = new Date(2025, 0, 1) // January 2025
  const now = new Date()
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1) // Current month + 1

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  let current = new Date(startDate)
  while (current <= endDate) {
    const year = current.getFullYear()
    const month = current.getMonth()
    const value = `${year}-${String(month + 1).padStart(2, '0')}`
    const label = `${monthNames[month]} ${year}`
    months.push({ value, label })
    current.setMonth(current.getMonth() + 1)
  }

  return months
}

const BILLING_MONTHS = generateBillingMonths()

export default function MonthlySOAPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [floors, setFloors] = useState<string[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState("")
  const [billingMonth, setBillingMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(false)
  const [soa, setSOA] = useState<SOAData | null>(null)

  // Batch mode state
  const [batchFilter, setBatchFilter] = useState("all")
  const [batchFloor, setBatchFloor] = useState("")
  const [batchBuilding, setBatchBuilding] = useState("")
  const [batchData, setBatchData] = useState<BatchData | null>(null)

  useEffect(() => {
    fetchUnits()
    fetchFloors()
  }, [])

  const fetchFloors = async () => {
    try {
      const res = await fetch("/api/floors")
      if (res.ok) {
        const data = await res.json()
        setFloors(data)
      }
    } catch (error) {
      console.error("Error fetching floors:", error)
    }
  }

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/units")
      if (!res.ok) throw new Error("Failed to fetch units")
      const data = await res.json()
      setUnits(data.filter((u: Unit) => u.isActive))
    } catch (error) {
      toast.error("Failed to load units")
    }
  }

  const handleGenerate = async () => {
    if (!selectedUnitId) {
      toast.error("Please select a unit")
      return
    }

    try {
      setLoading(true)
      setBatchData(null)
      const res = await fetch(
        `/api/billing/soa/monthly?unitId=${selectedUnitId}&billingMonth=${billingMonth}`
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate SOA")
      }

      const data = await res.json()
      setSOA(data.soa)
      toast.success("SOA generated successfully")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchGenerate = async () => {
    try {
      setLoading(true)
      setSOA(null)

      const params = new URLSearchParams({
        billingMonth,
        filter: batchFilter,
      })
      if (batchFilter === "floor" && batchFloor) {
        params.set("floor", batchFloor)
      }
      if (batchFilter === "building" && batchBuilding) {
        params.set("building", batchBuilding)
      }

      const res = await fetch(`/api/billing/soa/monthly/batch?${params}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate batch SOA")
      }

      const data = await res.json()
      setBatchData(data)
      toast.success(`Generated SOA for ${data.soaList.length} unit(s)`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    const soaList = batchData?.soaList || (soa ? [soa] : [])
    if (soaList.length === 0) {
      toast.error("No SOA data to export")
      return
    }

    const workbook = XLSX.utils.book_new()

    soaList.forEach((soaData, index) => {
      // Create sheet data matching the Excel format exactly
      const sheetData: any[][] = [
        ["MEGATOWER RESIDENCES"],
        ["CONDOMINIUM OWNERS INC."],
        ["MEGATOWER RESIDENCES I, GROUND FLOOR, PROPERTY MANAGEMENT OFFICE, CORNER TECSON, SANDICO ST., SALUD MITRA, BAGUIO CITY, PHILIPPINES"],
        [""],
        [""],
        ["STATEMENT OF ACCOUNT"],
        ["", "", "", "", "", "FOR THE MONTH OF:", "", "", "", "", "", "", soaData.billingMonth],
        [""],
        ["SOA NO.:", "", "", "", "", soaData.soaNumber],
        ["UNIT NO: ", "", "", "", "", soaData.unitNumber, "", soaData.building, "", "", "", "", "", "", "SOA DATE:", "", "", "", soaData.soaDate],
        ["UNIT OWNER: ", "", "", "", "", soaData.ownerName, "", "", "", "", "", "", "", "", "DUE DATE:", "", "", "", soaData.dueDate],
        [""],
        [""],
        ["Particulars:"],
        [""],
        ["", "", "", "ELECTRICITY:", "", "", "", "Pres", "", "Prev", "", "Cons", "", "Rate", "", "", "", "", ""],
        [soaData.currentCharges.electric.period || "", "", "", "", "", "", "", soaData.currentCharges.electric.presentReading || "", "", soaData.currentCharges.electric.previousReading || "", "", soaData.currentCharges.electric.consumption || "", "", soaData.currentCharges.electric.rate || "", "", "", "", "", soaData.currentCharges.electric.amount],
        [""],
        ["", "", "", "WATER:", "", "", "", "Pres", "", "Prev", "", "Cons", "", "Rate", "", "", "", "", ""],
        [soaData.currentCharges.water.period || "", "", "", "", "", "", "", soaData.currentCharges.water.presentReading || "", "", soaData.currentCharges.water.previousReading || "", "", soaData.currentCharges.water.consumption || "", "", "", "", "", "", "", soaData.currentCharges.water.amount],
        [""],
        ["", "", "", "", "", "", "", "", "", "", "AMOUNT PER DUES"],
        ["", "", "", "ASSOCIATION DUES:", "", "", "", "Rate:", "", "Area"],
        ["", "", "", "", " Rate per Sq.mtr - ", "", "", soaData.currentCharges.associationDues.rate, "", soaData.currentCharges.associationDues.area, soaData.currentCharges.associationDues.amount],
        ["", "", "", "", "Parking area - ", "", "", soaData.currentCharges.parking.rate, "", "", soaData.currentCharges.parking.amount || 0, "", "", "", "", "", "", "", soaData.currentCharges.associationDues.amount + soaData.currentCharges.parking.amount],
        [""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "TOTAL AMOUNT:", "", "", soaData.currentCharges.totalAmount],
        [""],
        [""],
        ["", "", "", "BALANCE RECORD:"],
        ["", "", "PAST DUES:"],
        ["", "", "MOS.", "", "ASS'N DUES", "ELECTRIC", "", "WATER", "", "TOTAL", "", "1st MONTH", "", "2nd MONTH", "", "3rd MONTH", "", "", "TOTAL"],
      ]

      // Add past dues rows
      if (soaData.pastDues.length > 0) {
        soaData.pastDues.forEach(pd => {
          sheetData.push(["", "", pd.month, "", pd.dues, pd.electric, "", pd.water, "", pd.total, "", pd.penalty1Month, "", pd.penalty2Month, "", pd.penalty3Month, "", "", pd.total + pd.totalPenalty])
        })
      } else {
        sheetData.push(["", "", "", "", "", "", "", "", "", 0, "", "", "", "", "", "", "", "", 0])
        sheetData.push(["", "", "", "", "", "", "", "", "", 0, "", "", "", "", "", "", "", "", 0])
        sheetData.push(["", "", "", "", "", "", "", "", "", 0, "", "", "", "", "", "", "", "", 0])
      }

      sheetData.push(["", "", "For more than three (3) months of unsettled billings, please refer to the attached file."])

      // Payment section
      const totalPastDues = soaData.totalPastDues
      sheetData.push(["", "", "PAYMENT AS OF:", "", "", soaData.paymentMonth, "", "", "", "", "", "", "", "TOTAL PAST DUES:", "", "", "", "", totalPastDues])
      sheetData.push(["", "", "", "ELECTRIC", "", "", "OR# ", soaData.paymentBreakdown.electric.orNumber, "", "", "", soaData.paymentBreakdown.electric.amount, "", "SP. ASSESS (Insurance)", "", "", "", "", soaData.adjustments.spAssessment])
      sheetData.push(["", "", "", "WATER", "", "", "OR# ", soaData.paymentBreakdown.water.orNumber, "", "", "", soaData.paymentBreakdown.water.amount, "", "DISCOUNT/ PROMO:", "", "", "", "", soaData.adjustments.discount])
      sheetData.push(["", "", "", "ASSOC. DUES", "", "", "OR# ", soaData.paymentBreakdown.associationDues.orNumber, "", "", "", soaData.paymentBreakdown.associationDues.amount, "", "ADVANCED FOR ASS'N DUES:", "", "", "", "", soaData.adjustments.advanceDues])
      sheetData.push(["", "", "", "PAST DUES", "", "", "OR# ", soaData.paymentBreakdown.pastDues.orNumber || "", "", "", "", soaData.paymentBreakdown.pastDues.amount, "", "ADVANCED FOR UTILITIES:", "", "", "", "", soaData.adjustments.advanceUtilities])
      sheetData.push(["", "", "", "SPECIAL ASSESSMENT", "", "", "OR# ", soaData.paymentBreakdown.specialAssessment.orNumber || "", "", "", "", soaData.paymentBreakdown.specialAssessment.amount])
      sheetData.push(["", "", "", "ADVANCE PAYMENT", "", "", "OR# ", soaData.paymentBreakdown.advancePayment.orNumber || "", "", "", "", soaData.paymentBreakdown.advancePayment.amount, "", "OTHER ADVANCED:", "", "", "", "", 0])
      sheetData.push(["", "", "", "", "", "", "", "TOTAL PAYMENT", "", "", "", soaData.paymentBreakdown.totalPayment])
      sheetData.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", soaData.totalAmountDue])
      sheetData.push(["TOTAL AMOUNT DUE AND PAYABLE"])
      sheetData.push(["", "", "1. Payable in Cash or Check. All cheques must be payable to Megatower Residences Condominium Owners Inc."])
      sheetData.push(["", "", "2. For any inquiry please call the undersigned at Telephone No.  (074) 661-02-61 or 0917 - 577 - 5521; EMAIL: megatowerpmobillings@gmail.com"])
      sheetData.push([""])
      sheetData.push(["", "", "3. This is to inform you that we are to charge Php. 50.00 minimum for ELECTRIC and Php. 80.00 - Php. 370.00 minimum for WATER per month with or without meter movement."])
      sheetData.push([""])
      sheetData.push(["", "", "4. Please settle accounts on or before the due date to avoid compound penalty."])
      sheetData.push(["", "", "5. Bank Name: Metrobank; Account Name: Megatower Residences; Account No.: 416-7-41601073-7"])
      sheetData.push(["", "", "6. Please settle all accounts before Moving in or Moving out."])
      sheetData.push(["", "", "Prepared by:", "", "", "", "", "", "", "", "", "", "", "", "", "", "Noted by:"])
      sheetData.push([""])
      sheetData.push([""])
      sheetData.push(["", "", "BILLING CLERK", "", "", "", "", "", "", "", "", "", "", "", "", "", "PROPERTY MANAGER"])

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData)

      // Set column widths
      worksheet['!cols'] = [
        { wch: 15 }, { wch: 3 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
        { wch: 5 }, { wch: 10 }, { wch: 3 }, { wch: 8 }, { wch: 3 }, { wch: 10 },
        { wch: 3 }, { wch: 8 }, { wch: 3 }, { wch: 12 }, { wch: 3 }, { wch: 3 },
        { wch: 12 }
      ]

      // Extract unit number for sheet name (e.g., M2-2F-1 -> 1)
      const unitNum = soaData.unitNumber.split('-').pop() || (index + 1).toString()
      XLSX.utils.book_append_sheet(workbook, worksheet, unitNum)
    })

    // Generate filename
    const monthLabel = BILLING_MONTHS.find(m => m.value === billingMonth)?.label || billingMonth
    const filename = batchData
      ? `SOA_${batchData.floor || 'ALL'}_${monthLabel.replace(' ', '_')}.xlsx`
      : `SOA_${soa?.unitNumber}_${monthLabel.replace(' ', '_')}.xlsx`

    XLSX.writeFile(workbook, filename)
    toast.success(`Exported ${soaList.length} SOA(s) to Excel`)
  }

  const handleExportPDF = () => {
    const soaList = batchData?.soaList || (soa ? [soa] : [])
    if (soaList.length === 0) {
      toast.error("No SOA data to export")
      return
    }

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()

    soaList.forEach((soaData, index) => {
      if (index > 0) {
        doc.addPage()
      }

      let y = 15

      // Header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('MEGATOWER RESIDENCES', pageWidth / 2, y, { align: 'center' })
      y += 5
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('CONDOMINIUM OWNERS INC.', pageWidth / 2, y, { align: 'center' })
      y += 4
      doc.setFontSize(7)
      doc.text('MEGATOWER RESIDENCES I, GROUND FLOOR, PROPERTY MANAGEMENT OFFICE', pageWidth / 2, y, { align: 'center' })
      y += 3
      doc.text('CORNER TECSON, SANDICO ST., SALUD MITRA, BAGUIO CITY, PHILIPPINES', pageWidth / 2, y, { align: 'center' })

      y += 8
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('STATEMENT OF ACCOUNT', pageWidth / 2, y, { align: 'center' })
      y += 5
      doc.setFontSize(10)
      doc.text(`FOR THE MONTH OF: ${soaData.billingMonth}`, pageWidth / 2, y, { align: 'center' })

      y += 8
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`SOA NO.: ${soaData.soaNumber}`, 15, y)
      doc.text(`SOA DATE: ${soaData.soaDate}`, pageWidth - 15, y, { align: 'right' })
      y += 5
      doc.text(`UNIT NO: ${soaData.unitNumber} - ${soaData.building}`, 15, y)
      doc.text(`DUE DATE: ${soaData.dueDate}`, pageWidth - 15, y, { align: 'right' })
      y += 5
      doc.text(`UNIT OWNER: ${soaData.ownerName}`, 15, y)

      y += 8
      doc.setFont('helvetica', 'bold')
      doc.text('Particulars:', 15, y)
      y += 5

      // Current Charges Table
      const chargesData: any[][] = []
      if (soaData.currentCharges.electric.amount > 0) {
        chargesData.push(['ELECTRICITY', soaData.currentCharges.electric.period, `P${formatCurrency(soaData.currentCharges.electric.amount)}`])
      }
      if (soaData.currentCharges.water.amount > 0) {
        chargesData.push(['WATER', soaData.currentCharges.water.period, `P${formatCurrency(soaData.currentCharges.water.amount)}`])
      }
      chargesData.push(['ASSOCIATION DUES', `${soaData.currentCharges.associationDues.rate}/sqm x ${soaData.currentCharges.associationDues.area} sqm`, `P${formatCurrency(soaData.currentCharges.associationDues.amount)}`])
      if (soaData.currentCharges.parking.amount > 0) {
        chargesData.push(['PARKING', '', `P${formatCurrency(soaData.currentCharges.parking.amount)}`])
      }
      chargesData.push(['', 'TOTAL CURRENT CHARGES:', `P${formatCurrency(soaData.currentCharges.totalAmount)}`])

      autoTable(doc, {
        startY: y,
        head: [['Item', 'Details', 'Amount']],
        body: chargesData,
        theme: 'grid',
        headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 80 },
          2: { cellWidth: 40, halign: 'right' }
        },
        margin: { left: 15, right: 15 }
      })

      y = (doc as any).lastAutoTable.finalY + 5

      // Past Dues
      if (soaData.pastDues.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('PAST DUES:', 15, y)
        y += 3

        const pastDuesData = soaData.pastDues.map(pd => [
          pd.month,
          `P${formatCurrency(pd.total)}`,
          `P${formatCurrency(pd.totalPenalty)}`,
          `P${formatCurrency(pd.total + pd.totalPenalty)}`
        ])
        pastDuesData.push(['', '', 'TOTAL:', `P${formatCurrency(soaData.totalPastDues)}`])

        autoTable(doc, {
          startY: y,
          head: [['Month', 'Balance', 'Penalty', 'Total']],
          body: pastDuesData,
          theme: 'grid',
          headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 15, right: 15 }
        })

        y = (doc as any).lastAutoTable.finalY + 5
      }

      // Payments
      if (soaData.paymentBreakdown.totalPayment > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text(`PAYMENT AS OF ${soaData.paymentMonth}:`, 15, y)
        y += 3

        const paymentData: any[][] = []
        if (soaData.paymentBreakdown.electric.amount > 0) {
          paymentData.push(['ELECTRIC', `OR# ${soaData.paymentBreakdown.electric.orNumber}`, `P${formatCurrency(soaData.paymentBreakdown.electric.amount)}`])
        }
        if (soaData.paymentBreakdown.water.amount > 0) {
          paymentData.push(['WATER', `OR# ${soaData.paymentBreakdown.water.orNumber}`, `P${formatCurrency(soaData.paymentBreakdown.water.amount)}`])
        }
        if (soaData.paymentBreakdown.associationDues.amount > 0) {
          paymentData.push(['ASSOC. DUES', `OR# ${soaData.paymentBreakdown.associationDues.orNumber}`, `P${formatCurrency(soaData.paymentBreakdown.associationDues.amount)}`])
        }
        if (soaData.paymentBreakdown.pastDues.amount > 0) {
          paymentData.push(['PAST DUES', `OR# ${soaData.paymentBreakdown.pastDues.orNumber}`, `P${formatCurrency(soaData.paymentBreakdown.pastDues.amount)}`])
        }
        if (soaData.paymentBreakdown.specialAssessment.amount > 0) {
          paymentData.push(['SP. ASSESSMENT', `OR# ${soaData.paymentBreakdown.specialAssessment.orNumber}`, `P${formatCurrency(soaData.paymentBreakdown.specialAssessment.amount)}`])
        }
        paymentData.push(['', 'TOTAL PAYMENT:', `P${formatCurrency(soaData.paymentBreakdown.totalPayment)}`])

        autoTable(doc, {
          startY: y,
          head: [['Item', 'OR#', 'Amount']],
          body: paymentData,
          theme: 'grid',
          headStyles: { fillColor: [200, 230, 200], textColor: 0, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 15, right: 15 }
        })

        y = (doc as any).lastAutoTable.finalY + 5
      }

      // Total Amount Due
      y += 5
      doc.setFillColor(240, 240, 240)
      doc.rect(15, y - 3, pageWidth - 30, 10, 'F')
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('TOTAL AMOUNT DUE AND PAYABLE:', 20, y + 3)
      doc.setTextColor(soaData.totalAmountDue > 0 ? 180 : 0, soaData.totalAmountDue > 0 ? 0 : 128, 0)
      doc.text(`P${formatCurrency(soaData.totalAmountDue)}`, pageWidth - 20, y + 3, { align: 'right' })
      doc.setTextColor(0, 0, 0)

      // Footer notes
      y += 15
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      const notes = [
        '1. Payable in Cash or Check. All cheques must be payable to Megatower Residences Condominium Owners Inc.',
        '2. For any inquiry please call (074) 661-02-61 or 0917-577-5521; EMAIL: megatowerpmobillings@gmail.com',
        '3. Minimum charge: Php 50.00 for ELECTRIC and Php 80.00-370.00 for WATER per month.',
        '4. Please settle accounts on or before the due date to avoid compound penalty.',
        '5. Bank: Metrobank; Account Name: Megatower Residences; Account No.: 416-7-41601073-7',
        '6. Please settle all accounts before Moving in or Moving out.'
      ]
      notes.forEach(note => {
        doc.text(note, 15, y)
        y += 4
      })

      // Signatures
      y += 10
      doc.setFontSize(8)
      doc.text('Prepared by:', 30, y)
      doc.text('Noted by:', pageWidth - 50, y)
      y += 12
      doc.line(20, y, 70, y)
      doc.line(pageWidth - 70, y, pageWidth - 20, y)
      y += 4
      doc.text('BILLING CLERK', 30, y)
      doc.text('PROPERTY MANAGER', pageWidth - 55, y)
    })

    // Generate filename
    const monthLabel = BILLING_MONTHS.find(m => m.value === billingMonth)?.label || billingMonth
    const filename = batchData
      ? `SOA_${batchData.floor || 'ALL'}_${monthLabel.replace(' ', '_')}.pdf`
      : `SOA_${soa?.unitNumber}_${monthLabel.replace(' ', '_')}.pdf`

    doc.save(filename)
    toast.success(`Exported ${soaList.length} SOA(s) to PDF`)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const renderSOA = (soaData: SOAData, index?: number) => (
    <div
      key={soaData.unitNumber}
      className={`soa-container bg-white p-4 md:p-6 rounded-lg border border-gray-300 print:border-0 print:p-2 print:rounded-none mb-6 ${index !== undefined && index > 0 ? 'print:break-before-page' : ''}`}
      style={{ fontSize: '11px' }}
    >
      {/* Header Section - Centered */}
      <div className="text-center mb-3">
        <h1 className="text-base font-bold">MEGATOWER RESIDENCES</h1>
        <h2 className="text-sm font-semibold">CONDOMINIUM OWNERS INC.</h2>
        <p className="text-[9px] leading-tight mt-1">
          MEGATOWER RESIDENCES I, GROUND FLOOR, PROPERTY MANAGEMENT OFFICE,<br />
          CORNER TECSON, SANDICO ST., SALUD MITRA, BAGUIO CITY, PHILIPPINES
        </p>
      </div>

      {/* Title */}
      <div className="text-center mb-3">
        <h3 className="text-sm font-bold underline">STATEMENT OF ACCOUNT</h3>
        <p className="text-xs mt-1">FOR THE MONTH OF: <span className="font-bold">{soaData.billingMonth}</span></p>
      </div>

      {/* SOA Info Row */}
      <div className="grid grid-cols-2 gap-4 mb-3 text-[10px]">
        <div>
          <p><span className="font-semibold">SOA NO.:</span> {soaData.soaNumber}</p>
          <p><span className="font-semibold">UNIT NO:</span> {soaData.unitNumber} - {soaData.building}</p>
          <p><span className="font-semibold">UNIT OWNER:</span> {soaData.ownerName}</p>
        </div>
        <div className="text-right">
          <p><span className="font-semibold">SOA DATE:</span> {soaData.soaDate}</p>
          <p><span className="font-semibold">DUE DATE:</span> {soaData.dueDate}</p>
        </div>
      </div>

      {/* Particulars Label */}
      <p className="font-bold text-[10px] mb-2">Particulars:</p>

      {/* Current Charges Section */}
      <div className="mb-3">
        {/* Electricity */}
        <div className="mb-2">
          <table className="w-full text-[9px]">
            <thead>
              <tr>
                <td className="font-bold w-24">ELECTRICITY:</td>
                <td className="text-center w-12">Pres</td>
                <td className="text-center w-12">Prev</td>
                <td className="text-center w-12">Cons</td>
                <td className="text-center w-12">Rate</td>
                <td className="text-right w-20"></td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-[8px]">{soaData.currentCharges.electric.period || ""}</td>
                <td className="text-center">{soaData.currentCharges.electric.presentReading || "-"}</td>
                <td className="text-center">{soaData.currentCharges.electric.previousReading || "-"}</td>
                <td className="text-center">{soaData.currentCharges.electric.consumption || "-"}</td>
                <td className="text-center">{soaData.currentCharges.electric.rate || "-"}</td>
                <td className="text-right font-semibold">P{formatCurrency(soaData.currentCharges.electric.amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Water */}
        <div className="mb-2">
          <table className="w-full text-[9px]">
            <thead>
              <tr>
                <td className="font-bold w-24">WATER:</td>
                <td className="text-center w-12">Pres</td>
                <td className="text-center w-12">Prev</td>
                <td className="text-center w-12">Cons</td>
                <td className="text-center w-12">Rate</td>
                <td className="text-right w-20"></td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-[8px]">{soaData.currentCharges.water.period || ""}</td>
                <td className="text-center">{soaData.currentCharges.water.presentReading || "-"}</td>
                <td className="text-center">{soaData.currentCharges.water.previousReading || "-"}</td>
                <td className="text-center">{soaData.currentCharges.water.consumption || "-"}</td>
                <td className="text-center">{soaData.currentCharges.water.rate || "-"}</td>
                <td className="text-right font-semibold">P{formatCurrency(soaData.currentCharges.water.amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Association Dues */}
        <div className="mb-2">
          <table className="w-full text-[9px]">
            <thead>
              <tr>
                <td className="font-bold w-40">ASSOCIATION DUES:</td>
                <td className="text-center w-16">Rate</td>
                <td className="text-center w-16">Area</td>
                <td className="text-right font-semibold">AMOUNT PER DUES</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pl-4">Rate per Sq.mtr -</td>
                <td className="text-center">{soaData.currentCharges.associationDues.rate.toFixed(2)}</td>
                <td className="text-center">{soaData.currentCharges.associationDues.area}</td>
                <td className="text-right">P{formatCurrency(soaData.currentCharges.associationDues.amount)}</td>
              </tr>
              {soaData.currentCharges.parking.area > 0 && (
                <tr>
                  <td className="pl-4">Parking area -</td>
                  <td className="text-center">{soaData.currentCharges.parking.rate.toFixed(2)}</td>
                  <td className="text-center">{soaData.currentCharges.parking.area || "-"}</td>
                  <td className="text-right">P{formatCurrency(soaData.currentCharges.parking.amount)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right font-bold pt-1">TOTAL AMOUNT:</td>
                <td className="text-right font-bold pt-1">P{formatCurrency(soaData.currentCharges.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Balance Record / Past Dues Section */}
      <div className="mb-3">
        <p className="font-bold text-[10px] mb-1">BALANCE RECORD:</p>
        <p className="text-[9px] mb-1 ml-2">PAST DUES:</p>
        <table className="w-full text-[8px] border border-gray-400">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-400 px-1 py-0.5 text-left">MOS.</th>
              <th className="border border-gray-400 px-1 py-0.5 text-right">ASS'N DUES</th>
              <th className="border border-gray-400 px-1 py-0.5 text-right">ELECTRIC</th>
              <th className="border border-gray-400 px-1 py-0.5 text-right">WATER</th>
              <th className="border border-gray-400 px-1 py-0.5 text-right">TOTAL</th>
              <th className="border border-gray-400 px-1 py-0.5 text-right">1st MONTH</th>
              <th className="border border-gray-400 px-1 py-0.5 text-right">2nd MONTH</th>
              <th className="border border-gray-400 px-1 py-0.5 text-right">3rd MONTH</th>
              <th className="border border-gray-400 px-1 py-0.5 text-right font-bold">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {soaData.pastDues.length > 0 ? (
              soaData.pastDues.map((pd, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-400 px-1 py-0.5">{pd.month}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">{pd.dues > 0 ? formatCurrency(pd.dues) : "-"}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">{pd.electric > 0 ? formatCurrency(pd.electric) : "-"}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">{pd.water > 0 ? formatCurrency(pd.water) : "-"}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">{pd.total > 0 ? formatCurrency(pd.total) : "-"}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">{pd.penalty1Month > 0 ? formatCurrency(pd.penalty1Month) : "-"}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">{pd.penalty2Month > 0 ? formatCurrency(pd.penalty2Month) : "-"}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">{pd.penalty3Month > 0 ? formatCurrency(pd.penalty3Month) : "-"}</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right font-semibold">{formatCurrency(pd.total + pd.totalPenalty)}</td>
                </tr>
              ))
            ) : (
              <>
                <tr>
                  <td className="border border-gray-400 px-1 py-0.5">-</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">-</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">-</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">-</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">-</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">-</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">-</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">-</td>
                  <td className="border border-gray-400 px-1 py-0.5 text-right">-</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
        <p className="text-[7px] mt-1 italic">For more than three (3) months of unsettled billings, please refer to the attached file.</p>
      </div>

      {/* Payment & Adjustments Section - Side by Side */}
      <div className="grid grid-cols-2 gap-4 mb-3 text-[9px]">
        {/* Left: Payment Section */}
        <div>
          <p className="font-bold mb-1">PAYMENT AS OF: <span className="font-normal">{soaData.paymentMonth}</span></p>
          <table className="w-full">
            <tbody>
              <tr>
                <td className="py-0.5 pl-2">ELECTRIC</td>
                <td className="py-0.5">OR# {soaData.paymentBreakdown.electric.orNumber || "-"}</td>
                <td className="py-0.5 text-right">{soaData.paymentBreakdown.electric.amount > 0 ? formatCurrency(soaData.paymentBreakdown.electric.amount) : "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5 pl-2">WATER</td>
                <td className="py-0.5">OR# {soaData.paymentBreakdown.water.orNumber || "-"}</td>
                <td className="py-0.5 text-right">{soaData.paymentBreakdown.water.amount > 0 ? formatCurrency(soaData.paymentBreakdown.water.amount) : "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5 pl-2">ASSOC. DUES</td>
                <td className="py-0.5">OR# {soaData.paymentBreakdown.associationDues.orNumber || "-"}</td>
                <td className="py-0.5 text-right">{soaData.paymentBreakdown.associationDues.amount > 0 ? formatCurrency(soaData.paymentBreakdown.associationDues.amount) : "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5 pl-2">PAST DUES</td>
                <td className="py-0.5">OR# {soaData.paymentBreakdown.pastDues.orNumber || "-"}</td>
                <td className="py-0.5 text-right">{soaData.paymentBreakdown.pastDues.amount > 0 ? formatCurrency(soaData.paymentBreakdown.pastDues.amount) : "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5 pl-2">SPECIAL ASSESSMENT</td>
                <td className="py-0.5">OR# {soaData.paymentBreakdown.specialAssessment.orNumber || "-"}</td>
                <td className="py-0.5 text-right">{soaData.paymentBreakdown.specialAssessment.amount > 0 ? formatCurrency(soaData.paymentBreakdown.specialAssessment.amount) : "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5 pl-2">ADVANCE PAYMENT</td>
                <td className="py-0.5">OR# {soaData.paymentBreakdown.advancePayment.orNumber || "-"}</td>
                <td className="py-0.5 text-right">{soaData.paymentBreakdown.advancePayment.amount > 0 ? formatCurrency(soaData.paymentBreakdown.advancePayment.amount) : "-"}</td>
              </tr>
              <tr className="border-t border-gray-400">
                <td colSpan={2} className="py-0.5 font-bold text-right">TOTAL PAYMENT</td>
                <td className="py-0.5 text-right font-bold">{formatCurrency(soaData.paymentBreakdown.totalPayment)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right: Adjustments Section */}
        <div>
          <table className="w-full">
            <tbody>
              <tr>
                <td className="py-0.5 font-bold">TOTAL PAST DUES:</td>
                <td className="py-0.5 text-right font-bold">{formatCurrency(soaData.totalPastDues)}</td>
              </tr>
              <tr>
                <td className="py-0.5">SP. ASSESS (Insurance)</td>
                <td className="py-0.5 text-right">{soaData.adjustments.spAssessment > 0 ? formatCurrency(soaData.adjustments.spAssessment) : "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5">DISCOUNT/ PROMO:</td>
                <td className="py-0.5 text-right">{soaData.adjustments.discount > 0 ? formatCurrency(soaData.adjustments.discount) : "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5">ADVANCED FOR ASS'N DUES:</td>
                <td className="py-0.5 text-right">{soaData.adjustments.advanceDues > 0 ? formatCurrency(soaData.adjustments.advanceDues) : "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5">ADVANCED FOR UTILITIES:</td>
                <td className="py-0.5 text-right">{soaData.adjustments.advanceUtilities > 0 ? formatCurrency(soaData.adjustments.advanceUtilities) : "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5">OTHER ADVANCED:</td>
                <td className="py-0.5 text-right">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Total Amount Due - Highlighted */}
      <div className="bg-gray-100 border-2 border-black p-2 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold">TOTAL AMOUNT DUE AND PAYABLE</span>
          <span className={`text-lg font-bold ${soaData.totalAmountDue > 0 ? 'text-red-700' : 'text-green-700'}`}>
            P{formatCurrency(soaData.totalAmountDue)}
          </span>
        </div>
      </div>

      {/* Footer Notes */}
      <div className="text-[7px] space-y-0.5 mb-3">
        <p>1. Payable in Cash or Check. All cheques must be payable to Megatower Residences Condominium Owners Inc.</p>
        <p>2. For any inquiry please call the undersigned at Telephone No. (074) 661-02-61 or 0917 - 577 - 5521; EMAIL: megatowerpmobillings@gmail.com</p>
        <p>3. This is to inform you that we are to charge Php. 50.00 minimum for ELECTRIC and Php. 80.00 - Php. 370.00 minimum for WATER per month with or without meter movement.</p>
        <p>4. Please settle accounts on or before the due date to avoid compound penalty.</p>
        <p>5. Bank Name: Metrobank; Account Name: Megatower Residences; Account No.: 416-7-41601073-7</p>
        <p>6. Please settle all accounts before Moving in or Moving out.</p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 mt-4 text-[9px]">
        <div className="text-center">
          <p className="mb-6">Prepared by:</p>
          <div className="border-b border-black w-32 mx-auto mb-1"></div>
          <p className="font-semibold">BILLING CLERK</p>
        </div>
        <div className="text-center">
          <p className="mb-6">Noted by:</p>
          <div className="border-b border-black w-32 mx-auto mb-1"></div>
          <p className="font-semibold">PROPERTY MANAGER</p>
        </div>
      </div>
    </div>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header - Hidden on Print */}
        <div className="print:hidden">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Monthly Statement of Account</h1>
          <p className="text-gray-500">Generate monthly SOA matching Excel format</p>
        </div>

        {/* Mode Selection */}
        <Tabs defaultValue="batch" className="print:hidden">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Single Unit
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Batch Generate
            </TabsTrigger>
          </TabsList>

          {/* Single Unit Mode */}
          <TabsContent value="single">
            <Card>
              <CardHeader>
                <CardTitle>Generate SOA</CardTitle>
                <CardDescription>Generate statement for a single unit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="unit">Select Unit *</Label>
                    <SearchableSelect
                      options={units.map((unit) => ({
                        value: unit.id,
                        label: `${unit.unitNumber} - ${unit.owner?.name || "No Owner"}`,
                        sublabel: `Floor: ${unit.floorLevel}`,
                      }))}
                      value={selectedUnitId}
                      onValueChange={setSelectedUnitId}
                      placeholder="Search unit or owner..."
                      searchPlaceholder="Type unit number or owner name..."
                      emptyMessage="No units found."
                    />
                  </div>
                  <div>
                    <Label>Billing Month *</Label>
                    <Select value={billingMonth} onValueChange={setBillingMonth}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleGenerate} disabled={!selectedUnitId || loading} className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      {loading ? "Generating..." : "Generate SOA"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batch Mode */}
          <TabsContent value="batch">
            <Card>
              <CardHeader>
                <CardTitle>Batch Generate SOA</CardTitle>
                <CardDescription>Generate statements for multiple units at once</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label>Filter</Label>
                    <Select value={batchFilter} onValueChange={(value) => {
                        setBatchFilter(value)
                        setBatchFloor("")
                        setBatchBuilding("")
                      }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Units</SelectItem>
                        <SelectItem value="with_balance">With Balance Only</SelectItem>
                        <SelectItem value="building">By Building</SelectItem>
                        <SelectItem value="floor">By Floor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {batchFilter === "building" && (
                    <div>
                      <Label>Building</Label>
                      <Select value={batchBuilding} onValueChange={setBatchBuilding}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select building" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M1">M1 - Mega Tower 1</SelectItem>
                          <SelectItem value="M2">M2 - Mega Tower 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {batchFilter === "floor" && (
                    <div>
                      <Label>Floor Level</Label>
                      <Select value={batchFloor} onValueChange={setBatchFloor}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select floor" />
                        </SelectTrigger>
                        <SelectContent>
                          {floors.map((floor) => (
                            <SelectItem key={floor} value={floor}>
                              {floor === "GF" ? "Ground Floor" : `${floor} Floor`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Billing Month *</Label>
                    <Select value={billingMonth} onValueChange={setBillingMonth}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleBatchGenerate}
                      disabled={loading || (batchFilter === "floor" && !batchFloor) || (batchFilter === "building" && !batchBuilding)}
                      className="w-full"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      {loading ? "Generating..." : "Generate All"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Export Buttons */}
        {(soa || batchData) && (
          <div className="flex justify-end gap-2 print:hidden">
            <Button onClick={handleExportExcel} variant="outline" size="lg">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={handleExportPDF} variant="outline" size="lg">
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={handlePrint} size="lg">
              <Printer className="h-4 w-4 mr-2" />
              Print {batchData ? `${batchData.soaList.length} SOAs` : "SOA"}
            </Button>
          </div>
        )}

        {/* Batch Summary */}
        {batchData && (
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Batch Summary - {batchData.billingMonth}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">Total Units</p>
                  <p className="text-2xl font-bold text-blue-900">{batchData.summary.totalUnits}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Current Charges</p>
                  <p className="text-xl font-bold text-gray-900">P{formatCurrency(batchData.summary.totalCurrentCharges)}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-600">Past Dues</p>
                  <p className="text-xl font-bold text-orange-900">P{formatCurrency(batchData.summary.totalPastDues)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">Total Payments</p>
                  <p className="text-xl font-bold text-green-900">P{formatCurrency(batchData.summary.totalPayments)}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-600">Total Amount Due</p>
                  <p className="text-xl font-bold text-red-900">P{formatCurrency(batchData.summary.totalAmountDue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Single SOA Display */}
        {soa && !batchData && renderSOA(soa)}

        {/* Batch SOA Display */}
        {batchData && batchData.soaList.map((soaItem, index) => renderSOA(soaItem, index))}

        {/* Empty State */}
        {!soa && !batchData && (
          <Card className="print:hidden">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                Select a unit or use batch mode to generate Monthly Statement of Account
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body * {
            visibility: hidden;
          }
          .soa-container, .soa-container * {
            visibility: visible;
          }
          .soa-container {
            position: relative;
            width: 100%;
            padding: 8px;
            font-size: 9px;
            page-break-inside: avoid;
            border: none !important;
            background: white !important;
          }
          .soa-container table {
            border-collapse: collapse;
          }
          .soa-container th, .soa-container td {
            padding: 2px 4px;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:break-before-page {
            page-break-before: always;
          }
          .text-red-700 {
            color: #b91c1c !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .text-green-700 {
            color: #15803d !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bg-gray-100 {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}
