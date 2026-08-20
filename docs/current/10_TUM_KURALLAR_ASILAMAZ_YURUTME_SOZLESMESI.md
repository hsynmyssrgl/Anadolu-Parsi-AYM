# Tüm Kurallar Aşılamaz Yürütme Sözleşmesi

- Sürüm: **Bronze 20.08.2026.37**
- Karar: **DEC-129**
- Kanonik kural sayısı: **228**
- Aktif kural: **207**
- Kural SHA-256: `c7cd9a0b82e58d3bf9dbc3aca7cf38d452b73b7e5bc361690e84d94821a7b25d`

## Değişmez çalışma ilkesi

Her ACTIVE kural `config/rule-enforcement-registry.json` içinde tam bir enforcement kaydına sahiptir. `failClosed=true`, `waiverAllowed=false`, `skipAllowed=false` zorunludur. Makineyle doğrudan kanıtlanamayan bir kural PASS sayılmaz; kanıt gerektiren aşama BLOCKED kalır.

## PR-171 adım kilidi

Büyük işler `config/work-segmentation-plan.json` ile küçük adımlara ayrılır. Aynı anda yalnız bir adım `IN_PROGRESS` olabilir. Bir adım `PASS` doğrulaması ve kalıcı Library checkpoint kanıtı olmadan `COMPLETED` olamaz; önceki adım tamamlanmadan sonraki adım başlatılamaz.

## Komut zinciri

Build/test/package/publish komutları governed preflight ve aktif work-step kilidini doğrular. Universal Rule Enforcement Gate hem preflight hem postflight içinde zorunludur.

## Güvence sınırı

Bu sistem, proje sürecinde kuralın sessizce atlanmasını veya kanıtsız PASS verilmesini engeller. Gerçek dünya ve dış sağlayıcı koşullarını makineyle ispatlayamadığı yerde durumu `BLOCKED/NOT_RUN` tutar; bu durum Silver/Gold geçişinde PASS yerine kullanılamaz.
