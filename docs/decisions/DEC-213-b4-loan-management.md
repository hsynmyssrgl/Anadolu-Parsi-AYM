# DEC-213 — B4 kredi ve ödeme geçmişi yönetimi

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: B4-08, B4-09
- Uygulama paketi: 33-B

## Karar

İhtiyaç, konut, taşıt ve diğer kredi profilleri; TCMB kataloglu kurum, oran türü ve
baz puan, vade, taksit, kalan anapara, kullandırım/ilk ödeme/vade tarihleri ve yerel
ödeme planıyla tek korumalı finans aggregate'ında izlenir. Erken kapama teklifi,
gecikme üçlüsü, sigorta, teminat ve bileşenleri ayrıştırılmış ödeme geçmişi aynı
aggregate'ın açık sözleşmesine bağlanır.

## Gerçeklik sınırı

Bütün değerlerin kaynağı manueldir. Uygulama bankaya bağlanmaz, kredi veya bakiye
doğrulamaz, uzak hareket çekmez ve ödeme göndermez. Yerel takvim bankanın resmi
amortisman planı olduğu iddiasını taşımaz. Ödeme geçmişine eklenen kayıt kalan
anaparayı otomatik değiştirmez. Erken kapama alanı yalnız kullanıcının aldığı teklif
değerini izler; teklif isteme veya krediyi kapatma işlemi yapmaz.

## Güvenlik, politika ve kalıcılık

Tam PAN, kart numarası, CVV/CVC, PIN ve internet bankacılığı parolası exact IPC ve
application sözleşmelerinde fail-closed reddedilir; serbest metinlerde Luhn-geçerli
PAN taranır. Her kredi oluşturma ve ödeme geçmişi ekleme işlemi mevcut
`finance.write` PEP kararı ile kullanılmamış exact kalıcı receipt gerektirir.
Migration 80 kredi, plan ve append-only ödeme geçmişini ekler; cross-table receipt
replay, doğrudan mutation ve deletion trigger'larla engellenir. Audit ve outbox
parasal tutar, sigorta referansı, teminat açıklaması veya ödeme notu taşımaz.

## Ratchet ve dürüst kapsam

Üç yeni DataStore use-case composition yüzeyi PPK-021 allowlist'ine açık incelemeyle
eklenir; exact ratchet 537'den 540'a ve use-case composition sayısı 269'dan 272'ye
çıkar. Doğrudan rol bypass sıfır, PPK-022 238 ve network egress değişmeden kalır.
B4-08 ile B4-09 tamamlanır. B4-10 ve sonraki finans maddeleri, gerçek banka
senkronizasyonu/ödeme icrası, B9-01, Silver readiness ve Bronze Final tamamlanmaz.
