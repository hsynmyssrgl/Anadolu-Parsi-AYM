# ADR-030 — Anahtar Tabanlı Sayfalama ve Sınırlı Renderer Penceresi

**Aktif sürüm:** 01.08.2026.219  

## Durum

Kabul edildi — Bronze RC2 Build 147 Active Development.

## Bağlam

Offset tabanlı sayfalama büyük tablolarda satır atlama maliyeti oluşturur ve
sayfalar arasında eşzamanlı değişiklik olduğunda yinelenen/atlanmış sonuç riskini
artırır. Tüm soy ağacı, zaman tüneli veya arşiv listesini renderer belleğine almak
da açılış süresini ve DOM maliyetini veri büyüklüğüyle doğrusal artırır.

## Karar

Üç büyük görünüm ayrı, izin duyarlı read-model repository’si kullanır. Sayfalama
kararlı sıralama anahtarları üzerinden yapılır ve her çağrı en fazla 200 kayıtla
sınırlıdır. Renderer yalnız istenen sayfaları biriktirir; yeni sayfa kullanıcı
isteğiyle yüklenir. Tam arşiv listesi uygulama açılışında çağrılmaz.

Soy ağacı sırası `generation ASC, display_name COLLATE NOCASE ASC, id ASC`; zaman
tüneli `start_at DESC, id DESC`; arşiv `created_at DESC, id DESC` olarak
sabitlenmiştir. İmleç, görünüm türü ve sürümüyle doğrulanmış base64url JSON zarfıdır.
İmleç yetki belgesi değildir; yalnız sorgu konumudur.

## Sonuçlar

- Büyük tablolarda offset taraması kaldırılır.
- DOM ve renderer veri hacmi sayfa büyüklüğüyle kontrol edilir.
- Filtreler main/repository katmanında uygulanır.
- Olay ve arşiv nesnesi izinleri dönüşten önce tekrar denetlenir.
- Toplam kayıt sayısı için pahalı ayrı `COUNT(*)` zorunluluğu yoktur.
- Gerçek Windows render performansı ve üretim SQLite adaptörü daha sonraki toplu
  doğrulama kapısında kanıtlanacaktır.
