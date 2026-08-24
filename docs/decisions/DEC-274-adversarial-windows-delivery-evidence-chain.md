# DEC-274 — Adversarial Windows paket, kurulum ve final teslim kanıt zinciri

- Tarih: 24.08.2026
- Durum: ACTIVE
- Kural: PR-239
- Görünür sürüm: Bronze 22.08.2026.50

## Karar

Bronze local-test Windows teslimi yalnız aynı temiz exact commit, governed fingerprint ve kanonik kural hash'ini canlı geri okuyan schema-2 package provenance ile başlar. Bronze sequence 50 governed bootstrap'tır: `previousPackageProvenance` null olmalı; previous paket/runtime girdisi ile mevcut `C:\Program Files\PPT\ParsYuva-Bronze` kökü, EXE veya Bronze uninstall kaydı kabul edilmez. Bu sürüm temiz ilk kurulum ve ayrı same-version maintenance kanıtlar; N→N+1 iddiası üretmez.

Bronze sequence 51 ve üzerindeki yükseltmede current package `parentRelease` ile bağlı immutable önceki schema-2 package provenance arşivi ve `C:\Program Files\PPT\ParsYuva-Bronze\ParsYuva-Bronze.exe` yolundaki canlı N runtime, arşivdeki packaged runtime ile SHA-256, boyut ve FileVersion bakımından exact eşleşmelidir. Yükseltme aynı Bronze aylık sıra döneminde sequence tam bir artış ve monotonik tarih taşır. Legacy nested program ve kullanıcı verisi yalnız değişmezlik snapshot sınırıdır; trusted predecessor değildir ve silinmez. UAT110 V3 birbirini dışlayan bootstrap-fresh-install veya continuation-N→N+1 ilk fazı ile ayrı same-version maintenance fazında kullanıcı verisi içerik eşitliğini, sentetik marker cleanup/absence readback'ini, diğer kanal ve legacy program/registry sıfır yazımını ve installed==packaged canlı kimliğini kanıtlar.

Final teslimde installer-experience V2 zorunludur. UAT111 V3 UAT110 parent runId/SHA, exact package/source/producer ve temiz sentetik profil bağı taşır. Dört modül ve yirmi iki rota yalnız tracked TypeScript kaynağından AST ile türetilen exact kanonik otoriteye göre kabul edilir. Görünür uygun kontroller sabit bir tıklama sayısıyla değil, rota/durum/yüzey bazlı dinamik keşif ve doğrulanmış outcome oracle ile kapanır. Native dosya iletişim pencereleri canonical envanterde gerçek CANCEL ve ACCEPT hareketleriyle; bütün kanıt üreticileri UUID tabanlı, exclusive ve reparse içermeyen çalışma kökünde doğrulanır. Guard kaybında path tabanlı temporary veya target temizliği yasaktır. Ana süreç/renderer hatası, erişilebilirlik veya görsel durum eksiği, profil cleanup, screenshot hash/readback ya da secret taraması eksikse PASS verilemez. Final V3 bütün girdileri distinct evidence kökleri, producer SHA, tam kronoloji ve canlı dosya geri-okumasıyla yeniden doğrular.

`NotSigned` ve Kaspersky koruması kapalı yerel test, zararsızlık veya üretim uygunluğu kanıtı değildir. İmzalı ve koruma açık retest yapılmadan üretim engeli sürer. Bu turda `.51` tahsisi, build, install veya final receipt üretimi yapılmaz.
