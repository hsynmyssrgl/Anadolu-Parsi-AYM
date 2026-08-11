# Build 115 Mimari Doğrulama Raporu

- Application Version: `25.07.2026.115`
- Package Version: `25.7.2026-115`
- Stage: **Bronze RC2 Active Development**

## Sonuç

**PASS — 48 assertion**

## Doğrulanan alanlar

- 12 zorunlu kanıt dosyası ve 7 kapı iddiası sözleşmesi.
- Kanıt yollarının yalnızca `artifacts/validation/` sınırında olması.
- Kaynak ZIP kimliği, dosya sayısı, byte sayısı ve SHA-256 bağlama.
- `BUILD_STATUS.md` ve `VERIFICATION_REPORT.md` durumlarının kanıttan türetilmesi.
- Yanlış temiz kurulum PASS iddiasının reddi.
- Kanıt bayt değişikliğinin hash uyumsuzluğu olarak reddi.
- ZIP içindeki belge iddiası değişikliğinin reddi.
- ZIP bayt bozulmasının reddi.
- Eksik kanıt dosyasının reddi.
- Tasdik `.sha256` yan dosyası üretim sözleşmesi.

Bu rapor yalnızca gerçekten çalıştırılmış hedefli Build 115 mimari doğrulamasını kapsar.
