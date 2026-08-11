# ADR-039 — Fail-Closed Adaptif IPC Kaynak Bütçeleri

## Durum
Kabul edildi — Build 164.

## Bağlam
Build 161 sabit geri basınç sınırlarını, Build 162 güvenli okuma cache'ini ve Build 163 gizlilik güvenli performans telemetrisini sağladı. Sabit sınırlar güvenli olsa da farklı bilgisayar ve yük profillerinde gereksiz kuyruk baskısı veya bellek tüketimi oluşabilir.

## Karar
IPC telemetrisi yalnız toplu teknik ölçümlerle, üç durumlu bir bütçe denetleyicisine bağlanır: `baseline`, `guarded`, `restricted`.

- Basınçta bütçeler hemen daralır.
- Hiçbir adaptif değer Build 161/162 taban sınırını aşamaz.
- Geçersiz veya yetersiz ölçüm büyümeye izin vermez.
- İyileşme iki aşamalı ve zaman kilitlidir.
- Mod değişiminde kısa ömürlü okuma cache'i temizlenir.
- Kullanıcı, oturum, istek ve ham argümanlar bütçe kararına veya loga girmez.

## Sonuçlar
Sistem ani istek fırtınalarında daha ihtiyatlı davranır; sağlıklı dönemde kontrollü biçimde taban kapasiteye döner. Bütçe artışı tabanın üzerinde değildir ve Final/Silver kapılarını değiştirmez.
