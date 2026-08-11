# Bronze RC2 Active Development — Build 145

- **Ürün:** Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `28.07.2026.145`
- Package Version: `28.7.2026-145`
- Stage: **Bronze RC2 Active Development**
- **Sonraki geliştirme noktası:** Build 146

## Tamamlanan ana geliştirme

İmzalı iptal listeleri için periyodik güvenli senkronizasyon katmanı eklendi.
Etkin sağlayıcı profilleri zamanlayıcı çevriminde kontrol edilir; yalnız Build 144
HTTPS, sağlayıcı profili ve geçerli TLS SPKI pin zincirinden geçen yanıtlar alınır.

Ağ içeriği doğrudan uygulanmaz. Sıra numarası, liste kimliği ve `thisUpdate` /
`nextUpdate` zaman penceresi ön kontrolden geçerse güçlü kullanıcı doğrulaması
bekleyen geçici güncelleme olarak tutulur. Son doğrulanmış sıraya eşit veya daha
küçük içerik güven durumunu geri alamaz. Başarısız denemelerde 15 dakikadan
başlayan ve 6 saatle sınırlanan artan geri çekilme uygulanır; yeni güncelleme,
blokaj ve ilk hata kullanıcıya bildirilir ve tanılama kaydına yazılır.

## Gerçek hedefli kontroller

- Build 145 güvenli senkronizasyon sözleşmesi: **PASS — 17/17**
- Renderer/preload/global sözdizimi: **PASS — 3/3**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS — kontrollü dış tip kabuğu**

## Çalıştırılmayan geniş kapılar

- Temiz `npm ci`: **NOT_RUN**
- Tam root `tsc --noEmit`: **NOT_RUN**
- Tüm birim ve entegrasyon testleri: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke: **NOT_RUN**
- Gerçek internet sağlayıcı endpoint testi: **NOT_RUN**
- Gerçek TLS sertifika ve pin geçiş testi: **NOT_RUN**
- Render edilmiş ekran UAT: **NOT_RUN**
- Windows installer yaşam döngüsü: **NOT_RUN**
