# ADR-094 — Isolated Windows packager bootstrap ve PowerShell 5.1 kanıt kodlaması

## Karar

Birleşik Bronze Windows güvenlik kapanışında iki dependency graph açıkça bootstrap edilir:

1. root workspace: `npm ci --no-audit --no-fund`
2. izole Windows packager: `npm run windows-packager:install`

İkinci adım tamamlandıktan sonra `tools/windows-packager/node_modules/electron-builder/cli.js` fiziksel olarak doğrulanır. Eksikse installer build başlatılmaz.

Windows PowerShell 5.1 tarafından doğrudan çalıştırılan Build220 `.ps1` dosyaları UTF-8 BOM ile saklanır. Bu, Türkçe ürün adı ve kurulu executable/uninstaller yollarının mojibake nedeniyle bozulmasını önler.

Her alt süreç için bounded stdout/stderr tail lifecycle JSON'a eklenir; böylece sonraki Windows hatası kanıtsız exit code'a indirgenmez.
