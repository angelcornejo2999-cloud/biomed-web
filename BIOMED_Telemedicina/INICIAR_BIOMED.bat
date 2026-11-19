@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   BIOMED - TELEMEDICINA INTEGRAL (DEMO LOCAL)
echo ================================================
where py >nul 2>nul
if %errorlevel%==0 (
  py app.py
) else (
  python app.py
)
echo.
echo El servidor se ha detenido.
pause
