@echo off
setlocal
title Stream Games Launcher

chcp 65001 >nul
echo STREAM GAMES...
cd /d "%~dp0"
echo ------------------------------------------------------
echo  SERVER IS STARTING...
echo  URL: http://localhost:3000
echo ------------------------------------------------------
call npm start
