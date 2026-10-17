@echo off
title LarpCord Status
cd /d "%~dp0"
node cli.js status
echo.
pause
