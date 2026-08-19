# DEC-258 — Çevrimdışı aile haritası altyapısı

Tarih: 19.08.2026  
Durum: UYGULANDI — YEREL HARİTA PAKETİ OPSİYONEL

## Karar

ParsYuva AYM konum ekranı, Windows Maps veya genel internet karo servisi yerine MapLibre GL JS `6.4.1` ve PMTiles `4.5.0` tabanlı çevrimdışı harita altyapısını kullanır. Her iki bağımlılık BSD-3-Clause lisanslı ve exact sürümle kilitlidir.

Uygulama yalnız `pardus-app://renderer/offline-map/turkiye.pmtiles` adresini okuyabilir. Ana süreç bu adresi sabit kullanıcı-verisi yolu altındaki `haritalar/turkiye.pmtiles` dosyasına bağlar; kullanıcıdan veya renderer'dan dosya yolu kabul etmez. Okuma salt okunur, tek HTTP byte-range ile sınırlı, 16 MiB istek ve 8 GiB paket üst sınırına bağlıdır. Regular-file, hard-link, symbolic-link, realpath, PMTiles magic ve paket boyutu doğrulamaları başarısızsa erişim kapalı reddedilir.

## Kullanıcı deneyimi ve doğruluk

- Yerel paket mevcutsa vektör veya raster PMTiles görüntülenir.
- Paket yoksa ekran boş kalmaz; koordinat ızgarası ve geçerli kayıtlı aile konumu işaretleri gösterilir.
- Görsel harita başlatılamazsa erişilebilir metin konum listesi kullanılabilir kalır.
- Harita canlı konum izlemez, rota takibi yapmaz ve arka planda veri göndermez.
- Renderer içinde genel `http://` veya `https://` harita adresi yoktur; ağ ve bulut kullanılmaz.
- Yerel harita paketi OpenStreetMap verisi içeriyorsa `© OpenStreetMap katkıda bulunanlar` atfı görünür tutulur; dağıtılan veri paketinin lisans ve kaynak zinciri ayrıca doğrulanmadan pakete eklenmez.

## Güvenlik ve yönetişim

PPK-015 dış ağ adapteri veya purpose sayısı genişlemez. PPK-021 privileged AST yüzeyi eklenmez. PPK-022 yalnız `windows-desktop/file.access/SIGNED_MANIFEST_STARTUP` altında beş exact, salt-okunur `node:fs` importunu kaydeder; genel dosya yetkisi veya renderer dosya yolu açılmaz.

Yerel Türkiye PMTiles veri dosyası bu kod değişikliğinde üretilmedi veya indirilmedi. Uygulama bu nedenle paket olmadan güvenli koordinat görünümüyle çalışır. Üretim harita paketi ayrıca kaynak, atıf, lisans, SHA-256, boyut ve güncelleme süreci kanıtı gerektirir.

## Teknik kanıt

- `apps/desktop/tests/offline-family-map.test.ts`: sabit origin, HEAD/range okuma, magic, link, query, multi-range ve ağsız renderer sözleşmesi.
- Desktop Electron ve renderer typecheck: PASS.
- Desktop üretim build: PASS; MapLibre worker uygulama origininden ayrı çıktı olarak paketlenir.
- PPK-015 source gate: sıfır bulgu; dış adapter/purpose değişmedi.
- PPK-021 source gate: sıfır bulgu; privileged yüzey sayısı değişmedi.
- PPK-022 source gate: 428/428 exact yüzey, sıfır bulgu.
