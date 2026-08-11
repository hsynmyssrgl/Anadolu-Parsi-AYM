# ADR-070 — Atomik temiz-yedek terminal geçişi

**Durum:** Kabul edildi — Bronze RC2 Build 197.

## Karar

Politika ile çalışma defterinin terminal sonuçlandırması iki bağımsız güncelleme olarak uygulanmayacaktır. Terminal çalışma defteri güncellemesi, SQLite tetikleyicisi aracılığıyla politikayı aynı cümlede sonuçlandıracaktır. Politikanın aktif çalışma defteri sonuçlanmadan `running` durumundan çıkması reddedilecektir.

## Sonuç

Yarım kalan politika geçişi, yetim `running` çalışma defteri ve sonraki claim’leri kilitleyen kalıcı tutarsızlık engellenir. Terminal iş yükü kimliği sonuçlandırma sırasında değiştirilemez.
