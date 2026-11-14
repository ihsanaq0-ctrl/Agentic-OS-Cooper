@echo off
setlocal
title ULTRON - Agentic OS (Content Agent OS)

echo ============================================
echo   ULTRON - Agentic OS launcher
echo   Owner: Ihsan Ullah
echo ============================================
echo.

cd /d "%~dp0content-os"
if errorlevel 1 (
  echo [ULTRON] Could not enter the content-os folder.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ULTRON] Node.js not found. Install it from https://nodejs.org
  pause
  exit /b 1
)

REM -- If something already serves port 3950, just open the dashboard --
netstat -ano | findstr ":3950" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo [ULTRON] Server already running on http://localhost:3950
  start "" "http://localhost:3950"
  exit /b 0
)

REM -- Remove stale WASM SQLite lock left by an unclean shutdown --
REM    (fixes "database is locked" at startup)
if exist "data\content-os.sqlite.lock" (
  echo [ULTRON] Removing stale database lock...
  rmdir /s /q "data\content-os.sqlite.lock"
)

echo [ULTRON] Starting server on http://localhost:3950
echo [ULTRON] Close this window or press Ctrl+C to stop ULTRON.
echo.

REM -- Open the dashboard in the default browser after the server boots --
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3950'"

npm start

echo.
echo [ULTRON] Server stopped.
pause
