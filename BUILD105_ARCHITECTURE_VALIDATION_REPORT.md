# Panthera pardus tulliana Aile — Bronze RC2 Build 105 Mimari Doğrulama Raporu

- Application Version: `25.07.2026.105`
- Package Version: `25.7.2026-105`
- Aşama: **Bronze RC2 Active Development**
- Terfi durumu: **Yok**

## Build 105 mimari kapsamı

1. Persistence contract sahipliği `@ppt/database` ve `@ppt/repositories` paketlerinden alınarak `@ppt/contracts` katmanında birleştirildi.
2. `TransactionContext.database` kaldırıldı; yerine nominal ve opak `RepositoryTransaction` belirteci eklendi.
3. Application adapter’larının transaction callback üzerinden SQL çalıştırma kabiliyeti tip düzeyinde kaldırıldı.
4. SQLite transaction executor native database nesnesini yalnızca opak belirteç olarak aktaracak şekilde düzenlendi.
5. Opak belirtecin `DatabaseExecutor` olarak açılması yalnızca `SqliteRepository.database(...)` korumalı metodunda bırakıldı.
6. 26 repository implementasyonundaki doğrudan transaction SQL erişimi kontrollü repository taban metoduna taşındı.
7. Database, repositories, infrastructure ve desktop paketlerinin neutral contracts dependency kayıtları eklendi.
8. Migration güvenli yedek yardımcılarının yanlış `backup-safety` importu gerçek sahip modül olan `migration-runner` importuna düzeltildi.
9. Audit ve outbox repository port interface’lerindeki TypeScript tarafından geçersiz kabul edilen varsayılan parametreler optional sözleşmelere çevrildi.
10. Audit input validation, merkezi `createAppError` ve `ERROR_CODES.CORE_INVALID_ARGUMENT` sözleşmesine geçirildi.

## Gerçekten çalıştırılan ve geçen kaynak doğrulamaları

- Lockfile integrity: **PASS — 1.124 assertion / 13 workspace**
- Dependency supply: **PASS — 1.347 assertion / 436 canonical dış tarball**
- Build 105 mimari doğrulaması: **PASS — 337 assertion / 26 repository / 30 application adapter**
- Sürüm sırası: **PASS — 25.07.2026.105 / sıra 105**
- Repository denetimi: **PASS — source-only**
- TypeScript/TSX kaynak sözdizimi ayrıştırması: **PASS — 162 dosya / 0 parse diagnostic**
  - Bu kontrol **`tsc --noEmit` değildir.**
- Hedefli persistence tip analizi: **PASS**
  - Global TypeScript 5.8.3 ve yalnızca eksik dış modül bildirimleri için ambient stub kullanıldı.
  - Bu analiz tam workspace type-check değildir.
- Transaction kullanan 21 application adapter için hedefli tip analizi: **PASS**
  - Bu analiz tam workspace type-check değildir.
- Node script sözdizimi: **PASS — 78 dosya**
- JSON ayrıştırma: **PASS — 261 dosya**
- GitHub Actions YAML ayrıştırma: **PASS — 2 dosya**

## Temiz doğrulama kapısı sonucu

Ayrı ve `node_modules` içermeyen Build 105 kaynak kopyasında sıralı RC2 kapı yöneticisi gerçekten çalıştırıldı.

- `clean-npm-ci`: **FAIL**
- Çıkış kodu: `1`
- Hata: HTTP `503 Service Temporarily Unavailable`
- İlk başarısız dış paket: `esbuild-0.25.12.tgz`
- `tsc-no-emit`: **NOT_RUN**
- `electron-production-build`: **NOT_RUN**
- `smoke-tests`: **NOT_RUN**
- `windows-real-launch`: **NOT_RUN**
- `windows-installer`: **NOT_RUN**

Makine kanıtı: `artifacts/validation/build105-clean-validation.json`

## Sonuç

Build 105 mimari geliştirmesi tamamlandı. Application adapter ile database executor arasındaki doğrudan kabiliyet sızıntısı opak transaction belirteciyle kapatıldı ve persistence contract sahipliği neutral contracts katmanına taşındı. Temiz `npm ci` paket hizmetinin HTTP 503 yanıtı nedeniyle tamamlanmadı. Bu nedenle sonraki doğrulama kapıları çalıştırılmadı. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmedi.
