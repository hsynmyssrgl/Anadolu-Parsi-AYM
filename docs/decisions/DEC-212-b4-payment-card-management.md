# DEC-212 — B4 kart ürünü ve takip otomasyonları

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: B4-05, B4-06
- Uygulama paketi: 33-A

## Karar

Kart profili; TCMB kataloglu kurum, ürün adı, kredi/banka/ön ödemeli türü, kart ağı,
fiziksel/sanal/ek kart biçimi, yalnız son dört hane, para birimi, limit,
kullanılabilir limit, güncel borç, ekstre borcu, kesim ve son ödeme tarihiyle
izlenir. Taksit sayısı ve kalan tutarı, otomatik ödeme takip modu, puan, mil,
yıllık ücret ve yerel uyarı eşikleri aynı korumalı finans aggregate'ında tutulur.

## Sır ve işlem sınırı

Tam PAN, kart numarası, CVV/CVC, PIN ve internet bankacılığı parolası exact IPC ve
application sözleşmelerinde fail-closed reddedilir. `payment_cards` yalnız `last4`
sütununu taşır; audit ve outbox son dört haneyi bile içermez. Otomatik ödeme alanı
yalnız kullanıcının manuel takip tercihidir; banka talimatı, ödeme veya para
transferi başlatmaz. Uygulama kart ağına bağlanmaz ve uzak kart verisi çekmez.

## Politika ve kalıcılık

Yazma, mevcut `finance.write` PEP kararı ve kullanılmamış exact kalıcı policy
receipt olmadan gerçekleşmez. Migration 79 receipt replay, doğrudan mutation ve
doğrudan deletion girişimlerini engeller. Read tarafında mevcut kişi sahipliği ve
nesne gizliliği filtresi uygulanır. Hassas veri envanteri kartı yalnız “son dört
hane” olarak adlandırır; kişi yaşam döngüsü kart referansını güvenli silme
incelemesine dahil eder.

## Ratchet ve dürüst kapsam

İki yeni DataStore use-case composition yüzeyi PPK-021 allowlist'ine açık
incelemeyle eklenir; ratchet 535'ten 537'ye çıkar, doğrudan rol bypass sıfır kalır.
PPK-022 238 yüzeyde değişmez ve yeni network egress yoktur. B4-05 ile B4-06
tamamlanır. Kart hareketleri, gerçek banka senkronizasyonu, işlem içe aktarma,
B4-08 ve sonraki finans maddeleri, B9-01, Silver readiness ve Bronze Final bu
kararla tamamlanmaz.
