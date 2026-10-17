@echo off
title LarpCord - Controller
cd /d "%~dp0"

:menu
cls
echo ========================================================
echo                  LARPCORD CONTROLLER
echo ========================================================
echo.
node cli.js status
echo.
echo --------------------------------------------------------
echo   [1] Start Background Client
echo   [2] Stop Client
echo   [3] Restart Client
echo   [4] Refresh Status
echo   [5] Run Interactive Monitor
echo   [6] Edit config.json
echo   [7] Exit
echo --------------------------------------------------------
set /p opt="Choose (1-7): "

if "%opt%"=="1" (
    call start.bat
    goto menu
)
if "%opt%"=="2" (
    call stop.bat
    goto menu
)
if "%opt%"=="3" (
    node cli.js restart
    timeout /t 2 >nul
    goto menu
)
if "%opt%"=="4" goto menu
if "%opt%"=="5" (
    node cli.js run
    pause
    goto menu
)
if "%opt%"=="6" (
    start notepad config.json
    goto menu
)
if "%opt%"=="7" exit
goto menu
