# Bronze RC2 Build 105 Sürüm Notları

Build 105, application ve persistence katmanları arasındaki yetki sınırını güçlendirir. Önceki sürümde transaction callback’i application adapter’larına `DatabaseExecutor` veriyor ve adapter’ların doğrudan SQL çalıştırabilmesine tip sistemi düzeyinde imkân tanıyordu.

Bu sürümde database ve transaction sözleşmeleri `@ppt/contracts` katmanına taşınmış; native database executor yerine nominal, opak `RepositoryTransaction` belirteci kullanılmaya başlanmıştır. SQL yeteneğinin açılması yalnızca SQLite repository taban sınıfında tutulur. Repository-backed application adapter’ları transaction belirtecini repository context’e aktarır, ancak `prepare` veya `exec` yeteneğine erişemez.

Ayrıca migration güvenli yedek yardımcılarının yanlış modül importu, audit/outbox repository port interface varsayılan parametreleri ve audit doğrulamasındaki geçersiz hata nesnesi giderilmiştir.

Bu sürüm yalnızca Bronze RC2 Active Development kaynak teslimidir. Final, Code Freeze, Silver veya Gold terfisi değildir.
