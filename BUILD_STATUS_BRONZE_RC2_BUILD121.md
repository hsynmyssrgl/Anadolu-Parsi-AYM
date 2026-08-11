# Bronze RC2 Build 121 Durumu

- Product: Panthera pardus tulliana Aile
- Application Version: `25.07.2026.121`
- Package Version: `25.7.2026-121`
- Stage: **Bronze RC2 Active Development**
- Build: **121**

## Geliştirme kapsamı

Windows ve POSIX ortamlarındaki workspace manifest yolları tek bir kanonik repository-yolu sözleşmesine bağlandı. Aktif sürüm doğrulayıcısı ve güvenli sürüm artırıcı artık `package-lock.json` workspace girdilerini platformdan bağımsız biçimde bulur ve günceller.

## Kaynak doğrulamaları

- Workspace path portability sözleşmesi: **PASS — 37 assertion**
- Build 121 mimari doğrulaması: **PASS — 60 entegrasyon assertion + 37 sözleşme assertion**
- Source preflight: **PASS — 11/11**
- Source integrity: **PASS — 967 kaynak / 968 SHA-256 girdisi**
- Package-source type-check: **PASS — TypeScript 7.0.2**
- Electron-main kontrollü type-check: **PASS**
- Database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC**

## Zorunlu RC2 kapıları

- Clean `npm ci`: **PASS — resmî npm registry / 349 paket**
- Tam root `tsc --noEmit`: **PASS — TypeScript 7.0.2**
- Electron production build: **FAIL — esbuild kaynak dizini erişim hatası**
- Blocking smoke zinciri: **NOT_RUN — blockedBy: electron-production-build**
- Windows gerçek açılış: **NOT_RUN — blockedBy: electron-production-build**
- Windows installer: **NOT_RUN — blockedBy: electron-production-build**

Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmedi.
