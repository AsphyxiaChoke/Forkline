@echo off
setlocal
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git was not found in PATH.
  goto :failed
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [ERROR] This folder is not a Git repository.
  goto :failed
)

for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if not "%CURRENT_BRANCH%"=="main" (
  echo [ERROR] Current branch is "%CURRENT_BRANCH%". Switch to "main" first.
  goto :failed
)

echo [Forkline] Pulling origin/main...
git pull --rebase origin main
if errorlevel 1 goto :failed

echo.
echo [Forkline] Pull completed.
git log -1 --oneline
echo.
pause
exit /b 0

:failed
echo.
echo [Forkline] Pull stopped. Resolve the message above and try again.
echo.
pause
exit /b 1
