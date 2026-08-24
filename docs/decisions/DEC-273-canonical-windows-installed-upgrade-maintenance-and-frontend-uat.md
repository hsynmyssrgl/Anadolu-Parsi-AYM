# DEC-273 — Kanonik Windows kurulu yükseltme, maintenance ve ön yüz UAT zinciri

- Tarih: 24.08.2026
- Durum: ACTIVE
- Kural: PR-238
- Görünür sürüm: Bronze 22.08.2026.50

## Karar

Windows installer teslimi yalnız `scripts/run-windows-installed-release-uat.ps1` kanonik üreticisinin aynı çalışmada oluşturduğu `windows-installed-release-uat110.json` ve buna SHA/source/package bağıyla bağlı schema-2 `installed-frontend-user-uat111.json` makbuzlarıyla kabul edilir.

Üretici installer, packaged EXE, installed EXE, package provenance, governed preflight, yeni evidence root ve expected release ID girdilerini açıkça ister. Evidence root validation alanında yeni, containment doğrulanmış ve reparse içermeyen bir kök olmalıdır. İlk faz gerçek N→N+1 yükseltme, ikinci faz aynı sürüm maintenance olarak ayrı sınıflandırılır. Her iki fazda veri seçim diyaloğu görünmez; kurulu EXE packaged EXE ile SHA-256, boyut ve sürüm bakımından exact eşleşir; sibling Bronze program kökü ve uninstall registry kaydı exact doğrulanır.

Mevcut kullanıcı verisi içeriği okunmaz ve dosya adları makbuza yazılmaz. Bronze, Silver, Gold ve legacy program/userData sınırları metadata hash manifestleriyle karşılaştırılır; yalnız üreticinin sentetik Bronze markerı yazılır. Marker ile bütün kanal ve legacy userData manifestleri korunur, Silver/Gold/legacy program ve registry alanlarına sıfır yazım kanıtlanır. Gerçek kullanıcı dosyası silinmez, taşınmaz veya otomatik migrate edilmez.

Kurulu ön yüz UAT runnerı `--installation-preservation` ile UAT110 makbuzunu alır ve schema-2 makbuzunda onun SHA-256 değerini, package provenance SHA-256 değerini, expected release ID ve source commit bağını taşır. Final local-test teslimi eski bağımsız installer/maintenance kanıtlarını kabul etmez; yalnız bu iki kanonik makbuzu aynı package provenance ve source commit üzerinde kabul eder. `NotSigned` yalnız yerel test sınıfıdır; imzalı üretim veya zararsızlık iddiası değildir.

## Bu tur sınırı

Bu karar turunda gerçek `.51` tahsisi, build, installer çalıştırma, uygulama başlatma, kurulum veya commit yapılmaz. Yalnız üretici, sözleşme testleri ve yönetişim bağları hazırlanır.
