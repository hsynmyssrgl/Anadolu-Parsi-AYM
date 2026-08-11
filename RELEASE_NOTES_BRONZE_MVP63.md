# Panthera pardus tulliana — Bronze MVP-63

**Sürüm:** 24.07.2026.63  
**Kilometre taşı:** B065-M21 Tanılama ve Dışa Aktarım Kayıt Mimarisi

## Tamamlananlar

- `export_artifacts` kayıt, listeleme ve tekil bulma işlemleri application/repository katmanına taşındı.
- `diagnostic_reports` kayıt, listeleme ve tekil bulma işlemleri application/repository katmanına taşındı.
- Dosya sistemi işlemleri, içerik üretimi ve SHA-256 doğrulaması masaüstü servis sınırında tutuldu.
- `verifyExportArtifact`, `verifyDiagnosticReport` ve `readDiagnosticReport` doğrudan SQL kullanmadan çalışacak biçimde güncellendi.
- Yeni use-case'ler, SQLite repository yöntemleri ve adapter bağlantıları eklendi.
- Tanılama raporu ile dışa aktarım akışları için hedefe özel 8 kontrollü doğrulama eklendi.

## Mimari sonuç

DataStore, dışa aktarım ve tanılama raporu meta verilerinin kalıcılaştırılmasında SQLite ayrıntılarını artık doğrudan bilmemektedir. Dosya erişimi ile veri kalıcılığı arasındaki sorumluluk ayrımı güçlendirilmiştir.
