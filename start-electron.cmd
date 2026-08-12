@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron 尚未安装，请先在当前目录执行 npm.cmd install
  pause
  exit /b 1
)

call npm.cmd run desktop -- %*
