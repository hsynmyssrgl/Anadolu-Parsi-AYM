# ADR-059: Bağlı Temiz Yedek Yeniden Yazım Kronolojisi

**Aktif sürüm:** 01.08.2026.219  

## Durum

Kabul edildi — Bronze Build 186.

## Bağlam

Build 185 propagation iç kronolojisini monotonik hale getirdi. Dış otomatik
temiz-yedek servisi ise propagation döndükten sonra duvar saatini yeniden okuyup
üst çalışma zamanını daha erken kaydedebiliyordu.

## Karar

- Başarı/kısmi sonuç zamanı bağlı propagation tamamlanma zamanıdır.
- Başarı/kısmi sonuç propagation kimliği olmadan sonuçlandırılamaz.
- Migrasyon 31 insert/update tetikleyicileri bağlantı ve zaman sırasını doğrular.
- Eksik bağlantı, geçersiz tarih ve geriye giden sıra atomik olarak reddedilir.
- Hata yolları çalışma başlangıç zamanından daha erken kaydedilemez.

## Sonuç

Kalıcı politika, çalışma defteri, propagation kaydı ve tombstone güncellemesi
tutarlı bir zaman zinciri oluşturur.
