# DEC-266 — Özel kurulum, ilk aile, temiz paket ve çift yedek kabul zinciri

- Tarih: 22.08.2026
- Durum: ACTIVE
- Yürürlük: Bronze 22.08.2026.45
- Kaynak: Kullanıcının güncel konuşmadaki açık talimatı
- Kanonik kural: PR-232

## Karar

Özel Windows karşılama sayfası, ilk aile oluşturma yüzeyi ve teslim zinciri birbirinden kopuk görsel notlar değil, tek bağlayıcı kabul kapsamıdır.

1. Kurulum karşılama sayfası ParsYuva marka, logo ve kanal paletini kullanır. Sakin dekoratif hareket kurulum ilerlemesi gibi sunulamaz; gerçek kurulum yüzdesi yalnız yerel NSIS dosya kurulum aşamasından gelir.
2. İlk aile ekranı en az 900x640 görünümde yatay taşmadan ve kesilmeden çalışır. Sağ yüzey sıcak açık tonlar, yumuşak çerçeve ve başlık düğmeleri kullanır; marka alanı belirgindir. Erkek, dişi ve çocuk pars görselleri aynı aile kompozisyonunda bulunur ve hareket azaltma tercihi animasyonu kapatır.
3. Türkçe ve İngilizce tanıtımda önce aynı dilde kadın sesi seçilir; bulunamazsa aynı dilde kurulu erkek/varsayılan ses kullanılır. Gerçek ses çıkışı gözlenmeden “duyuldu” kabulü verilmez; metin dökümü her zaman görünür kalır.
4. Pencere ve sistem tepsisi simgeleri küçük Windows yüzeylerinde seçilebilir ayrı kaynaklar kullanır.
5. İlk aile, yönetici, kişi üyeliği, güvenilir cihaz, ilk izinler ve audit kayıtları tek SQLite unit-of-work içinde oluşturulur; herhangi bir hata tüm kurulumu geri alır ve güvenli yeniden denemeye izin verir.
6. Sürüm yükseltmesi kişisel veriyi korur. Sessiz bakım ve yükseltme önceki kaldırıcıyı yıkıcı kullanıcı-verisi seçimine sokmaz; açık kaldırma akışı ayrı kalır.
7. Paketlemeden önce eski installer EXE, blockmap ve SHA-256 yan dosyaları silinir. Tüm çalışma alanları yeniden derlenir; installer doğrulaması, paketlenmiş gerçek uygulama açılışı, gerçek sürüm, SHA-256 ve imza durumu kaydedilir.
8. Kesin kaynak commit'i aynı dalda GitHub ve `D:\GitYedekleri\Anadolu-Parsi-AYM.git` uzak depolarına gönderilir. Ayrıca güncel kaynak ağacı D: haricî diskte sürüm klasörüne deterministik arşivlenir ve byte boyutu ile SHA-256 geri-okuması PASS olmadan teslim tamamlanmış sayılmaz.

## Kanıt ve sınır

`scripts/verify-first-family-clean-release-policy.mjs` kaynak sözleşmesini fail-closed denetler. Hedefli SQLite, anlatım, responsive görsel, installer ve paketlenmiş runtime testleri ayrıca çalıştırılır. Yerel imzasız paket `NotSigned` olarak kalır; üretim Authenticode, temiz Windows DPI matrisi ve insan tarafından gerçek ses duyma kanıtı ayrı dış kabul sınırıdır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
