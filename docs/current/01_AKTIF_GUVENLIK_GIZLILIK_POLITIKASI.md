# Aktif Güvenlik, Gizlilik ve Politika Sözleşmesi

1. Bütün uygulamalar ve workerlar tek Platform Policy Kernel kararını sunucu tarafında uygular. UI görünürlüğü yetki değildir.
2. Yeni kodda doğrudan rol kontrolü yasaktır; mevcut kontroller baseline borcudur ve yalnız azaltılabilir.
3. Ağ konumu, aile yöneticiliği veya cihaz sahipliği örtük güven vermez. Kullanıcı+cihaz+uygulama+amaç+veri sahibi+nesne+süre birlikte değerlendirilir.
4. Politika servisi, imza veya sürüm doğrulanamıyorsa hassas işlem fail-closed reddedilir.
5. OCR, AI, çeviri, transkript, thumbnail, embedding, arama indeksi ve cache kaynak verinin hassasiyetini, izinlerini, saklama ve silme politikasını devralır.
6. Mesaj ve dosyalar E2EE; ses/görüntü kaydı varsayılan kapalı ve bütün katılımcıların ayrı onayına bağlıdır. Audit içerikten ayrıdır.
7. Finans, sağlık, çocuk ve konum yüksek hassasiyetlidir. Aile yöneticiliği otomatik erişim sağlamaz.
8. Haricî işleme varsayılan kapalıdır; yerel/offline sağlayıcı önceliklidir.
9. Her uygulama aynı conformance test paketinden geçmeden yayımlanamaz.
10. Bilinen P0/P1 güvenlik veya mahremiyet açığı varken Silver/Gold yasaktır.
