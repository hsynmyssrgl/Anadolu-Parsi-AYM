# Build 183 Mimari Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.183`
- Package Version: `30.7.2026-183`
- Stage: **Bronze RC2 Active Development**
- Build: **183**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Mimari kararlar

Build 183 kararı DEC-073, ADR-056 ve
`docs/AUTOMATIC_CLEAN_BACKUP_REWRITE_V1.md` altında kayıtlıdır.

## Uygulanan sınırlar

- Saklama süresi dolmuş tombstone kayıtları, otomatik çevrimin tek veri kaynağıdır.
- Her etkin hedefte önce yeni tam yedek üretilir ve bütünlüğü doğrulanır.
- Eski yönetilen `.pptbackup` dosyaları doğrudan silinmez; manifestli karantinaya alınır.
- Çalışma sahipliği ve ara durum veritabanında kalıcıdır; kesinti sonrası güvenli geri çekilme uygulanır.
- Manuel başarısızlıkta 60 dakika, otomatik başarısızlıkta 360 dakika geri çekilme vardır.
- CPU veya bellek yüzde 85 eşiğine ulaştığında işlem 30 dakika ertelenir.
- Etkin hedef yokluğu görünür `attention` durumu ve tanı kaydı üretir.
- Politika değişikliği güçlü yeniden doğrulama gerektirir.
- Manuel ve yönetilmeyen haricî kopyalara otomatik dokunulmaz.

## Hedefli doğrulama

- Contract ve karar yayılımı: **36/36 PASS**
- Davranış: **15/15 PASS**
- Syntax/controlled TypeScript: **3/3 PASS**
- Kaynak preflight hedefi: **165/165 PASS — 21 küçük segment**
- Kaynak bütünlüğü hedefi: **1.594/1.594 PASS — 1.595 SHA-256 girdisi**
- Aktif sürüm sözleşmesi hedefi: **178/178 PASS**
- Aktif teslim belgeleri hedefi: **121/121 PASS**
