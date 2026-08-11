# ADR-022 — Yönetilen yedeklerde doğrulanmış imha yayılımı ve karantina

- Durum: Kabul edildi
- Tarih: 28.07.2026
- Build: 137
- Karar: DEC-051

## Bağlam

Build 136 kalıcı imha sonrasında içeriksiz tombstone ve
`backupPropagationPending=true` işareti bırakır. Canlı SQLite kaydının imhası,
daha önce oluşturulmuş tam yedeklerdeki kopyaları tek başına ortadan kaldırmaz.
Eski yedekleri yeni bir temiz yedek doğrulanmadan silmek felaket kurtarma
kabiliyetini; yönetilmeyen kullanıcı kopyalarını otomatik taşımak veya silmek ise
mülkiyet ve veri kaybı sınırını ihlal eder.

## Karar

1. Kalıcı imha sonrasında kritik öncelikli `backup.propagation` kuyruk görevi
   oluşturulur.
2. Yayılım yalnız etkin aile yöneticisi bağlamında çalışır.
3. Her etkin yönetilen hedefte önce güncel veritabanından yeni parola korumalı tam
   yedek oluşturulur; dosya okuma sonrası SHA-256 doğrulaması ve başarılı yedek
   çalışma kaydı bulunmadan eski yönetilen yedeklere dokunulmaz.
4. Olağan retention temizliği bu özel çalışma sırasında devre dışıdır.
5. Yalnız başarılı `backup_runs` kayıtlarına bağlı eski dosya yolları karantina
   portuna verilir. Hedefteki diğer `.pptbackup` dosyaları otomatik taşınmaz veya
   silinmez.
6. Eski yönetilen dosyalar aynı hedef içindeki
   `.purge-quarantine/<işlem-kimliği>/` dizinine atomik yeniden adlandırmayla
   taşınır. Hata durumunda taşınmış dosyalar eski yerlerine geri alınır.
7. Karantina manifesti dosya adı, boyut, SHA-256 özeti ve açık kayıt kimliği
   içermeyen tombstone parmak izlerini taşır. Dizin `0700`, dosyalar mümkün olan
   sistemlerde `0600` izinleriyle korunur.
8. Taze yedek, hedef dizini ve karantinaya alınacak yollar için hedef sınırı
   doğrulanır; taze yedek karantinaya alınamaz.
9. Kök hedefte yönetilmeyen aktif `.pptbackup` kalırsa hedef başarılı sayılmaz;
   kullanıcı kopyasına dokunulmaz ve tombstone bekleme işareti korunur.
10. Bütün etkin hedefler başarıyla yenilenmeden `backupPropagationPending`
    kapatılmaz. Kapanış beklenen `updatedAt` değeriyle karşılaştırmalı güncelleme
    kullanır; eşzamanlı değişiklik conflict üretir.
11. Her çalışma hedef bazlı temiz yedek yolu/hash'i, karantina dizini/manifesti,
    taşınan dosya ve yönetilmeyen dosya sayılarını kalıcı geçmişte tutar.

## Sonuçlar

Aktif yönetilen yedek seti imha edilmiş veriden arındırılırken yeni doğrulanmış
kurtarma kopyası korunur ve eski yönetilen kopyalar yanlışlık durumunda geri
alınabilir karantinaya alınır. Karantina fiziksel imha değildir. Karantina saklama
ve nihai imha süresi, manuel kopyalar, çevrimdışı medya, snapshotlar ve bulut
sürüm geçmişi ayrı hukuk/gizlilik ve promotion kapısı olarak kalır.
