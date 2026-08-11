# Bronze MVP-55 Sürüm Notları

Finans kayıtları ve değerlemeler `FamilyDataStore` içindeki doğrudan SQL akışından application/repository mimarisine taşındı. Varlık, borç, gelir ve gider kayıtları artık kişi doğrulaması, merkezi yetkilendirme, audit ve outbox ile tek transaction içinde yazılır.

Günlük değerleme işleminde kayıt bulunabilirliği ve `update` yetkisi kontrol edilir. Açık `deny` kaydı kayıt sahipliğinin önünde uygulanır. Geçersiz kişi veya tutar senaryolarında finans, audit ve outbox tablolarında kısmi kayıt bırakılmaz.

Migration 10 ile finans türü/para birimi/tarih ve değerleme kayıt/tarih sorgu indeksleri eklendi.
