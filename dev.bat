@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "PYTHONPATH=%cd%\src;%PYTHONPATH%"
set "AZUFW_DEV=1"

echo =====================================
echo  🔥 azufw - Development Mode
echo  (mock data, no UFW required)
echo =====================================
echo.

python -m azufw

if errorlevel 1 (
    echo.
    echo ⚠️  Try installing dependencies first:
    echo    pip install textual
    pause
)
