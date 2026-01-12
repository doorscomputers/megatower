# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Workflow Rules (MUST FOLLOW)

1. **First think through the problem**, read the codebase for relevant files, and write a plan to `tasks/todo.md`.
2. **The plan should have a list of todo items** that you can check off as you complete them.
3. **Before you begin working, check in with me** and I will verify the plan.
4. **Then, begin working on the todo items**, marking them as complete as you go.
5. **Please every step of the way** just give me a high level explanation of what changes you made.
6. **Make every task and code change you do as simple as possible.** We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. **Finally, add a review section** to the `todo.md` file with a summary of the changes you made and any other relevant information.
8. **DO NOT BE LAZY. NEVER BE LAZY.** If there is a bug, find the root cause and fix it. NO TEMPORARY FIXES. You are a senior developer. NEVER BE LAZY.
9. **MAKE ALL FIXES AND CODE CHANGES AS SIMPLE AS HUMANLY POSSIBLE.** They should only impact necessary code relevant to the task and nothing else. It should impact as little code as possible. Your goal is to NOT introduce any bugs. IT'S ALL ABOUT SIMPLICITY.

## Project Overview

Multi-tenant Condominium Billing Management System for Mega Tower Residences. Handles automated monthly billing, meter readings, payments, and statement generation with complex water tier calculations and compounding penalties.

## Development Commands

### Daily Development

```bash
npm run dev              # Start development server (http://localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Database Operations

```bash
npm run db:generate      # Generate Prisma client (run after schema changes)
npm run db:push          # Push schema to database (development)
npm run db:migrate       # Run migrations (production)
npm run db:seed          # Seed initial data (tenant, admin, menus)
npm run db:studio        # Open Prisma Studio GUI
```

### Running Tests

```bash
# Run specific Prisma seed script
npx tsx prisma/seed.ts
```

## Critical Architecture

### Billing Calculation System (lib/calculations/)

**Water Billing** - 14-tier system (7 residential + 7 commercial)

- Location: `lib/calculations/water.ts`
- Residential: Fixed rates for tiers 1-3, progressive for 4-7
- Commercial: Higher fixed rates, different tier breakpoints
- Formula exactly matches Excel formulas from Ma'am Rose's spreadsheet

**Electric Billing** - Minimum charge logic

- Location: `lib/calculations/billing.ts`
- Formula: `IF(consumption × rate <= ₱50, ₱50, consumption × rate)`
- Always charge minimum ₱50

**Compounding Penalty** - 10% monthly compounding

- Each month adds: 10% of principal + 10% of accumulated penalties
- Not simple interest - penalties compound on penalties
- Critical calculation for overdue bills

**Association Dues** - Area-based calculation

- Formula: `Area (sqm) × Rate`
- Rate configurable per tenant

### Payment Allocation (lib/payment-allocation.ts)

Supports three strategies:

1. **OLDEST_FIRST (FIFO)** - Pay oldest bills first
2. **NEWEST_FIRST (LIFO)** - Pay newest bills first
3. **MANUAL** - User specifies exact allocation per bill component

Payments are allocated proportionally across bill components (electric, water, dues, penalty, other) unless manually overridden.

### Multi-Tenant Architecture

- All data scoped to `tenantId`
- Tenant-specific settings in `TenantSettings` model
- Billing schedule configurable per tenant (e.g., 27th-26th cycle)
- Users belong to one tenant (except SUPER_ADMIN)

### Role-Based Access Control

7 user roles with different permissions:

- **SUPER_ADMIN**: Full access, can edit water tiers (programmer level)
- **ADMIN**: Edit rates, configure permissions, manage data
- **MANAGER**: View reports, approve payments
- **ACCOUNTANT**: Full billing cycle, payment entry
- **BOOKKEEPER**: Payment entry, view bills
- **CLERK**: Meter readings only
- **UNIT_OWNER**: View own bills/payments only

Permissions are menu-based with 5 types: View, Create, Edit, Delete, Export. User-specific overrides stored in `MenuPermission` model.

### Authentication

- NextAuth.js v4 with credentials provider
- Middleware protects all routes except `/login` and public assets
- Session includes userId, tenantId, role for authorization
- Configuration in `middleware.ts`

## Database Schema Key Points

### Unit Organization

- Units grouped by floor (GF, 2F, 3F, 4F, 5F, 6F)
- Each unit has type: RESIDENTIAL or COMMERCIAL (affects water rates)
- Area stored in sqm for association dues calculation
- Multiple units can belong to same owner

### Bill Status Flow

```
DRAFT → PENDING → PAID / PARTIAL / OVERDUE
```

- DRAFT: Generated but not finalized
- PENDING: Sent to owner, unpaid
- PARTIAL: Some payment received
- PAID: Fully paid
- OVERDUE: Past due date

### Payment to Bill Relationship

- Many-to-many through `BillPayment` join table
- Tracks which bills a payment was applied to
- Stores allocated amounts per bill component
- Supports advance payments (excess stored as credit)

## File Structure Conventions

- `app/` - Next.js 14 App Router (uses /dashboard for protected routes)
- `app/api/` - API routes (REST endpoints for CRUD)
- `components/ui/` - shadcn/ui components (button, card, dialog, etc.)
- `components/layouts/` - Layout components (dashboard-layout.tsx)
- `lib/` - Business logic and utilities
- `lib/calculations/` - Billing formulas (water.ts, billing.ts)
- `prisma/` - Database schema and seed scripts

## Path Aliases

Use `@/` prefix for imports:

```typescript
import { Button } from "@/components/ui/button";
import { calculateWaterBill } from "@/lib/calculations/water";
```

## Important Calculation Details

### Water Tier Boundaries

Residential: 0-1, 1-5, 5-10, 10-20, 20-30, 30-40, 40+
Commercial: 0-1, 1-5, 5-10, 10-20, 20-30, 30-40, 40+

The boundary logic uses `<=` for max and `>` for exceeding. Consumption of exactly 5 cu.m falls into Tier 2, not Tier 3.

### Billing Schedule Pattern

Default: 27th-26th billing period

- Reading date: 26th of month
- Bill generation: 27th of month
- Statement sent: ~10 days after billing (configurable)
- Due date: ~10 days after statement (configurable)

### Database Connection

Uses Prisma Client singleton pattern in `lib/prisma.ts` to prevent connection exhaustion in development (Next.js hot reload).

## Technology Stack

- **Framework**: Next.js 14 (App Router, React Server Components)
- **Database**: PostgreSQL 14+ via Prisma ORM
- **Auth**: NextAuth.js v4
- **UI**: Radix UI + Tailwind CSS + shadcn/ui
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table + DevExtreme DataGrid
- **PDF**: jsPDF + jsPDF-AutoTable
- **State**: Zustand (minimal client state)
- **TypeScript**: v5.3+
- \*\*Devextrem Datagrid React Component for All Data Grid views

## Default Credentials

After running `npm run db:seed`:

- Email: `admin@megatower.com`
- Password: `Admin@123456`
- Role: SUPER_ADMIN
- Tenant: Mega Tower Residences

## Environment Variables Required

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/condo_billing?schema=public"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Seed configuration
SUPER_ADMIN_EMAIL="admin@megatower.com"
SUPER_ADMIN_PASSWORD="Admin@123456"
DEFAULT_TENANT_NAME="Mega Tower Residences"
```

## When Adding New Features

1. **New API Route**: Create in `app/api/[resource]/route.ts`
2. **New Page**: Create in `app/[route]/page.tsx`
3. **New Calculation**: Add to `lib/calculations/` with tests/examples
4. **Schema Changes**:
   - Edit `prisma/schema.prisma`
   - Run `npm run db:generate`
   - Run `npm run db:push` (dev) or `npm run db:migrate` (prod)
5. **New UI Component**: Use shadcn/ui or create in `components/ui/`

## Common Pitfalls

- **Water calculations**: Always use the correct unit type (RESIDENTIAL vs COMMERCIAL)
- **Penalty calculations**: Don't use simple interest - must compound monthly
- **Payment allocation**: Remember to handle partial payments and advance credits
- **Tenant scoping**: Always filter by tenantId in queries (except SUPER_ADMIN)
- **Date comparisons**: Billing month stored as Date, use proper date utilities
- **Decimal precision**: Financial amounts use Prisma Decimal type, convert for calculations

## Windows-Specific Notes

- PostgreSQL must be installed via Windows installer or WSL
- Use `psql -U postgres` to access PostgreSQL CLI
- Environment variables in `.env` file (not `.env.local`)
- Port 3000 must be open in Windows Firewall for LAN access

## UI Component Rules

### DevExtreme vs shadcn/ui Usage

**IMPORTANT**: Use DevExtreme ONLY for DataGrid display/presentation. For all form interactions (add, edit, delete modals/dialogs), use shadcn/ui components.

- **DevExtreme DataGrid**: Use for displaying tabular data with sorting, filtering, paging
- **shadcn/ui Dialog**: Use for add/edit/delete modal forms
- **shadcn/ui Form components**: Use Input, Select, Button, etc. for all form fields

**Why**: DevExtreme's built-in popup editing mode has compatibility issues with custom React components. shadcn/ui dialogs work seamlessly with React's controlled components and state management.

**Pattern for DataGrid pages**:
1. Use DevExtreme DataGrid with `Editing` disabled or set to custom
2. Add "Edit" and "Delete" buttons in a custom column that open shadcn Dialogs
3. Use a separate "Add" button that opens a shadcn Dialog
4. Handle all CRUD operations through custom dialogs with shadcn form components

### Button Styling

- Improve buttons so they look professional, not like plain labels
- Use shadcn Button component with appropriate variants (default, outline, destructive, etc.)
- Always refer to this session and maintain consistency