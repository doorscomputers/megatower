# 🚀 SETUP GUIDE - Condominium Billing System

## 📋 Complete Installation Instructions

Follow these steps carefully to get your system running.

---

## ✅ PREREQUISITES

Before starting, ensure you have:

1. **Node.js 18+**
   ```bash
   node --version  # Should show v18.x.x or higher
   ```

2. **PostgreSQL 14+**
   ```bash
   psql --version  # Should show 14.x or higher
   ```

3. **Git** (optional, for version control)

---

## 🎯 STEP-BY-STEP INSTALLATION

### Step 1: Navigate to Project Directory

```bash
cd /home/claude/condo-billing-system
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages (~5 minutes).

### Step 3: Setup PostgreSQL Database

#### Option A: Using psql Command Line

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE condo_billing;

# Exit
\q
```

#### Option B: Using pgAdmin
1. Open pgAdmin
2. Right-click on "Databases"
3. Create → Database
4. Name: `condo_billing`
5. Save

### Step 4: Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit the .env file
nano .env
```

**Update these values:**

```env
# Database (REQUIRED - Update password!)
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/condo_billing?schema=public"

# NextAuth (REQUIRED - Change this!)
NEXTAUTH_SECRET="generate-random-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Super Admin (First user to access system)
SUPER_ADMIN_EMAIL="admin@megatower.com"
SUPER_ADMIN_PASSWORD="Admin@123456"
SUPER_ADMIN_FIRSTNAME="System"
SUPER_ADMIN_LASTNAME="Administrator"

# Default Tenant
DEFAULT_TENANT_NAME="Mega Tower Residences"
DEFAULT_TENANT_ADDRESS="Megatower Residences I, Ground Floor, Property Management Office, Corner Tecson, Sandico St., Salud Mitra, Baguio City, Philippines"
DEFAULT_TENANT_PHONE="(074) 661-02-61"
DEFAULT_TENANT_EMAIL="megatowerpmobillings@gmail.com"
```

**To generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 5: Initialize Database

```bash
# Push Prisma schema to database
npm run db:push
```

Expected output:
```
✔ Prisma schema loaded from prisma/schema.prisma
✔ Datasource "db": PostgreSQL database "condo_billing"
✔ Generated Prisma Client
✔ The database is now in sync with your Prisma schema.
```

### Step 6: Seed Database (Create Initial Data)

```bash
npm run db:seed
```

Expected output:
```
🌱 Starting database seed...
📊 Creating default tenant...
✅ Tenant created: Mega Tower Residences
⚙️  Creating tenant settings...
✅ Settings created
👤 Creating super admin user...
✅ Super Admin created: admin@megatower.com
📋 Creating default menus...
✅ 24 menus created
🔐 Creating role permissions...
✅ Role permissions created
🎉 Database seed completed!
```

### Step 7: Start Development Server

```bash
npm run dev
```

Expected output:
```
   ▲ Next.js 14.1.0
   - Local:        http://localhost:3000
   - Network:      http://192.168.x.x:3000

 ✓ Ready in 2.5s
```

### Step 8: Access the Application

Open your browser and go to:
```
http://localhost:3000
```

**Login with:**
- Email: `admin@megatower.com`
- Password: `Admin@123456`

---

## 🎉 SUCCESS! What's Next?

After logging in, you should:

1. **Change Admin Password**
   - Go to Profile → Change Password

2. **Add Sample Units**
   - Go to Master Data → Units
   - Add units: 2F-1, 2F-2, GF-1, etc.

3. **Add Owners**
   - Go to Master Data → Owners
   - Link owners to units

4. **Enter Meter Readings**
   - Go to Meter Readings → Electric Readings
   - Enter readings for units

5. **Generate Bills**
   - Go to Billing → Generate Bills
   - Select month and generate

---

## 🔧 TROUBLESHOOTING

### Issue: Database Connection Failed

**Error:**
```
Error: Can't reach database server at `localhost:5432`
```

**Solutions:**
1. Check if PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```

2. Start PostgreSQL:
   ```bash
   sudo systemctl start postgresql
   ```

3. Verify connection:
   ```bash
   psql -U postgres -d condo_billing
   ```

### Issue: Prisma Client Not Generated

**Error:**
```
PrismaClient is unable to be run in the browser
```

**Solution:**
```bash
npm run db:generate
```

### Issue: Port 3000 Already in Use

**Error:**
```
Port 3000 is already in use
```

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# OR use different port
PORT=3001 npm run dev
```

### Issue: Permission Denied on Database

**Error:**
```
permission denied for schema public
```

**Solution:**
```sql
-- Login to PostgreSQL
psql -U postgres

-- Grant permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
```

---

## 💻 FOR LAN DEPLOYMENT

### 1. Build the Application

```bash
npm run build
```

### 2. Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
pm2 start npm --name "condo-billing" -- start

# View logs
pm2 logs condo-billing

# Monitor
pm2 monit
```

### 3. Auto-Start on Boot

```bash
# Save current process list
pm2 save

# Generate startup script
pm2 startup

# Run the command it outputs (example):
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yourusername --hp /home/yourusername
```

### 4. Configure Firewall

```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp
sudo ufw reload

# Check firewall status
sudo ufw status
```

### 5. Access from Other Computers

Find your server's IP address:
```bash
ip addr show
# or
hostname -I
```

Access from other computers on the same network:
```
http://YOUR_SERVER_IP:3000
```

Example:
```
http://192.168.1.100:3000
```

---

## 📊 TESTING THE SYSTEM

### Create Test Data

```bash
# Open Prisma Studio
npm run db:studio
```

This opens a web interface at `http://localhost:5555` where you can:
- View all database tables
- Add sample units
- Add sample owners
- View bills and payments

### Sample Units to Add

| Unit Number | Floor Level | Area | Type | Owner Name |
|------------|-------------|------|------|------------|
| 2F-1 | 2F | 34.5 | RESIDENTIAL | Juan Dela Cruz |
| 2F-2 | 2F | 30.0 | RESIDENTIAL | Maria Santos |
| GF-1 | GF | 30.0 | COMMERCIAL | ABC Store Inc. |

---

## 🔒 SECURITY CHECKLIST

Before deploying to production:

- [ ] Change SUPER_ADMIN_PASSWORD
- [ ] Generate new NEXTAUTH_SECRET
- [ ] Use strong database password
- [ ] Enable PostgreSQL SSL
- [ ] Configure firewall
- [ ] Setup regular backups
- [ ] Enable HTTPS (for internet deployment)
- [ ] Review user permissions
- [ ] Test all features

---

## 📦 DATABASE BACKUP

### Manual Backup

```bash
# Backup
pg_dump -U postgres condo_billing > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres condo_billing < backup_20250116.sql
```

### Automated Backup (Cron Job)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * pg_dump -U postgres condo_billing > /home/backups/condo_$(date +\%Y\%m\%d).sql

# Keep only last 30 days
0 3 * * * find /home/backups/ -name "condo_*.sql" -mtime +30 -delete
```

---

## 📞 NEED HELP?

If you encounter issues:

1. **Check logs:**
   ```bash
   pm2 logs condo-billing
   ```

2. **Check database:**
   ```bash
   npm run db:studio
   ```

3. **Restart application:**
   ```bash
   pm2 restart condo-billing
   ```

4. **Check this guide's troubleshooting section**

5. **Review README.md for detailed documentation**

---

## ✅ SETUP COMPLETE!

Your Condominium Billing System is now ready to use! 🎉

**Remember to:**
- Change default passwords
- Add your units and owners
- Configure billing rates in Settings
- Test the billing cycle before going live

**Happy billing!** 📊💰
