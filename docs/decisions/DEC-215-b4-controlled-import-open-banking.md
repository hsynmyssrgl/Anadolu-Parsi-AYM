# DEC-215 — Kontrollü finans içe aktarma ve ağsız ÖHVPS sınırı

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: B4-13, B4-14
- Uygulama paketi: 33-D

## Karar

CSV, TSV, XLSX, OFX ve QFX hareketleri ana sürecin sahip olduğu dosya seçimiyle
alınır. Dosya yolu ve ham dosya renderer'a verilmez. En fazla 5 MiB, 5.000 satır ve
64 sütunluk içerik 15 dakikalık timer-backed geçici önizlemede tutulur; ayrıştırılmış
satırların süre sonuna kadar bellekte kaldığı ve örnek hücrelerin renderer'da
gösterildiği açıkça belirtilir. Önizleme renderer sender, doğrulanmış hesap ve aileye
bağlanır; login, logout ve session lock geçişlerinde temizlenir. Kullanıcı tarih,
açıklama, tutar/borç/alacak, yön, para birimi ve harici kimlik sütunlarını gelir ve
gider kategorilerine eşler. Doğrulanan paket tek finance PEP işlemi içinde staging
batch, append-only hareketler ve exact seal olarak kaydedilir.

Tekrar önleme; aile, sahip, kaynak dosya SHA-256 değeri, kaynak satır numarası,
tarih, yön, iki ondalıklı tutar, para birimi, harici hareket kimliği ve normalize
açıklamadan SHA-256 üretir. SQLite `UNIQUE(family_id,row_fingerprint)` kalıcı çiti
aynı kaynak satırının yeniden içe alınmasını engeller. Hesap kimliği bulunmayan iki
ayrı dosyadaki benzer gerçek hareketler kesin tekrar sayılmaz; böylece varsayılan
`skip` seçeneği meşru hareketi sessizce kaybetmez. Kullanıcı exact kaynak tekrarında
paketin tamamını reddetmeyi veya tekrarı atlamayı seçer.

## Excel/OFX güvenlik kararı

XLSX, yeni dış bağımlılık almayan sınırlandırılmış ZIP/XML okuyucusuyla yalnız ilk
çalışma sayfasından okunur. ZIP merkez dizini, yol, boyut ve CRC32 bütünlüğü
doğrulanır. Formül, makro, dış bağlantı, veri bağlantısı, XML DOCTYPE/ENTITY,
şifreleme ve desteklenmeyen sıkıştırma fail-closed reddedilir. Eski XLS/XLSB kapsam
dışıdır. OFX/QFX yalnız yerel `STMTTRN` hareketlerini ayrıştırır; ağ çağrısı yapmaz.

## ÖHVPS/open-banking gerçeklik sınırı

`FinanceOpenBankingAdapterPort` ve `LocalOhvpsSandboxAdapter`, `ohvps-v1-local`
sözleşmesini iki modla sunar: tamamen yerel/sentetik sandbox ve kontrollü dosya
içe aktarmaya yönlenen manuel fallback. Canlı banka bağlantısı, hesap keşfi, müşteri
kimlik bilgisi, token, sertifika, harici rıza/onay veya uzaktan eşitleme yoktur.
Sandbox hareketleri banka verisi değildir; içe aktarılan hareketler dışarıdan
doğrulanmış sayılmaz ve ödeme icra etmez.

## Politika, kalıcılık ve gizlilik

Migration 82, `finance_import_batches` ve `finance_import_entries` tablolarını ekler.
Batch yalnız `staging` durumunda oluşturulur ve tek kullanımlık exact
`finance.write/create` makbuzuna bağlanır; makbuz hassasiyeti gizlilikle birebir
eşleşir. Aynı makbuzun
diğer finans tablolarında replay edilmesi iki yönlü trigger'larla reddedilir. Hareket
satırları batch, aile, sahip, gizlilik ve kategori yönünü hem application hem SQLite
guard'larında miras alır. Batch yalnız bütün satırlar yazıldıktan sonra staging'den
committed'a geçebilir; hareketler update/delete edilemez. Audit/outbox tutar,
açıklama, harici kimlik ve satır parmak izi taşımaz. Hassas veri envanteri ve kişi
yaşam döngüsü referans sayımı iki yeni tabloyu kapsar.

## Ratchet ve kapsam

İki gereksinim tek `CommitFinanceImportBatchUseCase` composition yüzeyiyle kapanır.
PPK-021 exact allowlist 542'den 543'e, use-case composition 274'ten 275'e çıkar;
doğrudan rol bypass sıfırdır. Dosya boyutu okumadan önce doğrulanır ve descriptor
üzerinden sınırlı okunur; `openSync`, `fstatSync`, `readSync`, `closeSync` yüzeyleri
exact manifestte açıkça incelendiği için PPK-022 238'den 242'ye çıkar. Network egress
değişmeden kalır.
B4-13 ve B4-14 tamamlanır. Canlı open-banking, B5 ve sonraki açık kapsam, B9-01,
Silver readiness ve Bronze Final tamamlanmaz.
