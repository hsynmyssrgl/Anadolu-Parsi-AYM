# ADR-029 — Doğrulanmış Aile Verisi İçe Aktarma ve Kontrollü Geri Alma

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Build: 146
- Aşama: Bronze RC2 Active Development
- Tarih: 2026-07-28

## Bağlam

Aile verisi dış kaynaklardan gerçek kayıtlarla içe alınırken bozuk JSON, aşırı büyük
dosya, eksik referans, aynı paketin yeniden uygulanması, ön izleme sonrasında dosya
veya veritabanı değişikliği, renderer kaynaklı yol enjeksiyonu ve kısmi yazma riski
vardır. İçe aktarma sonrası kayıtların güvenli biçimde geri alınması da sonradan
oluşmuş bağımlılıkların silinmemesini gerektirir.

## Karar

1. Dosya seçimi yalnız Electron main process tarafından yapılır. Renderer dosya
   yolu veya dosya içeriği gönderemez.
2. Yalnız normal, sembolik bağ olmayan, `.json` uzantılı ve en fazla 25 MiB kaynak
   kabul edilir. UTF-8 çözümleme fatal modda yapılır; NUL karakteri reddedilir.
3. Şema sürümü 1 katıdır. Bilinmeyen alanlar, yinelenen kimlikler, geçersiz
   tarihler, sınır dışı koordinatlar ve dosya içi kırık kişi/konum referansları
   hata üretir.
4. Ön izleme yalnız okunurdur ve 15 dakika geçerlidir. Kaynak SHA-256, boyut,
   değiştirilme zamanı, kayıt özeti, eşleşme/oluşturma planı ve uyarılar gösterilir.
5. Yeni hedef kimlikleri ön izleme sırasında üretilir ve uygulama sırasında aynı
   kimlikler kullanılır. Uygulama öncesinde dosya stat bilgisi, ham içerik SHA-256
   değeri ve güncel veritabanından yeniden oluşturulan çakışma planı karşılaştırılır.
6. Uygulama yalnız `family_admin` rolü ve parola; etkinse TOTP/kurtarma kodu ile
   güçlü yeniden doğrulama sonrasında tek `BEGIN IMMEDIATE` işlemi içinde yapılır.
7. Aynı SHA-256 veya `exportId` ile daha önce uygulanmış ve geri alınmamış paket
   tekrar uygulanamaz.
8. Her oluşturulan ve yeniden kullanılan kayıt kaynak kimliğiyle bir içe aktarma
   batch kaydına bağlanır. Uygulama ve geri alma denetim zincirine yazılır.
9. Geri alma penceresi 24 saattir. Yalnız o batch tarafından oluşturulan kayıtlar,
   bağımlılık sırasıyla silinir; önceden var olup yeniden kullanılan kayıtlar
   korunur.
10. İçe aktarılan kayıtlar sonradan kullanıcı, finans, sağlık, yaşam merkezi,
    arşiv, otomasyon, ilişki veya etkinlik bağına alınmışsa geri alma fail-closed
    engellenir. Engelleyici nedenler kullanıcıya gösterilir ve işlem daha sonra
    yeniden denenebilir.

## Sonuçlar

- Kısmi içe aktarma veritabanında kalmaz.
- Ön izleme ile uygulama arasında TOCTOU değişiklikleri fail-closed durur.
- Renderer yetkisi dosya sistemine genişlemez.
- Geri alma, sonradan oluşturulmuş gerçek aile verisini sessizce silmez.
- Şema v1 dışındaki kaynaklar açık dönüştürme/migrasyon olmadan kabul edilmez.

## Kanıt sınırı

Build 146 hedefli runtime senaryoları bellek içi repository portlarıyla plan,
atomiklik, replay, dosya değişikliği ve geri alma davranışını sınar. Gerçek SQLite
kilitlemesi, native Electron dosya iletişim kutusu, render edilmiş ekran ve Windows
paketi toplu doğrulama aşamasına kadar kanıtlanmış sayılmaz.
