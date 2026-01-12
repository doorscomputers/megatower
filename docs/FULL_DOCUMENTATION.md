# Mega Tower Residences - Condominium Billing Management System

## Complete Application Documentation

**Version:** 1.0.0
**Last Updated:** December 2025
**Platform:** Next.js 14 + PostgreSQL + Prisma

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Core Business Logic](#5-core-business-logic)
6. [API Reference](#6-api-reference)
7. [Application Pages](#7-application-pages)
8. [User Roles & Permissions](#8-user-roles--permissions)
9. [Billing Calculations](#9-billing-calculations)
10. [Payment System](#10-payment-system)
11. [Configuration & Settings](#11-configuration--settings)
12. [Development Guide](#12-development-guide)
13. [Deployment](#13-deployment)

---

## 1. Overview

### 1.1 Purpose

The Mega Tower Residences Condominium Billing Management System is a multi-tenant SaaS application designed to handle:

- **Automated Monthly Billing** - Electric, water, and association dues
- **Meter Readings** - Track electric and water consumption per unit
- **Payment Processing** - Multiple payment methods with flexible allocation
- **Statement Generation** - Professional SOA (Statement of Accounts) with PDF export
- **Penalty Calculation** - 10% monthly compounding interest on overdue bills
- **Role-Based Access** - 7 user roles with granular permissions

### 1.2 Key Features

| Feature | Description |
|---------|-------------|
| Multi-Tenant | Complete data isolation per building/condominium |
| 14-Tier Water Billing | 7 residential + 7 commercial tiers with progressive pricing |
| Compounding Penalties | True compound interest (10% monthly on principal + accumulated penalties) |
| Flexible Payment Allocation | FIFO, LIFO, or manual allocation strategies |
| Owner Portal | Unit owners can view their own bills, payments, and SOA |
| Professional PDF Reports | Statement of Accounts, receipts, and reports |
| DevExtreme DataGrid | Enterprise-grade data tables with sorting, filtering, export |

### 1.3 Default Credentials

After running `npm run db:seed`:

```
Email: admin@megatower.com
Password: Admin@123456
Role: SUPER_ADMIN
Tenant: Mega Tower Residences
```

---

## 2. Technology Stack

### 2.1 Core Technologies

| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | Next.js (App Router) | 14.1.0 |
| **Language** | TypeScript | 5.3.3 |
| **Database** | PostgreSQL | 14+ |
| **ORM** | Prisma | 5.9.1 |
| **Authentication** | Better Auth | 1.3.34 |

### 2.2 Frontend Libraries

| Library | Purpose | Version |
|---------|---------|---------|
| React | UI Framework | 18.2.0 |
| Tailwind CSS | Styling | 3.4.1 |
| shadcn/ui | Component Library | - |
| Radix UI | Headless Components | Various |
| Lucide React | Icons | 0.323.0 |
| TanStack Table | Data Tables | 8.11.8 |
| DevExtreme React | Enterprise DataGrid | 25.1.6 |
| Recharts | Charts | 2.11.0 |
| Sonner | Toast Notifications | 1.4.0 |

### 2.3 Form & Validation

| Library | Purpose | Version |
|---------|---------|---------|
| React Hook Form | Form Management | 7.50.0 |
| Zod | Schema Validation | 3.22.4 |
| @hookform/resolvers | Zod Integration | 3.3.4 |

### 2.4 Utilities

| Library | Purpose | Version |
|---------|---------|---------|
| date-fns | Date Manipulation | 3.3.1 |
| jsPDF | PDF Generation | 2.5.1 |
| jsPDF-AutoTable | PDF Tables | 3.8.2 |
| bcryptjs | Password Hashing | 2.4.3 |
| Zustand | State Management | 4.5.0 |
| ExcelJS | Excel Export | 4.4.0 |

---

## 3. Project Structure

```
D:\Megatower\
├── app/                           # Next.js 14 App Router
│   ├── api/                       # API Routes (20 endpoints)
│   │   ├── auth/                  # Better Auth endpoint
│   │   ├── billing/               # Bill CRUD, generation, SOA
│   │   ├── payments/              # Payment CRUD
│   │   ├── readings/              # Meter readings
│   │   ├── units/                 # Unit CRUD
│   │   ├── owners/                # Owner CRUD
│   │   ├── owner/                 # Owner portal endpoints
│   │   └── reports/               # Report generation
│   │
│   ├── billing/                   # Billing pages
│   │   ├── generate/              # Bill generation
│   │   ├── list/                  # Bill listing
│   │   ├── soa/                   # Statement of Accounts
│   │   └── opening-balance/       # Opening balance entry
│   │
│   ├── payments/                  # Payment pages
│   │   ├── record/                # Record new payment
│   │   └── list/                  # Payment listing
│   │
│   ├── readings/                  # Meter reading pages
│   │   ├── electric/              # Electric readings
│   │   └── water/                 # Water readings
│   │
│   ├── units/                     # Unit management
│   ├── owners/                    # Owner management
│   ├── reports/                   # Reports pages
│   ├── dashboard/                 # Admin dashboard
│   ├── owner/                     # Owner portal
│   ├── login/                     # Login page
│   │
│   ├── layout.tsx                 # Root layout
│   ├── providers.tsx              # React providers
│   └── globals.css                # Global styles
│
├── components/
│   ├── ui/                        # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── checkbox.tsx
│   │   ├── textarea.tsx
│   │   ├── popover.tsx
│   │   ├── toaster.tsx
│   │   └── searchable-select.tsx
│   │
│   └── layouts/
│       ├── dashboard-layout.tsx   # Admin layout with sidebar
│       └── owner-layout.tsx       # Owner portal layout
│
├── lib/                           # Business logic
│   ├── calculations/
│   │   ├── water.ts               # 14-tier water calculation
│   │   └── billing.ts             # Electric, dues, penalties
│   │
│   ├── payment-allocation.ts      # FIFO/LIFO/Manual allocation
│   ├── billing-period.ts          # Billing schedule utilities
│   ├── auth.ts                    # Better Auth config
│   ├── auth-client.ts             # Client-side auth
│   ├── prisma.ts                  # Prisma singleton
│   ├── utils.ts                   # Common utilities
│   └── utils/
│       └── owner.ts               # Owner utilities
│
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── seed.ts                    # Initial seed script
│   ├── seed-sample-data.ts        # Sample data for testing
│   └── migrate-to-better-auth.ts  # Migration script
│
├── types/                         # TypeScript types
├── tests/                         # Unit tests
├── e2e/                           # Playwright E2E tests
├── docs/                          # Documentation
├── tasks/                         # Project task tracking
│
├── middleware.ts                  # Auth middleware
├── next.config.js                 # Next.js config
├── tailwind.config.ts             # Tailwind config
├── tsconfig.json                  # TypeScript config
└── package.json                   # Dependencies
```

### 3.1 Path Aliases

Use `@/` prefix for imports:

```typescript
import { Button } from "@/components/ui/button"
import { calculateWaterBill } from "@/lib/calculations/water"
import { prisma } from "@/lib/prisma"
```

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Tenant    │───┬───│    User     │       │   Session   │
└─────────────┘   │   └─────────────┘       └─────────────┘
      │           │          │
      │           │          │
      ▼           │          ▼
┌─────────────┐   │   ┌─────────────┐
│   Owner     │───┼───│   Account   │
└─────────────┘   │   └─────────────┘
      │           │
      │           │
      ▼           │
┌─────────────┐   │   ┌─────────────┐   ┌─────────────┐
│    Unit     │───┴───│    Bill     │───│   Penalty   │
└─────────────┘       └─────────────┘   └─────────────┘
      │                     │
      ├───────────┬─────────┤
      │           │         │
      ▼           ▼         ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ElectricRead │ │ WaterRead   │ │   Payment   │
└─────────────┘ └─────────────┘ └─────────────┘
                                      │
                                      ▼
                              ┌─────────────┐
                              │ BillPayment │
                              └─────────────┘
```

### 4.2 Core Models

#### Tenant

Multi-tenant support - each condo/building is a separate tenant.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| name | String | Building name (e.g., "Mega Tower Residences") |
| address | String? | Building address |
| phone | String? | Contact phone |
| email | String? | Contact email |
| isActive | Boolean | Active status |

**Relations:** users, units, owners, bills, payments, settings

#### User

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| tenantId | String? | Link to tenant |
| email | String | Unique email |
| username | String? | Unique username (lowercase) |
| displayUsername | String? | Original casing username |
| password | String | Bcrypt hashed password |
| role | UserRole | User's role |
| firstName | String | First name |
| lastName | String | Last name |
| phoneNumber | String? | Phone number |
| ownerId | String? | Link to owner (for UNIT_OWNER) |
| isActive | Boolean | Active status |

#### Owner

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| tenantId | String | Link to tenant |
| lastName | String | Last name |
| firstName | String | First name |
| middleName | String? | Middle name |
| email | String? | Email address |
| phone | String? | Phone number |
| address | String? | Mailing address |

**Relations:** user (for portal access), units (can own multiple)

#### Unit

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| tenantId | String | Link to tenant |
| unitNumber | String | Unit number (e.g., "2F-1") |
| floorLevel | String | Floor (GF, 2F, 3F, 4F, 5F, 6F) |
| area | Decimal | Area in sqm |
| unitType | UnitType | RESIDENTIAL or COMMERCIAL |
| ownerId | String? | Link to owner |
| isActive | Boolean | Active status |
| occupancyStatus | OccupancyStatus | Occupancy status |

**Enums:**
- `UnitType`: RESIDENTIAL, COMMERCIAL
- `OccupancyStatus`: OCCUPIED, VACANT, OWNER_OCCUPIED, RENTED

#### ElectricReading / WaterReading

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| unitId | String | Link to unit |
| readingDate | DateTime | Date of reading |
| billingPeriod | DateTime | Billing month |
| previousReading | Decimal | Previous meter value |
| presentReading | Decimal | Current meter value |
| consumption | Decimal | Calculated consumption |
| readBy | String? | User who recorded |
| remarks | String? | Notes |

**Unique Constraint:** (unitId, billingPeriod) - one reading per unit per month

#### Bill

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| tenantId | String | Link to tenant |
| unitId | String | Link to unit |
| billNumber | String | Unique bill number |
| billingMonth | DateTime | Billing month (e.g., 2025-11-01) |
| billingPeriodStart | DateTime | Period start (e.g., Sep 27) |
| billingPeriodEnd | DateTime | Period end (e.g., Oct 26) |
| statementDate | DateTime | Statement date |
| dueDate | DateTime | Payment due date |
| electricAmount | Decimal | Electric charges |
| waterAmount | Decimal | Water charges |
| associationDues | Decimal | Association dues |
| penaltyAmount | Decimal | Penalty charges |
| otherCharges | Decimal | Other charges |
| totalAmount | Decimal | Total bill amount |
| paidAmount | Decimal | Amount paid |
| balance | Decimal | Remaining balance |
| status | BillStatus | Bill status |
| billType | BillType | REGULAR or OPENING_BALANCE |

**Enums:**
- `BillStatus`: UNPAID, PARTIAL, PAID, OVERDUE, CANCELLED
- `BillType`: REGULAR, OPENING_BALANCE

#### Payment

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| tenantId | String | Link to tenant |
| unitId | String | Link to unit |
| orNumber | String? | Official Receipt number |
| arNumber | String? | Acknowledgement Receipt |
| paymentDate | DateTime | Date of payment |
| amount | Decimal | Payment amount |
| paymentMethod | PaymentMethod | Payment method |
| referenceNumber | String? | Reference number |
| checkNumber | String? | Check number (if check) |
| checkDate | DateTime? | Check date |
| bankName | String? | Bank name |
| advanceAmount | Decimal | Advance/credit amount |
| status | PaymentStatus | Payment status |
| receivedBy | String? | Cashier who received |
| remarks | String? | Notes |

**Enums:**
- `PaymentMethod`: CASH, CHECK, BANK_TRANSFER, GCASH, PAYMAYA, CREDIT_CARD, DEBIT_CARD
- `PaymentStatus`: PENDING, CONFIRMED, CANCELLED

**Unique Constraint:** (tenantId, orNumber) - OR# unique per tenant

#### BillPayment (Join Table)

Links payments to bills with component breakdown.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| paymentId | String | Link to payment |
| billId | String | Link to bill |
| electricAmount | Decimal | Electric portion |
| waterAmount | Decimal | Water portion |
| duesAmount | Decimal | Dues portion |
| penaltyAmount | Decimal | Penalty portion |
| otherAmount | Decimal | Other portion |
| totalAmount | Decimal | Total allocated |

#### TenantSettings

One-to-one with Tenant for configuration.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| billingDayOfMonth | Int | 27 | Billing day |
| readingDay | Int | 26 | Meter reading day |
| statementDelay | Int | 10 | Days after reading |
| dueDateDelay | Int | 10 | Days after statement |
| gracePeriodDays | Int | 0 | Grace period |
| electricRate | Decimal | 8.39 | ₱/kWh rate |
| electricMinCharge | Decimal | 50 | Minimum charge |
| associationDuesRate | Decimal | 60 | ₱/sqm rate |
| penaltyRate | Decimal | 0.10 | 10% penalty rate |
| paymentAllocationStrategy | String | OLDEST_FIRST | Allocation strategy |
| soaDetailMonths | Int | 4 | Months to show in detail |

**Water Tier Settings:**

Residential Tiers (7 tiers):
| Tier | Max (cu.m) | Rate (₱) |
|------|------------|----------|
| 1 | 1 | 80 (fixed) |
| 2 | 6 | 200 (fixed) |
| 3 | 11 | 370 (fixed) |
| 4 | 21 | 40/cu.m |
| 5 | 31 | 45/cu.m |
| 6 | 41 | 50/cu.m |
| 7 | ∞ | 55/cu.m |

Commercial Tiers (7 tiers):
| Tier | Max (cu.m) | Rate (₱) |
|------|------------|----------|
| 1 | 1 | 200 (fixed) |
| 2 | 6 | 250 (fixed) |
| 3 | 11 | 740 (fixed) |
| 4 | 21 | 55/cu.m |
| 5 | 31 | 60/cu.m |
| 6 | 41 | 65/cu.m |
| 7 | ∞ | 85/cu.m |

---

## 5. Core Business Logic

### 5.1 Water Billing Calculation

**Location:** `lib/calculations/water.ts`

The water billing system uses a 14-tier structure (7 residential + 7 commercial) based on exact Excel formulas from Ma'am Rose's spreadsheet.

#### Residential Water Formula

```typescript
// Excel Formula:
// =IF(J9<=1, 80,
//   IF(AND((J9>1),(J9<6)), 200,
//     IF(AND((J9>5),(J9<11)), 370,
//       IF(AND((J9>10),(J9<21)), ((J9-10)*40+370),
//         IF(AND((J9>20),(J9<31)), ((J9-20)*45+770),
//           IF(AND((J9>30),(J9<41)), (((J9-30)*50+1220)),
//             ((J9-40)*55+1720)))))))

function calculateResidentialWater(consumption: number, settings: WaterTierSettings): number {
  // Tier 1: <=1 cu.m = Fixed ₱80
  if (cons <= 1) return 80

  // Tier 2: >1 AND <6 = Fixed ₱200
  if (cons > 1 && cons < 6) return 200

  // Tier 3: >=6 AND <11 = Fixed ₱370
  if (cons >= 6 && cons < 11) return 370

  // Tier 4: >=11 AND <21 = (cons-10)*40 + 370
  if (cons >= 11 && cons < 21) return (cons - 10) * 40 + 370

  // Tier 5: >=21 AND <31 = (cons-20)*45 + 770
  if (cons >= 21 && cons < 31) return (cons - 20) * 45 + 770

  // Tier 6: >=31 AND <41 = (cons-30)*50 + 1220
  if (cons >= 31 && cons < 41) return (cons - 30) * 50 + 1220

  // Tier 7: >=41 = (cons-40)*55 + 1720
  return (cons - 40) * 55 + 1720
}
```

#### Commercial Water Formula

Similar structure with higher rates:
- Tier 1: ₱200 (fixed)
- Tier 2: ₱250 (fixed)
- Tier 3: ₱740 (fixed)
- Tier 4-7: Progressive rates (₱55-₱85/cu.m)

#### Key Functions

```typescript
// Main calculation function
calculateWaterBill(consumption: number, unitType: 'RESIDENTIAL' | 'COMMERCIAL', settings: WaterTierSettings): number

// Get breakdown for display
getWaterTierBreakdown(consumption: number, unitType: 'RESIDENTIAL' | 'COMMERCIAL', settings: WaterTierSettings): TierBreakdown[]
```

### 5.2 Electric Billing Calculation

**Location:** `lib/calculations/billing.ts`

```typescript
// Excel Formula: =IF(P9<=50, 50, (E9*F9))
// If (consumption × rate) <= min charge, charge minimum
// Otherwise, charge consumption × rate

function calculateElectricBill(consumption: number, settings: BillingSettings): number {
  const amount = consumption * settings.electricRate  // Default: 8.39
  return Math.max(amount, settings.electricMinCharge) // Default: 50
}
```

**Example:**
- 5 kWh × ₱8.39 = ₱41.95 → Charge minimum ₱50
- 10 kWh × ₱8.39 = ₱83.90 → Charge ₱83.90

### 5.3 Association Dues Calculation

```typescript
function calculateAssociationDues(area: number, settings: BillingSettings): number {
  return area * settings.associationDuesRate  // Default: 60
}
```

**Example:**
- 45 sqm × ₱60 = ₱2,700/month

### 5.4 Compounding Penalty Calculation

**CRITICAL:** This is NOT simple interest. Penalties compound on top of previous penalties.

**Location:** `lib/calculations/billing.ts`

#### Excel Column Reference

| Column | Description |
|--------|-------------|
| C | Principal (monthly bill amount) |
| D | 10% P = C × 10% |
| E | Sum w/ Prev Interest = E(prev) + F(prev) + D(curr) |
| F | Comp. 10% Interest = E × 10% |
| H | Total Interest = E + F (month 2+) or D (month 1) |

#### Formula

```typescript
function calculateCompoundingPenalty(bills: UnpaidBill[], penaltyRate: number = 0.10) {
  let totalInterest = 0

  for (let i = 0; i < bills.length; i++) {
    const principal = bills[i].principal
    const tenPercentP = principal * penaltyRate

    if (i === 0) {
      // Month 1: Simple 10% of principal
      totalInterest = tenPercentP
    } else {
      // Month 2+: Compound calculation
      const sumWithPrevInterest = totalInterest + tenPercentP
      const compoundInterest = sumWithPrevInterest * penaltyRate
      totalInterest = sumWithPrevInterest + compoundInterest
    }
  }

  return totalInterest
}
```

#### Example (₱5,000/month for 3 months)

| Month | Principal | 10% P | Sum w/ Prev | Comp 10% | Total Interest |
|-------|-----------|-------|-------------|----------|----------------|
| 1 | ₱5,000 | ₱500 | - | - | ₱500 |
| 2 | ₱5,000 | ₱500 | ₱1,000 | ₱100 | ₱1,100 |
| 3 | ₱5,000 | ₱500 | ₱1,600 | ₱160 | ₱1,760 |

**Total Penalty:** ₱1,760 (not ₱1,500 from simple interest!)

---

## 6. API Reference

### 6.1 Authentication

#### POST /api/auth/[...all]

Better Auth handles all authentication:
- `POST /api/auth/sign-in/email` - Email/password login
- `POST /api/auth/sign-up/email` - Registration
- `GET /api/auth/session` - Get current session
- `POST /api/auth/sign-out` - Logout

### 6.2 Billing APIs

#### GET /api/billing

List all bills with filtering.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status (UNPAID, PARTIAL, PAID, OVERDUE) |
| billingMonth | string | Filter by month (YYYY-MM) |
| unitId | string | Filter by unit |
| page | number | Page number |
| limit | number | Items per page |

**Response:**
```json
{
  "bills": [...],
  "total": 100,
  "page": 1,
  "totalPages": 10
}
```

#### POST /api/billing/generate

Generate monthly bills.

**Request Body:**
```json
{
  "billingMonth": "2025-11",
  "preview": true,
  "unitIds": ["unit1", "unit2"]
}
```

**Response:**
```json
{
  "bills": [...],
  "summary": {
    "totalGenerated": 50,
    "totalAmount": 250000
  }
}
```

#### POST /api/billing/opening-balance

Create opening balance bill.

**Request Body:**
```json
{
  "unitId": "unit123",
  "amount": 15000,
  "remarks": "Arrears from previous period"
}
```

#### GET /api/billing/soa

Generate Statement of Account.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| unitId | string | Unit ID (required) |
| asOfDate | string | As of date (optional) |

#### POST /api/billing/soa/batch

Batch generate SOAs.

**Request Body:**
```json
{
  "unitIds": ["unit1", "unit2"],
  "asOfDate": "2025-11-30"
}
```

### 6.3 Payment APIs

#### GET /api/payments

List all payments.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| orNumber | string | Search by OR# |
| unitId | string | Filter by unit |
| startDate | string | Start date |
| endDate | string | End date |
| page | number | Page number |

#### POST /api/payments

Record new payment.

**Request Body:**
```json
{
  "unitId": "unit123",
  "amount": 5000,
  "paymentMethod": "CASH",
  "orNumber": "OR-2025-001",
  "paymentDate": "2025-11-15",
  "allocationStrategy": "OLDEST_FIRST",
  "manualAllocations": []
}
```

**Response:**
```json
{
  "payment": {...},
  "allocations": [...],
  "advanceAmount": 0
}
```

#### GET /api/payments/[id]

Get payment details with allocations.

#### DELETE /api/payments/[id]

Delete/cancel payment (reverses allocations).

### 6.4 Meter Reading APIs

#### POST /api/readings/electric

Record electric meter reading.

**Request Body:**
```json
{
  "unitId": "unit123",
  "billingPeriod": "2025-11-01",
  "readingDate": "2025-10-26",
  "previousReading": 1000,
  "presentReading": 1150
}
```

#### POST /api/readings/water

Record water meter reading (same structure as electric).

### 6.5 Master Data APIs

#### Units

- `GET /api/units` - List units
- `POST /api/units` - Create unit
- `GET /api/units/[id]` - Get unit
- `PUT /api/units/[id]` - Update unit

#### Owners

- `GET /api/owners` - List owners
- `POST /api/owners` - Create owner
- `GET /api/owners/[id]` - Get owner
- `PUT /api/owners/[id]` - Update owner

### 6.6 Owner Portal APIs

- `GET /api/owner/bills` - Get own bills
- `GET /api/owner/payments` - Get own payments
- `GET /api/owner/soa` - Get own SOA

### 6.7 Reports APIs

#### GET /api/reports/collections

Collections report.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| startMonth | string | Start month (YYYY-MM) |
| endMonth | string | End month (YYYY-MM) |

**Response:**
```json
{
  "collectionRate": 85.5,
  "totalBilled": 500000,
  "totalCollected": 427500,
  "overdueAmount": 72500,
  "byPaymentMethod": {...}
}
```

---

## 7. Application Pages

### 7.1 Admin Dashboard Routes

| Route | Description |
|-------|-------------|
| `/dashboard` | Main dashboard with statistics |
| `/billing/generate` | Generate monthly bills |
| `/billing/list` | List and manage bills |
| `/billing/soa` | Statement of Accounts |
| `/billing/opening-balance` | Opening balance entry |
| `/payments/record` | Record new payment |
| `/payments/list` | Payment history |
| `/readings/electric` | Electric meter readings |
| `/readings/water` | Water meter readings |
| `/units` | Unit management |
| `/owners` | Owner management |
| `/reports/collections` | Collections report |

### 7.2 Owner Portal Routes

| Route | Description |
|-------|-------------|
| `/owner` | Owner dashboard |
| `/owner/bills` | View own bills |
| `/owner/payments` | View own payments |
| `/owner/soa` | View own SOA |

### 7.3 Public Routes

| Route | Description |
|-------|-------------|
| `/login` | Login page |

---

## 8. User Roles & Permissions

### 8.1 Role Hierarchy

| Role | Access Level | Description |
|------|--------------|-------------|
| SUPER_ADMIN | Full | Programmer - can edit water tiers |
| ADMIN | High | Edit rates, configure permissions |
| MANAGER | Medium-High | View reports, approve payments |
| ACCOUNTANT | Medium | Full billing cycle operations |
| BOOKKEEPER | Medium-Low | Enter payments, view bills |
| CLERK | Low | Enter readings only |
| UNIT_OWNER | Restricted | View own data only |

### 8.2 Permission Types

| Permission | Description |
|------------|-------------|
| canView | View records |
| canCreate | Create new records |
| canEdit | Edit existing records |
| canDelete | Delete records |
| canExport | Export data (PDF, Excel) |

### 8.3 Default Role Permissions

| Feature | SUPER_ADMIN | ADMIN | MANAGER | ACCOUNTANT | BOOKKEEPER | CLERK | UNIT_OWNER |
|---------|-------------|-------|---------|------------|------------|-------|------------|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Bill Generate | ✓ | ✓ | ✓ | ✓ | - | - | - |
| Bill List | ✓ | ✓ | ✓ | ✓ | ✓ | - | Own |
| Payments | ✓ | ✓ | ✓ | ✓ | ✓ | - | Own |
| Readings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Units | ✓ | ✓ | ✓ | - | - | - | - |
| Owners | ✓ | ✓ | ✓ | - | - | - | - |
| Reports | ✓ | ✓ | ✓ | ✓ | - | - | - |
| Settings | ✓ | ✓ | - | - | - | - | - |
| Water Tiers | ✓ | - | - | - | - | - | - |

---

## 9. Billing Calculations

### 9.1 Complete Bill Calculation Flow

```typescript
interface BillCalculationInput {
  electricConsumption: number   // kWh
  waterConsumption: number      // cu.m
  unitType: 'RESIDENTIAL' | 'COMMERCIAL'
  area: number                  // sqm
  settings: BillingSettings
}

function calculateBill(input: BillCalculationInput): BillCalculationResult {
  // 1. Calculate electric
  const electricAmount = calculateElectricBill(input.electricConsumption, input.settings)

  // 2. Calculate water (using 14-tier system)
  const waterAmount = calculateWaterBill(
    input.waterConsumption,
    input.unitType,
    input.settings.waterSettings
  )

  // 3. Calculate association dues
  const associationDues = calculateAssociationDues(input.area, input.settings)

  // 4. Calculate subtotal
  const subtotal = electricAmount + waterAmount + associationDues

  return {
    electricAmount,
    waterAmount,
    associationDues,
    subtotal,
    totalAmount: subtotal,
    breakdown: {...}
  }
}
```

### 9.2 Sample Bill Calculation

**Input:**
- Unit: 2F-1 (Residential)
- Area: 45 sqm
- Electric: 150 kWh
- Water: 12 cu.m

**Calculation:**
```
Electric:  150 kWh × ₱8.39 = ₱1,258.50
Water:     Tier 4 = (12-10) × ₱40 + ₱370 = ₱450
Assoc:     45 sqm × ₱60 = ₱2,700
────────────────────────────────────────
Total:     ₱4,408.50
```

### 9.3 Billing Schedule

Default 27th-26th billing cycle:

| Event | Day | Example |
|-------|-----|---------|
| Reading Date | 26th | Oct 26 |
| Billing Day | 27th | Oct 27 |
| Statement Date | +10 days | Nov 5 |
| Due Date | +10 days | Nov 15 |
| Penalty Starts | After due | Nov 16 |

---

## 10. Payment System

### 10.1 Payment Methods

| Method | Fields Required |
|--------|-----------------|
| CASH | - |
| CHECK | checkNumber, checkDate, bankName |
| BANK_TRANSFER | referenceNumber, bankName |
| GCASH | referenceNumber |
| PAYMAYA | referenceNumber |
| CREDIT_CARD | referenceNumber |
| DEBIT_CARD | referenceNumber |

### 10.2 Allocation Strategies

#### OLDEST_FIRST (FIFO)

Pays oldest unpaid bills first.

```typescript
// Sort by billing month ascending
bills.sort((a, b) => a.billingMonth - b.billingMonth)
```

**Example:**
- Bill A (Oct): ₱5,000 unpaid
- Bill B (Nov): ₱5,000 unpaid
- Payment: ₱7,000

**Result:**
- Bill A: Paid ₱5,000 (PAID)
- Bill B: Paid ₱2,000 (PARTIAL)

#### NEWEST_FIRST (LIFO)

Pays newest bills first.

```typescript
// Sort by billing month descending
bills.sort((a, b) => b.billingMonth - a.billingMonth)
```

#### MANUAL

User specifies exact allocation per bill component.

```typescript
const manualAllocations = [
  {
    billId: "bill1",
    electricAmount: 1000,
    waterAmount: 500,
    duesAmount: 2000,
    penaltyAmount: 0,
    otherAmount: 0
  }
]
```

### 10.3 Component Allocation

When paying a bill partially, amounts are allocated proportionally:

```typescript
function allocateToBillComponents(bill: UnpaidBill, amount: number) {
  const ratio = amount / bill.balance

  return {
    electricAmount: bill.electricAmount * ratio,
    waterAmount: bill.waterAmount * ratio,
    duesAmount: bill.associationDues * ratio,
    penaltyAmount: bill.penaltyAmount * ratio,
    otherAmount: bill.otherCharges * ratio
  }
}
```

### 10.4 Advance Payments

Excess payments are stored as advance credit:

```typescript
const result = allocatePayment(10000, unpaidBills) // Total bills: ₱8,000
// result.advanceAmount = ₱2,000
```

---

## 11. Configuration & Settings

### 11.1 Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/condo_billing?schema=public"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Seed Configuration
SUPER_ADMIN_EMAIL="admin@megatower.com"
SUPER_ADMIN_PASSWORD="Admin@123456"
DEFAULT_TENANT_NAME="Mega Tower Residences"
```

### 11.2 Configurable Rates

| Setting | Default | Who Can Edit |
|---------|---------|--------------|
| Electric Rate | ₱8.39/kWh | ADMIN, SUPER_ADMIN |
| Electric Min | ₱50 | ADMIN, SUPER_ADMIN |
| Association Dues | ₱60/sqm | ADMIN, SUPER_ADMIN |
| Penalty Rate | 10% | ADMIN, SUPER_ADMIN |
| Water Tiers | See above | SUPER_ADMIN only |

### 11.3 Billing Schedule Settings

| Setting | Default | Description |
|---------|---------|-------------|
| billingDayOfMonth | 27 | Day billing starts |
| readingDay | 26 | Meter reading day |
| statementDelay | 10 | Days after reading |
| dueDateDelay | 10 | Days after statement |
| gracePeriodDays | 0 | Grace period |

---

## 12. Development Guide

### 12.1 Getting Started

```bash
# Clone repository
git clone <repository-url>
cd Megatower

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

### 12.2 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed initial data |
| `npm run db:seed-sample` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test:e2e` | Run Playwright tests |
| `npm run test:e2e:ui` | Run Playwright with UI |

### 12.3 Adding New Features

#### New API Route

```typescript
// app/api/[resource]/route.ts
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await requireAuth(request.headers)

  const data = await prisma.resource.findMany({
    where: { tenantId: session.tenantId }
  })

  return Response.json(data)
}
```

#### New Page

```typescript
// app/[route]/page.tsx
import { DashboardLayout } from "@/components/layouts/dashboard-layout"

export default function NewPage() {
  return (
    <DashboardLayout>
      <div>Page content</div>
    </DashboardLayout>
  )
}
```

#### Schema Changes

1. Edit `prisma/schema.prisma`
2. Run `npm run db:generate`
3. Run `npm run db:push` (dev) or `npm run db:migrate` (prod)

### 12.4 Code Style Guidelines

1. **TypeScript** - Always use strict typing
2. **Imports** - Use `@/` path aliases
3. **Components** - Use shadcn/ui components
4. **Forms** - Use React Hook Form + Zod
5. **Tables** - Use DevExtreme DataGrid
6. **Currency** - Use `formatCurrency()` from `lib/utils.ts`

### 12.5 Common Pitfalls

| Issue | Solution |
|-------|----------|
| Water calculations wrong | Check unit type (RESIDENTIAL vs COMMERCIAL) |
| Penalty not compounding | Use `calculateCompoundingPenalty()`, not simple interest |
| Data leaking between tenants | Always filter by `tenantId` |
| Decimal precision loss | Use Prisma `Decimal` type, convert for calculations |
| Connection exhaustion | Use Prisma singleton from `lib/prisma.ts` |

---

## 13. Deployment

### 13.1 Production Build

```bash
# Build the application
npm run build

# Start production server
npm run start
```

### 13.2 Database Migration

```bash
# Generate migration
npx prisma migrate dev --name migration_name

# Apply to production
npx prisma migrate deploy
```

### 13.3 Environment Configuration

Production environment variables:

```env
DATABASE_URL="postgresql://user:pass@host:5432/dbname?schema=public"
NEXTAUTH_SECRET="production-secret-key"
NEXTAUTH_URL="https://your-domain.com"
NODE_ENV="production"
```

### 13.4 Windows-Specific Notes

- PostgreSQL via Windows installer or WSL
- Use `psql -U postgres` for CLI access
- Environment variables in `.env` file
- Port 3000 must be open in Windows Firewall for LAN access

---

## Appendix A: Quick Reference

### Water Tier Quick Reference

**Residential:**
```
≤1 cu.m   = ₱80 (fixed)
2-5 cu.m  = ₱200 (fixed)
6-10 cu.m = ₱370 (fixed)
11-20     = (cons-10) × ₱40 + ₱370
21-30     = (cons-20) × ₱45 + ₱770
31-40     = (cons-30) × ₱50 + ₱1,220
41+       = (cons-40) × ₱55 + ₱1,720
```

**Commercial:** 2-3× residential rates

### Bill Status Flow

```
UNPAID → PARTIAL → PAID
         ↓
       OVERDUE → PARTIAL → PAID
```

### Payment Method Icons

```
CASH          💵
CHECK         📝
BANK_TRANSFER 🏦
GCASH         📱
PAYMAYA       📱
CREDIT_CARD   💳
DEBIT_CARD    💳
```

---

## Appendix B: Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Check connection
psql -U postgres -d condo_billing -c "SELECT 1"
```

### Prisma Issues

```bash
# Regenerate client
npx prisma generate

# Reset database (CAUTION: destroys data)
npx prisma db push --force-reset

# View database
npx prisma studio
```

### Authentication Issues

1. Clear browser cookies
2. Check `NEXTAUTH_SECRET` is set
3. Verify session in database
4. Check middleware configuration

---

**Document Version:** 1.0.0
**Last Updated:** December 2025
**Maintained by:** Megatower Development Team
