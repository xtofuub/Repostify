@echo off
rem ── Repostify one-click launcher (Windows) ─────────────────────────────
rem Installs deps if missing, starts the dev server, opens the browser.
setlocal
cd /d "%~dp0"

rem Prefer pnpm (the project's package manager); fall back to npm.
where pnpm >nul 2>&1 && (set "PM=pnpm") || (set "PM=npm")

if not exist node_modules (
  echo Installing dependencies with %PM% ...
  call %PM% install
  if errorlevel 1 (
    echo.
    echo Dependency install failed. Fix the error above and re-run.
    pause
    exit /b 1
  )
)

echo.
echo Starting Repostify at http://localhost:3000
echo Leave this window open while you use it. Close it to stop the server.
echo.

rem Open the browser once the server actually answers (side window polls it).
rem Single line — no caret continuation (a trailing space after ^ would break it).
start "" powershell -NoProfile -Command "for($i=0;$i -lt 90;$i++){try{ if((Invoke-WebRequest -UseBasicParsing http://localhost:3000 -TimeoutSec 2).StatusCode -eq 200){ Start-Process 'http://localhost:3000'; break } }catch{}; Start-Sleep -Milliseconds 800 }"

rem Pin to port 3000 so the URL above always matches the running server.
rem Use the PORT env var, not "-- -p 3000": pnpm forwards "--" literally and
rem next dev then treats "-p" as the project directory and aborts.
set "PORT=3000"
call %PM% run dev
