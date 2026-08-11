# Bronze RC2 Build 193 Sürüm Notları

## Yeni

- `DEC-083` ve `ADR-066`: çalışan temiz-yedek defteri sahip kimliği bütünlüğü.
- Repository claim, çalışma satırı yazımını ve policy–ledger sahiplik join'ini transaction içinde doğrular.
- Migrasyon 37; yetim, farklı kimlikli, farklı tetikleyicili veya farklı başlangıç zamanlı `running` satırları reddeder.

## Güvenlik ve bütünlük

- Aktif çalışan defterin kimliği/tetikleyicisi değiştirilemez ve satır silinemez.
- Tek `running` indeksi yetim satırla kilitlenemez.
- Geçerli claim, terminal tamamlama ve kesinti kurtarma davranışları korunur.

## Doğrulama sınırı

Bronze kaynak kanıtları çalıştırılır. Temiz kurulum, tam test, production build, smoke ve gerçek Windows/installer kapıları Silver için NOT_RUN kalır.
