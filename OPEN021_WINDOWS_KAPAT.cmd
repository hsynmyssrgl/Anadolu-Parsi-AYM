@echo off
setlocal
cd /d "%~dp0"
echo Anadolu Parsi Aile Yasam Merkezi - OPEN-021 Windows Kapatma
echo Build217 / 01.08.2026.217
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-open021-windows-closure.ps1"
set "PPT_EXIT_CODE=%ERRORLEVEL%"
echo.
if "%PPT_EXIT_CODE%"=="0" (
  echo OPEN-021 GERCEK WINDOWS KANITI: PASS / READY_TO_CLOSE
  echo artifacts\validation klasorundeki OPEN021_Windows_Kanitlari_Build217_*.zip dosyasini saklayin.
) else (
  echo OPEN-021 HENUZ KAPANMADI. Ayrintilar artifacts\validation klasorundedir.
)
echo.
pause
exit /b %PPT_EXIT_CODE%
