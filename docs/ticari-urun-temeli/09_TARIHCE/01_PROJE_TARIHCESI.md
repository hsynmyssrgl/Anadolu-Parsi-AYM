# Proje Tarihcesi

## 20.07.2026 - Baslangic donemi

Aile yasam merkezi fikri; aile verilerini, belgeleri ve gunluk yasam alanlarini tek yerel uygulamada toplama hedefiyle basladi. Ilk kapsam ve veri modelleri olusturuldu.

## Temmuz sonu - Agustos basi 2026

Kural, karar, test ve kanit tabanli yonetim gelistirildi. Domain/application/repository katmanlari, merkezi policy, audit/outbox ve SQLite migration yapisi buyudu. Finans, saglik, yasam, arsiv, yedekleme ve sistem sagligi alanlari eklendi.

## 04.08.2026 kanonik yonetim donemi

Kanonik kural sicili, governed preflight/postflight, belge indeksleri ve kalici kanit sozlesmeleri kuruldu. Eski belgelerin tarihsel kanit olarak korunmasi kararlastirildi.

## 13-18.08.2026 urun genisleme donemi

Gizlilik/veri haklari, passkey/federated kimlik, yerel OCR, AI asistani, harita, iletisim, toplantilar, akilli ev, dagitik istemci ve Windows dayaniklilik paketleri gelistirildi. ParsYuva markasi ve Bronze/Silver/Gold tema kurali tanimlandi.

## 19.08.2026 ticari temel surumu

Daginik aktif belgeler yerine, gecmisi silmeden Git deposu icinde yeni `docs/ticari-urun-temeli` alani olusturuldu. `C:\PPT\AYM\12_TICARI_URUN_TEMEL_SURUMU` kullanici uyumluluk yolu ayni dizine baglandi. Bu alan ilk temiz ticari belge temeli, asilamaz kurallar, ayrintili is analizi, mimari, lisans envanteri ve tek ana is listesi olarak kabul edildi.

## 20.08.2026 ek karar birlestirme ve teslim denetimi

18.08.2026 tarihli EK-001–EK-019 karar tamponu silinmeden tarihsel kaynak olarak korundu. Kanal renkleri, parola gorunurlugu, installer adlandirma ve yasam dongusu, aylik derleme numarasi, 30 gunluk kullanim/Gold aktivasyon, kaldirma-yedek-sifirlama, tepsiye kucultme ve veri koruyan guncelleme kurallari PR-218–PR-227 ile V14 kanonik sicile baglandi. Daha yeni ParsYuva, dil ve kurulum kararlarinin eski Anadolu adlandirmalarina ustun oldugu acikca kaydedildi. Tam regresyon, installer ve Git iki-uzak-depo readback zinciri `DEC-260` ile teslim kosulu yapildi.

## Gelecek donem

1. Temiz kaynak ve Silver dogrulama.
2. Tam English, erisilebilirlik ve gercek Windows UAT.
3. Uretim imzasi, lisanslama ve veri koruma kapanisi.
4. Gold ticari yayin.
5. Web/alan adi ve Apple platformlari.

Tarihce aktif teknik gerceklik yerine gecmez; her donemin exact durumu ilgili kanit ve kaynak snapshotindan okunur.
