@echo off
setlocal
title Anadolu Parsi Aile Yasam Merkezi - Build227 Windows Guvenlik Kapatma
echo Anadolu Parsi Aile Yasam Merkezi - Bronze Windows Guvenlik Kapatma
echo Build227 / 02.08.2026.227
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-build227-bronze-security-closure.ps1"
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo OPEN-021 / OPEN-022 READY_TO_CLOSE.
) else if "%RESULT%"=="21" (
  echo Yalniz OPEN-021 READY_TO_CLOSE.
) else if "%RESULT%"=="22" (
  echo Yalniz OPEN-022 READY_TO_CLOSE.
) else (
  echo OPEN-021 / OPEN-022 HENUZ KAPANMADI. Ayrintilar artifacts\validation klasorundedir.
)
echo.
echo artifacts\validation klasorundeki Bronze_Guvenlik_Windows_Kanitlari_Build227_*.zip ve .sha256 dosyalarini saklayin.
pause
exit /b %RESULT%
