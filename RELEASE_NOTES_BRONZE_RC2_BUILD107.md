# Bronze RC2 Build 107 Sürüm Notları

## Düzeltilenler

- `@ppt/repository-contracts` workspace’i kalıcı olarak `private: true` yapıldı.
- Workspace sayısı değiştiğinde eski sabit sayıya bağlı kalan doğrulama problemi kaldırıldı.
- Güçlü workspace dependency doğrulaması lockfile doğrulama zincirine bağlandı.
- Package-source ve Electron-main controlled type-check komutları kalıcı npm scriptleri olarak kaydedildi.
- `repository-composition-root.ts` port tiplerini yanlışlıkla implementasyon paketinden almak yerine `@ppt/repository-contracts` paketinden almaya başladı.
- Kullanılmayan repository compatibility shim dosyaları kaldırıldı.
- Desktop’taki kullanılmayan `@ppt/test-data` runtime bağımlılığı kaldırıldı.
- Application testi infrastructure katmanı yerine yerel in-memory test double kullanacak şekilde düzeltildi; test-data bağımlılığı devDependency olarak tanımlandı.
- `FamilyDataStore` constructor’ındaki atanmadan önce `#databasePath` okuması düzeltildi.
- Eksik `node:os` `platform` ve `arch` importları eklendi.
- AI consent context içindeki tanımsız correlation helper kullanımı kaldırıldı.
- Depolama, sistem kaynağı ve tam yedek adapter’larında kalan `transactionPath` / `transactionSha256` eski alan adları canonical `databasePath` / `databaseSha256` adlarına geçirildi.

## Doğrulama sınırı

Controlled source type-check’leri TypeScript 5.8.3 ve kontrollü Electron declaration shell ile geçti. Bunlar, temiz `npm ci` sonrasında çalıştırılması gereken kilitli tam workspace `tsc --noEmit` kapısının yerine geçmez.
