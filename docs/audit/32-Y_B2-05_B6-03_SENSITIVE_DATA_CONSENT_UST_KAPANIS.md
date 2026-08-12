# 32-Y — B2-05/B6-03 Hassas Veri Onayı Üst Kapanışı

## Kapanan gereksinimler

- **B2-05:** Çocuk, sağlık, finans ve konum için varsayılan-ret, açık rıza,
  ayrı amaç, süre, görünür durum ve anlık iptal zinciri tamamlandı.
- **B6-03:** Dört kategori için AI işleme onayından bağımsız dışa gönderim
  onayı ve veri göndermeyen kategori/alan/sayım önizlemesi tamamlandı.

## Uygulanan zincir

- Domain: dört kategori, iki amaç, etkin durum, profil ve preview sözleşmeleri
- Policy/use-case: default deny, explicit consent, 15 dakika–30 gün, expiry,
  revoke, preview validation ve audit
- Authorization: merkezi `administer` kararı; doğrudan rol bypass yok
- Repository: mevcut `ai_consents` kimliği ve metadata-only inventory projection
- IPC/UI/menu: üç exact kanal, handler öncesi kapalı payload doğrulaması, typed
  preload, Yapay Zekâ ekranında görünür durum, rıza ve önizleme
- Geriye dönük güvenlik: genel AI upsert/preview kanalları hassas amaçları reddeder;
  süresiz veya sınır dışı geçmiş hassas grant kayıtları varsayılan-ret olur
- Test/doküman: unit, production composition, SQLite runtime, DEC-210 ve tehdit modeli
- Ratchet: PPK-021 exact allowlist 528'den 531'e; PPK-022 capability yüzeyi değişmedi

## Dürüst kapsam

Önizleme bir aktarım değildir ve `outboundTransferPerformed=false` döndürür.
Yeni network/send/upload/transfer handler'ı, migration, backfill, gerçek veri
taşıma veya cutover yoktur; latest migration 77 kalır. B2-02, PPK-025, B9-01,
Silver readiness ve Bronze Final açık kalır.

## Kanıtlar

- `artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-boundary.json`
- `artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-contract.json`
- `artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-runtime.json`
- `packages/application/tests/sensitive-data-consent-use-cases.test.ts`
- `apps/desktop/tests/b2-b6-sensitive-data-consent-integration.test.ts`
- `apps/desktop/tests/data-store.test.ts`

## Final doğrulama özeti

- Tam Vitest regresyonu: **98/98 test dosyası, 849/849 test geçti**.
- Paket hedefli regresyonu: **3/3 test dosyası, 9/9 test geçti**.
- Production build: **18/18 workspace derlendi**; Electron main/preload ve Vite
  renderer çıktıları üretildi.
- 32-Y kaynak sınırı **26/26**, sözleşme **38/38**, runtime **9/9** geçti.
- PPK-021 AST/runtime zinciri **83/83 ve 20/20**, PPK-023 sözleşmesi **71/71** geçti.
- Latest migration **77** kaldı; preview sırasında dış aktarım yapılmadı.
