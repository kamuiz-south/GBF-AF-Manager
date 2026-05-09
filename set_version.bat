@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   GBF AF Manager - Version Updater
echo ========================================
echo.

if "%~1"=="" (
    echo [ERROR] No version specified.
    echo Usage: set_version.bat [new-version]
    echo Example: set_version.bat 1.0.7
    echo.
    pause
    exit /b 1
)

cd af-manager
call node scripts\bump-version.js %1

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to update version.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Version successfully updated to v%1 across all files!
pause
