@echo off
setlocal
cd /d "%~dp0"
echo Panthera pardus tulliana Aile - Bronze Final Windows Dogrulamasi
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-bronze-final-windows-validation.ps1"
set "PPT_EXIT_CODE=%ERRORLEVEL%"
echo.
if "%PPT_EXIT_CODE%"=="0" (
  echo DOGRULAMA TAMAMLANDI: PASS
) else (
  echo DOGRULAMA TAMAMLANAMADI. Ayrintilar artifacts\validation klasorundedir.
)
echo.
pause
exit /b %PPT_EXIT_CODE%
