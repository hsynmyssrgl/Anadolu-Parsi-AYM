# Build 215 — Bronze RC2 Active Development

- Application Version: `01.08.2026.215`
- Package Version: `1.8.2026-215`
- Build: **215**
- Stage: **Bronze RC2 Active Development**
- Scope: OPEN-021/OPEN-022 gerçek Windows EFS + Electron safeStorage/DPAPI + paketli runtime evidence harness
- Project Rules: `PROJECT-RULES-2026-08-01-V5` / `2e342a2e0a982bb19c2e45fb25b67336f70eb71969ce1e0f4e298f3fe6cfe9d1`

## Durum

Build215, Build213/214 güvenlik uygulamalarını değiştirmekten çok onların gerçek Windows platform kanıtını fail-closed ve tekrar üretilebilir hale getirir. Windows test probu yalnız `PPT_WINDOWS_SECURITY_PROBE=1` altında çalışır; normal product runtime bu probu çalıştırmaz.

## Doğrulanmış kaynak kanıtları

- Windows security evidence harness contract: **PASS (26/26)**
- Package source TypeScript: **PASS**
- Desktop-main controlled TypeScript: **PASS**
- Node script syntax: **PASS**
- PowerShell parser: **NOT_RUN** — bu ortamda `pwsh` yok

## Platform kanıt sınırı

- Real Windows EFS: **NOT_RUN**
- Real Electron safeStorage/DPAPI: **NOT_RUN**
- Development Windows Electron launch: **NOT_RUN**
- Packaged/installed Windows Electron launch: **NOT_RUN**
- Windows installer lifecycle: **NOT_RUN**
- Clean npm ci / full root tsc / full tests / Electron production build: **NOT_RUN**

Bu nedenle OPEN-021 ve OPEN-022 **IN_PROGRESS** kalır. Build215'in tamamlanması Windows kanıtının PASS olduğu anlamına gelmez; yalnız kanıt harness'inin kaynak tesliminin tamamlandığı anlamına gelir.
