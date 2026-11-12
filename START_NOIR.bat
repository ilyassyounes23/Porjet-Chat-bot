@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title NOIR - Curated Cinema Streaming Platform

echo.
echo ========================================================================
echo   NOIR  ^|  Editorial Cinema Streaming Platform
echo ========================================================================
echo.

:: 1. Verify Node.js installation
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not found in PATH.
  echo.
  echo   Please install Node.js LTS ^(v20 or newer^) from:
  echo   https://nodejs.org/
  echo.
  echo   After installing Node.js, double-click START_NOIR.bat again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js detected: %NODE_VER%

:: 2. Verify npm installation
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  echo   Please reinstall Node.js from https://nodejs.org/ ^(includes npm^).
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('call npm -v') do set NPM_VER=%%v
echo [OK] npm detected: v%NPM_VER%

:: 3. Install dependencies if node_modules does not exist
if not exist "node_modules\" (
  echo.
  echo [INFO] node_modules not found. Installing dependencies ^(first run^)...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install dependencies via npm install.
    echo   Verify your internet connection and retry START_NOIR.bat.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo [OK] Dependencies installed successfully.
) else (
  echo [OK] Dependencies ready ^(node_modules found^).
)

:: 4. Ensure port 5173 is not blocked by another non-NOIR process
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5173/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200 -and $r.Content -match 'NOIR') { exit 10 } } catch { exit 0 }"
if errorlevel 10 (
  echo.
  echo [INFO] NOIR is already running on http://localhost:5173
  echo [INFO] Opening browser...
  start "" "http://localhost:5173"
  exit /b 0
)

echo.
echo [INFO] Starting NOIR development server on http://localhost:5173 ...
echo [INFO] Your default browser will open automatically once ready.
echo [INFO] Keep this window open while watching. Press Ctrl+C to stop NOIR.
echo.

:: 5. Background readiness watcher: polls http://localhost:5173/api/health before opening browser
start "" /b powershell -NoProfile -WindowStyle Hidden -Command ^
  "$deadline = (Get-Date).AddSeconds(60); " ^
  "while ((Get-Date) -lt $deadline) { " ^
  "  try { " ^
  "    $res = Invoke-WebRequest -Uri 'http://localhost:5173/api/health' -UseBasicParsing -TimeoutSec 2; " ^
  "    if ($res.StatusCode -eq 200) { " ^
  "      Start-Process 'http://localhost:5173'; " ^
  "      exit 0 " ^
  "    } " ^
  "  } catch {} " ^
  "  Start-Sleep -Milliseconds 500 " ^
  "}"

:: 6. Start Vite dev server (configured with port: 5173 and strictPort: true in vite.config.ts)
call npm run dev
set SERVER_EXIT=%ERRORLEVEL%

if not "%SERVER_EXIT%"=="0" (
  echo.
  echo [ERROR] The NOIR server exited with code %SERVER_EXIT%.
  echo   If port 5173 is occupied by another program, close that program and retry.
  echo.
  pause
  exit /b %SERVER_EXIT%
)

endlocal
