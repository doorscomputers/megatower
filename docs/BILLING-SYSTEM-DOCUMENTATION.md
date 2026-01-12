# MEGATOWER BILLING SYSTEM - Complete User Documentation

## Table of Contents
1. [System Flow Chart](#1-system-flow-chart)
2. [Data Flow Diagram](#2-data-flow-diagram)
3. [Operations Manual](#3-operations-manual)
4. [Seeded Data Reference](#4-seeded-data-reference)
5. [Sample Good Accounts](#5-sample-good-accounts)
6. [Month-by-Month Billing Computations](#6-month-by-month-billing-computations)
7. [Payment Allocation Examples](#7-payment-allocation-examples)
8. [Verification Checklist](#8-verification-checklist)

---

## 1. SYSTEM FLOW CHART

### 1.1 Overall Billing Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MEGATOWER BILLING SYSTEM FLOW                         │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │    START     │
                              │  (26th/27th) │
                              └──────┬───────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │   1. METER READING ENTRY       │
                    │   - Electric Meter (kWh)       │
                    │   - Water Meter (cu.m)         │
                    │   [Clerk enters present reading]│
                    └────────────────┬───────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │   2. CONSUMPTION CALCULATION   │
                    │   Present - Previous = Usage   │
                    └────────────────┬───────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │   3. BILL GENERATION           │
                    │   - Electric Amount            │
                    │   - Water Amount (tiered)      │
                    │   - Association Dues           │
                    │   - Previous Balance           │
                    │   - Penalty (if overdue)       │
                    └────────────────┬───────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │   4. STATEMENT OF ACCOUNT      │
                    │   - Generate SOA PDF           │
                    │   - Send to Unit Owner         │
                    │   (10 days after billing)      │
                    └────────────────┬───────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │   5. PAYMENT COLLECTION        │
                    │   - Cash/Check/Bank Transfer   │
                    │   - GCash/PayMaya              │
                    │   (Due: 10 days after SOA)     │
                    └────────────────┬───────────────┘
                                     │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                   ┌──────────────┐    ┌──────────────┐
                   │  PAID IN     │    │  NOT PAID    │
                   │  FULL        │    │  OR PARTIAL  │
                   └──────┬───────┘    └──────┬───────┘
                          │                   │
                          ▼                   ▼
                   ┌──────────────┐    ┌──────────────┐
                   │ Status: PAID │    │Status:OVERDUE│
                   │ Balance: 0   │    │ +10% Penalty │
                   └──────────────┘    │ (compounds)  │
                                       └──────┬───────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ Add to Next  │
                                       │ Month's Bill │
                                       └──────────────┘
```

### 1.2 Bill Status Flow

```
                              ┌──────────────┐
                              │    DRAFT     │
                              │ (Generated   │
                              │  not final)  │
                              └──────┬───────┘
                                     │ Finalize
                                     ▼
                              ┌──────────────┐
                              │   UNPAID     │◄───────────────┐
                              │ (No payment) │                │
                              └──────┬───────┘                │
                                     │                        │
                        ┌────────────┼────────────┐           │
                        │ Partial    │ Full       │ Past Due  │
                        │ Payment    │ Payment    │ + No Pay  │
                        ▼            ▼            ▼           │
                 ┌──────────┐  ┌──────────┐  ┌──────────┐     │
                 │ PARTIAL  │  │   PAID   │  │ OVERDUE  │─────┘
                 │          │  │          │  │ +Penalty │
                 └────┬─────┘  └──────────┘  └──────────┘
                      │                           │
                      │ Full Payment              │ Payment
                      ▼                           ▼
                 ┌──────────┐              ┌──────────┐
                 │   PAID   │              │ PARTIAL  │
                 └──────────┘              │ or PAID  │
                                           └──────────┘
```

### 1.3 Water Tier Calculation Flow

```
                              ┌──────────────┐
                              │ Water Usage  │
                              │  (cu.m)      │
                              └──────┬───────┘
                                     │
                          ┌──────────┴──────────┐
                          │  Check Unit Type    │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                                 ▼
             ┌─────────────┐                   ┌─────────────┐
             │ RESIDENTIAL │                   │ COMMERCIAL  │
             └──────┬──────┘                   └──────┬──────┘
                    │                                 │
                    ▼                                 ▼
    ┌───────────────────────────────┐  ┌───────────────────────────────┐
    │ Tier 1: ≤1 cu.m = ₱80        │  │ Tier 1: ≤1 cu.m = ₱200       │
    │ Tier 2: 2-5 cu.m = ₱200      │  │ Tier 2: 2-5 cu.m = ₱250      │
    │ Tier 3: 6-10 cu.m = ₱370     │  │ Tier 3: 6-10 cu.m = ₱740     │
    │ Tier 4: 11-20 cu.m = Formula │  │ Tier 4: 11-20 cu.m = Formula │
    │ Tier 5: 21-30 cu.m = Formula │  │ Tier 5: 21-30 cu.m = Formula │
    │ Tier 6: 31-40 cu.m = Formula │  │ Tier 6: 31-40 cu.m = Formula │
    │ Tier 7: >40 cu.m = Formula   │  │ Tier 7: >40 cu.m = Formula   │
    └───────────────────────────────┘  └───────────────────────────────┘
```

---

## 2. DATA FLOW DIAGRAM

### 2.1 Level 0 - Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTEXT DIAGRAM (DFD Level 0)                      │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌───────────┐                                         ┌───────────┐
    │   CLERK   │                                         │   OWNER   │
    │           │                                         │           │
    └─────┬─────┘                                         └─────┬─────┘
          │                                                     │
          │ Meter Readings                          Payments    │
          │ (Electric, Water)                      (Cash/Check) │
          │                                                     │
          ▼                                                     ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │                   MEGATOWER BILLING SYSTEM                      │
    │                                                                 │
    │  - Process meter readings                                       │
    │  - Calculate bills (Electric, Water, Dues, Penalties)           │
    │  - Record payments                                              │
    │  - Generate statements & reports                                │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
          │                                                     │
          │ Reports                              Statement of   │
          │ (Billing Summary,                    Account (SOA)  │
          │  Collection Reports)                                │
          ▼                                                     ▼
    ┌───────────┐                                         ┌───────────┐
    │ ACCOUNTANT│                                         │   OWNER   │
    │           │                                         │           │
    └───────────┘                                         └───────────┘
```

### 2.2 Level 1 - Main Processes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DFD LEVEL 1 - MAIN PROCESSES                       │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ┌───────────┐
                                    │   CLERK   │
                                    └─────┬─────┘
                                          │
                           Meter Readings │
                           (Present Reading)
                                          │
                                          ▼
                              ┌───────────────────┐
                              │  1.0 PROCESS      │
                              │  METER READINGS   │
                              │                   │
                              │ - Validate reading│
                              │ - Calculate usage │
                              │ - Store in DB     │
                              └─────────┬─────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
  ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
  │ D1: ELECTRIC  │           │ D2: WATER     │           │ D3: UNITS     │
  │    READINGS   │           │    READINGS   │           │    MASTER     │
  └───────────────┘           └───────────────┘           └───────────────┘
          │                             │                             │
          └─────────────────────────────┼─────────────────────────────┘
                                        │
                                        ▼
                              ┌───────────────────┐
                              │  2.0 GENERATE     │
                              │  BILLS            │
                              │                   │
                              │ - Electric calc   │
                              │ - Water calc      │
                              │ - Dues calc       │
                              │ - Penalty calc    │
                              └─────────┬─────────┘
                                        │
                                        ▼
                              ┌───────────────────┐
                              │ D4: BILLS         │
                              │                   │
                              │ Bill Number       │
                              │ Components        │
                              │ Total Amount      │
                              │ Status            │
                              └─────────┬─────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
┌───────────────────┐         ┌───────────────────┐         ┌───────────────────┐
│  3.0 GENERATE     │         │  4.0 PROCESS      │         │  5.0 GENERATE     │
│  STATEMENTS       │         │  PAYMENTS         │         │  REPORTS          │
│                   │         │                   │         │                   │
│ - Create SOA PDF  │         │ - Validate        │         │ - Billing Summary │
│ - Send to Owner   │         │ - Allocate to Bill│         │ - Collection Rpt  │
└─────────┬─────────┘         │ - Update Status   │         │ - Aging Report    │
          │                   └─────────┬─────────┘         └─────────┬─────────┘
          │                             │                             │
          ▼                             ▼                             ▼
    ┌───────────┐               ┌───────────────┐               ┌───────────┐
    │   OWNER   │               │ D5: PAYMENTS  │               │ ACCOUNTANT│
    │           │               │               │               │           │
    │  (SOA)    │               │ Amount, Date  │               │ (Reports) │
    └───────────┘               │ Method, OR#   │               └───────────┘
                                │ Allocation    │
                                └───────────────┘
```

### 2.3 Level 2 - Bill Generation Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DFD LEVEL 2 - BILL GENERATION PROCESS                     │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
     │ D1: ELECTRIC  │   │ D2: WATER     │   │ D3: UNITS     │
     │    READINGS   │   │    READINGS   │   │    MASTER     │
     └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
             │                   │                   │
             │ Previous &        │ Previous &        │ Area (sqm)
             │ Present Reading   │ Present Reading   │ Unit Type
             │                   │                   │
             ▼                   ▼                   ▼
     ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
     │ 2.1 CALCULATE │   │ 2.2 CALCULATE │   │ 2.3 CALCULATE │
     │ ELECTRIC      │   │ WATER         │   │ ASSOC DUES    │
     │               │   │               │   │               │
     │ Consumption   │   │ Consumption   │   │ Area × ₱60    │
     │ × ₱8.39       │   │ → Tier Rate   │   │               │
     │ Min: ₱50      │   │ (14 tiers)    │   │               │
     └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
             │                   │                   │
             │ Electric Amount   │ Water Amount      │ Dues Amount
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ 2.4 CHECK     │
                         │ PREVIOUS      │
                         │ BALANCE       │◄────┐
                         └───────┬───────┘     │
                                 │             │
                                 ▼             │
                         ┌───────────────┐     │ Previous
                         │ 2.5 CALCULATE │     │ Unpaid
                         │ PENALTY       │     │ Bills
                         │               │     │
                         │ 10% compound  │     │
                         │ monthly       │     │
                         └───────┬───────┘     │
                                 │             │
                                 │             │
             ┌───────────────────┼─────────────┘
             │                   │
             ▼                   ▼
     ┌───────────────┐   ┌───────────────┐
     │ D4: BILLS     │   │ D6: TENANT    │
     │               │   │    SETTINGS   │
     │ Total =       │   │               │
     │ E+W+D+Prev+P  │   │ Rates, Tiers  │
     └───────────────┘   └───────────────┘
```

---

## 3. OPERATIONS MANUAL

### 3.1 Getting Started

#### Login Credentials (After Seeding)
```
URL:      http://localhost:3000
Email:    admin@megatower.com
Password: Admin@123456
Role:     SUPER_ADMIN
```

#### First-Time Setup
1. Start the development server: `npm run dev`
2. Access: http://localhost:3000
3. Login with admin credentials
4. Verify seeded data is present

### 3.2 Monthly Billing Cycle Operations

#### Step 1: Enter Meter Readings (26th of Month)

**Navigation:** Dashboard → Readings → Electric Readings / Water Readings

**For Each Unit:**
1. Select the unit from the list
2. Enter the **Present Reading** from the meter
3. System automatically:
   - Retrieves previous reading
   - Calculates consumption (Present - Previous)
4. Add remarks if needed
5. Click **Save**

**Tips:**
- Present reading must be ≥ previous reading
- If meter was replaced, add note in remarks
- Can filter units by floor for easier entry

#### Step 2: Generate Bills (27th of Month)

**Navigation:** Dashboard → Billing → Generate Bills

**Process:**
1. Select **Billing Period** (e.g., "January 2025")
2. Click **Preview** to see calculations without saving
3. Review the preview:
   - Check for missing readings (warnings shown)
   - Verify amounts look reasonable
4. Click **Generate Bills** to create actual bills
5. System generates bill numbers: `MT-YYYYMM-XXXX`

**What Gets Calculated:**
- Electric: consumption × ₱8.39 (min ₱50)
- Water: tiered based on consumption and unit type
- Association Dues: area × ₱60
- Previous Balance: from unpaid bills
- Penalty: 10% compound on overdue amounts

#### Step 3: Send Statements (5th-10th of Month)

**Navigation:** Dashboard → Billing → Statement of Account

**Process:**
1. Select billing period
2. Click **Generate SOA** for individual unit or **Generate All**
3. Print or export to PDF
4. Distribute to unit owners

**SOA Contents:**
- Owner and unit details
- Current month charges breakdown
- Past due amounts
- Payment history
- Total amount due
- Due date

#### Step 4: Record Payments (Ongoing)

**Navigation:** Dashboard → Payments → New Payment

**Required Information:**
1. **Unit/Owner**: Select from dropdown
2. **Payment Date**: Date received
3. **Amount**: Amount paid
4. **Payment Method**: Cash, Check, Bank Transfer, GCash, PayMaya
5. **Reference Number**: OR#, Check#, or Transaction#

**Payment Allocation:**
- System uses OLDEST_FIRST (FIFO) by default
- Allocates proportionally across bill components
- Excess becomes advance payment/credit

**After Recording:**
- Bill status updates automatically:
  - UNPAID → PARTIAL (partial payment)
  - PARTIAL → PAID (full payment)
  - OVERDUE → PARTIAL/PAID

#### Step 5: Month-End Reports

**Navigation:** Dashboard → Reports

**Available Reports:**
1. **Billing Summary**: All bills for the period
2. **Collection Report**: Payments received
3. **Aging Report**: Overdue accounts by age
4. **Floor Summary**: Totals per floor

### 3.3 Handling Special Cases

#### Case: Meter Replacement
1. Enter meter readings as usual
2. Add remark: "Meter replaced - old reading: XXXX, new meter starts at: 0"
3. If previous reading needs adjustment, contact admin

#### Case: Partial Payment
1. Record the payment normally
2. System marks bill as PARTIAL
3. Remaining balance carries to next month
4. Penalty applies only to overdue portion

#### Case: Advance Payment
1. Record payment exceeding current bill
2. Excess stored as credit
3. Applied to future bills automatically

#### Case: Disconnection Warning
1. Check aging report for accounts >60 days
2. Generate disconnection notice
3. Follow up before disconnection

---

## 4. SEEDED DATA REFERENCE

### 4.1 Default Tenant
```
Name:    Mega Tower Residences
Address: Megatower Residences I, Ground Floor, Property Management Office
         Corner Tecson, Sandico St., Salud Mitra, Baguio City, Philippines
Phone:   (074) 661-02-61
Email:   megatowerpmobillings@gmail.com
```

### 4.2 Rate Settings
| Item | Rate | Unit |
|------|------|------|
| Electric Rate | ₱8.39 | per kWh |
| Electric Minimum | ₱50.00 | flat |
| Association Dues | ₱60.00 | per sqm |
| Penalty Rate | 10% | per month (compound) |

### 4.3 Water Tiers - Residential
| Tier | Range | Rate/Formula |
|------|-------|--------------|
| 1 | 0-1 cu.m | ₱80 fixed |
| 2 | 2-5 cu.m | ₱200 fixed |
| 3 | 6-10 cu.m | ₱370 fixed |
| 4 | 11-20 cu.m | (cons-10)×₱40+₱370 |
| 5 | 21-30 cu.m | (cons-20)×₱45+₱770 |
| 6 | 31-40 cu.m | (cons-30)×₱50+₱1,220 |
| 7 | 41+ cu.m | (cons-40)×₱55+₱1,720 |

### 4.4 Water Tiers - Commercial
| Tier | Range | Rate/Formula |
|------|-------|--------------|
| 1 | 0-1 cu.m | ₱200 fixed |
| 2 | 2-5 cu.m | ₱250 fixed |
| 3 | 6-10 cu.m | ₱740 fixed |
| 4 | 11-20 cu.m | (cons-10)×₱55+₱740 |
| 5 | 21-30 cu.m | (cons-20)×₱60+₱1,290 |
| 6 | 31-40 cu.m | (cons-30)×₱65+₱1,890 |
| 7 | 41+ cu.m | (cons-40)×₱85+₱2,540 |

### 4.5 Sample Units (Seeded)

| Unit | Floor | Type | Area | Owner |
|------|-------|------|------|-------|
| GF-1 | GF | Commercial | 34.5 sqm | Retuta |
| GF-2 | GF | Commercial | 35.0 sqm | Chua |
| GF-3 | GF | Commercial | 48.5 sqm | HomeAsia Corp |
| GF-6 | GF | Residential | 25.5 sqm | Juan Dela Cruz |
| 2F-1 | 2F | Residential | 45.0 sqm | Maria Santos |
| 3F-1 | 3F | Residential | 41.0 sqm | Pedro Reyes |
| 4F-1 | 4F | Residential | 38.0 sqm | Ana Garcia |
| 5F-1 | 5F | Residential | 52.0 sqm | Jose Mendoza |
| 6F-1 | 6F | Residential | 58.5 sqm | Carmen Lopez |

---

## 5. SAMPLE GOOD ACCOUNTS

### 5.1 Account A: Small Residential Unit (Always Pays On Time)
```
Unit:       GF-6 (Juan Dela Cruz)
Type:       Residential
Area:       25.5 sqm
Profile:    Single occupant, low usage, excellent payer
```

### 5.2 Account B: Medium Residential Unit (Regular Family)
```
Unit:       2F-1 (Maria Santos)
Type:       Residential
Area:       45.0 sqm
Profile:    Family of 4, moderate usage, pays on time
```

### 5.3 Account C: Large Residential Unit (High Usage)
```
Unit:       6F-1 (Carmen Lopez)
Type:       Residential
Area:       58.5 sqm
Profile:    Extended family, higher usage, pays on time
```

### 5.4 Account D: Commercial Unit (Business)
```
Unit:       GF-3 (HomeAsia Corp)
Type:       Commercial
Area:       48.5 sqm
Profile:    Real estate office, high water usage
```

### 5.5 Account E: Problem Account (For Penalty Testing)
```
Unit:       3F-1 (Pedro Reyes)
Type:       Residential
Area:       41.0 sqm
Profile:    Irregular payer, accumulates penalties
```

---

## 6. MONTH-BY-MONTH BILLING COMPUTATIONS

### 6.1 ACCOUNT A (GF-6 Juan Dela Cruz) - Good Payer

#### JANUARY 2025 BILL

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 5,000 | 5,045 | 45 kWh |
| Water | 100 | 103 | 3 cu.m |

**Calculations:**
```
ELECTRIC:
  Consumption: 45 kWh
  Calculation: 45 × ₱8.39 = ₱377.55
  Min Check: ₱377.55 > ₱50 ✓
  ELECTRIC AMOUNT: ₱377.55

WATER (Residential, Tier 2):
  Consumption: 3 cu.m
  Tier Check: 3 > 1 AND 3 < 6 → Tier 2
  WATER AMOUNT: ₱200.00

ASSOCIATION DUES:
  Area: 25.5 sqm
  Calculation: 25.5 × ₱60 = ₱1,530.00
  DUES AMOUNT: ₱1,530.00

PREVIOUS BALANCE: ₱0.00
PENALTY: ₱0.00

═══════════════════════════════════════
TOTAL BILL (January 2025): ₱2,107.55
═══════════════════════════════════════
```

**Payment Record:**
- Payment Date: January 15, 2025
- Amount Paid: ₱2,107.55
- Status: PAID
- Balance: ₱0.00

---

#### FEBRUARY 2025 BILL

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 5,045 | 5,095 | 50 kWh |
| Water | 103 | 106 | 3 cu.m |

**Calculations:**
```
ELECTRIC:
  Consumption: 50 kWh
  Calculation: 50 × ₱8.39 = ₱419.50
  ELECTRIC AMOUNT: ₱419.50

WATER (Residential, Tier 2):
  Consumption: 3 cu.m
  WATER AMOUNT: ₱200.00

ASSOCIATION DUES:
  DUES AMOUNT: ₱1,530.00

PREVIOUS BALANCE: ₱0.00
PENALTY: ₱0.00

═══════════════════════════════════════
TOTAL BILL (February 2025): ₱2,149.50
═══════════════════════════════════════
```

**Payment:** Paid on time - Status: PAID

---

#### MARCH 2025 BILL

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 5,095 | 5,140 | 45 kWh |
| Water | 106 | 111 | 5 cu.m |

**Calculations:**
```
ELECTRIC:
  Consumption: 45 kWh
  Calculation: 45 × ₱8.39 = ₱377.55
  ELECTRIC AMOUNT: ₱377.55

WATER (Residential, Tier 2):
  Consumption: 5 cu.m
  Tier Check: 5 > 1 AND 5 < 6 → Tier 2 (BOUNDARY CASE!)
  WATER AMOUNT: ₱200.00

ASSOCIATION DUES:
  DUES AMOUNT: ₱1,530.00

═══════════════════════════════════════
TOTAL BILL (March 2025): ₱2,107.55
═══════════════════════════════════════
```

---

### 6.2 ACCOUNT B (2F-1 Maria Santos) - Family Unit

#### JANUARY 2025 BILL

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 8,000 | 8,180 | 180 kWh |
| Water | 200 | 218 | 18 cu.m |

**Calculations:**
```
ELECTRIC:
  Consumption: 180 kWh
  Calculation: 180 × ₱8.39 = ₱1,510.20
  ELECTRIC AMOUNT: ₱1,510.20

WATER (Residential, Tier 4):
  Consumption: 18 cu.m
  Tier Check: 18 > 10 AND 18 < 21 → Tier 4
  Formula: (18 - 10) × ₱40 + ₱370
         = 8 × ₱40 + ₱370
         = ₱320 + ₱370
  WATER AMOUNT: ₱690.00

ASSOCIATION DUES:
  Area: 45.0 sqm
  Calculation: 45 × ₱60 = ₱2,700.00
  DUES AMOUNT: ₱2,700.00

═══════════════════════════════════════
TOTAL BILL (January 2025): ₱4,900.20
═══════════════════════════════════════
```

---

#### FEBRUARY 2025 BILL

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 8,180 | 8,350 | 170 kWh |
| Water | 218 | 240 | 22 cu.m |

**Calculations:**
```
ELECTRIC:
  Consumption: 170 kWh
  Calculation: 170 × ₱8.39 = ₱1,426.30
  ELECTRIC AMOUNT: ₱1,426.30

WATER (Residential, Tier 5):
  Consumption: 22 cu.m
  Tier Check: 22 > 20 AND 22 < 31 → Tier 5
  Formula: (22 - 20) × ₱45 + ₱770
         = 2 × ₱45 + ₱770
         = ₱90 + ₱770
  WATER AMOUNT: ₱860.00

ASSOCIATION DUES:
  DUES AMOUNT: ₱2,700.00

═══════════════════════════════════════
TOTAL BILL (February 2025): ₱4,986.30
═══════════════════════════════════════
```

---

### 6.3 ACCOUNT C (6F-1 Carmen Lopez) - High Usage

#### JANUARY 2025 BILL

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 12,000 | 12,320 | 320 kWh |
| Water | 500 | 535 | 35 cu.m |

**Calculations:**
```
ELECTRIC:
  Consumption: 320 kWh
  Calculation: 320 × ₱8.39 = ₱2,684.80
  ELECTRIC AMOUNT: ₱2,684.80

WATER (Residential, Tier 6):
  Consumption: 35 cu.m
  Tier Check: 35 > 30 AND 35 < 41 → Tier 6
  Formula: (35 - 30) × ₱50 + ₱1,220
         = 5 × ₱50 + ₱1,220
         = ₱250 + ₱1,220
  WATER AMOUNT: ₱1,470.00

ASSOCIATION DUES:
  Area: 58.5 sqm
  Calculation: 58.5 × ₱60 = ₱3,510.00
  DUES AMOUNT: ₱3,510.00

═══════════════════════════════════════
TOTAL BILL (January 2025): ₱7,664.80
═══════════════════════════════════════
```

---

### 6.4 ACCOUNT D (GF-3 HomeAsia) - Commercial

#### JANUARY 2025 BILL

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 20,000 | 20,450 | 450 kWh |
| Water | 800 | 828 | 28 cu.m |

**Calculations:**
```
ELECTRIC:
  Consumption: 450 kWh
  Calculation: 450 × ₱8.39 = ₱3,775.50
  ELECTRIC AMOUNT: ₱3,775.50

WATER (COMMERCIAL, Tier 5):
  Consumption: 28 cu.m
  Tier Check: 28 > 20 AND 28 < 31 → Tier 5
  Formula: (28 - 20) × ₱60 + ₱1,290  ← COMMERCIAL RATES!
         = 8 × ₱60 + ₱1,290
         = ₱480 + ₱1,290
  WATER AMOUNT: ₱1,770.00

ASSOCIATION DUES:
  Area: 48.5 sqm
  Calculation: 48.5 × ₱60 = ₱2,910.00
  DUES AMOUNT: ₱2,910.00

═══════════════════════════════════════
TOTAL BILL (January 2025): ₱8,455.50
═══════════════════════════════════════
```

---

### 6.5 ACCOUNT E (3F-1 Pedro Reyes) - PENALTY DEMONSTRATION

This account demonstrates compounding penalty calculation over 3 months of non-payment.

#### JANUARY 2025 BILL (UNPAID)

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 6,000 | 6,120 | 120 kWh |
| Water | 300 | 315 | 15 cu.m |

**Calculations:**
```
ELECTRIC:
  120 × ₱8.39 = ₱1,006.80

WATER (Residential, Tier 4):
  (15 - 10) × ₱40 + ₱370 = ₱570.00

ASSOCIATION DUES:
  41 × ₱60 = ₱2,460.00

═══════════════════════════════════════
JANUARY BILL (Principal): ₱4,036.80
STATUS: UNPAID → OVERDUE
═══════════════════════════════════════
```

---

#### FEBRUARY 2025 BILL (UNPAID)

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 6,120 | 6,230 | 110 kWh |
| Water | 315 | 327 | 12 cu.m |

**Current Month Charges:**
```
ELECTRIC: 110 × ₱8.39 = ₱922.90
WATER: (12 - 10) × ₱40 + ₱370 = ₱450.00
DUES: 41 × ₱60 = ₱2,460.00
FEBRUARY PRINCIPAL: ₱3,832.90
```

**Penalty Calculation (Month 1 of January being overdue):**
```
January Principal: ₱4,036.80
Month 1 Penalty: ₱4,036.80 × 10% = ₱403.68

JANUARY WITH PENALTY: ₱4,036.80 + ₱403.68 = ₱4,440.48
```

**February Bill Total:**
```
Current Month (February):     ₱3,832.90
Previous Balance (January):   ₱4,036.80
Penalty (January - Month 1):  ₱403.68
═══════════════════════════════════════
TOTAL DUE (February 2025):    ₱8,273.38
STATUS: UNPAID
═══════════════════════════════════════
```

---

#### MARCH 2025 BILL (UNPAID)

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 6,230 | 6,350 | 120 kWh |
| Water | 327 | 341 | 14 cu.m |

**Current Month Charges:**
```
ELECTRIC: 120 × ₱8.39 = ₱1,006.80
WATER: (14 - 10) × ₱40 + ₱370 = ₱530.00
DUES: 41 × ₱60 = ₱2,460.00
MARCH PRINCIPAL: ₱3,996.80
```

**COMPOUNDING PENALTY CALCULATION:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PENALTY BREAKDOWN (Ma'am Rose Formula)                    │
└─────────────────────────────────────────────────────────────────────────────┘

Month    │ Principal │  10% P   │ Sum w/Prev │ Compound  │ Total Int
─────────┼───────────┼──────────┼────────────┼───────────┼──────────
January  │ ₱4,036.80 │ ₱403.68  │     -      │     -     │ ₱403.68
February │ ₱3,832.90 │ ₱383.29  │ ₱786.97    │ ₱78.70    │ ₱865.67

CALCULATION TRACE:
═══════════════════════════════════════════════════════════════════

MONTH 1 (January overdue):
  10% P = ₱4,036.80 × 10% = ₱403.68
  Total Interest = ₱403.68

MONTH 2 (January + February overdue):
  10% P (Feb) = ₱3,832.90 × 10% = ₱383.29
  Sum w/ Prev Interest = ₱403.68 + ₱383.29 = ₱786.97
  Compound Interest = ₱786.97 × 10% = ₱78.70
  Total Interest = ₱786.97 + ₱78.70 = ₱865.67

ACCUMULATED PENALTY: ₱865.67
```

**March Bill Summary:**
```
═══════════════════════════════════════════════════════════════════
                    MARCH 2025 STATEMENT
═══════════════════════════════════════════════════════════════════

CURRENT CHARGES (March 2025):
  Electric:              ₱1,006.80
  Water:                   ₱530.00
  Association Dues:      ₱2,460.00
  Subtotal:              ₱3,996.80

PAST DUE AMOUNTS:
  January 2025:          ₱4,036.80
  February 2025:         ₱3,832.90
  Subtotal Past Due:     ₱7,869.70

PENALTY (10% Compounding):
  Total Penalty:           ₱865.67

═══════════════════════════════════════════════════════════════════
TOTAL AMOUNT DUE:       ₱12,732.17
═══════════════════════════════════════════════════════════════════
```

---

#### APRIL 2025 BILL (Still Unpaid - 3 Months Overdue)

**Meter Readings:**
| Type | Previous | Present | Consumption |
|------|----------|---------|-------------|
| Electric | 6,350 | 6,460 | 110 kWh |
| Water | 341 | 353 | 12 cu.m |

**Current Month Charges:**
```
ELECTRIC: 110 × ₱8.39 = ₱922.90
WATER: (12 - 10) × ₱40 + ₱370 = ₱450.00
DUES: 41 × ₱60 = ₱2,460.00
APRIL PRINCIPAL: ₱3,832.90
```

**COMPOUNDING PENALTY CALCULATION (3 Months):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               PENALTY BREAKDOWN - 3 MONTHS OVERDUE                           │
└─────────────────────────────────────────────────────────────────────────────┘

Month     │ Principal  │  10% P   │ Sum w/Prev │ Compound  │ Total Int
──────────┼────────────┼──────────┼────────────┼───────────┼───────────
January   │ ₱4,036.80  │ ₱403.68  │     -      │     -     │ ₱403.68
February  │ ₱3,832.90  │ ₱383.29  │ ₱786.97    │ ₱78.70    │ ₱865.67
March     │ ₱3,996.80  │ ₱399.68  │ ₱1,265.35  │ ₱126.54   │ ₱1,391.89

CALCULATION TRACE:
═══════════════════════════════════════════════════════════════════

MONTH 3 (Jan + Feb + Mar overdue):
  Previous Total Interest = ₱865.67
  10% P (Mar) = ₱3,996.80 × 10% = ₱399.68
  Sum w/ Prev Interest = ₱865.67 + ₱399.68 = ₱1,265.35
  Compound Interest = ₱1,265.35 × 10% = ₱126.54
  Total Interest = ₱1,265.35 + ₱126.54 = ₱1,391.89

ACCUMULATED PENALTY: ₱1,391.89
```

**April Bill Summary:**
```
═══════════════════════════════════════════════════════════════════
                    APRIL 2025 STATEMENT
═══════════════════════════════════════════════════════════════════

CURRENT CHARGES (April 2025):
  Electric:              ₱922.90
  Water:                 ₱450.00
  Association Dues:    ₱2,460.00
  Subtotal:            ₱3,832.90

PAST DUE AMOUNTS:
  January 2025:        ₱4,036.80
  February 2025:       ₱3,832.90
  March 2025:          ₱3,996.80
  Subtotal Past Due:  ₱11,866.50

PENALTY (10% Compounding - 3 Months):
  Total Penalty:       ₱1,391.89

═══════════════════════════════════════════════════════════════════
TOTAL AMOUNT DUE:     ₱17,091.29
═══════════════════════════════════════════════════════════════════
```

---

### 6.6 SPECIAL BOUNDARY TEST CASES

These verify edge cases in the water tier calculations:

#### Test Case 1: Exactly 5 cu.m (Boundary)
```
Consumption: 5 cu.m
Expected Tier: 2 (NOT Tier 3!)
Excel Formula Check: J=5, J<6 is TRUE → Tier 2
Expected Amount (Residential): ₱200.00
```

#### Test Case 2: Exactly 6 cu.m (Boundary)
```
Consumption: 6 cu.m
Expected Tier: 3
Excel Formula Check: J=6, J>5 AND J<11 is TRUE → Tier 3
Expected Amount (Residential): ₱370.00
```

#### Test Case 3: Exactly 10 cu.m (Boundary)
```
Consumption: 10 cu.m
Expected Tier: 3 (NOT Tier 4!)
Excel Formula Check: J=10, J<11 is TRUE → Tier 3
Expected Amount (Residential): ₱370.00
```

#### Test Case 4: Exactly 11 cu.m (Boundary)
```
Consumption: 11 cu.m
Expected Tier: 4
Formula: (11-10) × ₱40 + ₱370 = ₱410.00
```

#### Test Case 5: High Commercial Usage (125 cu.m)
```
Consumption: 125 cu.m (Commercial)
Tier: 7 (>40)
Formula: (125-40) × ₱85 + ₱2,540
       = 85 × ₱85 + ₱2,540
       = ₱7,225 + ₱2,540
Expected Amount: ₱9,765.00
```

#### Test Case 6: Minimum Electric (3 kWh)
```
Consumption: 3 kWh
Calculation: 3 × ₱8.39 = ₱25.17
Min Check: ₱25.17 < ₱50
Expected Amount: ₱50.00 (minimum)
```

#### Test Case 7: Zero Consumption
```
Electric: 0 kWh → ₱50.00 (minimum)
Water (Res): 0 cu.m → ₱80.00 (Tier 1)
Water (Com): 0 cu.m → ₱200.00 (Tier 1)
```

---

## 7. PAYMENT ALLOCATION EXAMPLES

This section demonstrates how payments are allocated across bills and bill components.

### 7.1 Payment Allocation Strategies

The system supports 3 allocation strategies:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **OLDEST_FIRST (FIFO)** | Pays oldest unpaid bills first | Default - ensures oldest debts cleared |
| **NEWEST_FIRST (LIFO)** | Pays newest bills first | When current month is priority |
| **MANUAL** | User specifies exact allocation | Special arrangements |

### 7.2 Proportional Allocation Formula

When a payment is applied to a bill, it's split **proportionally** across components:

```
Ratio = Payment Amount / Total Unpaid Balance

Electric Allocated = Unpaid Electric × Ratio
Water Allocated    = Unpaid Water × Ratio
Dues Allocated     = Unpaid Dues × Ratio
Penalty Allocated  = Unpaid Penalty × Ratio
Other Allocated    = Unpaid Other × Ratio
```

---

### 7.3 EXAMPLE 1: Full Payment on Single Bill

**Scenario:** Account A (GF-6 Juan Dela Cruz) pays January 2025 bill in full

**Bill Details:**
```
Bill Number: MT-202501-0006
Billing Month: January 2025
Status: UNPAID

Components:
  Electric:         ₱377.55
  Water:            ₱200.00
  Association Dues: ₱1,530.00
  Penalty:          ₱0.00
  Other:            ₱0.00
  ─────────────────────────
  TOTAL:            ₱2,107.55
```

**Payment Received:**
```
Payment Date: January 15, 2025
Amount: ₱2,107.55
Method: CASH
OR Number: 001-2025
```

**Allocation Result:**
```
┌──────────────────────────────────────────────────────────────────┐
│                    PAYMENT ALLOCATION RECEIPT                     │
├──────────────────────────────────────────────────────────────────┤
│ Payment Amount:        ₱2,107.55                                 │
│ Applied to Bill:       MT-202501-0006                            │
├──────────────────────────────────────────────────────────────────┤
│ COMPONENT ALLOCATION:                                            │
│   Electric:            ₱377.55  (100% of ₱377.55 unpaid)        │
│   Water:               ₱200.00  (100% of ₱200.00 unpaid)        │
│   Association Dues:    ₱1,530.00 (100% of ₱1,530.00 unpaid)     │
│   Penalty:             ₱0.00                                     │
│   Other:               ₱0.00                                     │
│   ─────────────────────────────────────────────────────────────  │
│   TOTAL ALLOCATED:     ₱2,107.55                                 │
├──────────────────────────────────────────────────────────────────┤
│ Bill Status: UNPAID → PAID                                       │
│ Remaining Balance: ₱0.00                                         │
│ Advance Credit: ₱0.00                                            │
└──────────────────────────────────────────────────────────────────┘
```

---

### 7.4 EXAMPLE 2: Partial Payment (50%)

**Scenario:** Account B (2F-1 Maria Santos) makes partial payment

**Bill Details:**
```
Bill Number: MT-202501-0010
Billing Month: January 2025
Status: UNPAID

Components:
  Electric:         ₱1,510.20
  Water:            ₱690.00
  Association Dues: ₱2,700.00
  Penalty:          ₱0.00
  Other:            ₱0.00
  ─────────────────────────
  TOTAL:            ₱4,900.20
```

**Payment Received:**
```
Payment Date: January 20, 2025
Amount: ₱2,500.00 (partial)
Method: GCASH
Reference: 7891234567890
```

**Proportional Calculation:**
```
Ratio = ₱2,500.00 / ₱4,900.20 = 0.5102 (51.02%)

Electric:  ₱1,510.20 × 0.5102 = ₱770.50
Water:     ₱690.00 × 0.5102   = ₱352.04
Dues:      ₱2,700.00 × 0.5102 = ₱1,377.46
                               ─────────
Total:                         ₱2,500.00
```

**Allocation Result:**
```
┌──────────────────────────────────────────────────────────────────┐
│                    PAYMENT ALLOCATION RECEIPT                     │
├──────────────────────────────────────────────────────────────────┤
│ Payment Amount:        ₱2,500.00                                 │
│ Applied to Bill:       MT-202501-0010                            │
├──────────────────────────────────────────────────────────────────┤
│ COMPONENT ALLOCATION (Proportional 51.02%):                      │
│                        Allocated    Remaining                    │
│   Electric:            ₱770.50      ₱739.70                     │
│   Water:               ₱352.04      ₱337.96                     │
│   Association Dues:    ₱1,377.46    ₱1,322.54                   │
│   Penalty:             ₱0.00        ₱0.00                       │
│   Other:               ₱0.00        ₱0.00                       │
│   ─────────────────────────────────────────────────────────────  │
│   TOTAL:               ₱2,500.00    ₱2,400.20                   │
├──────────────────────────────────────────────────────────────────┤
│ Bill Status: UNPAID → PARTIAL                                    │
│ Remaining Balance: ₱2,400.20                                     │
└──────────────────────────────────────────────────────────────────┘
```

**Second Payment (Remaining Balance):**
```
Payment Date: January 25, 2025
Amount: ₱2,400.20
Method: CASH
OR Number: 015-2025
```

**Final Allocation:**
```
┌──────────────────────────────────────────────────────────────────┐
│ Payment Amount:        ₱2,400.20                                 │
│ Applied to Bill:       MT-202501-0010                            │
├──────────────────────────────────────────────────────────────────┤
│ COMPONENT ALLOCATION (100% of remaining):                        │
│   Electric:            ₱739.70                                   │
│   Water:               ₱337.96                                   │
│   Association Dues:    ₱1,322.54                                 │
│   ─────────────────────────────────────────────────────────────  │
│   TOTAL:               ₱2,400.20                                 │
├──────────────────────────────────────────────────────────────────┤
│ Bill Status: PARTIAL → PAID                                      │
│ Remaining Balance: ₱0.00                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

### 7.5 EXAMPLE 3: Multiple Bills - OLDEST_FIRST (FIFO)

**Scenario:** Account E (3F-1 Pedro Reyes) has 3 unpaid bills and makes partial payment

**Outstanding Bills:**
```
Bill #1: MT-202501-0015 (January 2025) - OVERDUE
  Electric: ₱1,006.80, Water: ₱570.00, Dues: ₱2,460.00
  Penalty: ₱403.68
  TOTAL: ₱4,440.48

Bill #2: MT-202502-0015 (February 2025) - OVERDUE
  Electric: ₱922.90, Water: ₱450.00, Dues: ₱2,460.00
  Penalty: ₱383.29 + ₱78.70 compound = ₱462.00
  TOTAL: ₱4,294.90

Bill #3: MT-202503-0015 (March 2025) - UNPAID
  Electric: ₱1,006.80, Water: ₱530.00, Dues: ₱2,460.00
  Penalty: ₱0.00 (current month)
  TOTAL: ₱3,996.80

═══════════════════════════════════════
TOTAL OUTSTANDING: ₱12,732.17
═══════════════════════════════════════
```

**Payment Received:**
```
Payment Date: March 25, 2025
Amount: ₱5,000.00
Method: BANK_TRANSFER
Reference: BTF-20250325-001
Strategy: OLDEST_FIRST
```

**Allocation Process (FIFO):**
```
Step 1: Apply to Bill #1 (January - oldest)
  Bill Total: ₱4,440.48
  Payment Applied: ₱4,440.48 (full)
  Remaining Payment: ₱5,000.00 - ₱4,440.48 = ₱559.52
  Bill Status: PAID ✓

Step 2: Apply remaining to Bill #2 (February)
  Bill Total: ₱4,294.90
  Payment Available: ₱559.52
  Payment Applied: ₱559.52 (partial - 13.03% of bill)
  Remaining Payment: ₱0.00
  Bill Status: PARTIAL
```

**Allocation Details for Bill #2:**
```
Ratio = ₱559.52 / ₱4,294.90 = 0.1303 (13.03%)

Electric:  ₱922.90 × 0.1303  = ₱120.25
Water:     ₱450.00 × 0.1303  = ₱58.64
Dues:      ₱2,460.00 × 0.1303 = ₱320.54
Penalty:   ₱462.00 × 0.1303  = ₱60.20
                              ─────────
Total:                        ₱559.63 (rounded)
```

**Complete Allocation Result:**
```
┌──────────────────────────────────────────────────────────────────┐
│              PAYMENT ALLOCATION SUMMARY (OLDEST_FIRST)           │
├──────────────────────────────────────────────────────────────────┤
│ Total Payment:         ₱5,000.00                                 │
│ Strategy:              OLDEST_FIRST (FIFO)                       │
├──────────────────────────────────────────────────────────────────┤
│ BILL #1 (MT-202501-0015) - January 2025                         │
│   Amount Applied:      ₱4,440.48                                 │
│   Status:              OVERDUE → PAID ✓                          │
│   Allocation:                                                    │
│     Electric:          ₱1,006.80                                 │
│     Water:             ₱570.00                                   │
│     Dues:              ₱2,460.00                                 │
│     Penalty:           ₱403.68                                   │
├──────────────────────────────────────────────────────────────────┤
│ BILL #2 (MT-202502-0015) - February 2025                        │
│   Amount Applied:      ₱559.52                                   │
│   Status:              OVERDUE → PARTIAL                         │
│   Allocation:                                                    │
│     Electric:          ₱120.25 (₱802.65 remaining)              │
│     Water:             ₱58.64  (₱391.36 remaining)              │
│     Dues:              ₱320.54 (₱2,139.46 remaining)            │
│     Penalty:           ₱60.09  (₱401.91 remaining)              │
│   Remaining Balance:   ₱3,735.38                                 │
├──────────────────────────────────────────────────────────────────┤
│ BILL #3 (MT-202503-0015) - March 2025                           │
│   Amount Applied:      ₱0.00 (no funds remaining)               │
│   Status:              UNPAID (unchanged)                        │
│   Balance:             ₱3,996.80                                 │
├──────────────────────────────────────────────────────────────────┤
│ SUMMARY:                                                         │
│   Bills Fully Paid:    1                                         │
│   Bills Partially Paid: 1                                        │
│   Bills Unpaid:        1                                         │
│   Total Allocated:     ₱5,000.00                                 │
│   Advance Credit:      ₱0.00                                     │
│   Remaining Balance:   ₱7,732.17                                 │
└──────────────────────────────────────────────────────────────────┘
```

---

### 7.6 EXAMPLE 4: Overpayment (Advance Credit)

**Scenario:** Account A (GF-6 Juan Dela Cruz) pays more than the bill amount

**Bill Details:**
```
Bill Number: MT-202502-0006
Billing Month: February 2025
Status: UNPAID
TOTAL: ₱2,149.50
```

**Payment Received:**
```
Payment Date: February 10, 2025
Amount: ₱5,000.00 (overpayment)
Method: CHECK
Check Number: 0012345
Bank: Metrobank
```

**Allocation Result:**
```
┌──────────────────────────────────────────────────────────────────┐
│                    PAYMENT ALLOCATION RECEIPT                     │
├──────────────────────────────────────────────────────────────────┤
│ Payment Amount:        ₱5,000.00                                 │
│ Total Outstanding:     ₱2,149.50                                 │
├──────────────────────────────────────────────────────────────────┤
│ BILL MT-202502-0006:                                             │
│   Amount Applied:      ₱2,149.50                                 │
│   Status:              UNPAID → PAID ✓                           │
│   Allocation:                                                    │
│     Electric:          ₱419.50                                   │
│     Water:             ₱200.00                                   │
│     Association Dues:  ₱1,530.00                                 │
├──────────────────────────────────────────────────────────────────┤
│ ADVANCE PAYMENT CREATED:                                         │
│   Excess Amount:       ₱2,850.50                                 │
│   Status:              CREDIT                                    │
│   Applied to:          Future bills automatically                │
├──────────────────────────────────────────────────────────────────┤
│ NEXT BILL (March 2025) - Preview:                                │
│   Expected Bill:       ~₱2,107.55                                │
│   Available Credit:    ₱2,850.50                                 │
│   Net Due:             ₱0.00 (credit remaining: ~₱742.95)       │
└──────────────────────────────────────────────────────────────────┘
```

**How Advance Credit is Applied:**

When March 2025 bill is generated:
```
March Bill:          ₱2,107.55
Less: Advance Credit ₱2,107.55
═══════════════════════════════
Amount Due:          ₱0.00
Remaining Credit:    ₱742.95 (carries to April)
```

---

### 7.7 EXAMPLE 5: Manual Allocation

**Scenario:** Accountant manually allocates payment to specific components

**Account:** HomeAsia Corp (GF-3) - Commercial
**Bill:** MT-202501-0003

**Bill Details:**
```
Bill Number: MT-202501-0003
Components:
  Electric:         ₱3,775.50
  Water:            ₱1,770.00
  Association Dues: ₱2,910.00
  Penalty:          ₱500.00 (previous)
  ─────────────────────────
  TOTAL:            ₱8,955.50
```

**Manual Allocation Request:**
Owner wants to pay specific components only:
```
Payment Amount: ₱4,680.00
Strategy: MANUAL

Requested Allocation:
  - Electric: ₱3,775.50 (full)
  - Association Dues: ₱904.50 (partial)
  - Water: ₱0.00
  - Penalty: ₱0.00
```

**Allocation Result:**
```
┌──────────────────────────────────────────────────────────────────┐
│                 MANUAL PAYMENT ALLOCATION RECEIPT                 │
├──────────────────────────────────────────────────────────────────┤
│ Payment Amount:        ₱4,680.00                                 │
│ Strategy:              MANUAL                                    │
├──────────────────────────────────────────────────────────────────┤
│ COMPONENT ALLOCATION:                                            │
│                        Requested   Before      After             │
│   Electric:            ₱3,775.50   ₱3,775.50   ₱0.00   ✓ PAID   │
│   Water:               ₱0.00       ₱1,770.00   ₱1,770.00         │
│   Association Dues:    ₱904.50     ₱2,910.00   ₱2,005.50         │
│   Penalty:             ₱0.00       ₱500.00     ₱500.00           │
│   ─────────────────────────────────────────────────────────────  │
│   TOTAL ALLOCATED:     ₱4,680.00                                 │
├──────────────────────────────────────────────────────────────────┤
│ Bill Status: UNPAID → PARTIAL                                    │
│ Remaining Balance: ₱4,275.50                                     │
│   (Water: ₱1,770, Dues: ₱2,005.50, Penalty: ₱500)               │
└──────────────────────────────────────────────────────────────────┘
```

**Validation Rules for Manual Allocation:**
```
✓ Total allocation (₱4,680.00) ≤ Payment amount (₱4,680.00)
✓ Electric allocation (₱3,775.50) ≤ Electric unpaid (₱3,775.50)
✓ Dues allocation (₱904.50) ≤ Dues unpaid (₱2,910.00)
✓ No negative allocations
```

---

### 7.8 EXAMPLE 6: Payment with Penalty Recovery

**Scenario:** Account E fully pays after 3 months overdue

**Outstanding as of April 2025:**
```
Total Principal (Jan+Feb+Mar+Apr): ₱15,699.40
Total Penalty (3 months compound):  ₱1,391.89
═══════════════════════════════════════════════
GRAND TOTAL:                       ₱17,091.29
```

**Full Payment:**
```
Payment Date: April 30, 2025
Amount: ₱17,091.29
Method: CASH
OR Number: 089-2025
```

**Allocation (OLDEST_FIRST):**
```
┌──────────────────────────────────────────────────────────────────┐
│                 FULL PAYMENT - 4 BILLS CLEARED                    │
├──────────────────────────────────────────────────────────────────┤
│ Bill #1: MT-202501-0015 (January) - PAID                         │
│   Principal:     ₱4,036.80                                       │
│   Penalty:       ₱403.68 (Month 1)                              │
│   Subtotal:      ₱4,440.48 ✓                                     │
├──────────────────────────────────────────────────────────────────┤
│ Bill #2: MT-202502-0015 (February) - PAID                        │
│   Principal:     ₱3,832.90                                       │
│   Penalty:       ₱462.00 (Month 2 compound)                     │
│   Subtotal:      ₱4,294.90 ✓                                     │
├──────────────────────────────────────────────────────────────────┤
│ Bill #3: MT-202503-0015 (March) - PAID                           │
│   Principal:     ₱3,996.80                                       │
│   Penalty:       ₱526.22 (Month 3 compound)                     │
│   Subtotal:      ₱4,523.02 ✓                                     │
├──────────────────────────────────────────────────────────────────┤
│ Bill #4: MT-202504-0015 (April) - PAID                           │
│   Principal:     ₱3,832.90                                       │
│   Penalty:       ₱0.00 (current month)                          │
│   Subtotal:      ₱3,832.90 ✓                                     │
├──────────────────────────────────────────────────────────────────┤
│ PAYMENT SUMMARY:                                                 │
│   Total Principals Paid:    ₱15,699.40                          │
│   Total Penalties Paid:     ₱1,391.89                           │
│   ─────────────────────────────────────────────────────────────  │
│   GRAND TOTAL PAID:         ₱17,091.29                          │
│   Account Status:           CURRENT (no balance)                │
└──────────────────────────────────────────────────────────────────┘
```

---

### 7.9 Payment Methods Supported

| Method | Fields Required | Notes |
|--------|-----------------|-------|
| CASH | OR Number | Immediate confirmation |
| CHECK | Check #, Bank, Date | Clearing period applies |
| BANK_TRANSFER | Reference # | May need manual verification |
| GCASH | Reference # | Auto-confirmed |
| PAYMAYA | Reference # | Auto-confirmed |
| CREDIT_CARD | Reference # | Processing fee may apply |
| DEBIT_CARD | Reference # | Same as credit card |

---

### 7.10 Payment Status Flow

```
                    ┌───────────────┐
                    │   PENDING     │
                    │ (recorded but │
                    │ not verified) │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             │             ▼
     ┌───────────────┐     │      ┌───────────────┐
     │  CONFIRMED    │     │      │  CANCELLED    │
     │ (verified &   │     │      │ (bounced      │
     │  applied)     │     │      │  check, etc.) │
     └───────────────┘     │      └───────────────┘
                           │
              Check clearing period
              (2-3 business days)
```

**CHECK Payment Special Handling:**
```
Day 1: Payment recorded (Status: PENDING)
       Bill status unchanged

Day 3: Check cleared (Status: CONFIRMED)
       Bill status updated
       Allocation applied

OR

Day 3: Check bounced (Status: CANCELLED)
       Bill status unchanged
       Penalty may apply
```

---

## 8. VERIFICATION CHECKLIST

### For End Users to Verify

Use this checklist when testing the system with the sample accounts above:

#### Electric Billing Verification
- [ ] Consumption calculated correctly (Present - Previous)
- [ ] Amount = Consumption × ₱8.39
- [ ] Minimum ₱50 applied when consumption × rate < ₱50
- [ ] Zero consumption charges ₱50 minimum

#### Water Billing Verification (Residential)
- [ ] Tier 1: 0-1 cu.m = ₱80 (fixed)
- [ ] Tier 2: 2-5 cu.m = ₱200 (fixed) - **CHECK: 5 cu.m should be ₱200!**
- [ ] Tier 3: 6-10 cu.m = ₱370 (fixed) - **CHECK: 10 cu.m should be ₱370!**
- [ ] Tier 4: 11-20 cu.m = (cons-10)×₱40+₱370
- [ ] Tier 5: 21-30 cu.m = (cons-20)×₱45+₱770
- [ ] Tier 6: 31-40 cu.m = (cons-30)×₱50+₱1,220
- [ ] Tier 7: 41+ cu.m = (cons-40)×₱55+₱1,720

#### Water Billing Verification (Commercial)
- [ ] Uses higher rates (₱200 minimum vs ₱80)
- [ ] Progressive rates higher than residential
- [ ] Commercial units correctly identified

#### Association Dues Verification
- [ ] Amount = Area (sqm) × ₱60
- [ ] Area correct per unit records

#### Penalty Verification
- [ ] Month 1: Principal × 10% (simple)
- [ ] Month 2+: Compounds on accumulated interest
- [ ] Formula: Sum w/ Prev + 10%, then × 10% compound
- [ ] Test Account E matches calculations above

#### Payment Allocation Verification
- [ ] OLDEST_FIRST pays oldest bills first
- [ ] Partial payments update status to PARTIAL
- [ ] Full payments update status to PAID
- [ ] Excess creates advance credit

---

## SUMMARY

This documentation provides:
1. **Visual flow charts** showing system processes
2. **Data flow diagrams** at three levels of detail
3. **Step-by-step operations manual** for daily use
4. **Complete seeded data reference**
5. **5 sample accounts** with different profiles
6. **Month-by-month calculations** with full breakdowns
7. **Detailed payment allocation examples** covering:
   - Full payments
   - Partial payments (50%)
   - Multiple bills with OLDEST_FIRST (FIFO)
   - Overpayment with advance credit
   - Manual allocation
   - Penalty recovery scenarios
8. **Verification checklist** for end-user testing

**Key Points for Testing:**
- Start with Account A (simple, pays on time)
- Progress to Account E (penalty demonstration)
- Verify boundary cases (5 cu.m, 10 cu.m)
- Confirm compounding penalty matches Ma'am Rose's formula
- Commercial vs Residential water rates
- Test payment allocation with partial payments
- Verify advance credit is applied correctly

**Send to End Users:**
- Sections 4-7 contain all sample data, computations, and payment scenarios
- They can manually verify calculations
- Any discrepancies should be reported immediately

**Payment Testing Checklist:**
- [ ] Full payment on single bill → Status: PAID
- [ ] Partial payment → Status: PARTIAL, proportional allocation
- [ ] Multiple bills with FIFO → Oldest bill paid first
- [ ] Overpayment → Advance credit created
- [ ] Advance credit applied to next bill automatically

---

*Document generated for Megatower Billing System testing and verification.*
