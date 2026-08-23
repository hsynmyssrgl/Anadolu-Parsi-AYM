# Tüm Kurallar Aşılamaz Yürütme Sözleşmesi

- Sürüm: **Bronze 22.08.2026.50**
- Karar: **DEC-129**
- Kanonik kural sayısı: **234**
- Aktif kural: **211**
- Kural SHA-256: `67462d63e873b68a1eacfb358f904226d9199f99c81950645e05350df9963506`

## Değişmez çalışma ilkesi

Her ACTIVE kural `config/rule-enforcement-registry.json` içinde tam bir enforcement kaydına sahiptir. `failClosed=true`, `waiverAllowed=false`, `skipAllowed=false` zorunludur. Makineyle doğrudan kanıtlanamayan bir kural PASS sayılmaz; kanıt gerektiren aşama BLOCKED kalır.

Her durum değiştiren işlem öncesinde `scripts/verify-operation-rule-check.mjs` açık işlem türü ve açıklamasıyla çalıştırılır. Kural, hash, onay veya enforcement kontrolü PASS değilse kod, dosya, test, build, paketleme, kurulum, silme, yayımlama ya da dış yazma işlemi başlatılamaz.

PR-234 gereği Bronze, Silver ve Gold ayrı Program Files alt klasörü, EXE, kısayol, appId, productName, kullanıcı veri kökü, kaldırma kapsamı, Git worktree ve branch kullanır. Bir kanal diğerinin programına, verisine veya build çıktısına dokunamaz.

## PR-171 adım kilidi

Büyük işler `config/work-segmentation-plan.json` ile küçük adımlara ayrılır. Aynı anda yalnız bir adım `IN_PROGRESS` olabilir. Bir adım `PASS` doğrulaması ve kalıcı Library checkpoint kanıtı olmadan `COMPLETED` olamaz; önceki adım tamamlanmadan sonraki adım başlatılamaz.

## Komut zinciri

Build/test/package/publish komutları governed preflight ve aktif work-step kilidini doğrular. Universal Rule Enforcement Gate hem preflight hem postflight içinde zorunludur.

## Güvence sınırı

Bu sistem, proje sürecinde kuralın sessizce atlanmasını veya kanıtsız PASS verilmesini engeller. Gerçek dünya ve dış sağlayıcı koşullarını makineyle ispatlayamadığı yerde durumu `BLOCKED/NOT_RUN` tutar; bu durum Silver/Gold geçişinde PASS yerine kullanılamaz.
