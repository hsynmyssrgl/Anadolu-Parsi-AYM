# DEC-263 — Kod değişikliğinde eski Windows kurulum artefaktlarının silinmesi

- Tarih: 22.08.2026
- Durum: ACTIVE
- Etkili sürüm: Bronze 22.08.2026.43
- Kaynak: Açık kullanıcı kararı

## Karar

Kaynak kodda veya Windows paketleme davranışında değişiklik yapıldığında `apps/desktop/release` altındaki mevcut ParsYuva kurulum dosyaları artık güncel kaynak teslimi sayılamaz. Yeni derleme başlamadan önce eski installer `EXE`, `.exe.blockmap`, `.exe.sha256`, `win-unpacked` paketi ve electron-builder tarafından üretilen eski yapılandırma/tanı çıktıları silinir.

Paketleme tamamlandığında release klasöründe yalnız güncel görünür sürüme ait en fazla bir kurulum seti kalabilir. Eski sürüm, aynı sürüm numarasıyla daha önce üretilmiş farklı binary veya tanınmayan ParsYuva installer adı fail-closed reddedilir.

Bu temizlik yalnız repo içindeki üretilmiş installer artefaktlarını kapsar. Kullanıcı verisi, Windows'a kurulmuş uygulama, kaynak arşivleri, tarihsel kararlar ve yönetişim kanıtları silinmez.

## Teknik uygulama

- `scripts/clean-stale-windows-installers.mjs` yalnız `apps/desktop/release` kökündeki tanımlı ParsYuva installer setlerini ve bilinen paketleme çıktılarını güvenli biçimde siler; özyinelemeli silme yalnız tam adı `win-unpacked` olan üretilmiş klasöre uygulanır.
- Kök `prebuild` ve bütün Windows paketleme komutları temizliği otomatik çalıştırır.
- Yerel imzasız `NSIS` ve dizin paketleme yolları, sürüm ayrımından sonra eski `dist` içeriğini paketlememek için bütün çalışma alanı paketlerini yeniden derlemeden masaüstü paketini üretemez.
- `scripts/verify-windows-installer-retention-policy.mjs` boş release klasörünü veya yalnız güncel görünür sürüme ait tek seti kabul eder.
- Doğrulama kapısı `GOVERNED_PREFLIGHT` ve `PR-229` enforcement kaydına bağlıdır.

## Doğrulama

- `apps/desktop/tests/windows-installer-retention-policy.test.ts`
- `scripts/verify-windows-installer-retention-policy.mjs`
- `artifacts/validation/windows-installer-retention-policy.json`

Bu karar eski kurulum paketlerini tarihsel kanıt olarak koruma zorunluluğu getirmez; tarihsel sürüm gerçeği sürüm ve karar defterlerinde korunur.
