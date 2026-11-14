# fix-content-os.ps1
# Diagnose and fix the two most common startup problems:
#   1. "SQLite3Error: database is locked" - a leftover .lock from a killed instance
#   2. "EADDRINUSE :::3950" - the app (or another app) already owns the port
# Safe to re-run any time. Deletes NOTHING except the stale lock directory.
# Usage:
#   powershell -ExecutionPolicy Bypass -File fix-content-os.ps1
#   .\fix-content-os.ps1          (if your execution policy allows scripts)

$ErrorActionPreference = 'SilentlyContinue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $here 'data'
$lockDir = Join-Path $dataDir 'content-os.sqlite.lock'
$pidFile = Join-Path $dataDir 'content-os.pid'
$dbFile = Join-Path $dataDir 'content-os.sqlite'
$port = 3950
$envPort = [int][Environment]::GetEnvironmentVariable('PORT','Process')
if ($envPort -gt 0) { $port = $envPort }

Write-Host "Content Agent OS - diagnostic fixer" -ForegroundColor Cyan
Write-Host "  Working dir:  $here"
Write-Host "  Port:         $port"
Write-Host ""

# 1. Who owns the port?
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  Write-Host ("  Port $port is IN USE by PID $($listener.OwningProcess) ($($proc.ProcessName)) - the app is probably already running.") -ForegroundColor Yellow
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 3
    Write-Host "  Dashboard responds: HTTP $($resp.StatusCode) at http://localhost:$port" -ForegroundColor Green
  } catch {
    Write-Host "  Port responds but dashboard check failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
} else {
  Write-Host "  Port $port is free - no instance is running." -ForegroundColor Green
}

# 2. Stale lock directory from a previous (possibly killed) run?
if (Test-Path $lockDir) {
  $isDir = (Get-Item $lockDir -Force).PSIsContainer
  Write-Host "  Found leftover lock: $lockDir" -ForegroundColor Yellow
  Write-Host "  Removing it (the DB file itself is untouched)." -ForegroundColor Yellow
  if ($isDir) { Remove-Item $lockDir -Recurse -Force -ErrorAction SilentlyContinue }
  else { Remove-Item $lockDir -Force -ErrorAction SilentlyContinue }
  if (Test-Path $lockDir) { Write-Host "  !! Could not remove the lock - close any open node processes, or run as Administrator." -ForegroundColor Red }
  else { Write-Host "  Lock removed. The app should start cleanly now." -ForegroundColor Green }
} else {
  Write-Host "  No leftover lock found." -ForegroundColor Green
}

# 2b. Stale single-instance pid marker (the app cleans it on clean exit,
#     but a force-kill can leave it behind)?
if (Test-Path $pidFile) {
  Write-Host "  Found leftover pid marker: $pidFile" -ForegroundColor Yellow
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  if (Test-Path $pidFile) { Write-Host "  !! Could not remove the pid marker." -ForegroundColor Red }
  else { Write-Host "  Pid marker removed." -ForegroundColor Green }
}

# 3. DB present?
if (Test-Path $dbFile) {
  Write-Host "  Database found: $dbFile (your data is safe)" -ForegroundColor Green
} else {
  Write-Host "  No database yet - first run will create it." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next step - start the app FROM THE CONTENT-OS FOLDER:" -ForegroundColor Cyan
Write-Host "    cd $here"
Write-Host "    npm start"
Write-Host "  Then open:  http://localhost:$port"
