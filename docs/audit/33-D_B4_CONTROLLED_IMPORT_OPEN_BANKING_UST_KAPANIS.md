# 33-D — B4 kontrollü içe aktarma ve ÖHVPS üst kapanışı

## Sonuç

B4-13 ve B4-14 tek paketle tamamlandı. CSV/TSV/XLSX/OFX/QFX için ana süreçte
kontrollü önizleme, exact sütun eşleme, iki tekrar stratejisi, kalıcı SHA-256 exact
kaynak-satırı replay çiti ve tek politika işlemiyle append-only kayıt zinciri kuruldu. Aynı finans
ekranında ağsız `ohvps-v1-local` adapter sözleşmesi, tamamen sentetik sandbox ve
kontrollü dosya manuel fallback'i görünür hale getirildi.

## Uygulanan zincir

- Domain: önizleme, eşleme, normalize satır, batch/hareket ve adapter gerçeklik alanları.
- Parser: okumadan önce 5 MiB sınırı; 5.000 satır/64 sütun; katı tutar/takvim
  doğrulaması; UTF-8 CSV/TSV/OFX/QFX ve XLSX.
- XLSX: ZIP/CRC/yol/boyut doğrulaması; 1900/1904 tarih sistemi; bütün sayfalarda
  formül taraması; makro, dış bağlantı ve XML varlığı reddi.
- Use-case: tek `CommitFinanceImportBatchUseCase`, sahip/gizlilik/kategori kontrolü,
  batch içi ve kalıcı tekrar denetimi, skip/reject, içeriksiz event.
- Repository/schema: Migration 82; yalnız staging INSERT ve staging→committed exact
  seal; append-only entry; kalıcı fingerprint unique fence; privacy→sensitivity
  bağlı exact receipt ve çapraz finans replay çiti.
- IPC/UI: sıfır argümanlı ana süreç dosya seçimi ve sentetik sandbox; exact commit
  payload; preview sender+hesap+aileye bağlı ve auth geçişinde temizlenir. Dosya yolu
  ve ham dosya baytları renderer'a çıkmaz; örnek hücre görünürlüğü açıkça belirtilir.
- Gizlilik: hassas veri envanteri ve kişi yaşam döngüsü referans sayımı güncellendi.

## Dürüst kapsam

Canlı banka hesabı bağlantısı, kimlik bilgisi/token/sertifika, harici rıza, uzaktan
eşitleme ve ödeme icrası yoktur. Sandbox verisi sentetiktir. İçe aktarılan hareketler
banka tarafından doğrulanmış sayılmaz. Eski XLS/XLSB, şifreli veya formüllü XLSX
desteklenmez. B5 ve sonraki açık kapsam, B9-01, Silver readiness ve Bronze Final
açık kalır; yeni Build verilmez.

## Kanıtlar

- `artifacts/validation/33-D-b4-controlled-import-open-banking-boundary.json`
- `artifacts/validation/33-D-b4-controlled-import-open-banking-contract.json`
- `artifacts/validation/33-D-b4-controlled-import-open-banking-runtime.json`
- `packages/application/tests/finance-controlled-import-open-banking.test.ts`
- `apps/desktop/tests/b4-finance-import-ipc-integration.test.ts`
- `apps/desktop/tests/finance-import-file-session.test.ts`
- `apps/desktop/tests/data-store.test.ts`

## Doğrulama özeti

- 33-D hedef testleri: `4/4` dosya, `17/17` test PASS.
- Tam Vitest regresyonu: `109/109` dosya, `931/931` test PASS.
- TypeScript: kök, Electron ve renderer denetimleri sıfır tanı ile PASS.
- Üretim derlemeleri: `16` paket + Core Service + Desktop, toplam `18/18` PASS.
- Migration: `1–82` zinciri `9/9` runtime kontrolüyle PASS; Migration 82 checksum
  `be32fbe6a79688ee879fda02a16faa78f6e0d4151e1462b2c9f28a1da44518c8`.
- 33-D boundary `40/40`, contract `14/14`, runtime `11/11` PASS.
- 32-Z/33-A/33-B/33-C halef regresyonları: boundary, contract ve runtime paketleri PASS.
- Kök `pretypecheck`: `23/23` güvenlik ve B4 kaynak kapısı PASS.
- PPK-021: contract `83/83`, exact yüzey `543`, use-case composition `275`,
  doğrudan rol bypass `0`; exact allowlist SHA-256
  `d6cb28c686caa25d9071f9ba1fb221ddeb5fe1b19433551671f6bce5e679fb29`.
- PPK-022: capability ve exact manifest yüzeyi `242/242`, bulgu `0`; dört yeni yüzey sınırlı dosya okuma korumasıdır.
- Karar defteri: `368` kontrol / `69` karar PASS; DEC-215 ACTIVE.
- Governed preflight: `18/18` komut PASS. Feature Reality: `350` gereksinimde
  honesty PASS; Bronze audit `PASS_WITH_OPEN_SCOPE`, official `%25`, strict
  `%16,8571`, implementation-chain `%17,3429`.
- Bronze governance reality matrix `81/81`; incremental governance contract
  `107/107` PASS.
