# DEC-211 — B4 banka kurumu, hesap, IBAN doğrulama ve sır reddi temeli

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: B4-01, B4-02, B4-03, B4-04, B4-07
- Uygulama paketi: 32-Z

## Karar

Türkiye banka kurumu kataloğu, TCMB'nin 2026 Ödeme Sistemleri Katılımcıları
listesine kaynak bağlı 71 kayıt olarak migration 78 ile yerel veritabanına alınır.
Katalog resmi dört haneli kurum kodunu, Türkiye IBAN'ındaki beş haneli ödeme
hizmeti sağlayıcısı kodunu, resmi adı ve müşteri hesabı desteğini taşır. Uygulama
uzaktan logo indirmez; güvenli `local_lettermark` simgesi kullanır.

Banka hesabı; sahip kişi, kurum, IBAN, hesap türü, para birimi, alias, isteğe bağlı
şube, 1–10.000 baz puan sahiplik oranı, durum ve gizlilikten oluşur. Tam normalize
IBAN yalnız korumalı SQLite tablosunda tutulur. Repository dışına maskeli IBAN ve
son dört hane çıkar; audit ile outbox payload'ı tam IBAN içermez. Yazma, mevcut
merkezi finans politika zincirinde `finance.write` kararı ve kullanılmamış exact
kalıcı policy receipt olmadan gerçekleşmez.

## IBAN doğrulama gerçeği

32-Z yalnız Türkiye IBAN'ını destekler. Girdi NFKC ile normalize edilir; ülke,
26 karakter uzunluk, karakter kümesi, ISO 7064 MOD 97-10, beş haneli sağlayıcı
kodu, Türkiye rezerv alanı `0` ve seçilen TCMB kurumu eşleşmesi kontrol edilir.
Bu sonuç yalnız yapısal doğruluktur. Banka ağına sorgu gönderilmez; gerçek hesabın
varlığı ve hesap sahipliği doğrulanmış sayılmaz. UI bu üç durumu ayrı ve açık
gösterir: yapısal kontrol, gerçek hesap doğrulaması ve sahiplik doğrulaması.

## Sır reddi

Tam PAN, kart numarası, CVV/CVC, PIN ve internet bankacılığı parolası banka hesabı
sözleşmesinde alan adı kanonikleştirilerek fail-closed reddedilir. Alias/şube gibi
serbest metinde 13–19 haneli Luhn-geçerli tam PAN da reddedilir. Aynı koruma eski
`finance:create` ve `finance:createValuation` kanallarına uygulanır; unknown alan
handler öncesi exact IPC sözleşmesinde, sır ise ayrıca application use-case'inde
reddedilir. Migration 78 bu sırlar için hiçbir kalıcı sütun oluşturmaz.

## Güvenlik ratchet'i ve kapsam

Dört yeni DataStore use-case composition yüzeyi PPK-021 exact allowlist'ine açık
incelemeyle eklenir; ratchet 531'den 535'e çıkar, doğrudan rol bypass sayısı sıfır
kalır. PPK-022 capability yüzeyi 238 olarak değişmez ve yeni network egress yoktur.

B4-01, B4-02, B4-03, B4-04 ve B4-07 birlikte tamamlanır. B4-05 kredi kartı ürün
modeli, B4-06 kart otomasyonları, gerçek banka/hesap/sahiplik doğrulaması, B9-01,
Silver readiness ve Bronze Final bu kararla tamamlanmaz.
