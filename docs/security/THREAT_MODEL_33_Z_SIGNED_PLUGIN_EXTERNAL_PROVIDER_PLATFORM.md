# 33-Z — İmzalı eklenti ve dış sağlayıcı aday platformu tehdit modeli

## Korunan varlıklar

- Güvenilen public imza anahtarı sınırı ve exact canonical manifest.
- Paket, entrypoint, SBOM, lisans envanteri ve provenance hash kanıtları.
- Minimum capability ile veri hassasiyeti, amaç, erişim, retention ve egress beyanları.
- Aile, hesap, kişi sahibi, PEP receipt/fence, mutation/release ledger ve current installation bağı.
- Renderer dışı kayıt otoritesi, rollback ve acil kapatma durumu.

## Tehditler ve kontroller

1. **Sahte veya değiştirilmiş manifest:** Exact anahtar kümesi ve canonical JSON Ed25519 ile doğrulanır; tanınmayan, retired, duplicate veya geçersiz signer fail-closed reddedilir.
2. **Aşırı yetki:** Her provider en az bir exact capability gerektirir. Bilinmeyen veya duplicate provider/capability, wildcard egress, private/local/IP/scheme/path host ve otuz günü aşan retention reddedilir.
3. **Supply-chain kanıtı yanıltması:** Paket, entrypoint, SBOM, lisans ve provenance hashleri manifest imzasına bağlıdır; fakat hash varlığı üretim provenance veya zafiyet temizliği iddiası değildir. PPK-025 production kanıtı açık kalır.
4. **Renderer otorite yükseltmesi:** IPC yalnız merkezi okuma, istenen durum, acil kapatma ve rollback taşır. Manifest, imza, anahtar, hash, paket yolu, token, credential ve host listesi renderer'a kapalıdır.
5. **Yabancı sahip kaydı:** Bütün current ve ledger satırları exact aile, hesap ve kişi sahibiyle, merkezi receipt/fence ve policy projection ile bağlanır.
6. **Replay ve yarış:** `clientOperationId`, request fingerprint, optimistic revision, immutable mutation ledger ve current-row last-mutation bağı zorunludur.
7. **Kötü sürüme dönüş:** Güncelleme yalnız daha yüksek sürümü kaydeder ve kapalı başlatır. Rollback yalnız exact önceki ve süresi geçerli release'e yapılır. Acil kapatma yeni imzalı sürüm olmadan yeniden etkinleştirilemez.
8. **Kod çalıştırma veya provider bağlantısı yanıltması:** Truth alanları runtime execution, provider connection, credential storage, production trust, release eligibility, sandbox ve OS network isolation için false kalır; bu paket ağ kullanmaz.

## Açık kanıtlar

Production signing trust, gerçek code-signing sertifikası, Authenticode, sandbox, işletim sistemi ağ izolasyonu, dokuz provider UAT'ı, zafiyet/lisans ve privacy/legal/security incelemeleri `NOT_RUN` durumundadır. Persistent governance receipt yoktur; registry ve roadmap kapanmamıştır. `33-Z` yalnız kısmi yerel teknik kanıttır ve `countsAsRequirementPass=false` kalır.
