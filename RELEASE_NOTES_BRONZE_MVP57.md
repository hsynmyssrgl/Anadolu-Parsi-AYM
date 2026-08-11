# Bronze MVP-57 Sürüm Notları

Dijital miras işlemlerindeki doğrudan DataStore SQL erişimleri repository ve application use-case mimarisine taşındı. Plan sahibi ve emanetçi doğrulaması, yönetici onayları, yürütme bekleme süresi, geri alma penceresi ve nesne izinlerinin aktarımı transaction sınırına alındı. Audit zinciri ve transactional outbox kanıtı eklendi. Migration 12 yalnızca sorgu indeksleri ve schema generation bilgisini günceller; tablo/kolon fingerprint'i değişmez.
