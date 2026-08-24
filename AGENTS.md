# Zorunlu işlem öncesi kural kontrolü

Bu depoda durum değiştiren hiçbir işlem kural kontrolü yapılmadan başlatılamaz.

1. İşlemden önce `node scripts/verify-operation-rule-check.mjs --kind <tur> --operation "<kisa-aciklama>"` çalıştırılır.
2. İzinli türler: `mutation`, `test`, `build`, `installation`, `deletion`, `publish`, `read-only`.
3. Kontrol PASS değilse kod, dosya, belge, test, build, paketleme, kurulum, silme, yayımlama veya dış yazma yapılmaz.
4. Salt okunur inceleme yalnız uygulanacak kuralları ve hedefleri belirlemek içindir.
5. Kural, karar veya kural hash'i değişirse sonraki mutasyondan önce kontrol yeniden çalıştırılır.
6. Waiver, sessiz atlama ve eski makbuz kullanımı yasaktır.

Bağlayıcı kaynaklar: `DEC-265`, `PR-231` ve `C:\PPT\AYM\AGENTS.md`.

## PR-235 / PR-240 mutasyon kapanış zinciri

1. En küçük kaynak, yapılandırma, test, üretici veya belge değişikliği `DEC-270 / PR-235` ve `DEC-275 / PR-240` etki zincirine girer.
2. Exact changed-file kümesi, kanonik bağımlılık sicilinden türetilen bütün bağlı kayıtlar ve exact etkilenen test/komut matrisiyle aynı değişiklikte eşleştirilir.
3. Bağlı ana kaynak, Bronze/Silver/Gold kanal kaynakları, kural ve karar sicilleri, aktif/ticari belgeler, iş listesi, kapsam/envanter/ratchet, manifest/indeks, master DOCX/PDF, test ve UAT kayıtları `UPDATED` veya kanıtlı `NOT_AFFECTED` olarak sınıflanmadan sonraki bağımsız işe geçilmez.
4. Hedefli Vitest kümesi, etkilenmiş salt-okunur Node/PowerShell kontrolleri, TypeScript, filtresiz tam Vitest regresyonu ve kaynak bütünlüğü aynı exact committe PASS olmadan kalıcı completion, paketleme, push veya teslim yapılamaz.
5. UI doğrulaması bütün menüleri, alt menüleri, görünür-etkin kontrolleri, durumları, Türkçe metni, erişilebilirliği, görsel/ölçek bütünlüğünü ve veri koruma sınırlarını kapsar; yalnız düğmeye basılmış olması test sayılmaz.
6. Kaynak veya Windows paketleme davranışı değiştiğinde `PR-229` eski installer temizliği, yeni buildden önce yeniden uygulanır.
7. Her gerçek test başarısızlığı boş `wip(rejected)` checkpoint commit'iyle kaydedilir; başarısızlık sessizce düzeltilmiş sayılmaz.
8. Bütün sorunlar ve bağımlı kayıtlar kapanmadan ara installer üretilemez. Paket yalnız temiz exact committen ve `06_KOD/app` ile ilgili kanal worktree commit eşitliği doğrulandıktan sonra üretilebilir.
