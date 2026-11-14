@echo off
setlocal
title COOPER - Unified Agentic OS
echo ===================================================
echo   COOPER - Unified Agentic OS (Butler Edition)
echo   Tri-Modal: Voice, Text, and Hand Gestures
echo ===================================================
echo.

cd /d "%~dp0content-os"
if errorlevel 1 (
  echo [Cooper] Error: Could not enter the content-os directory.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [Cooper] Node.js not detected on PATH. Please install Node.js v20+.
  pause
  exit /b 1
)

REM -- Clean up stale SQLite WASM locks if any --
if exist "data\content-os.sqlite.lock" (
  echo [Cooper] Clearing stale database lock...
  rmdir /s /q "data\content-os.sqlite.lock" 2>nul
)

REM -- If port 3950 is already running, open HUD directly --
netstat -ano | findstr ":3950" | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo [Cooper] Cooper is already running on http://localhost:3950
  start "" "http://localhost:3950"
  exit /b 0
)

echo [Cooper] Booting Cooper Master Hub on http://localhost:3950...
echo [Cooper] Press Ctrl+C to halt the system.
echo.

REM -- Open HUD in default browser after startup --
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3950'"

npm start
