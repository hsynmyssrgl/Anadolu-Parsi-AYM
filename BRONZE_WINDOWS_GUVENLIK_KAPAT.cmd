@echo off
setlocal
cd /d "%~dp0"
echo Anadolu Parsi Aile Yasam Merkezi - Birlesik Bronze Windows Guvenlik Kapatma
echo Build219 / 01.08.2026.219
echo OPEN-021 EFS + OPEN-022 safeStorage/DPAPI ve protected side-artifact
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-build219-bronze-security-closure.ps1"
set "PPT_EXIT_CODE=%ERRORLEVEL%"
echo.
if "%PPT_EXIT_CODE%"=="0" (
  echo OPEN-021 + OPEN-022: PASS / READY_TO_CLOSE
) else if "%PPT_EXIT_CODE%"=="21" (
  echo OPEN-021: PASS / READY_TO_CLOSE
  echo OPEN-022: HENUZ KAPANMADI
) else if "%PPT_EXIT_CODE%"=="22" (
  echo OPEN-022: PASS / READY_TO_CLOSE
  echo OPEN-021: HENUZ KAPANMADI
) else (
  echo OPEN-021 ve OPEN-022 HENUZ KAPANMADI.
)
echo artifacts\validation klasorundeki Bronze_Guvenlik_Windows_Kanitlari_Build219_*.zip ve .sha256 dosyalarini saklayin.
echo.
pause
exit /b %PPT_EXIT_CODE%
