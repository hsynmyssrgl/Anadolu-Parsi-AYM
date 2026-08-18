# DEC-250 — Güncel dokümantasyon yenilemesi ve tarihsel kayıtların korunması

Durum: ACTIVE

17 Ağustos 2026 tarihli açık kullanıcı kararıyla mevcut PDF, DOCX, build kapanış belgesi ve önceki aktif referansların üzerine yazılmaz. Build209–228 master belge çiftleri ile `MASTER_PROJE_DOKUMANTASYONU_BRONZE_04.08.2026.28` çifti tarihsel kanıt olarak korunur.

Canlı kaynak ağacındaki kararlar, kanonik kurallar, paket iş akışları, güvenlik sınırları, UI/görsel kimlik kararları, yerel doğrulama kanıtları ve dış bağımlı açık maddeler yeni bir güncel master dokümantasyon sürümünde birleştirilir. Yeni belge bir build kapanışı veya Silver/Gold terfisi değildir; `Bronze 04.08.2026.29` için güncel çalışma referansıdır.

Belge yenilemesi aşağıdaki doğruluk sınırlarına uyar:

- Tarihsel kapanış dosyaları değişmez ve yeni aktif gerçeği geçersiz kılamaz.
- Yerel test/build PASS sonucu; gerçek cihaz, gerçek sağlayıcı, hukuk/gizlilik, sertifikasyon veya üretim işletim kanıtı yerine kullanılamaz.
- `NOT_RUN`, `PARTIAL`, `BLOCKED` ve `countsAsRequirementPass=false` durumları tamamlandı olarak yazılamaz.
- Word ve PDF çıktıları aynı kaynak veriden üretilir, okunabilirlik ve sayfa düzeni görsel olarak doğrulanır.
- Yeni logo, sürüm renkleri ve erişilebilirlik değerleri `config/ui-visual-reference-manifest.json` ile birebir bağlanır.

Yetkili güncel kaynaklar:

- `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md`
- `docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_17.08.2026_V1.docx`
- `docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_17.08.2026_V1.pdf`

