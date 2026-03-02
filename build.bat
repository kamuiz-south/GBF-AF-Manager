@echo off
setlocal
cd /d %~dp0\af-manager

echo ========================================
echo   GBF AF Manager - Build Script
echo ========================================
echo.
echo Version: 1.0.0
echo.

echo [1/2] Building Frontend and Tauri App...
call npx tauri build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed. Please check the logs above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Finalizing binaries...
set RELEASE_DIR=src-tauri\target\release

if exist "%RELEASE_DIR%\app.exe" (
    move /y "%RELEASE_DIR%\app.exe" "%RELEASE_DIR%\GBF_AF_Manager.exe"
)

echo.
echo ========================================
echo   BUILD COMPLETE!
echo ========================================
echo.
echo Binaries can be found in:
echo   - MSI: %RELEASE_DIR%\bundle\msi
echo   - EXE: %RELEASE_DIR%
echo.
pause
