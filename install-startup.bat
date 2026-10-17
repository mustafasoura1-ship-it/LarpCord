@echo off
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LarpCord.vbs"

echo Creating startup shortcut...
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%~dp0"
echo WshShell.Run "node src\daemon.js", 0, False
) > "%STARTUP%"

if exist "%STARTUP%" (
    echo [OK] LarpCord will now start silently on Windows boot.
) else (
    echo [!] Failed to write to Startup folder.
)
timeout /t 3 >nul
