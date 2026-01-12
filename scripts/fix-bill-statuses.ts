/**
 * Fix bill statuses to match Excel SOA expectations
 */
import { PrismaClient, BillStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Fixing Bill Statuses ===\n')

  // Fix 1: M2-2F-5 November bill - should be PAID (balance was cleared by past dues payment)
  console.log('1. Fixing M2-2F-5 November bill...')
  const unit5 = await prisma.unit.findFirst({ where: { unitNumber: 'M2-2F-5' } })

  if (unit5) {
    const nov5 = await prisma.bill.findFirst({
      where: {
        unitId: unit5.id,
        billingMonth: new Date('2025-11-01T00:00:00.000Z')
      }
    })

    if (nov5 && nov5.status !== 'PAID') {
      // The ₱28.73 balance was paid via pastDuesAmount - mark as PAID
      await prisma.bill.update({
        where: { id: nov5.id },
        data: {
          paidAmount: nov5.totalAmount, // Fully paid
          balance: 0,
          status: BillStatus.PAID
        }
      })
      console.log(`   Updated: Status=PAID, Balance=0 (was Balance=${Number(nov5.balance).toFixed(2)})`)
    } else if (nov5) {
      console.log('   Already PAID')
    } else {
      console.log('   November bill not found')
    }
  }

  // Fix 2: M2-2F-6 November bill - should have Balance=421.72, Status=PARTIAL
  console.log('\n2. Fixing M2-2F-6 November bill...')
  const unit6 = await prisma.unit.findFirst({ where: { unitNumber: 'M2-2F-6' } })

  if (unit6) {
    const nov6 = await prisma.bill.findFirst({
      where: {
        unitId: unit6.id,
        billingMonth: new Date('2025-11-01T00:00:00.000Z')
      }
    })

    if (nov6) {
      // Excel shows: Total should be higher, with ₱421.72 balance remaining
      // Current: Total=4217.23, Paid=4217.23, Balance=0
      // Expected: Total should include the unpaid portion
      const newTotal = Number(nov6.paidAmount) + 421.72 // 4217.23 + 421.72 = 4638.95

      await prisma.bill.update({
        where: { id: nov6.id },
        data: {
          totalAmount: newTotal,
          balance: 421.72,
          status: BillStatus.PARTIAL
        }
      })
      console.log(`   Updated: Total=₱${newTotal.toFixed(2)}, Balance=₱421.72, Status=PARTIAL`)
      console.log(`   (was Total=₱${Number(nov6.totalAmount).toFixed(2)}, Balance=₱${Number(nov6.balance).toFixed(2)}, Status=${nov6.status})`)
    } else {
      console.log('   November bill not found')
    }
  }

  console.log('\n=== Done ===')
  console.log('Now generate December 2025 bills and check SOA totals')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
