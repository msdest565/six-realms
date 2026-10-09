@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-preview.ps1" %*
if errorlevel 1 (
    echo Preview could not start. See the error above.
    pause
    exit /b 1
)
echo Open the URL above in your browser.
pause
