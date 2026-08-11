# Release Notes — Bronze RC2 Build 206

**Sürüm:** `01.08.2026.206`  
**Kanal:** Bronze  
**Aşama:** Bronze RC2 Active Development

## Tamamlanan değişiklikler

- 20 Temmuz 2026’dan bugüne alınan 105 kesin proje kuralı Ana Build Defteri’nin makine kaynağına ve okunabilir görünümüne eklendi.
- `PROJECT-RULES-2026-08-01-V1` kural sürümü oluşturuldu.
- Kural seti SHA-256 özeti `298a7c161f5f82221fba0ccc34e4fd5976230b771466ea5f639fd6450a0dba0d` olarak sabitlendi.
- Yeni sohbet ve geliştirme oturumlarında ilk okunacak kaynağın `docs/17_MASTER_BUILD_LEDGER.md` olduğu bağlayıcı hale getirildi.
- Yeni build başlangıcında güncel kural SHA-256 değerinin `--rules-ack` ile kabul edilmesi zorunlu hale getirildi.
- Workspace sürüm yükseltme yolu da aynı hash kabul kapısına bağlandı; alternatif build başlatma yolu bırakılmadı.
- Kural seti değişiklikleri yeni build, açık kullanıcı kararı, yeni kural sürümü ve yeni hash gerektirecek şekilde sürümlendirildi.
- `DEC-096` ve `ADR-079` eklendi.
- OPEN-001 teknik işi, yönetişim önceliği nedeniyle Build 207’ye taşındı; işin kendisi değiştirilmedi.

## Doğrulama

- Proje kural sözleşmesi: **PASS — 132 assertion / 105 kural**
- Eksik `--rules-ack`: **beklendiği gibi reddedildi**
- Hatalı SHA-256: **beklendiği gibi reddedildi**
- Ana defter makine/Markdown eşleşmesi: **PASS**

Tam Silver/Gold doğrulama kapıları bu build kapsamında çalıştırılmamıştır ve `NOT_RUN` olarak korunur.
