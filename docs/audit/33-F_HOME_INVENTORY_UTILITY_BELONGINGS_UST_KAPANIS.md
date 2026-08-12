# 33-F üst kapanış — Ev envanteri, sayaç, tüketim, eşya, garanti ve servis

- Tarih: 13.08.2026
- Karar: DEC-217
- Gereksinimler: EXT-030, EXT-032
- Durum: COMPLETE / PASS
- Kalıcılık: Migration 84 (`b5_life_home_inventory_ledger`)

## Kapanan kapsam

EXT-030 ve EXT-032 aynı yönetilen `home` yaşam profilinin altında tek bir
append-only ev envanteri defteriyle kapatıldı. Uygulama; oda/alan, elektrik-su-doğal
gaz-diğer sayaç, integer milliunit okuma, açık reset/replacement, eşya, maskeli seri,
garanti, servis ve opaque arşiv belgesi olaylarını destekler.

Kök `life_managed_ledger` profili family, owner ve privacy otoritesidir. Her envanter
olayı exact `life_record/update` durable policy receipt ile köke bağlanır. Parent ve
supersession bağlantıları aynı kök/tür/zaman sınırında doğrulanır. Update ve delete
fail-closed; düzeltmeler yeni superseding olaydır.

## Güvenlik ve finansal doğruluk

- Sayaç ve para değerleri safe integer alanlarıdır; floating point depolanmaz.
- Normal sayaç okuması monoton ilerler; düşüş yalnız açık reset/replacement olayıyla
  ve açıklamayla kabul edilir.
- Canonical UTC ISO takvim doğrulaması hem uygulama hem SQLite katmanındadır.
- Cross-family/owner/privacy, yanlış parent, arşiv sensitivity/destroyed, finans
  gideri kapsamı, kimlik/makbuz replay ve cross-ledger collision reddedilir.
- Ham seri numarası repository iç yazma bağlamından renderer'a çıkmaz; workspace ve
  yazma yanıtında yalnız maskeli seri projekte edilir.
- Audit ve outbox seri, okuma, tutar, sağlayıcı, arşiv/finans ID ya da not taşımaz.
- Belge yalnız opaque `archiveItemId` ile bağlanır; path, ad, hash ve içerik verilmez.

## Gerçeklik sınırı

Veri kaynağı yalnız `manual`dır. `smartMeterLookup`, `providerContact`,
`warrantyLookup`, `ocr`, `paymentExecution` ve `documentContentExposure` değerleri
`not_performed` olarak taşınır. Yeni ağ, file-import, OCR, kripto veya ödeme primitive'i
açılmadı; PPK-022 capability yüzeyi 242'de kaldı.

B3-01, EXT-033, EXT-044 ve diğer Bronze gereksinimleri açık kalır. Silver readiness,
Bronze Final, acil servis garantisi veya yeni Build numarası iddia edilmez.

## Doğrulama zinciri

- `artifacts/validation/33-F-home-inventory-utility-belongings-boundary.json`
- `artifacts/validation/33-F-home-inventory-utility-belongings-contract.json`
- `artifacts/validation/33-F-home-inventory-utility-belongings-runtime.json`
- `packages/application/tests/managed-life-assets.test.ts`
- `packages/repositories/managed-life-repository-policy.test.ts`
- `apps/desktop/tests/b5-managed-life-ipc-integration.test.ts`
- `artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json`
- `docs/security/THREAT_MODEL_33_F_HOME_INVENTORY_UTILITY_BELONGINGS.md`
- `config/33-f-home-inventory-utility-belongings-scope.json`
- `config/33-f-home-inventory-utility-belongings-inventory.json`

Migration doğrulaması 9/9 PASS ve Migration 84 checksum değeri
`0d6bcb5884a7ea2c11c1b1d4e633344e990c18a203e7b6ce6592dcc80f630362` olarak
mühürlendi. Nihai boundary/contract/runtime, tam Vitest, TypeScript, 18 workspace
build, PPK-021 exact allowlist ve yerel+D: persistent receipt sonuçları kapanış
artefaktlarında sayısal olarak saklanır.

Yerel kapanış ölçümleri boundary 51/51, contract 15/15, runtime 11/11,
hedefli test 3 dosya/37 test, tam Vitest 112 dosya/968 test ve production build
18/18 PASS'tir. PPK-021 545 exact allowlist / 277 use-case composition, PPK-022
242 capability yüzeyinde PASS olarak korunmuştur.
