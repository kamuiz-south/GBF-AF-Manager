@echo off
setlocal
cd /d %~dp0

echo ========================================
echo   GBF AF Manager - Build ^& Package Script
echo ========================================
echo.

:: Get versions from JSON files using powershell
for /f "delims=" %%A in ('powershell -NoProfile -Command "(Get-Content af-manager\package.json | ConvertFrom-Json).version"') do set MGR_VERSION=%%A
for /f "delims=" %%A in ('powershell -NoProfile -Command "(Get-Content af-collector\manifest.json | ConvertFrom-Json).version"') do set COL_VERSION=%%A

echo AF Manager Version: %MGR_VERSION%
echo AF Collector Version: %COL_VERSION%
echo.

echo [1/3] Building Frontend and Tauri App...
cd af-manager
call npx tauri build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed. Please check the logs above.
    pause
    exit /b %ERRORLEVEL%
)

cd ..

echo.
echo [2/3] Finalizing binaries...
set RELEASE_DIR=af-manager\src-tauri\target\release
set BUNDLE_MSI_DIR=%RELEASE_DIR%\bundle\msi
set BUNDLE_NSIS_DIR=%RELEASE_DIR%\bundle\nsis

if exist "%RELEASE_DIR%\app.exe" (
    move /y "%RELEASE_DIR%\app.exe" "%RELEASE_DIR%\GBF_AF_Manager.exe"
)

echo.
echo [3/3] Creating Release ZIP archives...
set OUT_DIR=%~dp0\releases
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

:: 1. Installer ZIP (contains .msi and nsis setup .exe)
echo   - Creating Installer ZIP (MSI and NSIS)...
powershell -NoProfile -Command "Compress-Archive -Path '%BUNDLE_MSI_DIR%\*.msi', '%BUNDLE_NSIS_DIR%\*.exe' -DestinationPath '%OUT_DIR%\GBF_AF_Manager_installer_%MGR_VERSION%.zip' -Force"

:: 2. Portable ZIP (contains standalone .exe)
echo   - Creating Portable ZIP...
powershell -NoProfile -Command "Compress-Archive -Path '%RELEASE_DIR%\GBF_AF_Manager.exe' -DestinationPath '%OUT_DIR%\GBF_AF_Manager_portable_%MGR_VERSION%.zip' -Force"

:: 3. AF Collector ZIP (contains af-collector folder contents)
echo   - Creating AF Collector ZIP...
powershell -NoProfile -Command "Compress-Archive -Path '%~dp0\af-collector\*' -DestinationPath '%OUT_DIR%\AF_Collector_%COL_VERSION%.zip' -Force"

echo.
echo ========================================
echo   BUILD ^& PACKAGE COMPLETE!
echo ========================================
echo.
echo Release archives can be found in:
echo   %OUT_DIR%
echo.
pause
