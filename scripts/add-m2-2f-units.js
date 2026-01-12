const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')

const prisma = new PrismaClient()

const filePath = process.argv[2] || 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (nov 2025.xlsx'

async function main() {
  console.log('Adding M2-2F units from:', filePath)
  console.log('='.repeat(80))

  // Get tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    throw new Error('No tenant found in database')
  }
  console.log('Using tenant:', tenant.name, '(', tenant.id, ')')

  // Parse Excel file
  const wb = XLSX.readFile(filePath)
  const unitsToAdd = []

  for (const sheetName of wb.SheetNames) {
    const upperName = sheetName.toUpperCase()
    if (upperName.includes('SUMMARY') || upperName.includes('BALANCES') || upperName.includes('PAID') || upperName.includes('(A)')) {
      continue
    }

    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (data.length < 15) continue

    // Row 9: Unit info (cols 5-7)
    const unitRow = data[9] || []
    const floorPrefix = String(unitRow[5] || '').trim()
    const unitNum = String(unitRow[6] || '').trim()
    const building = String(unitRow[7] || '').trim()

    if (!floorPrefix || !unitNum) continue

    // Row 10: Owner name (col 5)
    const ownerRow = data[10] || []
    const ownerName = String(ownerRow[5] || '').trim()

    const buildingPrefix = building.includes('2') ? 'M2' : 'M1'
    const unitNumber = `${buildingPrefix}-${floorPrefix}-${unitNum}`

    unitsToAdd.push({
      unitNumber,
      floorLevel: floorPrefix,
      ownerName,
      buildingPrefix
    })
  }

  console.log(`\nFound ${unitsToAdd.length} units to add:`)
  unitsToAdd.forEach(u => console.log(`  ${u.unitNumber}: ${u.ownerName}`))

  // Check which units already exist
  const existingUnits = await prisma.unit.findMany({
    where: {
      unitNumber: { in: unitsToAdd.map(u => u.unitNumber) }
    },
    select: { unitNumber: true }
  })
  const existingSet = new Set(existingUnits.map(u => u.unitNumber))

  const newUnits = unitsToAdd.filter(u => !existingSet.has(u.unitNumber))
  console.log(`\n${existingUnits.length} units already exist, ${newUnits.length} new units to create`)

  if (newUnits.length === 0) {
    console.log('No new units to add!')
    return
  }

  // Create owners and units
  let created = 0
  for (const unit of newUnits) {
    // Parse owner name - try to split into first/last name
    let firstName = '', lastName = '', middleName = ''
    const name = unit.ownerName

    // Handle common patterns
    if (name.toUpperCase().startsWith('SPS.') || name.toUpperCase().startsWith('SPS ')) {
      // Spouses format: "Sps. Mario & Rosemarie Suarez"
      lastName = name.split(' ').pop() || name
      firstName = name
    } else if (name.toUpperCase().startsWith('MS.') || name.toUpperCase().startsWith('MR.') || name.toUpperCase().startsWith('ENGR.')) {
      // Title format: "Ms. Eloisa Montegrico"
      const parts = name.split(' ').filter(p => p.length > 0)
      if (parts.length >= 2) {
        lastName = parts[parts.length - 1]
        firstName = parts.slice(1, -1).join(' ') || parts[0]
      } else {
        firstName = name
      }
    } else {
      // Simple format: "Nelia Antonio"
      const parts = name.split(' ').filter(p => p.length > 0)
      if (parts.length >= 2) {
        firstName = parts.slice(0, -1).join(' ')
        lastName = parts[parts.length - 1]
      } else {
        firstName = name
      }
    }

    // Check if owner with similar name exists
    let owner = await prisma.owner.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { lastName: { contains: lastName, mode: 'insensitive' } },
          { firstName: { contains: firstName.substring(0, 5), mode: 'insensitive' } }
        ]
      }
    })

    if (!owner) {
      // Create new owner
      owner = await prisma.owner.create({
        data: {
          tenantId: tenant.id,
          firstName: firstName || unit.ownerName,
          lastName: lastName || 'N/A',
          middleName: middleName,
          email: null,
          phone: null,
          address: null
        }
      })
      console.log(`  Created owner: ${owner.firstName} ${owner.lastName}`)
    }

    // Create unit
    await prisma.unit.create({
      data: {
        tenantId: tenant.id,
        unitNumber: unit.unitNumber,
        floorLevel: unit.floorLevel,
        unitType: 'RESIDENTIAL',
        area: 30, // Default area
        ownerId: owner.id,
        isActive: true
      }
    })
    console.log(`  Created unit: ${unit.unitNumber}`)
    created++
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`Successfully created ${created} units!`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
