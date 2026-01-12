# Import Beginning Balances from Excel

## Purpose
Transition from Excel SOA files to the new billing system by importing:
1. **Opening Balance** (Total Amount Due and Payable - includes past dues)
2. **Past Dues** (Carried over from previous months)
3. **Meter Readings** (Electric & Water present readings as baseline)

## Script Location
`scripts/import-2f-november-balances.ts`

## How It Works

### Data Extracted from Excel (per unit sheet)

| Field | Excel Location | Purpose |
|-------|----------------|---------|
| Electric Previous Reading | Row 17, Index 9 | Historical reference |
| Electric Present Reading | Row 17, Index 7 | Baseline for next month |
| Electric Consumption | Row 17, Index 11 | Verification |
| Water Previous Reading | Row 20, Index 9 | Historical reference |
| Water Present Reading | Row 20, Index 7 | Baseline for next month |
| Water Consumption | Row 20, Index 11 | Verification |
| **Past Dues** | **Row 37, Index 18** | **Carried over balance from previous months** |
| **Total Amount Due** | **Row 45, Index 17** | **Opening balance (includes past dues, discounts)** |

### Important: Total Amount Due Location
The correct Total Amount Due is in **Row 45, Column R (index 17)**. This is the definitive total that includes:
- Current charges (Electric, Water, Association Dues)
- Past dues carried forward
- Any discounts or adjustments
- Penalties

Do NOT sum individual components - always use Row 45 total.

### Records Created
1. **ElectricReading** - October billing period with present reading
2. **WaterReading** - October billing period with present reading
3. **Bill** - November opening balance (BillType: OPENING_BALANCE)
   - `totalAmount` and `balance` = Total Amount Due from Row 45
   - `penaltyAmount` = Past Dues (if any)
   - `discounts` = Any discounts applied

## Usage

### Step 1: Modify Script for Your Data
Edit `scripts/import-2f-november-balances.ts`:
```typescript
const EXCEL_FILE = 'path/to/your/excel/file.xlsx'
const FLOOR_LEVEL = '2F'  // or 'GF', '3F', etc.
const BUILDING_PREFIX = 'M2'  // or 'M1'
const BILLING_MONTH = new Date(2025, 10, 1)  // Month for opening balance
const SHEETS_TO_PROCESS = ['1', '2', '3', ...]  // Sheet names to process
```

### Step 2: Run the Script
```bash
npx tsx scripts/import-2f-november-balances.ts
```

### Step 3: Verify
- Check Bills List page for opening balance bills
- Verify totals match Excel (especially units with past dues)
- Check Electric Readings page for baseline readings
- Check Water Readings page for baseline readings

## Workflow After Import

1. **System has:** Previous month's ending readings + Opening balance (with past dues)
2. **User enters:** Current month payments (applied against balance)
3. **User enters:** Current month readings (present readings)
4. **System generates:** Next month's SOA

## Excel File Structure Expected

Each sheet should be a unit number (1, 2, 3, 5, 6, etc.) containing:

```
Row 17: Electric data - [7]=Pres, [9]=Prev, [11]=Cons, [18]=Amount
Row 20: Water data - [7]=Pres, [9]=Prev, [11]=Cons, [18]=Amount
Row 25: Association dues - [18]=Amount
Row 33-35: Past dues breakdown (if any)
Row 37: TOTAL PAST DUES at [18]
Row 45: TOTAL AMOUNT DUE AND PAYABLE at [17]  ← USE THIS FOR BALANCE
```

## Example Session (November 2025)

```
Source: NOV 2025 MEGATOWER II/2ND FLOOR (t2).xlsx
Units: M2-2F-1 through M2-2F-22 (19 units)

Units with Past Dues:
- M2-2F-5: Past Dues ₱28.73, Total: ₱3,071.36

Units with Discounts:
- M2-2F-16: Discount ₱30.00, Total: ₱2,900.52

Created: 19 bills + 38 readings (19 electric + 19 water)
```

## Troubleshooting

### Wrong Totals
If totals don't match Excel:
1. Check Row 45, Column 17 (index 17) in Excel
2. Verify past dues at Row 37, Column 18
3. Check for discounts/adjustments

### Units with Past Dues
Past dues are shown in the script output with `***` marker:
```
M2-2F-5 - Owner: SPS. Richard & Perlita Lapid...
  Electric: Prev=9419, Pres=9436, Cons=17
  Water: Prev=1037, Pres=1039, Cons=2
  Past Dues: ₱28.73 ***
  Total Due: ₱3071.36
```

## Important Notes
- Script clears ALL existing data for the specified floor before importing
- Only processes sheets listed in `SHEETS_TO_PROCESS` (skips "(A)" suffix sheets)
- Unit numbers must exist in database (format: M2-2F-1, M1-3F-5, etc.)
- Always verify totals against Excel after import
