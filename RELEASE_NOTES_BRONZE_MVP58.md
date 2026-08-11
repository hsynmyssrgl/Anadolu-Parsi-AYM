# Bronze MVP-58 Sürüm Notları

Görev, sigorta, eğitim, abonelik ve resmî işlem kayıtları application/repository mimarisine taşındı.

- `LifeApplicationContext`, sorgu portu, transaction kapsamı ve yaşam kaydı use-case'leri eklendi.
- `SqliteLifeRepository` ile `life_records` okuma/yazma işlemleri veri deposundan ayrıldı.
- SQLite uygulama adaptörü; etkin hesap, merkezi yetkilendirme, kişi doğrulaması, audit ve outbox işlemlerini tek transaction altında birleştirdi.
- `subscription` ve `official_operation` yaşam kaydı kategorileri veri sözleşmesine ve arayüz etiketlerine eklendi.
- Başlık, tarih sırası, tutar, kayıt sahibi ve create yetkisi doğrulamaları application katmanına taşındı.
- Mevcut `employment`, `property` ve `emergency` kategorileri geriye dönük uyumluluk için korundu.

## Doğrulama notu

MVP-57 ZIP bütünlüğü SHA-256 ile doğrulandı. Kaynak pakette `node_modules` bulunmadığından ve bu çalışma ortamında bağımlılık kurulumu süre sınırına takıldığından tam TypeScript/Vitest/production build çalıştırılamadı. Kaynak yapısı, paket dışa aktarımları, sürüm metadata'sı ve doğrudan SQL akışının kaldırılması statik olarak kontrol edildi.
