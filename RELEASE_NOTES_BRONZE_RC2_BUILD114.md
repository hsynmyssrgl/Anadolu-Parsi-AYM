# Bronze RC2 Build 114 Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.114`
- Package Version: `25.7.2026-114`
- Kanal: **Bronze RC2 Active Development**

## Eklenenler

- Aktif teslim belgeleri için makine tarafından doğrulanan sürüm ve build sözleşmesi.
- Kök build durumu ile kullanıcı doğrulama raporu arasında kapı durumu çapraz kontrolü.
- Eski MVP/RC2 dosya referanslarını ve eski sürüm numaralarını reddeden drift kontrolü.
- Sürüm yükseltmesinde aktif belgeleri yeniden oluşturan ve eski doğrulama sonuçlarını `NOT_RUN` durumuna sıfırlayan güvenli güncelleme.
- Linux ve Windows doğrulama iş akışlarında `active-delivery-documents.json` kanıtı.

## Doğruluk kuralı

Tam `npm ci`, root `tsc --noEmit`, production build, smoke, Windows açılış ve installer sonuçları yalnızca gerçekten çalıştırılırsa PASS olarak raporlanır.
