@echo off
cd /d "%~dp0"
node cli.js start
timeout /t 2 >nul
