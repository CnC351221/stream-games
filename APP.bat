@echo off
setlocal
title Stream Games App Launcher

:: Use English to avoid encoding issues in CMD
chcp 65001 >nul
echo STARTING APPLICATION (ELECTRON)...
cd /d "%~dp0"
echo ------------------------------------------------------
echo  LAUNCHING...
echo  (Server will also be at: http://localhost:3000)
echo ------------------------------------------------------
call npm run app
