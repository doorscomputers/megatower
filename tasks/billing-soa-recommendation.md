# Billing Statement & Payment Collection - Recommended Design

## Based on Excel Analysis: 2ND FLOOR (t2).xlsx - November 2025

---

## 1. UNDERSTANDING THE CURRENT EXCEL SOA FORMAT

### SOA Structure (Statement of Account)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ MEGATOWER RESIDENCES                                                     │
│ CONDOMINIUM OWNERS INC.                                                  │
│ MEGATOWER RESIDENCES I, Gonzales St, Concepcion Uno, Marikina City       │
│                                                                          │
│ STATEMENT OF ACCOUNT                                                     │
│ FOR THE MONTH OF: NOVEMBER, 2025                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ SOA NO.: 2017-0227          SOA DATE: NOV 5, 2025                        │
│ UNIT NO: 2F-1 Megatower 2   DUE DATE: NOV 15, 2025                       │
│ UNIT OWNER: Sps. Mario & Rosemarie Suarez                                │
├─────────────────────────────────────────────────────────────────────────┤
│ PARTICULARS (CURRENT MONTH CHARGES):                                     │
│                                                                          │
│ ELECTRICITY: (9-27 TO 10-26)                                             │
│   Pres: 7734  Prev: 7619  Cons: 115  Rate: 8.39  Amount: ₱964.85         │
│                                                                          │
│ WATER: (9-27 TO 10-26)                                                   │
│   Pres: 421   Prev: 419   Cons: 2              Amount: ₱200.00           │
│                                                                          │
│ ASSOCIATION DUES:                                                        │
│   Rate per Sq.mtr: 60  Area: 34.5              Amount: ₱2,070.00         │
│   Parking area: 60 × (area if any)                                       │
│                                                                          │
│                                        TOTAL AMOUNT: ₱3,234.85           │
├─────────────────────────────────────────────────────────────────────────┤
│ BALANCE RECORD (PAST DUES):                                              │
│ MOS.   ASS'N DUES  ELECTRIC  WATER  TOTAL  1st MO  2nd MO  3rd MO  TOTAL │
│ Oct.   -           -         -      -      -       -       -       -     │
├─────────────────────────────────────────────────────────────────────────┤
│ PAYMENT AS OF: OCTOBER 2025                    │ SUMMARY:                │
│                                                │                         │
│ ELECTRIC         OR# 21627    ₱752.22          │ TOTAL PAST DUES:    ₱0  │
│ WATER            OR# 21627    ₱200.00          │ SP. ASSESS (Ins):   ₱0  │
│ ASSOC. DUES      OR# 159      ₱2,070.00        │ DISCOUNT/PROMO:     ₱0  │
│ PAST DUES        OR# -        ₱0               │ ADV FOR DUES:       ₱0  │
│ SPECIAL ASSESS   OR# 21627    ₱0               │ ADV FOR UTILITIES:  ₱0  │
│ ADVANCE PAYMENT  OR# -        ₱0               │ OTHER ADVANCED:     ₱0  │
│                                                │                         │
│              TOTAL PAYMENT    ₱3,022.22        │                         │
├─────────────────────────────────────────────────────────────────────────┤
│                    TOTAL AMOUNT DUE AND PAYABLE: ₱3,234.85               │
├─────────────────────────────────────────────────────────────────────────┤
│ NOTES:                                                                   │
│ 1. Payable in Cash or Check payable to Megatower Residences COI          │
│ 2. Contact: (074) 661-02-61 / 0917-577-5521                              │
│ 3. MINIMUM CHARGES: Electric ₱50.00, Water ₱80.00-₱370.00                │
│ 4. Please settle on or before due date to avoid compound penalty         │
│ 5. Bank: Metrobank | Acct Name: Megatower Residences | Acct#: xxx        │
│ 6. Settle all accounts before Moving in or Moving out                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. KEY INSIGHTS FROM EXCEL DATA

### A. OR# (Official Receipt) Understanding

**Each OR# represents ONE payment transaction that can cover multiple bill components.**

| Payment Scenario | Example |
|-----------------|---------|
| **Full payment, one receipt** | OR# 21488 = Electric + Water + Dues (Unit 2F-2) |
| **Split payment, multiple receipts** | OR# 21627 = Electric + Water, OR# 159 = Dues (Unit 2F-1) |
| **Full payment with Past Dues** | OR# 21649 = Electric + Water + Dues + Past Dues + Special (Unit 2F-5) |

### B. Two Receipt Book Series

| Series | Range | Purpose |
|--------|-------|---------|
| **21xxx** | 21468-21653 | Utility/General payments |
| **15x-16x** | 159-164 | Association Dues (separate receipt book) |

This explains why some units have:
- One OR# for utilities (Electric + Water)
- Different OR# for Association Dues

### C. Minimum Charges (from Notice Section)

```
"₱50.00 minimum for ELECTRIC and ₱80.00-₱370.00 minimum for WATER
per month with or without meter movement."
```

| Utility | Minimum | Meaning |
|---------|---------|---------|
| Electric | ₱50 | Even if 0 kWh consumed, charge ₱50 |
| Water | ₱80 | Tier 1 (0-1 cu.m) = ₱80 minimum |
| Water | ₱370 | Tier 3 (5-10 cu.m) maximum in "minimum" range |

**Note:** The ₱80-₱370 range means:
- If consumption is 0-1 cu.m → ₱80 (Tier 1)
- If consumption is 1-5 cu.m → ₱200 (Tier 2)
- If consumption is 5-10 cu.m → ₱370 (Tier 3)

All are considered "minimum" charges because they're fixed amounts, not consumption-based.

---

## 3. RECOMMENDED DATA MODEL

### Payment Model (Updated)

```prisma
model Payment {
  id              String   @id @default(cuid())
  tenantId        String

  // OR# should be unique per tenant (not globally unique)
  // One OR# = One payment transaction
  orNumber        String
  paymentDate     DateTime

  // Total amount received
  amount          Decimal  @db.Decimal(10, 2)

  // Payment method
  paymentMethod   PaymentMethod
  referenceNumber String?
  checkNumber     String?
  checkDate       DateTime?
  bankName        String?

  // Allocation to bills
  billPayments    BillPayment[]

  // Any excess becomes advance
  advanceAmount   Decimal  @default(0) @db.Decimal(10, 2)

  // Metadata
  receivedBy      String?
  remarks         String?
  status          PaymentStatus @default(CONFIRMED)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, orNumber])  // OR# unique per tenant
  @@index([tenantId])
  @@index([paymentDate])
}
```

### Key Changes:
1. **Remove global `@unique` from orNumber** - Change to `@@unique([tenantId, orNumber])`
2. This allows same OR# format across different tenants
3. OR# remains unique within a tenant

---

## 4. RECOMMENDED SOA DESIGN FOR THE APPLICATION

### Section 1: Header
```
┌────────────────────────────────────────────────────────────┐
│ MEGATOWER RESIDENCES CONDOMINIUM OWNERS INC.               │
│ Address, Contact Details                                    │
│                                                             │
│ STATEMENT OF ACCOUNT                                        │
│ For the Month of: NOVEMBER 2025                             │
├────────────────────────────────────────────────────────────┤
│ SOA No: 2025-1105-2F01    │ SOA Date: November 5, 2025     │
│ Unit: 2F-1 (Megatower 2)  │ Due Date: November 15, 2025    │
│ Owner: Sps. Mario & Rosemarie Suarez                        │
└────────────────────────────────────────────────────────────┘
```

### Section 2: Current Month Charges
```
┌────────────────────────────────────────────────────────────┐
│ CURRENT MONTH CHARGES (Billing Period: Sep 27 - Oct 26)    │
├────────────────────────────────────────────────────────────┤
│ ELECTRICITY                                                 │
│   Present: 7,734    Previous: 7,619    Consumption: 115 kWh│
│   Rate: ₱8.39/kWh                           Amount: ₱964.85│
│                                                             │
│ WATER                                                       │
│   Present: 421      Previous: 419      Consumption: 2 cu.m │
│   Tier 2 (Fixed Rate)                       Amount: ₱200.00│
│                                                             │
│ ASSOCIATION DUES                                            │
│   Unit Area: 34.5 sqm × ₱60/sqm             Amount: ₱2,070 │
│   Parking: (if any)                         Amount: ₱0     │
│                                                             │
│ SPECIAL ASSESSMENT                                          │
│   (if any)                                  Amount: ₱0     │
├────────────────────────────────────────────────────────────┤
│                         SUBTOTAL THIS MONTH: ₱3,234.85     │
└────────────────────────────────────────────────────────────┘
```

### Section 3: Outstanding Balance (Past Dues with Penalty)
```
┌────────────────────────────────────────────────────────────┐
│ OUTSTANDING BALANCE                                         │
├────────────────────────────────────────────────────────────┤
│ Month     │ Assoc Dues │ Electric │ Water │ Total │ Penalty│
│───────────┼────────────┼──────────┼───────┼───────┼────────│
│ Oct 2025  │ ₱0         │ ₱0       │ ₱0    │ ₱0    │ ₱0     │
│ Sep 2025  │ ₱0         │ ₱0       │ ₱0    │ ₱0    │ ₱0     │
│───────────┼────────────┼──────────┼───────┼───────┼────────│
│           │            │          │       │TOTAL PAST DUES:│
│           │            │          │       │       ₱0       │
└────────────────────────────────────────────────────────────┘
```

### Section 4: Payment History (Last Month)
```
┌────────────────────────────────────────────────────────────┐
│ PAYMENTS RECEIVED (As of October 2025)                      │
├────────────────────────────────────────────────────────────┤
│ Date       │ OR#   │ Component      │ Amount               │
│────────────┼───────┼────────────────┼──────────────────────│
│ Oct 5, 2025│ 21627 │ Electric       │ ₱752.22              │
│ Oct 5, 2025│ 21627 │ Water          │ ₱200.00              │
│ Oct 10,2025│ 159   │ Association    │ ₱2,070.00            │
│────────────┼───────┼────────────────┼──────────────────────│
│            │       │ TOTAL PAID     │ ₱3,022.22            │
└────────────────────────────────────────────────────────────┘
```

### Section 5: Summary
```
┌────────────────────────────────────────────────────────────┐
│ ACCOUNT SUMMARY                                             │
├────────────────────────────────────────────────────────────┤
│ Current Month Charges .......................... ₱3,234.85 │
│ Add: Past Due Balance .......................... ₱0.00     │
│ Add: Penalty (10% compounding) ................. ₱0.00     │
│ Add: Special Assessment ........................ ₱0.00     │
│                                              ──────────────│
│ Total Charges .................................. ₱3,234.85 │
│                                                             │
│ Less: Payments Received ........................ ₱3,022.22 │
│ Less: Credits/Advances ......................... ₱0.00     │
│                                              ══════════════│
│ TOTAL AMOUNT DUE AND PAYABLE ................... ₱212.63   │
└────────────────────────────────────────────────────────────┘
```

### Section 6: Footer Notes
```
┌────────────────────────────────────────────────────────────┐
│ IMPORTANT REMINDERS:                                        │
│ 1. Payable in Cash or Check (Megatower Residences COI)     │
│ 2. Minimum Charges: Electric ₱50.00 | Water ₱80.00-₱370.00 │
│ 3. 10% compound penalty after due date                      │
│ 4. Contact: (074) 661-02-61 / 0917-577-5521                │
│ 5. Bank: Metrobank | Acct: Megatower Residences | #: xxx   │
└────────────────────────────────────────────────────────────┘
```

---

## 5. PAYMENT COLLECTION REPORT DESIGN

### Daily Collection Report
```
┌────────────────────────────────────────────────────────────┐
│ DAILY COLLECTION REPORT                                     │
│ Date: October 5, 2025                                       │
├────────────────────────────────────────────────────────────┤
│ OR#   │ Unit  │ Owner              │ Amount   │ Method     │
│───────┼───────┼────────────────────┼──────────┼────────────│
│ 21627 │ 2F-1  │ Sps. Mario Suarez  │ ₱952.22  │ Cash       │
│ 21627 │ 2F-7  │ Sps. Rhandy Repollo│ ₱1,513.40│ Cash       │
│ 21628 │ 2F-2  │ Ms. Elaine Ramos   │ ₱3,698.32│ Bank Trans │
│ 159   │ 2F-1  │ Sps. Mario Suarez  │ ₱2,070.00│ Cash       │
│ 160   │ 2F-7  │ Sps. Rhandy Repollo│ ₱1,800.00│ Cash       │
├────────────────────────────────────────────────────────────┤
│                            TOTAL COLLECTIONS: ₱10,033.94   │
│                                                             │
│ By Component:                                               │
│   Electric: ₱2,065.62  │  Assoc Dues: ₱5,670.00            │
│   Water:    ₱600.00    │  Past Dues:  ₱0.00                │
│   Special:  ₱0.00      │  Advance:    ₱1,698.32            │
└────────────────────────────────────────────────────────────┘
```

### Monthly Collection Summary by Unit
```
┌────────────────────────────────────────────────────────────┐
│ MONTHLY COLLECTION SUMMARY - October 2025                   │
│ Floor: 2F                                                   │
├────────────────────────────────────────────────────────────┤
│ Unit │ Owner              │ Billed   │ Paid     │ Balance  │
│──────┼────────────────────┼──────────┼──────────┼──────────│
│ 2F-1 │ Sps. Mario Suarez  │ ₱3,234.85│ ₱3,022.22│ ₱212.63  │
│ 2F-2 │ Ms. Elaine Ramos   │ ₱3,252.31│ ₱3,698.32│ (₱446.01)│
│ 2F-3 │ Ms. Eloisa Monteg..│ ₱3,916.12│ ₱4,769.36│ (₱853.24)│
│ 2F-5 │ Sps. Richard Lapid │ ₱3,071.36│ ₱12,000  │(₱8,928.64)│
│ ...  │ ...                │ ...      │ ...      │ ...      │
├────────────────────────────────────────────────────────────┤
│ FLOOR TOTALS             │ ₱XX,XXX  │ ₱XX,XXX  │ ₱X,XXX   │
│                                                             │
│ Note: Negative balance = Credit/Advance Payment             │
└────────────────────────────────────────────────────────────┘
```

---

## 6. HANDLING THE OR# 21627 SCENARIO

The Excel shows OR# 21627 used by 6 different units. Possible explanations:

### Scenario A: Same Owner, Multiple Units
If Sps. Edilberto & Maria Carabbacan own 2F-8 and 2F-9, they might make ONE payment covering both units.

**Solution:** Allow payment to span multiple units if same owner.

### Scenario B: Batch Collection
Collector receives payments from multiple units and issues batch receipt.

**Solution:**
- Primary OR# for the batch
- Sub-entries for each unit's allocation

### Scenario C: Data Entry Shortcut
Ma'am Rose might use same OR# as template placeholder.

**Solution:** In the app, auto-generate OR# or validate uniqueness.

### Recommended Approach:
```
Allow OR# to optionally link to multiple units (for same-owner scenario)
OR
Each payment gets unique OR# per unit (cleaner, recommended)
```

---

## 7. MINIMUM CHARGE IMPLEMENTATION

### Electric Minimum (₱50)
```typescript
const electricAmount = Math.max(consumption * rate, 50);
// If 0 kWh × 8.39 = 0 → charge ₱50 minimum
// If 5 kWh × 8.39 = 41.95 → charge ₱50 minimum
// If 6 kWh × 8.39 = 50.34 → charge ₱50.34 (exceeds minimum)
```

### Water Minimum (₱80 for Tier 1)
```typescript
// Tier 1: 0-1 cu.m = ₱80 (fixed)
// Even 0 consumption = ₱80
// This is already in the tier system
```

The Excel notice "₱80-₱370 minimum" means:
- Tier 1 (0-1 cu.m): ₱80 - This is the TRUE minimum
- Tier 2 (1-5 cu.m): ₱200 - Fixed rate
- Tier 3 (5-10 cu.m): ₱370 - Fixed rate

All three are "minimum" in the sense they're fixed regardless of exact consumption within the tier.

---

## 8. NEXT STEPS

1. **Update Schema:** Change OR# constraint from global unique to tenant-unique
2. **Create SOA Template:** Match the format above
3. **Create Payment Form:**
   - Enter OR#, Date, Amount
   - Allocate to components (Electric, Water, Dues, etc.)
   - Show running balance
4. **Create Collection Reports:**
   - Daily Collection Report
   - Monthly Summary by Floor/Unit
   - Aging Report for Past Dues
5. **Test with Real Data:** Use the Excel test cases

---

## 9. VERIFIED TEST CASES

| Unit | Electric | Water | Dues | Total Bill | Total Paid | Balance |
|------|----------|-------|------|------------|------------|---------|
| 2F-1 | ₱964.85 (115 kWh) | ₱200 (2 cu.m) | ₱2,070 (34.5 sqm) | ₱3,234.85 | ₱3,022.22 | ₱212.63 |
| 2F-2 | ₱1,082.31 (129 kWh) | ₱370 (8 cu.m) | ₱1,800 (30 sqm) | ₱3,252.31 | ₱3,698.32 | -₱446.01 |
| 2F-5 | ₱142.63 (17 kWh) | ₱200 (2 cu.m) | ₱2,700 (45 sqm) | ₱3,042.63 | ₱12,000 | -₱8,957.37 |
| 2F-19 | ₱50 (min) | ₱80 (min) | ₱1,530 (25.5 sqm) | ₱1,660 | ₱1,660 | ₱0 |
| 2F-20 | ₱50 (min) | ₱80 (min) | ₱1,530 | ₱1,660 | ₱1,660 | ₱0 |

**Note:** Units 2F-19 and 2F-20 show the minimum charges in action!

---

Document Created: December 11, 2025
Based on: 2ND FLOOR (t2).xlsx - November 2025 billing data
