# ADR-040 — Crash-Safe Adaptive Budget State and Tamper-Evident Decision Journal

## Durum

Kabul edildi — Build 165.

## Bağlam

Build 164 adaptif IPC kaynak bütçeleri yalnız bellek içinde tutuluyordu. Uygulama yeniden başladığında baskı altında seçilmiş `guarded` veya `restricted` modunun doğrulanmış geçmişi kayboluyor; bozuk bir yerel durum dosyasının körlemesine kabul edilmesi ise güvenli değildir.

## Karar

Adaptif bütçe durumu iki katmanlı saklanacaktır:

- atomik JSON durum dosyası,
- SHA-256 hash zincirli, append-only JSONL karar günlüğü.

Her kayıt uygulama sürümüne ve politika parmak izine bağlanır. Günlük zinciri, durum özeti ve tazelik sınırı doğrulanmadan kalıcı mod uygulanmaz. Durum dosyası kaybolursa geçerli günlükten kurtarma yapılabilir; günlük bozulursa sistem fail-closed olarak `baseline` moduna döner ve bozuk kanıtları karantinaya alır.

## Sonuçlar

- Çökme sonrası son doğrulanmış adaptif mod geri yüklenebilir.
- Sürüm veya politika değişikliğinde eski kararlar otomatik uygulanmaz.
- Günlük büyümesi kesin sınırlarla kontrol edilir.
- Kullanıcı veya istek verisi kalıcı günlüğe girmez.
- Dosya sistemi yazma hatası uygulamayı çökertmez; sağlık görünümünde `write-failed` olarak raporlanır.
