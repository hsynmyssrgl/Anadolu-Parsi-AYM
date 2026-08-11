# Panthera pardus tulliana Aile — Bronze RC2 Build 111

- Application Version: `25.07.2026.111`
- Package Version: `25.7.2026-111`
- Stage: **Bronze RC2 Active Development**
- Promotion: Bronze RC2 Final / Code Freeze / Silver / Gold yapılmadı.

## Build 111 odağı

Bağımlılık gerektirmeyen kaynak, lockfile, workspace graph ve sürüm sözleşmelerinin dış npm hizmetinden önce ve bağımsız biçimde çalıştırılması; RC2 raporunda kaynak ön-kontrolü ile bağımlılık erişim kapısının ayrı statüler olarak korunması sağlandı.

## Mimari değişiklikler

- `config/source-preflight-checks.json` bağımlılıktan bağımsız zorunlu kontrolleri tek sözleşmede toplar.
- `scripts/run-source-preflight.mjs` yalnızca Node standart kütüphanesiyle ve `scripts/*.mjs` sınırı içinde çalışır.
- Lockfile integrity, dependency supply, workspace dependency graph, version sequence ve active version contract dış paket kurulumu olmadan çalıştırılır.
- RC2 gate yapılandırması fazlara ayrıldı ve kaynak ön-kontrolü ilk zorunlu faz yapıldı.
- Dış npm erişimi başarısız olsa bile geçen kaynak ön-kontrolleri PASS olarak korunur; bağımlılık gerektiren sonraki kapılar `blockedBy` alanıyla `NOT_RUN` kalır.
- Platforma uygun olmayan bir kapı, sonraki bağımsız kapıları yanlışlıkla engellemez.
- Linux CI ve Windows RC2 workflow kanıt paketleri kaynak ön-kontrol raporunu korur.

## Aşama durumu

Bu artırım aktif mimari geliştirmedir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.

## Gerçek doğrulama durumu

- Source preflight: **PASS — 5/5 kontrol**
- Lockfile integrity: **PASS — 1.150 assertion / 14 workspace**
- Dependency supply: **PASS — 1.349 assertion / 436 tarball**
- Workspace dependency contracts: **PASS — 356 assertion**
- Aktif sürüm sözleşmesi: **PASS — 176 assertion**
- Build 111 mimari doğrulaması: **PASS — 98 assertion**
- Package-source controlled type-check: **PASS — TypeScript 5.8.3**
- Electron-main controlled source type-check: **PASS**
- Aktif Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC**
- Temiz `npm ci`: **FAIL — üç denemede EAI_AGAIN / ATTEMPT_TIMEOUT**
- Başarısız kurulum kalıntı temizliği: **PASS — kök ve desktop node_modules kaldırıldı**
- Tam root `tsc --noEmit`, production build, blocking smoke, Windows gerçek açılış ve installer: **NOT_RUN**
