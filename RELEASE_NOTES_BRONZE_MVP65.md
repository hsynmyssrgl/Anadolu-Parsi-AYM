# Panthera pardus tulliana — Bronze MVP-66

**Sürüm:** 24.07.2026.66  
**Kanal:** Bronze

## Kapsam

- Tanılama arşivi kayıt, listeleme ve tekil bulma işlemleri application/repository sınırına taşındı.
- Arşivlenen tanılama kayıtlarını kesim tarihine kadar temizleme repository katmanına taşındı.
- `archiveDiagnostics`, `listDiagnosticArchives`, `readDiagnosticArchive` ve `verifyDiagnosticArchive` doğrudan `diagnostic_archives` SQL sorgusu kullanmıyor.
- Dosya sıkıştırma, disk yazma, açma ve SHA-256 doğrulama masaüstü servis katmanında bırakıldı.

## Doğrulama

- MVP-66 tanılama arşivi mimari sınır testi: **10/10 başarılı**.
- DataStore içindeki doğrudan tanılama arşivi INSERT/SELECT/DELETE sorguları kaldırıldı.
- Tam TypeScript/Electron derlemesi, kaynak pakette `node_modules` ve `@types/node` bulunmadığı için çalıştırılamadı.
