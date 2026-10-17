@echo off
cd /d "%~dp0"
node cli.js stop
timeout /t 2 >nul
