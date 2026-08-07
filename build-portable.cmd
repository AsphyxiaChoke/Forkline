@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-portable.ps1" %*
if errorlevel 1 (
  echo.
  echo Portable build failed.
  pause
  exit /b 1
)
echo.
echo Portable build completed.
pause
