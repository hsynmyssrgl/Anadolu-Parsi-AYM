# Temiz Yedek Yeniden Yazım Operasyonel İzolasyon V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Aktif bir temiz-yedek yeniden yazım çalışmasının kullanıcı politika değişikliği,
sistem saati geri alması veya tutarsız terminal yazımla kilitli kalmasını
engellemek.

## Bağlayıcı kurallar

1. Politika `running` iken etkinlik, saklama süresi ve geri çekilme ayarları değiştirilemez.
2. Kesinti kurtarma zamanı; gözlenen saat, politika `updated_at`, son deneme, son başarı, politika çalışma başlangıcı, çalışma defteri başlangıcı ve çalışma defteri `updated_at` değerlerinin en ilerisine eşittir.
3. Geri çekilme bu güvenli kurtarma zamanından 360 dakika sonrasıdır.
4. Terminal çalışma durumu, politika durumu ve son sonuç birebir eşleşir.
5. Politika sahipliği terminal çalışma kaydı yazılmadan önce bırakılır; aynı transaction içindeki terminal defter tetikleyicisi eşleşmeyi doğrular.
6. Bozuk, geriye giden veya çelişkili doğrudan SQLite yazımı fail-closed reddedilir.

## Terminal eşleme

| Çalışma durumu | Politika durumu | Politika sonucu |
|---|---|---|
| `success` | `idle` | `success` |
| `partial` | `backoff` | `partial` |
| `failed` | `backoff` | `failed` |
| `interrupted` | `backoff` | `failed` |
| `attention` | `attention` | `attention` |
| `deferred` | `deferred` | `deferred` |

## Kullanıcı görünürlüğü

Aktif çalışma sırasında politika değiştirme girişimi açık hata verir. Saat
düzeltmesiyle yapılan kesinti kurtarması gizlilik güvenli tanı kaydı üretir.
