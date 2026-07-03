@echo off
setlocal enabledelayedexpansion

cd /d %~dp0

echo ==================================================
echo   AI Development Context Optimizer Launcher
echo ==================================================

rem Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js and try again.
    pause
    exit /b 1
)

rem Check node_modules and install if missing
if not exist node_modules (
    echo node_modules not found. Installing dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

rem Check build artifacts and build if missing
if not exist dist (
    echo Build artifacts not found. Building project...
    call npm run build
    if !errorlevel! neq 0 (
        echo [ERROR] Build failed.
        pause
        exit /b 1
    )
)

rem Run security static scan
echo Running security static scan...
call npm run scan
if !errorlevel! neq 0 (
    echo [ERROR] External network connection detected. Launch aborted.
    pause
    exit /b 1
)

rem Open browser
echo Opening http://localhost:4173 in your browser...
start http://localhost:4173

rem Start server
echo Starting server...
node server.js

pause