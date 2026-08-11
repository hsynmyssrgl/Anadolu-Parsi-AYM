@echo off
setlocal
cd /d "%~dp0"
echo Anadolu Parsi Aile Yasam Merkezi - OPEN-022 Windows Kapatma
echo Build218 / 01.08.2026.218
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-open022-windows-closure.ps1"
set "PPT_EXIT_CODE=%ERRORLEVEL%"
echo.
if "%PPT_EXIT_CODE%"=="0" (
  echo OPEN-022 GERCEK WINDOWS KANITI: PASS / READY_TO_CLOSE
  echo artifacts\validation klasorundeki OPEN022_Windows_Kanitlari_Build218_*.zip dosyasini saklayin.
) else (
  echo OPEN-022 HENUZ KAPANMADI. Ayrintilar artifacts\validation klasorundedir.
)
echo.
pause
exit /b %PPT_EXIT_CODE%
