# 🪟 WINDOWS INSTALLATION GUIDE

## Step-by-Step Setup for Windows

### ✅ STEP 1: Install Prerequisites

**1. Install Node.js 18+**
- Download: https://nodejs.org/
- Run installer, check "Add to PATH"
- Verify: `node --version`

**2. Install PostgreSQL 14+**
- Download: https://www.postgresql.org/download/windows/
- Remember the postgres password!
- Verify: `psql --version`

### ✅ STEP 2: Create Database

```cmd
psql -U postgres
CREATE DATABASE condo_billing;
\q
```

### ✅ STEP 3: Configure .env File

Open `.env` file and update:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/condo_billing?schema=public"
```

Replace `YOUR_PASSWORD` with your PostgreSQL password!

### ✅ STEP 4: Install Dependencies

```cmd
cd D:\Megatower
npm install
```

Wait 3-5 minutes for installation.

### ✅ STEP 5: Setup Database

```cmd
npm run db:push
npm run db:seed
```

### ✅ STEP 6: Start Server

```cmd
npm run dev
```

Open: http://localhost:3000

### 🔐 Login

- Email: admin@megatower.com
- Password: Admin@123456

### 🔧 TROUBLESHOOTING

**PostgreSQL not running?**
- Press Win + R → `services.msc`
- Find "postgresql" → Start

**Port 3000 in use?**
```cmd
netstat -ano | findstr :3000
taskkill /PID <number> /F
```

**Database connection failed?**
- Check PostgreSQL is running
- Verify password in .env file
- Check database exists: `psql -U postgres -l`

### ✅ SUCCESS!

If you see the welcome page at http://localhost:3000, you're done!

**Next:** I'll build the UI pages!
