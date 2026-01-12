# 🏢 Condominium Billing Management System

A complete multi-tenant condominium billing and payment management system built with Next.js 14, PostgreSQL, and Prisma.

## ✨ Features

### 📊 Complete Billing System
- ✅ Automated monthly bill generation
- ✅ Electric billing (min ₱50 or consumption × rate)
- ✅ Water billing with 14-tier system (7 residential + 7 commercial)
- ✅ Association dues calculation (area × rate)
- ✅ 10% compounding monthly penalty (exact Excel formula)
- ✅ Configurable billing schedule (27th-26th pattern)

### 💳 Payment Management
- ✅ Full and partial payment support
- ✅ Payment allocation (FIFO/LIFO strategies)
- ✅ Manual payment allocation override
- ✅ Multiple payment methods (Cash, Check, GCash, etc.)
- ✅ OR/AR number tracking
- ✅ Advance payment handling

### 📄 Statement of Accounts
- ✅ Professional SOA format
- ✅ Current month detail
- ✅ Last 3-4 months detail
- ✅ Older bills summarized
- ✅ PDF generation
- ✅ Email delivery support

### 🏗️ Multi-Floor Structure
- ✅ Organize units by floor (GF, 2F, 3F, 4F, 5F, 6F)
- ✅ Floor-based reports
- ✅ Building-wide summaries
- ✅ Multiple units per owner support

### 👥 User Management
- ✅ 7 user roles (SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT, BOOKKEEPER, CLERK, UNIT_OWNER)
- ✅ Dynamic menu permissions (5 types: View, Create, Edit, Delete, Export)
- ✅ User-specific permission overrides
- ✅ Unit owner portal access

### 🏢 Multi-Tenant Architecture
- ✅ Support multiple condominiums
- ✅ Isolated data per tenant
- ✅ Tenant-specific settings

### 🔒 Security & Audit
- ✅ NextAuth.js v5 authentication
- ✅ Role-based access control
- ✅ Complete audit trail
- ✅ Activity logging

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### 1. Clone & Install

```bash
# Create project directory
cd condo-billing-system

# Install dependencies
npm install
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb condo_billing

# Or using psql
psql -U postgres
CREATE DATABASE condo_billing;
\q
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env and update:
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/condo_billing?schema=public"
NEXTAUTH_SECRET="your-secret-key-here"

# Super Admin Credentials (first user)
SUPER_ADMIN_EMAIL="admin@megatower.com"
SUPER_ADMIN_PASSWORD="Admin@123456"

# Default Tenant
DEFAULT_TENANT_NAME="Mega Tower Residences"
```

### 4. Initialize Database

```bash
# Push schema to database
npm run db:push

# Seed initial data (tenant, admin user, menus, permissions)
npm run db:seed
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Login with:**
- Email: `admin@megatower.com`
- Password: `Admin@123456`

---

## 📦 Project Structure

```
condo-billing-system/
├── app/                      # Next.js 14 app directory
│   ├── (auth)/              # Authentication pages
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/         # Protected dashboard pages
│   │   ├── dashboard/
│   │   ├── units/
│   │   ├── owners/
│   │   ├── readings/
│   │   ├── billing/
│   │   ├── payments/
│   │   ├── reports/
│   │   ├── users/
│   │   └── settings/
│   ├── api/                 # API routes
│   │   └── auth/
│   └── layout.tsx
├── components/              # Reusable components
│   ├── ui/                 # shadcn/ui components
│   ├── forms/              # Form components
│   ├── tables/             # Data tables
│   └── layouts/            # Layout components
├── lib/                    # Utilities & helpers
│   ├── calculations/       # Billing calculations
│   │   ├── water.ts       # Water tier formulas
│   │   └── billing.ts     # Electric, dues, penalties
│   ├── payment-allocation.ts
│   ├── prisma.ts
│   └── utils.ts
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed data
└── public/
```

---

## 🎯 Key Features Explained

### Billing Calculation

#### Electric Bill
```typescript
// Formula: IF(consumption × rate <= ₱50, ₱50, consumption × rate)
// Minimum charge: ₱50

Example:
  Consumption: 5 kWh × ₱8.39 = ₱41.95
  Charge: ₱50 (minimum)

  Consumption: 115 kWh × ₱8.39 = ₱964.85
  Charge: ₱964.85
```

#### Water Bill (Residential)
```typescript
7-Tier System:
  Tier 1: 0-1 cu.m    = ₱80 (fixed)
  Tier 2: 1-5 cu.m    = ₱200 (fixed)
  Tier 3: 5-10 cu.m   = ₱370 (fixed)
  Tier 4: 10-20 cu.m  = ₱370 + (consumption - 10) × ₱40
  Tier 5: 20-30 cu.m  = ₱770 + (consumption - 20) × ₱45
  Tier 6: 30-40 cu.m  = ₱1,220 + (consumption - 30) × ₱50
  Tier 7: 40+ cu.m    = ₱1,720 + (consumption - 40) × ₱55

Example:
  Consumption: 2 cu.m → ₱200
  Consumption: 15 cu.m → ₱370 + (15-10) × ₱40 = ₱570
```

#### Association Dues
```typescript
// Formula: Area (sqm) × Rate

Example:
  Area: 34.5 sqm
  Rate: ₱60/sqm
  Dues: 34.5 × 60 = ₱2,070
```

#### Penalty (10% Compounding)
```typescript
// Each month adds:
// 1. 10% of principal
// 2. 10% of accumulated penalties

Month 1: ₱3,234 → Penalty: ₱323.40
Month 2: ₱3,234 → Penalty: ₱323.40 + (₱323.40 × 10%) = ₱355.74
Total: ₱679.14

Month 3: ₱3,234 → Penalty: ₱323.40 + (₱679.14 × 10%) = ₱391.31
Total: ₱1,070.45
```

### Payment Allocation

#### FIFO (Oldest First)
```typescript
Unpaid Bills:
  Sep 2025: ₱2,500
  Oct 2025: ₱2,700
  Nov 2025: ₱3,234

Payment: ₱5,000

Allocation:
  1. Sep 2025: ₱2,500 (PAID)
  2. Oct 2025: ₱2,500 (PARTIAL, ₱200 balance)
  3. Nov 2025: ₱3,234 (UNPAID)
```

#### LIFO (Newest First)
```typescript
Same bills, same payment:

Allocation:
  1. Nov 2025: ₱3,234 (PAID)
  2. Oct 2025: ₱1,766 (PARTIAL, ₱934 balance)
  3. Sep 2025: ₱2,500 (UNPAID)
```

---

## 📋 User Roles & Permissions

| Role | Access Level |
|------|-------------|
| **SUPER_ADMIN** | Full system access, can edit water tiers |
| **ADMIN** | Can edit rates, configure permissions, manage all data |
| **MANAGER** | View reports, approve payments |
| **ACCOUNTANT** | Full billing cycle, payments |
| **BOOKKEEPER** | Enter payments, view bills |
| **CLERK** | Enter meter readings only |
| **UNIT_OWNER** | View own bills and payments only |

---

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start development server

# Build
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema to database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed database
npm run db:studio       # Open Prisma Studio

# Linting
npm run lint            # Run ESLint
```

---

## 🌐 Deployment

### LAN Deployment (Local Network)

1. **Build the application:**
```bash
npm run build
```

2. **Start with PM2 (auto-restart):**
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name "condo-billing" -- start

# Save PM2 process list
pm2 save

# Setup auto-start on boot
pm2 startup
```

3. **Access from other computers:**
```
http://192.168.x.x:3000
```

4. **Configure firewall:**
```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp

# Windows
# Add inbound rule for port 3000
```

### Production Deployment (Vercel)

1. **Push to GitHub**
2. **Connect to Vercel**
3. **Configure environment variables**
4. **Deploy**

---

## 📊 Database Backup

```bash
# Backup
pg_dump -U postgres condo_billing > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres condo_billing < backup_20250116.sql
```

---

## 🔧 Configuration

### Billing Schedule
Edit in Settings → Billing Schedule or directly in database:

```sql
UPDATE "TenantSettings" SET
  "billingDayOfMonth" = 27,
  "readingDay" = 26,
  "statementDelay" = 10,
  "dueDateDelay" = 10
WHERE "tenantId" = 'default-tenant';
```

### Rates
ADMIN can edit via Settings → Rates:
- Electric Rate
- Association Dues Rate
- Penalty Rate

SUPER_ADMIN can edit water tiers (14 tiers total)

---

## 📝 License

MIT License - Built for Mega Tower Residences and similar condominium management needs.

---

## 🤝 Support

For issues or questions:
1. Check this README
2. Review the code comments
3. Check database seed data
4. Review calculation utilities in `/lib/calculations`

---

## 🎯 Roadmap

- [ ] Email notifications (bills generated, payment received)
- [ ] SMS reminders
- [ ] Mobile app (React Native)
- [ ] Online payment gateway integration
- [ ] Tenant mobile portal
- [ ] Advanced reporting (charts, graphs)
- [ ] Export to Excel
- [ ] Bulk operations (import units, readings)

---

**Built with ❤️ for efficient condominium management**
