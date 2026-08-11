@echo off
setlocal
cd /d "%~dp0"
echo Anadolu Parsi Aile Yasam Merkezi - Bronze Windows Guvenlik Kapatma
echo Build222 / 02.08.2026.222
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-build222-bronze-security-closure.ps1"
set "PPT_EXIT_CODE=%ERRORLEVEL%"
echo.
if "%PPT_EXIT_CODE%"=="0" (
  echo OPEN-021 + OPEN-022 GERCEK WINDOWS KANITI: PASS / READY_TO_CLOSE
) else if "%PPT_EXIT_CODE%"=="21" (
  echo OPEN-021 READY_TO_CLOSE; OPEN-022 NOT_READY
) else if "%PPT_EXIT_CODE%"=="22" (
  echo OPEN-022 READY_TO_CLOSE; OPEN-021 NOT_READY
) else (
  echo OPEN-021 / OPEN-022 HENUZ KAPANMADI. Ayrintilar artifacts\validation klasorundedir.
)
echo.
echo artifacts\validation klasorundeki Bronze_Guvenlik_Windows_Kanitlari_Build222_*.zip ve .sha256 dosyalarini saklayin.
pause
exit /b %PPT_EXIT_CODE%
