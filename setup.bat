@echo off
echo ========================================
echo   MEGA TOWER SETUP
echo ========================================
echo.
echo Installing dependencies...
call npm install
if errorlevel 1 goto error

echo.
echo Setting up database...
call npm run db:push
if errorlevel 1 goto error

echo.
echo Seeding data...
call npm run db:seed
if errorlevel 1 goto error

echo.
echo ========================================
echo   SETUP COMPLETE!
echo ========================================
echo.
echo Login: admin@megatower.com
echo Password: Admin@123456
echo.
echo Run: npm run dev
echo Then open: http://localhost:3000
echo.
pause
exit /b 0

:error
echo.
echo [ERROR] Setup failed!
pause
exit /b 1
