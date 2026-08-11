# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 206

- Application Version: `01.08.2026.206`
- Package Version: `1.8.2026-206`
- Stage: **Bronze RC2 Active Development**
- Build: **206**
- Karar: **DEC-096**
- ADR: **ADR-079**

## Build 206 amacı

105 maddelik kesin proje kural setini Ana Build Defteri içine yerleştirmek ve yeni sohbet/geliştirme oturumu ile her yeni build başlangıcını bu kuralları okumaya ve güncel SHA-256 özetini kabul etmeye zorlamak.

## Bağlayıcı sonuç

- Tek başlangıç kaynağı: `docs/17_MASTER_BUILD_LEDGER.md`
- Makine kaynağı: `config/master-build-ledger.json`
- Kural sürümü: `PROJECT-RULES-2026-08-01-V1`
- Kural sayısı: **105**
- Kural SHA-256: `298a7c161f5f82221fba0ccc34e4fd5976230b771466ea5f639fd6450a0dba0d`
- `scripts/update-master-build-ledger.mjs start`: `--rules-ack` olmadan build başlatmaz.
- `scripts/set-workspace-version.mjs`: güncel kural SHA-256 değeri altıncı argüman olarak verilmeden sürüm/build yükseltmez.
- Yanlış veya eksik hash fail-closed reddedilir.
- Kural seti yalnız yeni build + açık kullanıcı kararı + yeni sürüm/hash ile değiştirilebilir.

## Hedefli doğrulama

- Build 206 proje kural sözleşmesi: **PASS — 132 assertion / 105 kural**
- Kural kabulü olmadan Build 207 başlangıç denemesi: **REJECTED — beklenen davranış**
- Yanlış kural hash’i ile Build 207 başlangıç denemesi: **REJECTED — beklenen davranış**
- Ana Build Defteri render/hash doğrulaması: **PASS**

## Kaynak teslim doğrulaması

- Source preflight: **PASS**
- Source integrity: **PASS**
- Build 206 proje kural sözleşmesi: **PASS — 132 assertion / 105 kural**

## Resmî geniş doğrulama sınırı

- Clean `npm ci`: **NOT_RUN**
- Full root/workspace `tsc --noEmit`: **NOT_RUN**
- Full unit/integration: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke: **NOT_RUN**
- Windows launch/installer: **NOT_RUN**

Build 206 Bronze RC2 Active Development yönetişim artımıdır; Bronze Final, Silver veya Gold terfisi değildir.
