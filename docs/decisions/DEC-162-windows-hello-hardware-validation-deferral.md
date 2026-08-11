# DEC-162 — Windows Hello donanım doğrulamasının geçici ertelenmesi

## Durum

ACTIVE — açık kullanıcı kararı, 10 Ağustos 2026.

## Karar

Mevcut geliştirme makinesi Windows Hello donanımını desteklemediği için gerçek ve etkileşimli Windows Hello testi geçici olarak ertelenmiştir. Bu donanım testi Bronze kapsamının ilerlemesini ve B2-01 kapanışını engellemez.

## Değişmeyen güvenlik sınırları

- Windows Hello kaynak kodu, kayıt, giriş ve yeniden doğrulama akışları korunur.
- Güçlü yerel parola yedeği korunur; kullanılabilir bir Hello cihazı zorunlu değildir.
- Kontrollü platform, sözleşme ve runtime testleri geçerliliğini korur.
- Gerçek donanım testi `USER_DEFERRED_NOT_RUN_NOT_PASS` olarak raporlanır; hiçbir yerde yerel donanım `PASS` iddiası yapılmaz.
- Bu karar Windows Hello dışındaki güçlü yeniden doğrulama, 2FA, kurtarma, politika veya fail-closed güvenlik kontrollerini gevşetmez.

## Yeniden açılma koşulu

Uyumlu bir Windows Hello cihazı ve etkileşimli kullanıcı oturumu sağlanırsa veya ürün sahibi açıkça isterse yalnız donanım doğrulama kapısı yeniden açılır. Kod değişikliği gerekmeksizin gerçek cihaz kanıtı ayrıca alınır.

## İş sırası

DEC-137 kapsamındaki onay gerektirmeyen işler otomatik öncelik sırasıyla devam eder. Fiziksel cihaz, haricî otorite, kullanıcı etkileşimi veya ek izin gerektiren işler listenin sonunda tutulur; çalıştırılmayan hiçbir kontrol `PASS` sayılmaz.

Bağlı kayıtlar: `config/accepted-scope-registry.json`, `config/bronze-backlog-priority-policy.json`, `config/user-decision-ledger.json`, `scripts/verify-bronze-governance-reality-matrix.mjs`.
