# Build 206 Teslim Doğrulama Raporu

## Teslim kimliği

- Ürün: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `01.08.2026.206`
- Package Version: `1.8.2026-206`
- Stage: **Bronze RC2 Active Development**
- Build: **206**

## Build 206 teslim sözleşmesi

- Ana Build Defteri 105 kesin kuralı görünür biçimde taşır.
- Makine kaynağı aynı kural setini sürüm ve SHA-256 ile taşır.
- Build 206 kural kabul kaydı güncel sürüm/hash ile eşleşir.
- Yeni build başlangıcı kural hash kabulü olmadan açılamaz.
- Source preflight ve kaynak bütünlüğü sonuçları yalnız gerçekten çalıştırıldıktan sonra PASS olarak raporlanır.

## Hedefli doğrulama

- Build 206 proje kural sözleşmesi: **PASS — 132 assertion / 105 kural**
- Kural kabul kapısı negatif testleri: **PASS — eksik ve yanlış hash reddedildi**

## Geniş doğrulama sınırı

`build206-validation-boundary.json` resmî geniş doğrulama sınırını **INCOMPLETE** olarak tutar. Clean npm ci, full TypeScript, tüm testler, Electron production build, blocking smoke ve Windows runtime/installer `NOT_RUN` durumundadır.

Kaynak preflight ve kaynak bütünlüğü nihai kaynak ağacı üzerinde **PASS** tamamlandı. Deterministik ZIP ve ayrık teslim tasdiki kaynak ağacı dondurulduktan sonra dış teslim kanıtı olarak üretilecektir.
