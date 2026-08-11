# Proje Anayasası V5 — Aktif Build 214

**Aktif sürüm:** 02.08.2026.224
**Yürürlük başlangıcı:** Build 214  
**Kural seti:** `PROJECT-RULES-2026-08-01-V5`  
**Kural sayısı:** 171  
**Kural SHA-256:** `2e342a2e0a982bb19c2e45fb25b67336f70eb71969ce1e0f4e298f3fe6cfe9d1`  
**Yetkili ana kaynak:** `docs/17_MASTER_BUILD_LEDGER.md`

V4 hükümleri aynen yürürlüktedir. V5, Build214 sırasında kabul edilen PR-171 çalışma yöntemini ekler. Kaynak-kurtarma sırasında handoff belgesinde bildirilen `8798cd8a8f3bdb23234aa4c7533a414fd2beab94eae9e43d990073ade5c843d2` değeri, doğrulanmış Build213 V4 + handoff PR-171 metni + repository kanonik hash algoritmasıyla yeniden üretilememiştir. Bu fark `artifacts/validation/build214-v5-rule-hash-recovery.json` içinde fail-open yapılmadan kayıt altındadır.

## PR-171 — Adımlı çalışma ve kalıcı doğrulama

Uzun veya zaman aşımı riski taşıyan geliştirme, doğrulama, belge üretimi, paketleme ve teslim işleri mümkün olan en küçük mantıksal ve bağımsız adımlara bölünmelidir. Her adım: 1. uygulanır, 2. doğrulanır, 3. sonucu kalıcı olarak kaydedilir, 4. kısa durum verilir, 5. ancak bundan sonra sonraki adıma geçilir. Tek seferde dev işlem zincirleri çalıştırma. Yalnız teknik olarak atomik olması zorunlu işlemler istisnadır. Bu kural anayasal ve aşılamazdır.

## V4'ten devralınan bağlayıcı sınırlar

- Proje kaynağı yalnız 20.07.2026 ve sonrasıdır.
- Production demo/kişisel seed verisi sıfırdır.
- Kullanıcı doğrulanmadan hassas kullanıcı veri kasası açılamaz.
- Kalıcı ana kullanıcı verisi AES-256-GCM kasadadır; aktif SQLite süreç belleğindedir.
- Log, cache, diagnostic, export, crash/evidence ve diğer hassas yan artifactlar plaintext kişisel/hassas içerik bırakamaz.
- Windows `safeStorage/DPAPI`, EFS ve paketli Electron davranışları gerçek Windows ortamında çalıştırılmadıkça PASS sayılamaz.
- Bronze Final, Silver veya Gold zorunlu kapılar geçmeden ilan edilemez.
