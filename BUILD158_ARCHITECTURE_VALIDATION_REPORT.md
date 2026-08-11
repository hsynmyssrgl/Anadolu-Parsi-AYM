# Build 158 Mimari Doğrulama Raporu

- Application Version: `29.07.2026.158`
- Package Version: `29.7.2026-158`
- Stage: **Bronze RC2 Active Development**

## Mimari sınır

Renderer state yazımları kapsam, oturum çağı ve istek sırasına bağlı
`AsyncWriteGuard` bileti olmadan uygulanmaz. Mutasyonlar benzersiz kimlik ve
anahtar bazlı monoton `MutationRevisionWatermark` filtresinden geçer.

Graph/timeline mutasyonu, mutasyondan önce başlamış snapshot yükünü geçersiz kılar;
bölüm yüklü değilse eski tek-uçuş promise'i ayrılır ve aktif ekran yükü yeniden
başlatılır.

## Mimari sonuç

- Session epoch invalidation: **PASS**
- Per-scope latest-request-wins: **PASS**
- Mutation id deduplication: **PASS**
- Monotonic per-key revision merge: **PASS**
- Snapshot/mutation race invalidation: **PASS**
- Active stage preservation: **PASS**
