# ADR-032 — Sınırlı Başlangıç ve Ekran Bazlı Tembel Veri Yükleme

**Aktif sürüm:** 01.08.2026.219  

## Durum

Kabul edildi — Bronze RC2 Build 155 Active Development.

## Bağlam

Build 147 büyük soy ağacı, zaman tüneli ve arşiv listelerini sayfaladı; ancak
uygulama oturum açılışında tam aile snapshot'ını ve birden çok ikincil modül
listesini aynı anda yüklemeye devam ediyordu. Bu davranış veri büyüdükçe başlangıç
belleğini ve IPC payload hacmini doğrusal artırıyordu.

## Karar

Başlangıç yalnız kimlik, uygulama bilgisi ve SQL agregalı dashboard özetini yükler.
Aile verisi `graph` ve `timeline` bölümlerine ayrılır; renderer ilgili bölümü ekran
ilk ziyaretinde ister ve eşzamanlı aynı istekleri birleştirir. İkincil modül
listeleri de ekran bazında tembel yüklenir.

Dashboard repository tam olay listesini application katmanına taşımaz. Toplamlar
SQL `COUNT/SUM` sorgularıyla, ön izlemeler `LIMIT 6` ve `LIMIT 4` ile üretilir.
Görünürlük aile rolü, katılımcı kimliği ve etkin açık izin/ret kayıtlarıyla sorgu
içinde sınırlandırılır.

## Sonuçlar

- Başlangıç IPC payload'ı tam aile ve modül veri hacminden ayrılır.
- Dashboard olay payload'ı en fazla 10 kayıt olur.
- Ekran yüklenmeden o ekranın büyük veri kümeleri okunmaz.
- Tam snapshot API'si geriye dönük uyumluluk için korunur ancak başlangıçta çağrılmaz.
- Windows render zamanlaması ve üretim disk I/O'su ayrı promotion kanıtı olarak kalır.
