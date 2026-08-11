$ErrorActionPreference = "Stop"
Write-Host "Panthera pardus tulliana kodlama hazırlığı doğrulanıyor..." -ForegroundColor Cyan
node --version
npm --version
npm install
npm run verify
Write-Host "Doğrulama tamamlandı." -ForegroundColor Green
