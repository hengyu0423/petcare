@echo off
title PawCare Launcher

set "ROOT=%~dp0"

echo Starting PawCare...
echo.

start "PawCare Frontend" /D "%ROOT%pet app" cmd /k npm run dev
timeout /t 2 /nobreak >nul

start "PawCare API" /D "%ROOT%pet-api" cmd /k npm run dev
timeout /t 2 /nobreak >nul

start "PawCare PetCam" cmd /k call "%ROOT%pet cam\restart_petcam.bat"

echo.
echo Started Frontend, API, and PetCam.
echo You can close this launcher window.
pause
