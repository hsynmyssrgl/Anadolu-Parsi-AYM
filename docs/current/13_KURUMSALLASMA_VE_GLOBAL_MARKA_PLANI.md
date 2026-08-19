# ParsYuva Kurumsallasma ve Global Marka Plani

- Belge sürümü: `KURUMSAL-2026-08-18-V1`
- Ürün: **ParsYuva AYM**
- Açıklayıcı ad: **ParsYuva Aile Yaşam Merkezi**
- Görünür sürüm: **Bronze 19.08.2026.34**
- Yetki kararı: `DEC-254`
- Durum: **ACTIVE_PLAN / EXTERNAL_ACTION_NOT_RUN**
- Dış kurumsallaşma kabulü: `countsAsRequirementPass=false`

## 1. Marka mimarisi

| Katman | Kabul edilen ad | Kullanım |
|---|---|---|
| Ana marka | ParsYuva | Web, iletişim, ürün ailesi |
| Masaüstü ürün | ParsYuva AYM | Kurulum, kısayol, pencere, uygulama içi kimlik |
| Açıklayıcı ürün adı | ParsYuva Aile Yaşam Merkezi | Tanıtım ve uzun açıklamalar |
| Şirket unvanı adayı | ParsYuva Dijital Yaşam Teknolojileri Anonim Şirketi | Tescil edilmeden resmî unvan gibi kullanılmaz |
| İngilizce pazarlama biçimi | ParsYuva Digital Life Technologies Inc. | Türkiye'deki resmî unvanın yerine geçmez |
| İngilizce slogan adayı | Your Private Family Hub | Marka ve anlam testi tamamlanmadan bağlayıcı değildir |

Eski `Anadolu Parsı Aile Yaşam Merkezi` adı kullanıcıya görünür yeni yüzeylerde kullanılmaz. Ancak mevcut kullanıcı verisini ve yükseltme zincirini korumak için eski Windows uygulama kimliği ve veri dizini teknik uyumluluk değeri olarak korunur.

## 2. Şirketleşme modeli

Tek pay sahipli anonim şirket, gelecekte yatırım alma ve pay yapısını kurma bakımından öncelikli adaydır. Bununla birlikte kuruluş sermayesi, devam maliyetleri, yönetim yükü ve vergi etkisi mali müşavir ve şirketler hukuku avukatıyla doğrulanmadan kesin seçim yapılmaz. AŞ olmak, yatırım veya halka arz için tek başına yeterli değildir.

## 3. Dış doğrulama ve resmî işlemler

1. TOBB/MERSİS üzerinden unvan benzerlik araştırması ve rezervasyon.
2. TÜRKPATENT'te birebir ve benzer marka araştırması; en az 9 ve 42, gerekiyorsa 35. sınıf.
3. Global alan adı, sosyal kullanıcı adı ve mağaza adlarının aynı güncel oturumda kontrolü ve satın alımı.
4. Ana sözleşme, faaliyet konusu/NACE, sermaye, temsil-ilzam ve pay sahipliği kararları.
5. Kaynak kodu, logo, alan adı ve tasarım haklarının şirkete devri/lisansı.
6. Banka, e-fatura, vergi ve muhasebe operasyonunun kurulması.
7. Gizlilik bildirimi, kullanım koşulları, mesafeli satış ve tüketici süreçleri.
8. Şirket kontrollü Apple, Microsoft ve Google geliştirici hesapları ile kod imzalama sertifikası.

## 4. Global dil sırası

- Aşama 1: Türkçe + İngilizce.
- Aşama 2: Almanca, İspanyolca, Fransızca.
- Aşama 3: Brezilya Portekizcesi ve Japonca.
- Aşama 4: Arapça; RTL yerleşim, tipografi ve erişilebilirlik UAT'si zorunludur.

İngilizce ilk küresel doğrulama için yeterli başlangıçtır; kalıcı global ürün erişimi için tek başına yeterli kabul edilmez.

## 5. Platform ve cihaz organizasyonu

- Microsoft/Windows: masaüstü, kurulum, Windows Hello, DPAPI/safeStorage ve Core Service.
- Apple/macOS/iOS: API istemcisi, mağaza/notarization, Keychain/Secure Enclave ve gerçek Apple cihaz UAT'si.
- Ortak cihaz katmanı: kimlik, sahiplik, şifreleme, politika, erişilebilirlik ve sürümlü API sözleşmeleri.
- Android: gelecek kapsamı; uygulama ve mağaza kanıtı yokken tamamlanmış sayılmaz.

Kurumsal klasör görünümü `C:\PPT\AYM\03_TASARIM\02_PLATFORM_VE_CIHAZ` ve `C:\PPT\AYM\07_DOKUMAN\02_GUNCEL_KURUMSAL_BELGELER` altında tutulur.

## 6. Açık işler

| İş | Yerel durum | Açık kalma nedeni | Eksik dış kanıt | requirement PASS |
|---|---|---|---|---|
| ParsYuva AYM kod ve kurulum kimliği | IMPLEMENTED | Test ve paket kapıları çalıştırılıyor | Yok | Hayır, build kapanışı bekleniyor |
| Şirket kuruluşu | NOT_RUN | Yetkili başvuru yapılmadı | MERSİS, noter/sicil, mali müşavir | Hayır |
| Marka tescili | NOT_RUN | Resmî araştırma/başvuru yok | TÜRKPATENT | Hayır |
| Alan adı ve sosyal hesaplar | NOT_RUN | Satın alma yetkisi kullanılmadı | Kayıt operatörü makbuzu | Hayır |
| Kod imzalama | BLOCKED_EXTERNAL | Üretim sertifikası yok | Authenticode sertifikası ve zaman damgası | Hayır |
| Apple dağıtımı | NOT_RUN | Şirket hesabı ve gerçek cihaz UAT yok | Apple Developer/Notarization/UAT | Hayır |
| Hukuk, vergi ve gizlilik incelemesi | NOT_RUN | Uzman onayı yok | İmzalı görüş ve politikalar | Hayır |

Bu açık işler yerel kodlama ile kendiliğinden kapanmaz ve resmî işlem yapılmış gibi raporlanamaz.
