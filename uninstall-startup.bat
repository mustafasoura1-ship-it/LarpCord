@echo off
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LarpCord.vbs"

if exist "%STARTUP%" (
    del /f /q "%STARTUP%"
    echo [OK] Removed LarpCord from Windows Startup.
) else (
    echo [i] LarpCord was not in Startup.
)
timeout /t 3 >nul
