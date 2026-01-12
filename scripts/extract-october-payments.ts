import XLSX from 'xlsx'

interface PaymentData {
  unitNumber: string
  ownerName: string
  electric: number
  water: number
  associationDues: number
  pastDues: number
  spAssessment: number
  advancePayment: number
  totalPayment: number
  previousBalance: number
  orNumbers: string
}

function parsePaymentFromSheet(sheet: XLSX.WorkSheet, sheetName: string): PaymentData | null {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  // Skip sheets that aren't main unit sheets
  if (sheetName.includes('(A)') || sheetName.includes('paid')) {
    return null
  }

  try {
    const unitNumber = `M2-2F-${sheetName}`
    let ownerName = ''
    let electric = 0
    let water = 0
    let associationDues = 0
    let pastDues = 0
    let spAssessment = 0
    let advancePayment = 0
    let totalPayment = 0
    let previousBalance = 0
    let orNumbers = ''

    // Find owner name
    for (let i = 0; i < Math.min(data.length, 15); i++) {
      const row = data[i]
      if (row && row[0] && String(row[0]).includes('UNIT OWNER')) {
        ownerName = row[5] || ''
        break
      }
    }

    // Find PAYMENT AS OF section (usually around row 45-60)
    let paymentSectionStart = -1
    for (let i = 30; i < data.length; i++) {
      const row = data[i]
      if (row) {
        const rowStr = JSON.stringify(row)
        if (rowStr.includes('PAYMENT AS OF') && rowStr.includes('OCTOBER')) {
          paymentSectionStart = i
          break
        }
      }
    }

    if (paymentSectionStart === -1) {
      console.log(`  No October payment section found for ${sheetName}`)
      return {
        unitNumber,
        ownerName,
        electric: 0,
        water: 0,
        associationDues: 0,
        pastDues: 0,
        spAssessment: 0,
        advancePayment: 0,
        totalPayment: 0,
        previousBalance: 0,
        orNumbers: ''
      }
    }

    // Parse payment data from the payment section
    for (let i = paymentSectionStart; i < Math.min(data.length, paymentSectionStart + 20); i++) {
      const row = data[i]
      if (!row) continue

      const rowStr = JSON.stringify(row).toUpperCase()

      // Get OR numbers and amounts
      if (rowStr.includes('ELECTRIC') && !rowStr.includes('PAYMENT')) {
        // Find OR# and amount
        for (let j = 0; j < row.length; j++) {
          if (row[j] && String(row[j]).includes('OR#')) {
            const orMatch = String(row[j]).match(/OR#\s*(\d+)/i)
            if (orMatch) orNumbers += `Electric: OR# ${orMatch[1]}; `
          }
          if (typeof row[j] === 'number' && row[j] > 0 && j > 2) {
            electric = row[j]
          }
        }
      }

      if (rowStr.includes('WATER') && !rowStr.includes('PAYMENT')) {
        for (let j = 0; j < row.length; j++) {
          if (row[j] && String(row[j]).includes('OR#')) {
            const orMatch = String(row[j]).match(/OR#\s*(\d+)/i)
            if (orMatch) orNumbers += `Water: OR# ${orMatch[1]}; `
          }
          if (typeof row[j] === 'number' && row[j] > 0 && j > 2) {
            water = row[j]
          }
        }
      }

      if (rowStr.includes('ASSOC') && rowStr.includes('DUES')) {
        for (let j = 0; j < row.length; j++) {
          if (row[j] && String(row[j]).includes('OR#')) {
            const orMatch = String(row[j]).match(/OR#\s*(\d+)/i)
            if (orMatch) orNumbers += `Association Dues: OR# ${orMatch[1]}; `
          }
          if (typeof row[j] === 'number' && row[j] > 0 && j > 2) {
            associationDues = row[j]
          }
        }
      }

      if (rowStr.includes('PAST') && rowStr.includes('DUES')) {
        for (let j = 0; j < row.length; j++) {
          if (typeof row[j] === 'number' && row[j] > 0 && j > 2) {
            pastDues = row[j]
          }
        }
      }

      if (rowStr.includes('SPECIAL') && rowStr.includes('ASSESSMENT')) {
        for (let j = 0; j < row.length; j++) {
          if (row[j] && String(row[j]).includes('OR#')) {
            const orMatch = String(row[j]).match(/OR#\s*(\d+)/i)
            if (orMatch) orNumbers += `Special Assessment: OR# ${orMatch[1]}; `
          }
          if (typeof row[j] === 'number' && row[j] > 0 && j > 2) {
            spAssessment = row[j]
          }
        }
      }

      if (rowStr.includes('ADVANCE') && rowStr.includes('PAYMENT')) {
        for (let j = 0; j < row.length; j++) {
          if (typeof row[j] === 'number' && row[j] > 0 && j > 2) {
            advancePayment = row[j]
          }
        }
      }

      if (rowStr.includes('TOTAL') && rowStr.includes('PAYMENT')) {
        for (let j = 0; j < row.length; j++) {
          if (typeof row[j] === 'number' && row[j] > 0) {
            totalPayment = row[j]
          }
        }
      }
    }

    // Get previous balance from TOTAL AMOUNT DUE section
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (row) {
        const rowStr = JSON.stringify(row).toUpperCase()
        if (rowStr.includes('TOTAL AMOUNT') && (rowStr.includes('DUE') || rowStr.includes('PAYABLE'))) {
          const numbers = row.filter((v: any) => typeof v === 'number' && v > 100)
          if (numbers.length > 0) {
            previousBalance = numbers[numbers.length - 1]
          }
        }
      }
    }

    return {
      unitNumber,
      ownerName,
      electric,
      water,
      associationDues,
      pastDues,
      spAssessment,
      advancePayment,
      totalPayment,
      previousBalance,
      orNumbers: orNumbers.trim()
    }
  } catch (e) {
    console.error(`Error parsing sheet ${sheetName}:`, e)
    return null
  }
}

interface MeterReading {
  unitNumber: string
  electricPrevReading: number
  electricCurrReading: number
  electricConsumption: number
  waterPrevReading: number
  waterCurrReading: number
  waterConsumption: number
}

function extractMeterReadings(sheet: XLSX.WorkSheet, sheetName: string): MeterReading | null {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  // Skip sheets that aren't main unit sheets
  if (sheetName.includes('(A)') || sheetName.includes('paid')) {
    return null
  }

  const unitNumber = `M2-2F-${sheetName}`
  let electricPrevReading = 0
  let electricCurrReading = 0
  let electricConsumption = 0
  let waterPrevReading = 0
  let waterCurrReading = 0
  let waterConsumption = 0

  // Look for ELECTRICITY and WATER sections
  // Structure: Row with header (ELECTRICITY:, Pres, Prev, Cons)
  //           Next row with data at specific indices: Pres[7], Prev[9], Cons[11]
  for (let i = 10; i < Math.min(data.length, 30); i++) {
    const row = data[i]
    if (!row) continue

    const rowStr = JSON.stringify(row).toUpperCase()

    // Electric header row (contains "ELECTRICITY:" and "PRES")
    if (rowStr.includes('ELECTRICITY') && rowStr.includes('PRES')) {
      // Next row has the data
      const dataRow = data[i + 1]
      if (dataRow) {
        // Column indices: Present=7, Previous=9, Consumption=11
        electricCurrReading = typeof dataRow[7] === 'number' ? dataRow[7] : 0
        electricPrevReading = typeof dataRow[9] === 'number' ? dataRow[9] : 0
        electricConsumption = typeof dataRow[11] === 'number' ? dataRow[11] : 0
      }
    }

    // Water header row (contains "WATER:" and "PRES")
    if (rowStr.includes('WATER') && rowStr.includes('PRES')) {
      // Next row has the data
      const dataRow = data[i + 1]
      if (dataRow) {
        // Column indices: Present=7, Previous=9, Consumption=11
        waterCurrReading = typeof dataRow[7] === 'number' ? dataRow[7] : 0
        waterPrevReading = typeof dataRow[9] === 'number' ? dataRow[9] : 0
        waterConsumption = typeof dataRow[11] === 'number' ? dataRow[11] : 0
      }
    }
  }

  // Calculate consumption if not found
  if (electricConsumption === 0 && electricCurrReading > electricPrevReading) {
    electricConsumption = electricCurrReading - electricPrevReading
  }
  if (waterConsumption === 0 && waterCurrReading > waterPrevReading) {
    waterConsumption = waterCurrReading - waterPrevReading
  }

  return {
    unitNumber,
    electricPrevReading,
    electricCurrReading,
    electricConsumption,
    waterPrevReading,
    waterCurrReading,
    waterConsumption
  }
}

async function main() {
  const excelPath = "c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (nov 2025.xlsx"

  console.log('Reading November SOA Excel file:', excelPath)
  console.log('')

  const workbook = XLSX.readFile(excelPath)
  console.log('Sheet names:', workbook.SheetNames)
  console.log('')

  // First, let's look at the raw data structure of one sheet to find meter readings
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]

  console.log('=== Raw data from first sheet (looking for meter readings rows 10-35) ===\n')
  for (let i = 10; i < Math.min(rawData.length, 35); i++) {
    const row = rawData[i]
    if (row && row.some((v: any) => v !== null && v !== undefined)) {
      console.log(`Row ${i}: ${JSON.stringify(row)}`)
    }
  }

  console.log('\n=== Extracting October Meter Readings ===\n')

  const readings: MeterReading[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const reading = extractMeterReadings(sheet, sheetName)
    if (reading) {
      readings.push(reading)
      console.log(`${reading.unitNumber}: Electric ${reading.electricPrevReading} -> ${reading.electricCurrReading} (${reading.electricConsumption} kWh) | Water ${reading.waterPrevReading} -> ${reading.waterCurrReading} (${reading.waterConsumption} cu.m)`)
    }
  }

  // CSV output for readings
  console.log('\n=== Meter Readings CSV ===')
  console.log('Unit,ElecPrev,ElecCurr,ElecConsumption,WaterPrev,WaterCurr,WaterConsumption')
  readings.sort((a, b) => {
    const numA = parseInt(a.unitNumber.split('-').pop() || '0')
    const numB = parseInt(b.unitNumber.split('-').pop() || '0')
    return numA - numB
  })
  for (const r of readings) {
    console.log(`${r.unitNumber},${r.electricPrevReading},${r.electricCurrReading},${r.electricConsumption},${r.waterPrevReading},${r.waterCurrReading},${r.waterConsumption}`)
  }

  console.log('\n=== Extracting October Payments from all sheets ===\n')

  const payments: PaymentData[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const payment = parsePaymentFromSheet(sheet, sheetName)
    if (payment) {
      payments.push(payment)
      console.log(`${payment.unitNumber}: Total Payment = ₱${payment.totalPayment.toFixed(2)}`)
    }
  }

  // Output as CSV
  console.log('\n=== CSV Output ===\n')
  console.log('Unit Number,Owner Name,Electric,Water,Association Dues,Past Dues,Special Assessment,Advance Payment,Total Payment,Previous Balance,OR Numbers')

  payments.sort((a, b) => {
    const numA = parseInt(a.unitNumber.split('-').pop() || '0')
    const numB = parseInt(b.unitNumber.split('-').pop() || '0')
    return numA - numB
  })

  for (const p of payments) {
    console.log(`${p.unitNumber},${p.ownerName},${p.electric},${p.water},${p.associationDues},${p.pastDues},${p.spAssessment},${p.advancePayment},${p.totalPayment},${p.previousBalance},"${p.orNumbers}"`)
  }
}

main().catch(console.error)
