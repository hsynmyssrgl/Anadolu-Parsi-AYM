# Build 148 Mimari Doğrulama Raporu

## Kapsam

- Build 145 güvenli iptal listesi senkronizasyonu
- Build 146 aile verisi içe aktarma ön izleme ve rollback akışı
- Build 147 büyük veri anahtar tabanlı sayfalama akışı
- Electron main/preload/renderer IPC sınırları

## Mimari sonuç

### Kanal bazlı IPC doğrulaması

Genel IPC boyut ve yapı korumalarına ek olarak kritik yeni kanallar için kesin
argüman sayısı, izin verilen nesne alanları, tür, uzunluk ve sayısal sınırlar
uygulanmıştır. Bilinmeyen alanlar reddedilir ve reddetme olayı denetim/tanı
kanalına yazılır. Eski kanalların mevcut sözleşmeleri değiştirilmemiştir.

### Ana süreç sahipliğinde güvenli ağ içeriği

Ham HTTPS iptal listesi IPC yüzeyinden kaldırılmıştır. Renderer serbest URL, pin
veya ağdan alınmış imzalı liste gövdesi gönderemez. Güvenli fetch, sağlayıcı HTTPS
profili ve TLS SPKI pinleriyle ana süreçte yapılır. Bekleyen gövde ana süreçte
tutulur; renderer yalnız sınırlı özet ve `pendingListId` görür. Uygulama sırasında
ana süreç kendi bekleyen gövdesini kullanır ve mevcut Ed25519 imza, sıra numarası,
zaman penceresi ve sağlayıcı güven zinciri doğrulamalarını yeniden işletir.

Bekleyen içerik endpoint kimliği, sağlayıcı kimliği, URL, birincil/geçiş pinleri,
pin geçiş zamanları ve endpoint durumunun SHA-256 parmak izine bağlıdır. Bu
alanlardan biri değişirse içerik uygulanamaz ve yeniden senkronizasyon gerekir.

### Oturum ve imleç kapsamı

Aile içe aktarma ön izlemeleri `familyId` ve `actorId` ile sahiplenilir. Uygulama
öncesi aynı bağlam zorunludur; çıkış işlemi bütün geçici ön izlemeleri temizler.

Büyük veri imleçleri görünüm türü, kullanıcı ve normalize edilmiş filtre kümesinin
SHA-256 kapsamını içerir. İmlecin başka kullanıcı, arama, dal, kişi, yıl, kategori,
etiket veya hassasiyet filtresiyle kullanılması fail-closed biçimde reddedilir.

## Gerçekten çalıştırılan hedefli kontroller

- Entegrasyon sözleşmesi: **PASS — 43/43**
- IPC politika runtime: **PASS — 22/22**
- İptal senkronizasyon runtime: **PASS — 17/17**
- Aile içe aktarma servis runtime: **PASS — 25/25**
- Aile içe aktarma SQLite runtime: **PASS — 11/11**
- Büyük veri servis runtime: **PASS — 16/16**
- Büyük veri SQLite/query-plan runtime: **PASS — 14/14**
- Renderer/preload/global/main/politika sözdizimi: **PASS — 5/5**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Main/preload IPC kanal paritesi: **PASS — 179/179**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace / Build 148**
- Kaynak bütünlüğü: **PASS — 1.230 / 1.230 dosya, 1.231 SHA256SUMS girdisi**

## Kanıtlanmayan alanlar

Gerçek internet endpoint’i, gerçek sertifika zinciri ve pin geçişi, üretim
`better-sqlite3`, temiz bağımlılık kurulumu, tam root TypeScript, bütün testler,
Electron production build, Windows paketli runtime, render edilmiş UAT, smoke ve
installer yaşam döngüsü bu hedefli raporun kanıt kapsamına girmez.
