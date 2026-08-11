# IPC Adaptif Kaynak Bütçeleri V1

Build 164, Build 163 telemetrisini fail-closed IPC admission ve cache bütçelerine bağlar.

## Modlar

- `baseline`: Build 161 ve Build 162 taban sınırları.
- `guarded`: uyarı düzeyi baskıda azaltılmış eşzamanlılık, kuyruk ve cache.
- `restricted`: kritik baskıda en dar güvenli sınırlar.

## Güvenlik kuralları

1. En az 32 örnek olmadan büyüme kararı verilmez.
2. Geçersiz telemetri mevcut modu korur.
3. Kritik baskı anında daraltılır.
4. Restricted → guarded dönüşü en az 60 saniye sağlıklı ölçüm gerektirir.
5. Guarded → baseline dönüşü en az 120 saniye sağlıklı ölçüm gerektirir.
6. Adaptif değerler taban bütçeleri aşamaz.
7. Mod değişiminde kısa ömürlü cache temizlenir.
8. Kararlar kullanıcı verisi, kimlik, argüman veya payload içermez.
