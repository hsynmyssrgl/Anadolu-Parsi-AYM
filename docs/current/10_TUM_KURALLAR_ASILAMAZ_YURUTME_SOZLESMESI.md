# Tüm Kurallar Aşılamaz Yürütme Sözleşmesi

- Sürüm: **Bronze 22.08.2026.45**
- Karar: **DEC-129**
- Kanonik kural sayısı: **232**
- Aktif kural: **211**
- Kural SHA-256: `a11d80649bc74759371fe68f7f5b8c0ab12c1cd6a9e77e09c7e96a9a3a7e068b`

## Değişmez çalışma ilkesi

Her ACTIVE kural `config/rule-enforcement-registry.json` içinde tam bir enforcement kaydına sahiptir. `failClosed=true`, `waiverAllowed=false`, `skipAllowed=false` zorunludur. Makineyle doğrudan kanıtlanamayan bir kural PASS sayılmaz; kanıt gerektiren aşama BLOCKED kalır.

Her durum değiştiren işlem öncesinde `scripts/verify-operation-rule-check.mjs` açık işlem türü ve açıklamasıyla çalıştırılır. Kural, hash, onay veya enforcement kontrolü PASS değilse kod, dosya, test, build, paketleme, kurulum, silme, yayımlama ya da dış yazma işlemi başlatılamaz.

## PR-171 adım kilidi

Büyük işler `config/work-segmentation-plan.json` ile küçük adımlara ayrılır. Aynı anda yalnız bir adım `IN_PROGRESS` olabilir. Bir adım `PASS` doğrulaması ve kalıcı Library checkpoint kanıtı olmadan `COMPLETED` olamaz; önceki adım tamamlanmadan sonraki adım başlatılamaz.

## Komut zinciri

Build/test/package/publish komutları governed preflight ve aktif work-step kilidini doğrular. Universal Rule Enforcement Gate hem preflight hem postflight içinde zorunludur.

## Güvence sınırı

Bu sistem, proje sürecinde kuralın sessizce atlanmasını veya kanıtsız PASS verilmesini engeller. Gerçek dünya ve dış sağlayıcı koşullarını makineyle ispatlayamadığı yerde durumu `BLOCKED/NOT_RUN` tutar; bu durum Silver/Gold geçişinde PASS yerine kullanılamaz.
