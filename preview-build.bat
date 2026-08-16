@echo off
setlocal
title NEON SWARM - Production Preview
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto :nonode
if not exist "node_modules\" call npm install
if errorlevel 1 goto :failed
if not exist "dist\index.html" (
  echo [BUILD] Production files were not found. Building now...
  call npm run build
  if errorlevel 1 goto :failed
)
echo.
echo [START] Preview URL: http://localhost:54173/
start "NEON SWARM Preview" /b cmd /c "npm run preview"
echo [WAIT] Waiting for the preview server...
powershell -NoProfile -Command "$ok=$false; 1..30 | ForEach-Object { try { $r=Invoke-WebRequest -UseBasicParsing 'http://localhost:54173/' -TimeoutSec 1; if($r.StatusCode -eq 200){$ok=$true;break} } catch {}; Start-Sleep -Milliseconds 500 }; if(-not $ok){exit 1}"
if errorlevel 1 goto :failed
echo [READY] Opening NEON SWARM at http://localhost:54173/
start "" "http://localhost:54173/"
echo.
echo Keep this window open while playing. Press any key to stop the server.
pause >nul
taskkill /FI "WINDOWTITLE eq NEON SWARM Preview" /T /F >nul 2>&1
goto :eof
if errorlevel 1 goto :failed
goto :eof
:nonode
echo [ERROR] Node.js was not found. Install Node.js 22 LTS or newer.
goto :pause
:failed
echo.
echo [ERROR] Preview failed. Port 54173 may already be in use.
:pause
pause

