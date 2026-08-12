# DEC-204 — PPK-023 uygulama güvenlik profili build kapısı

## Durum

ACTIVE / COMPLETE — 2026-08-12; uygulama ve final doğrulama zinciri tamamlandı.

## Bağlam

PPK-023 her yeni uygulamanın ASVS/MASVS/SSDF eşlemesi ve tehdit modeli olmadan kabul edilmemesini ister. PPK-020 on dört kanonik uygulama hedefini, PPK-021 ayrıcalıklı kod AST ratchet'ini ve PPK-022 runtime capability manifestini sağlamıştır; ancak bunlar uygulama başına sürümlü standart profili ve threat model sahipliğini tek başına kanıtlamaz.

Resmî OWASP kaynağı ASVS'nin son stable sürümünü `5.0.0` ve sürümlü requirement gösterimini `v<version>-<id>` biçiminde tanımlar. OWASP MASVS `2.1.0`, mobil attack surface için 24 kontrolü sekiz grupta yayımlar. NIST SP 800-218 SSDF `1.1`, final secure-development framework'tür; 2025 tarihli SSDF `1.2` belgesi draft olduğu için bu kararda final `1.1` kullanılır.

## Karar

1. `PlatformApplicationId` kaynak AST envanteri, PPK-020 target profilleri ve PPK-023 manifestindeki profil kimlikleri exact eşleşir.
2. On dört uygulamanın her biri tek `APP-THREAT-<applicationId>` bölümüne sahiptir. Dokümanın byte SHA-256 değeri manifestte sabittir.
3. Bütün profiller 21 sürümlü ASVS requirement'ı ve 19 SSDF practice kimliğini devralır.
4. iOS, iPadOS, watchOS ve visionOS hedefleri 24 MASVS kontrolünü devralır. Diğer profiller ancak exact, non-empty mobil-özgü N/A gerekçesiyle MASVS dışı kalabilir.
5. `apps/*` altındaki her gerçek uygulama workspace'i bir kanonik uygulama kimliğine exact bağlanır. Yeni/sahipsiz workspace build'i durdurur.
6. Manifest canonical SHA-256 ile bağlıdır. Eksik, duplicate, stale, yeni, hash'i bozuk, sürümü sapmış, kontrolü eksik veya extra-field kaçışlı profil fail-closed reddedilir.
7. Kök pretypecheck, prebuild ve birleşik Platform Policy kapısı PPK-023 doğrulayıcısını çalıştırır.
8. Desktop yalnız content-free, zero-argument ve no-cache durum özeti gösterir; kaynak yolları ve threat-model/manifest hash'leri renderer'a verilmez.

## Güvence iddiası sınırı

Eşleme bir ASVS/MASVS/SSDF uygunluk sertifikası, bağımsız audit, penetrasyon testi veya native runtime PASS değildir. Profil kaydı runtime capability veya data-access yetkisi vermez. Windows Desktop ve Windows Core Service dışındaki on iki target `PROFILE_ONLY / NOT_DEPLOYED` kalır ve yayımdan önce native validation zorunludur.

## Şema ve veri kararı

PPK-023 build-time yönetişim/policy paketidir. Repository persistence veya migration eklenmez; latest migration `77` kalır. Gerçek kullanıcı verisi taşınmaz, backfill/cutover yapılmaz, Desktop vault ve SQLite sahipliği değiştirilmez. PPK-012 offline lease/no-cache, PPK-015 egress ve PPK-022 signed capability sınırları zayıflatılmaz.

## Ardıl sınır

PPK-024 policy service unavailable, invalid signature veya stale policy halinde hassas işlemlerin read-only/deny olmasıdır. DEC-204 bu runtime availability gereksinimini tamamlamaz.

## Kanıt

- `config/32-s-ppk-023-application-security-profile-manifest.json`
- `scripts/verify-application-security-profile-gate.mjs`
- `packages/platform-policy/src/application-security-profile-policy.ts`
- `docs/security/PPK-023_APPLICATION_SECURITY_PROFILES_THREAT_MODEL.md`
- `artifacts/validation/32-S-ppk-023-application-security-profile-contract.json`
- `artifacts/validation/32-S-ppk-023-application-security-profile-runtime.json`

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.

## Final doğrulama

PPK-023 gate 14/14 uygulama ve 14/14 threat model için sıfır bulguyla geçti. Hedefli testler 16/16, PPK-012–PPK-023 güvenlik regresyonu 280/280, tam Vitest 80/80 dosya ve 688/688 test, production workspace build 18/18 geçti. Lockfile 542, dependency supply 436/135, workspace bağımlılıkları 516/18 ve karar defteri 313/58 kontrolle doğrulandı. PPK-021 ve PPK-022 ardıl sözleşme/runtime kanıtları da güncel kaynaklarda sırasıyla 83/83 + 20/20 ve 108/108 + 24/24 PASS verdi.
