# DEC-214 — B4 finans planlama, portföy ve analiz merkezi

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: B4-10, B4-11, B4-12
- Uygulama paketi: 33-C

## Karar

Gelir/gider kategorileri, planlanan ve gerçekleşen nakit akışı, aylık bütçe
revizyonları, yinelenen işlem kuralı/durum geçmişi ve finansal hedef/ilerleme
kayıtları tek korumalı append-only finans planlama defterinde tutulur. Nakit,
mevduat, altın/döviz, yatırım, bireysel emeklilik, gayrimenkul ve araç varlıkları
aynı defterde ilk değer ve append-only değerleme geçmişiyle izlenir.

Okuma modeli; en son durum, hedef ilerlemesi ve değerlemeyi türetir. Net değer,
borç oranı, gerçekleşen gelir/gider, nakit dengesi, bütçe sapması ve yaklaşan
ödemeler aile ile kişi görünümünde hesaplanır. Kart, kredi, borç, yinelenen gider
ve planlı nakit akışı yalnız ortak takip görünümünde birleştirilir.

## Gerçeklik sınırı

Bütün girdilerin kaynağı manueldir. Uygulama banka eşitlemesi yapmaz, dış piyasa
fiyatı almaz ve ödeme göndermez. Para birimleri birbirine çevrilmez; net değer ve
borç oranı her para biriminde ayrı gösterilir. Yaklaşan ödeme kaydı, ödeme talimatı
veya icra kanıtı değildir. Portföy değeri ve hedef ilerlemesi kullanıcı beyanıdır;
dışarıdan doğrulanmış sayılmaz.

## Güvenlik, politika ve kalıcılık

Dokuz komut türü discriminated exact IPC ve application sözleşmeleriyle doğrulanır.
Tam PAN, kart sırrı, CVV/CVC, PIN ve internet bankacılığı parolası reddedilir;
serbest metinlerde Luhn-geçerli PAN taranır. Üst kayıt türü, aile, sahip ve gizlilik
kalıtımı hem application hem SQLite parent guard ile doğrulanır.

Her taban kayıt `create`, her alt kayıt üst aggregate üzerinde `update`
`finance.write` PEP kararı ve kullanılmamış exact kalıcı receipt gerektirir.
Migration 81 tek `finance_planning_ledger` tablosunu, bütün finans tablolarını
kapsayan receipt replay fence'lerini ve update/delete guard'larını ekler. Audit ve
outbox; tutar, açıklama, not, hedef veya portföy değeri taşımaz.

## Ratchet ve dürüst kapsam

İki yeni DataStore use-case composition yüzeyi PPK-021 allowlist'ine açık
incelemeyle eklenir; exact ratchet 540'tan 542'ye ve use-case composition sayısı
272'den 274'e çıkar. Doğrudan rol bypass sıfır, PPK-022 238 ve network egress
değişmeden kalır. B4-10, B4-11 ve B4-12 tamamlanır. B4-13 kontrollü içe aktarma,
B4-14 open-banking adapter, gerçek banka senkronizasyonu/fiyat doğrulaması/ödeme
icrası, B9-01, Silver readiness ve Bronze Final tamamlanmaz.
