# ParsYuva AYM Urun Is Analizi

## Urun tanimi

ParsYuva AYM; aile bireyleri, aile hafizasi, belgeler, finans, saglik, yasam kayitlari, guvenlik, iletisim ve yerel yapay zeka islevlerini tek aile kapsaminda yoneten local-first masaustu platformudur.

## Is hedefleri

1. Kullanicinin aile verisini tek ve anlasilir merkezde yonetmesi.
2. Temel kullanimda internet hesabi zorunlulugu olmamasi.
3. Hassas verinin varsayilan olarak yerel ve sifreli kalmasi.
4. Bronze, Silver ve Gold kanallarinda kontrollu ticari urunlesme.
5. Windows ile baslayan, sonradan Apple istemcilerine genisleyebilen mimari.
6. Kullanici verisini surumler boyunca koruyan migration ve yedekleme modeli.
7. Kanitlanmamis saglayici, cihaz veya guvenlik ozelligi icin gercek disi iddia uretilmemesi.

## Hedef kullanici

- Birincil: Kendi ailesi icin yerel ve guvenli kayit merkezi isteyen birey.
- Ikincil: Aile yoneticisi roluyla birden fazla aile uyesini koordine eden kisi.
- Gelecek: Kucuk aile gruplari, bakim koordinasyonu ve cihazlar arasi kontrollu erisim.

## Deger onerisi

- Tek uygulamada parcalanmamis aile bilgisi.
- Yerel-first veri sahipligi.
- Guvenlik, audit ve izin kararlarinin gorunur olmasi.
- Cevrimdisi calisabilen temel akıslar.
- Surum ve tema kimligiyle tutarli kullanici deneyimi.
- Acik veri disari aktarma, yedek ve silme haklari.

## Ticari model adayi

| Kanal | Kullanim | Tema | Aktivasyon |
|---|---|---|---|
| Bronze | Gelistirme ve ilk yerel kullanim | Bronz | 30 gunluk degerlendirme; ticari kural henuz tam uygulanmis degil |
| Silver | Dogrulama ve duzeltme | Gumus | 30 gunluk degerlendirme |
| Gold | Uretim | Altin | Aktivasyon olmadan 30 gun; ayri yonetici araci ile sinirsiz aktivasyon tasarimi gerekir |

Aktivasyon altyapisi kod, guvenlik, lisans hukuku ve destek surecleri tamamlanmadan uretim hazir sayilmaz.

## Ana yetenek alanlari

1. Kimlik, oturum, MFA, passkey ve cihaz guveni.
2. Aile, kisi, hane, dal ve soy agaci.
3. Zaman cizelgesi, onemli gunler ve aile arsivi.
4. Finans, banka, kart, kredi, planlama ve portfoy.
5. Saglik, ilac, aile saglik gecmisi ve bakim koordinasyonu.
6. Yasam merkezi, ev, egitim, seyahat, varlik ve evcil hayvan.
7. Konum, cevrimdisi harita ve izinli konum kayitlari.
8. Yerel OCR, arama ve belge islemleri.
9. Yerel aile AI asistani ve riza bagli veri kullanimi.
10. Iletisim, dosya, toplanti, ses/goruntu ve kayit politikalari.
11. Yedekleme, geri yukleme, veri haklari ve fabrika ayari.
12. Sistem sagligi, bakim, rapor, yardim ve sesli anlatim.

## Basari olcutleri

- Kritik ana akislarda sifir P0/P1 acik hata.
- Tum gorunur butonlarin islev ve test baglantisi.
- Tam Turkish ve en az English temel urun kapsami; desteklenmeyen sistem dilinde English fallback.
- Kurulum, acilis, kapanis, guncelleme, kaldirma ve geri yukleme UAT kaniti.
- Veri kaybi olmadan N-1 surumden migration.
- Ticari lisans envanterinde belirsiz veya yasakli bilesen olmamasi.
- Uretim imzali installer ve kurulu EXE dogrulamasi.
- Yasal/gizlilik ve gercek cihaz kanitlari tamamlanana kadar yayin kapisinin kapali kalmasi.

## Mevcut durum ozeti

- Kod tabani genis ve otomatik test kapsami yuksektir.
- Guncel governed preflight PASS durumundadir.
- Calisma agaci buyuk bir degisiklik kumesi tasidigi icin temiz teslim kaniti henuz yoktur.
- Ingilizce altyapi ve temel akis vardir; uzman panellerin tam cevirisi aciktir.
- Yerel AI kodu vardir; yerel model kurulumu/dogrulamasi surmektedir.
- Cevrimdisi harita motoru vardir; Turkiye PMTiles veri paketi dis kaynak olarak saglanmalidir.
- OCR motoru vardir; Defender baglantisi, PDF ve dusuk ayricalikli sandbox farkli olgunluk duzeylerindedir.
- Uretim sertifikasi, gercek saglayici UAT ve ticari hukuk/gizlilik onaylari yoktur.

