# Sınırlı Başlangıç ve Ekran Bazlı Tembel Yükleme — v1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Uygulama açılış maliyetini aile üyesi, ilişki, olay, konum ve ikincil modül kayıt
sayısından ayırmak; tam veri kümelerini yalnız ilgili ekran ilk kez açıldığında
yüklemek.

## Başlangıç sözleşmesi

Oturum açılışında renderer yalnız uygulama bilgisi, kimlik durumu ve gösterge
paneli özetini ister. Tam `FamilyAppSnapshot`, arşivlenmiş olaylar, finans,
sağlık, ilaç, aile sağlık geçmişi, yaşam kayıtları, otomasyon ve rapor verileri
başlangıç `Promise.all` zincirinde yer almaz.

Gösterge paneli repository sorgusu:

- sayıları SQLite agregalarıyla hesaplar,
- yaklaşan önemli günleri en fazla 6 kayıtla,
- son zaman tüneli kayıtlarını en fazla 4 kayıtla sınırlar,
- aile/katılımcı/açık izin görünürlüğünü sorgu içinde uygular,
- renderer'a en fazla 10 olay ön izleme kaydı taşır.

## Bölümlü aile snapshot sözleşmesi

`data:getSnapshotSections` yalnız şu bölümleri kabul eder:

- `graph`: aile üyeleri ve ilişkiler,
- `timeline`: konumlar, olaylar ve aile bildirimleri.

Bilinmeyen, yinelenen veya boş bölüm listesi IPC entegrasyon politikası tarafından
reddedilir. Aynı bölüm için eşzamanlı renderer çağrıları tek promise altında
birleştirilir.

## Ekran yükleme matrisi

- Aile: graph + timeline
- Soy ağacı: graph
- Zaman tüneli: graph + timeline
- Önemli günler: graph + timeline + arşivlenmiş olaylar
- Arşiv: timeline
- Konum: timeline
- Finans, sağlık, yaşam merkezi, yetkiler, dijital miras: graph
- Finans/sağlık/yaşam/otomasyon/rapor veri kümeleri: yalnız ilgili ekran ilk açılışında

## Sınırlar

Bu değişiklik gerçek Windows Electron açılış süresini, installer yaşam döngüsünü
ve üretim diski I/O performansını kanıtlamaz. Tam `getSnapshot()` uyumluluk ve
mutasyon dönüşleri için korunur; başlangıç akışında kullanılmaz.
