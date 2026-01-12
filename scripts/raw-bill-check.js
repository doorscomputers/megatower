const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function check() {
  // Get M2-2F-16 unit
  const unit16 = await p.unit.findFirst({ where: { unitNumber: 'M2-2F-16' } })

  // Raw SQL query to see exact values
  const result = await p.$queryRaw`
    SELECT
      "billingMonth",
      "electricAmount"::text as electric,
      "waterAmount"::text as water,
      "associationDues"::text as dues,
      "spAssessment"::text as sp,
      "penaltyAmount"::text as penalty,
      "otherCharges"::text as other,
      "totalAmount"::text as total,
      "paidAmount"::text as paid,
      "balance"::text as balance,
      "status"
    FROM "Bill"
    WHERE "unitId" = ${unit16.id}
    ORDER BY "billingMonth" ASC
  `

  console.log('=== M2-2F-16 Raw Bill Data ===')
  for (const r of result) {
    console.log(r.billingMonth.toISOString().slice(0,7))
    console.log('  Electric:', r.electric, '+ Water:', r.water, '+ Dues:', r.dues)
    console.log('  SP:', r.sp, '+ Penalty:', r.penalty, '+ Other:', r.other)
    console.log('  = Total:', r.total, '| Paid:', r.paid, '| Balance:', r.balance)
    console.log('  Status:', r.status)
    console.log('')
  }

  // Check if there's any bill that might have balance around 4768
  console.log('=== Checking for balance ~4768 ===')
  const weird = await p.$queryRaw`
    SELECT b."billingMonth", u."unitNumber", b."balance"::text as balance, b."totalAmount"::text as total, b."status"
    FROM "Bill" b
    JOIN "Unit" u ON b."unitId" = u.id
    WHERE b."balance" > 4000 AND u."unitNumber" LIKE 'M2-2F-%'
    ORDER BY b."balance" DESC
    LIMIT 10
  `
  console.log(weird)

  await p.$disconnect()
}
check().catch(console.error)
