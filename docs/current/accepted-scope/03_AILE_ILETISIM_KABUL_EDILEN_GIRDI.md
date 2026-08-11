# Anadolu Parsı Aile Yaşam Merkezi
## Planlanan Bronze 03.08.2026.27 — Aile İletişim, Toplantı ve İşbirliği Merkezi

> Durum: Yeni bağlayıcı kapsam girdisi. Kaynak kod henüz değiştirilmemiştir ve bu belge PASS kanıtı değildir.

## 1. Modülün amacı

Bu modül yalnız bir sohbet ekranı değildir. Aile bireylerinin güvenli biçimde haberleştiği, görüştüğü, toplantı yaptığı, dosya paylaştığı, farklı dillerde birbirini anlayabildiği, karar ve görev ürettiği bir aile işbirliği alanıdır.

Ana alt modüller:

1. Güvenli mesajlaşma
2. Çevrimiçi durum ve ulaşılabilirlik
3. Sesli/görüntülü görüşme
4. Aile toplantıları
5. Yapay zekâ destekli dil ve çeviri
6. Dosya ve medya paylaşımı
7. Toplantı kaydı, transkript ve tutanak
8. İletişim denetim izi ve şifreli arşiv
9. Yaşlı/genç/engelli kullanıcı deneyimi

## 2. Kesin kayıt ilkesi

“Yapılan her şeyin kaydı” üç farklı kayıt türüne ayrılır:

### A. Zorunlu audit kaydı

Her zaman tutulur:

- kim giriş yaptı,
- hangi cihaz kullanıldı,
- hangi oda oluşturuldu,
- kim çağrı başlattı veya bitirdi,
- kim katıldı veya ayrıldı,
- mesaj/dosya kimliği oluşturuldu, düzenlendi veya silindi,
- izin, kayıt rızası ve saklama politikası değişti,
- anahtar dönemi ve cihaz iptali gerçekleşti.

Audit, mesajın veya konuşmanın kendisini kopyalamaz. İçerik yerine kimlik, zaman, sürüm, hash ve işlem sonucu tutar.

### B. İletişim içeriği

Mesajlar, dosyalar ve kullanıcı tarafından saklanan sesli mesajlar uçtan uca şifreli içerik olarak tutulur. Oda bazında kalıcı, süreli veya otomatik silinen saklama seçilebilir.

### C. Ses/görüntü/toplantı kaydı

Varsayılan kapalıdır. Yalnız bütün katılımcılar ayrı aydınlatma sonrası açıkça onaylarsa başlar. Bir kişi reddederse görüşme devam eder ancak kayıt yapılmaz. Yeni katılımcı onaylayana kadar kayıt durur. Herkes kırmızı gösterge ve sesli uyarıyla kayıt durumunu görür.

## 3. Mesajlaşma deneyimi

- Bire bir sohbet
- Tüm aile odası
- Hane veya aile dalı odası
- Etkinlik/seyahat/toplantı odası
- Bakım ve sağlık koordinasyon odası
- Özel proje veya görev odası
- Konu dizileri, alıntılı yanıt, tepki ve sabit mesaj
- Sesli mesaj, fotoğraf, video, belge ve izinli konum
- Çevrimdışı kuyruk, gönderildi/teslim edildi/okundu
- Okundu ve yazıyor göstergesi için gizlilik tercihi
- Mesaj düzenleme/silme geçmişi ve geri alma
- Zamanlanmış ve sessiz mesaj
- Yetki filtreli tam arama

## 4. Uçtan uca güvenlik

Metin mesajları ve grup anahtar yönetimi için MLS standardı; grup görüşmesi medyası için WebRTC + SFU + SFrame yaklaşımı kullanılır.

- Sunucu mesaj ve medya içeriğini çözemez.
- Her cihaz ayrı kimlik anahtarına sahiptir.
- Yeni üye eski mesaj geçmişine otomatik erişemez.
- Cihaz kaybında sertifika ve grup anahtarları yenilenir.
- Relay yalnız şifreli paketleri iletir.
- Metadata minimum düzeyde tutulur.
- Kriptografi sıfırdan yazılmaz; standart ve denetlenmiş implementasyonlar kullanılır.

## 5. Çevrimiçi durum

Kullanıcılar:

- Çevrimiçi
- Uzakta
- Meşgul
- Toplantıda
- Rahatsız etmeyin
- Görünmez
- Çevrimdışı

olabilir.

Durum bir gözetim aracı değildir. Son görülme, tam aktivite ve cihaz bilgisi ayrı ayrı gizlenebilir. Varsayılan görünüm yalnız “uygun/uygun değil” düzeyindedir. Kullanıcı görünmez olduğunda sistem yöneticisi rolü bunu aşamaz.

## 6. Görüntülü aile toplantısı

### Temel görüşme

- Bire bir arama
- Aile grup görüşmesi
- Ön katılım cihaz testi
- Kamera/mikrofon/hoparlör seçimi
- Ses-only ve düşük veri modu
- Aktif konuşmacı ve ızgara görünümü
- Ekran veya belirli pencere paylaşımı
- Fotoğraf, video, belge ve aile albümünü birlikte görüntüleme
- Anlık mesaj ve gerçek zamanlı metin
- El kaldırma, tepki ve konuşmacı sabitleme
- Bekleme odası ve toplantı kilidi

### Aile toplantısı iş akışı

- Gündem ve ön belgeler
- Katılım durumu ve hatırlatma
- Sunucu, kolaylaştırıcı, not tutucu ve çevirmen rolleri
- Anket ve oylama
- Karar defteri
- Görev, sorumlu ve son tarih
- Bir sonraki toplantı gündemi
- Rızalı transkriptten AI özet önerisi
- İnsan onayı sonrası şifreli tutanak

## 7. Dil, canlı altyazı ve yapay zekâ

### Yazılı mesaj

- Dil algılama
- Tek dokunuşla çeviri
- Kullanıcı tercihine göre otomatik çeviri
- Orijinal ve çeviriyi yan yana gösterme
- Makine çevirisi etiketi
- Belirsiz ifadeleri işaretleme
- Kullanıcı düzeltmesi
- Aile adları, lakaplar ve özel terimler sözlüğü

### Canlı görüşme

- Konuşmadan yazıya canlı altyazı
- Konuşmacı adıyla altyazı
- Kullanıcının diline canlı altyazı çevirisi
- İsteğe bağlı çevrilmiş metni seslendirme
- Orijinal sesi koruma
- Kayıt yapılmadan yalnız canlı altyazı modu
- İşaret dili konuşmacısını sabitleme ve büyütme

### Gizlilik

- Yerel/offline model önceliği
- Dış AI sağlayıcısına aktarım varsayılan kapalı
- Gönderilecek içeriğin önizlemesi
- Ayrı onay ve ayrı saklama süresi
- Sağlık, finans, çocuk ve konum konuşmalarında ek uyarı
- Çeviri hatalı olabilir; resmî, sağlık veya finans kararı olarak otomatik kullanılmaz

## 8. Dosya ve medya paylaşımı

- E2EE dosya aktarımı
- Büyük dosyada parçalı ve devam ettirilebilir transfer
- Hash ve imza doğrulaması
- Dosya sürümü
- Arşivde tek kopya, sohbetlerde güvenli referans
- Süreli erişim
- Yalnız önizleme
- İndirme izni
- Paylaşımı geri çekme
- Yerel zararlı yazılım taraması ve karantina
- Güvenli uygulama içi önizleme
- Albüm, yorum ve aile hikâyesine bağlama

## 9. Kullanıcı deneyimini yükseltecek ek özellikler

### İleri yaş kullanıcı

- Ana ekranda büyük “Ara” ve “Mesaj” düğmeleri
- Favori kişilerin büyük fotoğraflı kartları
- Yanlış kişiyi aramayı azaltan sesli isim teyidi
- Basit mod: yalnız favoriler, çağrılar, mesajlar ve toplantılar
- Otomatik altyazı ve büyük yazı
- Sesli komut

### Genç kullanıcı

- Hızlı tepki ve medya paylaşımı
- Güçlü gizlilik tercihleri
- Sessiz saatler
- Rahatsız edici kişiyi susturma/engelleme
- Aile yöneticisinin sağlık/finans dışındaki iletişim içeriğine otomatik erişememesi

### İşitme/görme/motor erişimi

- Canlı altyazı
- RTT
- İşaret dili penceresi
- Klavye ile tam kullanım
- Ekran okuyucu
- Yüksek kontrast
- 200%+ metin ve büyüteç uyumu
- En az 44 px hedefler

### Aile yaşamı

- Acil aile duyurusu ve “iyiyim/yardım lazım” yanıtı
- Birlikte fotoğraf ve video izleme
- Aile anısı anlatım gecesi
- Ortak beyaz tahta
- Kutlama ve doğum günü odası
- Seyahat odası
- Bakım veren kontrol listesi
- Uzaktan teknik yardım için tek seferlik ekran paylaşımı

Uzaktan kontrol varsa her an görünür gösterge, tek seferlik onay, anında iptal ve parola/güvenli masaüstü gizleme zorunludur.

## 10. Teknik medya mimarisi

- WebRTC çağrı uçları
- Ayrı Signaling Service
- 2 kişi için uygun durumda doğrudan P2P
- Grup görüşmeleri için SFU
- İnternet erişimi için TURN
- SFU medyayı yönlendirir ancak SFrame E2EE nedeniyle içeriği çözemez
- Çağrı ve mesaj grup anahtarları MLS üyeliğiyle birlikte yenilenir
- SFU ayrı media-plane hizmetidir; Core Service çökse dahi kontrollü kapanış ve yeniden bağlanma davranışı vardır
- Kayıt sunucunun gizlice çözmesiyle değil, açıkça katılan şifreli Recording Participant ile yapılır

## 11. Hukuk ve mahremiyet kapısı

- Aydınlatma metni ve açık rıza ayrı ekranlardır.
- Kayıt başlamadan önce amaç, kapsam, kimlerin erişeceği ve saklama süresi açıklanır.
- Rıza vermemek temel mesajlaşma/görüşme hizmetini engellemez.
- Çocuk, sağlık ve özel nitelikli veri için hukuk uzmanı incelemesi olmadan Gold yoktur.
- Saklama süresi dolan kayıt güvenli imha iş akışına girer.
- Fiziksel SSD imhası konusunda mutlak garanti verilmez.

## 12. Süre ve ilerleme etkisi

Dağıtık platform eklenmiş önceki geniş kapsamta Bronze yaklaşık %39–42 idi. Bu iletişim modülü henüz kaynakta bulunmadığı için genel Bronze kapsamı **%33–36** aralığına iner.

Ek odaklı iş tahmini:

- E2EE mesajlaşma, presence ve oda yönetimi: 12–18 gün
- WebRTC, SFU, TURN ve grup çağrısı: 15–25 gün
- MLS/SFrame anahtar ve cihaz yaşam döngüsü: 10–16 gün
- Kayıt, rıza, transkript ve şifreli arşiv: 8–14 gün
- AI çeviri, canlı altyazı ve sözlük: 10–16 gün
- Aile toplantısı, karar, oylama ve görevler: 8–12 gün
- Erişilebilirlik, Apple CallKit/PushKit ve fault testleri: 10–16 gün

Paralellik sonrası ek Bronze etkisi yaklaşık **45–65 odaklı iş günü**dür.

Güncellenmiş genel tahmin:

- Bronze: 130–175 odaklı iş günü
- Silver tam test ve düzeltme: 40–60 iş günü
- Gold kapanışı: 8–14 iş günü
- Native Apple iletişim ekranları: ayrıca 35–55 iş günü

## 13. İlk kodlama sırası

1. Communication domain ve MLS cihaz/grup üyeliği sözleşmeleri
2. Mesaj, oda, ek, presence ve retention şemaları
3. Şifreli mesaj delivery/sync API
4. Windows iletişim ekranı ve bildirimleri
5. WebRTC signaling, STUN/TURN ve bire bir çağrı
6. SFU grup görüşmesi
7. SFrame E2EE ve recording participant
8. Aile toplantısı, gündem, karar ve görev
9. Canlı altyazı ve çeviri provider katmanı
10. Apple CallKit/PushKit/Swift istemci sözleşmeleri
11. Erişilebilirlik ve ağ arızası/fault testleri

## 14. Zorunlu bitiş durumu

- Kanal: Bronze
- Planlanan görünür sürüm: Bronze 03.08.2026.27
- Kaynak kod değişikliği: Yapılmadı
- İletişim modülü durumu: YOK / BAŞLANMADI
- Güncel genel Bronze tahmini: %33–36
- Silver’a geçiş: YASAK / HAZIR DEĞİL
- Sonraki tek resmî iş: Communication domain sözleşmelerini Core Service ve FEATURE_REALITY_GATE kapsamına eklemek
- Bitiş cümlesi: Bu teslim yeni kapsam ve mimari kararıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
