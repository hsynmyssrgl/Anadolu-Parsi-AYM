$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Panthera pardus tulliana Bronze kurulum paketi hazırlanıyor..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js bulunamadı. Node.js LTS kurup yeniden deneyin."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm bulunamadı. Node.js kurulumunu kontrol edin."
}

npm ci
npm run verify
npm run package:win --workspace @ppt/desktop

$Release = Join-Path $Root "apps/desktop/release"
Write-Host "Kurulum paketi oluşturuldu: $Release" -ForegroundColor Green
Get-ChildItem $Release -Filter *.exe | Select-Object FullName, Length, LastWriteTime
