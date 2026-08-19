# Tüm Kurallar Aşılamaz Yürütme Sözleşmesi

- Sürüm: **Bronze 19.08.2026.33**
- Karar: **DEC-129**
- Kanonik kural sayısı: **217**
- Aktif kural: **197**
- Kural SHA-256: `b79db92a03d559f33ccd49348bad159a70b6034fbcf10a07abe5a407549bf0be`

## Değişmez çalışma ilkesi

Her ACTIVE kural `config/rule-enforcement-registry.json` içinde tam bir enforcement kaydına sahiptir. `failClosed=true`, `waiverAllowed=false`, `skipAllowed=false` zorunludur. Makineyle doğrudan kanıtlanamayan bir kural PASS sayılmaz; kanıt gerektiren aşama BLOCKED kalır.

## PR-171 adım kilidi

Büyük işler `config/work-segmentation-plan.json` ile küçük adımlara ayrılır. Aynı anda yalnız bir adım `IN_PROGRESS` olabilir. Bir adım `PASS` doğrulaması ve kalıcı Library checkpoint kanıtı olmadan `COMPLETED` olamaz; önceki adım tamamlanmadan sonraki adım başlatılamaz.

## Komut zinciri

Build/test/package/publish komutları governed preflight ve aktif work-step kilidini doğrular. Universal Rule Enforcement Gate hem preflight hem postflight içinde zorunludur.

## Güvence sınırı

Bu sistem, proje sürecinde kuralın sessizce atlanmasını veya kanıtsız PASS verilmesini engeller. Gerçek dünya ve dış sağlayıcı koşullarını makineyle ispatlayamadığı yerde durumu `BLOCKED/NOT_RUN` tutar; bu durum Silver/Gold geçişinde PASS yerine kullanılamaz.
