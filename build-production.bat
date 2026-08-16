@echo off
setlocal
title NEON SWARM - Production Build
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto :nonode
if not exist "node_modules\" (
  echo [SETUP] Installing dependencies...
  call npm install
  if errorlevel 1 goto :failed
)
echo [CHECK] Running TypeScript checks...
call npm run typecheck
if errorlevel 1 goto :failed
echo [BUILD] Creating production files...
call npx vite build --configLoader runner
if errorlevel 1 goto :failed
echo.
echo [SUCCESS] Production build is ready in dist\
pause
goto :eof
:nonode
echo [ERROR] Node.js was not found. Install Node.js 22 LTS or newer.
goto :pause
:failed
echo.
echo [ERROR] Build failed. Review the message above.
:pause
pause

