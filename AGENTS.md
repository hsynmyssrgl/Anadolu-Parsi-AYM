# Zorunlu işlem öncesi kural kontrolü

Bu depoda durum değiştiren hiçbir işlem kural kontrolü yapılmadan başlatılamaz.

1. İşlemden önce `node scripts/verify-operation-rule-check.mjs --kind <tur> --operation "<kisa-aciklama>"` çalıştırılır.
2. İzinli türler: `mutation`, `test`, `build`, `installation`, `deletion`, `publish`, `read-only`.
3. Kontrol PASS değilse kod, dosya, belge, test, build, paketleme, kurulum, silme, yayımlama veya dış yazma yapılmaz.
4. Salt okunur inceleme yalnız uygulanacak kuralları ve hedefleri belirlemek içindir.
5. Kural, karar veya kural hash'i değişirse sonraki mutasyondan önce kontrol yeniden çalıştırılır.
6. Waiver, sessiz atlama ve eski makbuz kullanımı yasaktır.

Bağlayıcı kaynaklar: `DEC-265`, `PR-231` ve `C:\PPT\AYM\AGENTS.md`.
