@echo off
title PawCare PetCam (auto-restart)
cd /d "%~dp0"

:loop
echo [%date% %time%] Starting pet cam (main.py)...
python main.py
echo [%date% %time%] pet cam stopped (exit code %errorlevel%). Restarting in 5 seconds... (close this window to stop)
timeout /t 5 /nobreak >nul
goto loop
