# DEC-256 — Tek gerçek kurulum ilerlemesi ve yerel yüzde görünümü

- Tarih: 19.08.2026
- Kabul zamanı: 2026-08-19T00:32:03+03:00
- Durum: ACTIVE
- Etkin sürüm: Bronze 19.08.2026.33

## Karar

Kurulum öncesindeki karşılama ve kuruluma hazır sayfaları gerçek dosya işi yapmadıkları için hareketli ilerleme göstergesi kullanmaz. Kurulum sırasında yalnız NSIS'in yerel dosya kurulum sayfasındaki tek ilerleme çubuğu hareket eder. Kullanıcıya gösterilen yüzde aynı yerel ilerleme kontrolünün değerinden okunur; zamanlayıcıyla üretilen dekoratif veya simüle edilmiş ilerleme kullanılamaz.

## Uygulama

- Karşılama ve hazır sayfaları statiktir.
- Yerel NSIS ilerleme denetimi `PBM_GETPOS` ile okunur.
- Görünür yüzde 0 ile 100 arasında sınırlandırılır.
- Kurulum tamamlanınca metin açıkça yüzde 100 olarak sabitlenir.
- Test ve kurulum doğrulayıcısı ikinci bir özel ilerleme çubuğunu, karşılama/hazır animasyonunu ve simüle zamanlayıcıyı fail-closed reddeder.

## Açık kanıt

Yerel paketleme ve kaynak/test kanıtı bu kararın teknik kapsamındadır. Üretim kurulum EXE'sinin yayımlanması için Authenticode kod imza sertifikası, güvenilir zaman damgası ve PPK-025 release kanıtı haricî olarak sağlanmalıdır; bunlar yokken üretim kurulum teslimi tamamlandı sayılamaz.
