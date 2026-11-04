@echo off
title PawCare PetCam (auto-restart)
cd /d "%~dp0"

rem 記錄寫入線上 API（不分本機/網頁端，同一個資料庫；只開 petcam 也能記錄）
set "PET_API_URL=https://pet-api-orcin.vercel.app"

:loop
echo [%date% %time%] Starting pet cam (main.py)...
python main.py
echo [%date% %time%] pet cam stopped (exit code %errorlevel%). Restarting in 5 seconds... (close this window to stop)
timeout /t 5 /nobreak >nul
goto loop
