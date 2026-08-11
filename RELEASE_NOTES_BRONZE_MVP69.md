# Panthera pardus tulliana — Bronze MVP-69

## Otomasyon yürütme işlem sınırı

- Etkin otomasyon kurallarının okunması repository katmanına taşındı.
- Önemli gün, yaşam kaydı, finans kaydı ve ilaç planı için vade penceresi sorguları repository katmanına taşındı.
- Aynı kural ve kaynak için tekrar çalışma üretimini engelleyen kontrol repository üzerinden çalışıyor.
- Otomatik yaşam görevi ve otomasyon çalışma kaydı tek transaction içinde oluşturuluyor.
- `automation.executed` zincirli denetim kaydı aynı transaction içine alındı.
- Otomasyon zamanı application use-case katmanında doğrulanıyor.
- DataStore içindeki otomasyon yürütme SQL sorguları kaldırıldı.

## Doğrulama

- MVP-69 mimari sınır testi: 10/10
- MVP-68 otomasyon regresyon testi: 10/10
- Gerçek SQLite atomik yürütme ve tekrar önleme senaryosu: başarılı
- Tam TypeScript/Electron derlemesi: kaynak pakette Node tür bağımlılıkları bulunmadığı için çalıştırılamadı.
