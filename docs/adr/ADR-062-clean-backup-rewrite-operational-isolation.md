# ADR-062 — Temiz Yedek Yeniden Yazım Operasyonel İzolasyonu

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Build: 189
- Karar: DEC-079
- Politika: `PPT-LIFECYCLE-STRICT-V1`

## Bağlam

Build 188 yeni çalışma sahiplenmesini kalıcı kronolojiye bağladı. Ancak çalışma
sürerken politika ayarı değiştirilebiliyor ve çalışma defteri `updated_at`
değeri kurtarma tabanına katılmıyordu. Bu durum ileri zamanlı yazım sonrasında
tamamlamanın reddedilmesine ve politikanın `running` kalmasına yol açabiliyordu.

## Karar

Aktif çalışma boyunca politika ayarları uygulama, repository ve SQLite
katmanlarında kilitlenir. Kesinti kurtarma tabanı kalıcı politika ve çalışma
defterinin en ileri zamanıdır. Terminal politika/çalışma eşlemesi SQLite
insert/update tetikleyicileriyle doğrulanır.

## Sonuçlar

- Yönetici ayar değişikliği çalışma tamamlanana kadar reddedilir.
- Saat geri alma veya ileri defter güncellemesi kurtarmayı kilitlemez.
- Çelişkili terminal yazımlar transaction'ı geri alır.
- Silver yalnız gerçek platform ve installer testlerini yürütür.
