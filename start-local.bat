@echo off
setlocal
title NEON SWARM - Development Server
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto :nonode
if not exist "node_modules\" (
  echo [SETUP] Installing dependencies...
  call npm install
  if errorlevel 1 goto :failed
)
echo.
echo [START] Game URL: http://localhost:53173/
start "NEON SWARM Server" /b cmd /c "npm run dev"
echo [WAIT] Waiting for the game server...
powershell -NoProfile -Command "$ok=$false; 1..30 | ForEach-Object { try { $r=Invoke-WebRequest -UseBasicParsing 'http://localhost:53173/' -TimeoutSec 1; if($r.StatusCode -eq 200){$ok=$true;break} } catch {}; Start-Sleep -Milliseconds 500 }; if(-not $ok){exit 1}"
if errorlevel 1 goto :failed
echo [READY] Opening NEON SWARM at http://localhost:53173/
start "" "http://localhost:53173/"
echo.
echo Keep this window open while playing. Press any key to stop the server.
pause >nul
taskkill /FI "WINDOWTITLE eq NEON SWARM Server" /T /F >nul 2>&1
goto :eof
if errorlevel 1 goto :failed
goto :eof
:nonode
echo [ERROR] Node.js was not found. Install Node.js 22 LTS or newer.
goto :pause
:failed
echo.
echo [ERROR] Startup failed. Port 53173 may already be in use.
:pause
pause

