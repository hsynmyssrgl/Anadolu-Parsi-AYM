# DEC-268 — Windows installer timer callback ve tam ön yüz kullanıcı UAT teslimi

- Tarih: 22.08.2026
- Durum: ACTIVE
- Görünür sürüm: Bronze 22.08.2026.49
- Bağlayıcı kural: PR-233
- Korunan önceki karar: DEC-267

## Kullanıcı kararı

Kullanıcı yeni kurulum dosyasının oluşturulmasını, ardından uygulamanın ön yüzünden sentetik kullanıcı/aile oluşturulmasını ve tüm uygulamanın sınanmasını açıkça yetkilendirdi. Gerçek kullanıcı verisi kullanılmaz.

## İlk başarısız paketleme

Bronze 22.08.2026.46 NSIS denemesi, `AymWelcomeTransition` fonksiyon adresi derleyici tarafından bağlanmadığı için warning 6010 ile FAIL oldu. Kısmi EXE, geçici uninstaller, builder debug kaydı ve `win-unpacked` kalıntıları temizlendi. Bronze 22.08.2026.47 paketlemesi teknik olarak tamamlandı; ancak `.46`dan kalan dahili `@pptdesktop-*.nsis.7z` payload arşivinin retention kapsamı dışında kaldığı görüldüğünden teslim kabul edilmedi ve `.47` paketi de silindi. Bronze 22.08.2026.48 kurulu ön yüz UAT'sinde kullanıcı ve 2FA başarıyla oluşturulduktan sonra güvenilir cihaz kaydı iptal kaldığı için Gösterge Paneli `AUTHORITY_RESOLUTION_FAILED` verdi; `.48` paketi de teslim edilmedi. Bu denemeler PASS sayılmaz.

## Düzeltme

Karşılama geçiş zamanlayıcısı compiler-bound `${NSD_CreateTimer}` ve `${NSD_KillTimer}` makrolarını kullanır. Bilgi kartı geçişi kurulum ilerlemesi değildir; gerçek dosya ilerlemesi yalnız yerel NSIS sayfasında gösterilir. Temizlik kuralı kullanıcıya dönük EXE/blockmap/SHA setinin yanında dahili sürümlü `@pptdesktop-*.nsis.7z` payload kalıntılarını da siler ve testle bağlar. İlk 2FA tamamlandığında ana uygulama açılmadan önce kullanıcı yerel parolasını ve güncel TOTP/kurtarma kodunu girer; mevcut bilgisayar güçlü doğrulamayla güvenilir cihaz yapılır ve yalnız `trustedDevice=true` durumu doğrulandıktan sonra politika korumalı ekranlar yüklenir.

## Kabul zinciri

1. Güncel kural/hash/onay/enforcement bağı ve governed preflight PASS olmalıdır.
2. Eski installer seti sıfır olmalı ve tüm workspace paketleri temiz kaynaktan derlenmelidir.
3. NSIS paketleme, paketli gerçek runtime sürümü ve canlı açılış doğrulanmalıdır.
4. Kurulu uygulama temiz sentetik profille açılmalı; aile adı, yönetici adı ve yerel parola ön yüzden oluşturulmalı; güvenlik başlangıcı kilitli kasa hatası vermemelidir.
5. Tam otomatik regresyon yalnız gerçek test sonuçlarıyla raporlanmalıdır.
6. Installer SHA-256 ve Authenticode durumu kaydedilmelidir. İmzasız yerel test paketi üretim imzalı teslim sayılamaz.
7. Kesin kaynak commit'i GitHub ve haricî Git yedeğine gönderilmeli; haricî kaynak arşivi geri-okumayla doğrulanmalıdır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
