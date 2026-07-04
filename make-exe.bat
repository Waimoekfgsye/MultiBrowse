@echo off
setlocal enabledelayedexpansion

echo.
echo  ======================================================================
echo    MultiBrowse - Clean ^& Build EXE
echo  ======================================================================
echo.

:: Check Node.js
echo  [1/8] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo         ERROR: Node.js not found!
    echo         Install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo         Found Node.js %%i

:: Clean
echo  [2/8] Cleaning old files...
if exist node_modules rmdir /s /q node_modules >nul 2>&1
if exist dist rmdir /s /q dist >nul 2>&1
if exist release rmdir /s /q release >nul 2>&1
if exist build rmdir /s /q build >nul 2>&1
if exist package-lock.json del /f /q package-lock.json >nul 2>&1
echo         Done.

:: Install dependencies
echo  [3/8] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo         ERROR: npm install failed!
    pause
    exit /b 1
)
echo         Done.

:: Install Electron and builder
echo  [4/8] Installing Electron ^& Builder...
call npm install --save-dev electron electron-builder
if %errorlevel% neq 0 (
    echo         ERROR: Electron install failed!
    pause
    exit /b 1
)
echo         Done.

:: Create icon files
echo  [5/8] Creating app icons...
if not exist build mkdir build
node scripts/create-icon.cjs
node scripts/png-to-ico.cjs none build/icon.ico
if not exist build\icon.ico (
    echo         ERROR: icon.ico was not created!
    pause
    exit /b 1
)
echo         ICO: build\icon.ico
echo         Done.

:: Build Vite app
echo  [6/8] Building web app...
call npm run build
if %errorlevel% neq 0 (
    echo         ERROR: Vite build failed!
    pause
    exit /b 1
)
echo         Done.

:: Update package.json for Electron
echo  [7/8] Configuring Electron...
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.main='electron/main.cjs';p.name='multibrowse';p.productName='MultiBrowse';p.version='1.2.0';p.description='Anti-Detect Browser Manager';p.author='MultiBrowse';fs.writeFileSync('package.json',JSON.stringify(p,null,2));"
if %errorlevel% neq 0 (
    echo         ERROR: Config update failed!
    pause
    exit /b 1
)
echo         Done.

:: Build EXE
echo  [8/8] Building EXE (this may take a few minutes)...
echo.
call npx electron-builder --config electron-builder.json --win
if %errorlevel% neq 0 (
    echo.
    echo  ======================================================================
    echo    ERROR: EXE build failed!
    echo  ======================================================================
    pause
    exit /b 1
)

echo.
echo  ======================================================================
echo    BUILD COMPLETE!
echo  ======================================================================
echo.
echo    Output files in: release\
echo.

:: List output files
for %%f in (release\*.exe) do (
    echo    - %%~nxf
)

echo.
echo    You can now run MultiBrowse-Portable.exe
echo  ======================================================================
echo.
pause
