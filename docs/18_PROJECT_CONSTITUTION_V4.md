# Proje Anayasası V4 — Aktif Build 212

**Aktif sürüm:** 01.08.2026.213  
**Yürürlük başlangıcı:** Build 209  
**Kural seti:** `PROJECT-RULES-2026-08-01-V4`  
**Kural sayısı:** 170  
**Kural SHA-256:** `6259d2c757caf865aedfe99a7bcea0a1a333551415b0912a856ac571876274f9`  
**Yetkili ana kaynak:** `docs/17_MASTER_BUILD_LEDGER.md`

V3 hükümleri yürürlüktedir; V4 aşağıdaki güvenli ilk-kurulum ve kullanıcı-verisi kasası hükümlerini ekler. Kurallar istisnasızdır; değişiklik yalnız açık kullanıcı kararı + yeni build + yeni kural sürümü/SHA + belge ve kod yayılımıyla yapılabilir.

## İlk kullanım ve kimlik

- Windows ilk çalıştırmada Anadolu Parsı marka kimlikli tanıtım ve kurulum sihirbazı gösterir.
- Türkçe sesli anlatım; altyazı, sessize alma, geçme ve sonradan tekrar oynatma seçenekleriyle erişilebilirdir.
- İlk başarılı kurulum kısa pars marka sesi ve kontrollü geçişle ana uygulamaya açılır; marka sesi kullanıcı tarafından kapatılabilir.
- Yerel güçlü parola temel yöntemdir. Apple, Google ve Microsoft OIDC sağlayıcıları mimari olarak desteklenir.
- Haricî kimlik sağlayıcısı yalnız kimliği doğrular; uygulama içi yetki vermez. Çevrimdışı yerel erişim ve kurtarma yolu korunur.
- Windows Hello, TOTP, kurtarma kodları ve FIDO2/WebAuthn güvenlik katmanları desteklenir; canlı sağlayıcı PASS ancak gerçek kayıt/kimlik bilgileri ve Windows doğrulaması sonrası verilebilir.

## Kullanıcı veri kasası

- Kullanıcı doğrulanmadan aile veritabanı ve hassas kullanıcı veri katmanı açılamaz.
- Kalıcı ana kullanıcı verisi AES-256-GCM şifreli kasada tutulur.
- Veri anahtarı kullanıcı parolasıyla türetilen scrypt anahtarı ve Windows `safeStorage/DPAPI` cihaz koruması birlikte olmadan açılamaz.
- Başarısız girişte şifre çözülmüş oturum bırakılmaz. Logout, oturum süresi dolumu ve uygulama kapanışında veri kasası yeniden mühürlenir ve geçici çalışma alanı silinir.
- Kasa başlığı yalnız kriptografik metadata taşır; kişisel/aile bilgisi içermez.
- Aynı Windows kullanıcısı yetkisindeki malware/yöneticiye karşı mutlak erişim engeli iddia edilemez. Aktif oturum sayfa/in-use şifreleme kapanışı Bronze Final öncesi zorunludur (`OPEN-021`).

## Belge ve yan artifact gizliliği

- Şifre çözülmüş arşiv belgesi haricî uygulamaya `shell.openPath` ile verilemez; yalnız uygulama içi güvenli önizleme kullanılabilir.
- Desteklenmeyen içerik fail-closed davranır.
- Log/cache/diagnostic/export/migration-backup/crash/evidence gibi hassas yan artifactlar Bronze Final öncesi şifreleme veya doğrulanmış sanitizasyon kapanışından geçer (`OPEN-022`).

## Kaynak ve dosya hiyerarşisi

- Kalıcı proje yolu: `/Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi`.
- Build, kaynak ZIP, Anayasa, Ana Build Defteri, Word/PDF, görsel manifesto ve teslim kanıtları bu hiyerarşi altında tutulur.
- Üst marka altındaki belirsiz/eski/başka proje dosyaları bu uygulamaya otomatik bağlanamaz.

## Değişmez sınırlar

- Proje kaynağı 20.07.2026 ve sonrasıdır.
- Production demo/kişisel seed verisi sıfırdır.
- Kullanıcı yüzeyi `Anadolu Parsı Aile Yaşam Merkezi` adını taşır; üst Latin marka normal UI’da gösterilmez.
- Silver görsel baseline doğrulanmadan; Bronze Final dead UI/dead production code, OPEN-021 ve OPEN-022 kapanmadan ilan edilemez.
