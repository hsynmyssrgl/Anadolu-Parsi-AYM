# Build 127 Architecture and Documentation Governance Report

## Kimlik

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.127`
- Package Version: `27.7.2026-127`
- Stage: **Bronze RC2 Active Development**

## Mimari etki

Çalışma zamanı katmanları değiştirilmemiştir. Dokümantasyon mimarisi; karar
defteri, belge yetki matrisi, uzmanlık standartları, ADR’ler ve gereksinim
izlenebilirliği olarak düzenlenmiştir.

## Bağlayıcı sözleşmeler

- En son açık kullanıcı kararı ve aktif kaynak sözleşmesi önceliklidir.
- Her önemli karar `DEC-xxx` kimliğiyle kayıtlıdır.
- Ürün, güvenlik, UI/UX, yedekleme ve release belgeleri aynı kararları taşır.
- Eski belgeler tarihsel kanıt olarak korunur; aktif kapsamı sessizce değiştirmez.
- Çalıştırılmayan doğrulama PASS olamaz.

## Hedefli doğrulama

- Build 127 document governance contract: **PASS — 136 assertion / 41 karar / 20 zorunlu belge**.
- Aktif teslim belge sözleşmesi: **PASS — 121 assertion / 5 belge**.
- Karar kimlikleri `DEC-001`–`DEC-041` eksiksiz ve tekrarsızdır.
- 16 modül, tipografi ölçeği, yedek hedefleri, güvenlik ve promotion kuralları çapraz doğrulanmıştır.
