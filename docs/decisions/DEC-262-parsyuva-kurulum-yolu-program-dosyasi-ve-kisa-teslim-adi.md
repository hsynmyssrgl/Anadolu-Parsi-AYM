# DEC-262 — ParsYuva kurulum yolu, program dosyası ve kısa teslim adı

- Tarih: 20.08.2026
- Durum: ACTIVE
- Etkili sürüm: Bronze 20.08.2026.37
- Kaynak: Açık kullanıcı kararı

## Karar

Yeni Windows paketlerinde teknik kurulum hedefi `C:\Program Files\PPT\ParsYuva`, kurulu ana program dosyası `ParsYuva.exe`, masaüstü ve Başlat menüsü kısayolu `ParsYuva` olacaktır.

Dağıtım EXE adı yalnız marka, güvenilir sürüm kanalı ve görünür sürüm numarasını taşıyacaktır:

`ParsYuva-<Bronze|Silver|Gold>-GG.AA.YYYY.NN.exe`

Dosya adına mimari, `Kurulum`, `AYM`, uzun ürün adı veya yerel-test eki eklenmeyecektir. Dosya adı ASCII olacaktır. İmza ve üretim güveni dosya adından değil Authenticode, zaman damgası ve kanıt kaydından doğrulanacaktır.

Uygulama içindeki görünür tam ürün adı `ParsYuva Aile Yaşam Merkezi` olarak kalır. Kararlı Windows `appId` ile eski kullanıcı-veri dizini mevcut kişisel verilerin güvenli migration uyumluluğu için değiştirilmez ve güncel marka sayılmaz.

## Değiştirdiği karar

Bu karar PR-220 dosya-adı bölümünü yürürlükten kaldırır ve PR-228 ile değiştirir. DEC-261’in güncel yüzeylerde AYM kullanmama sınırını korur.

## Doğrulama

- `apps/desktop/scripts/verify-installer.mjs`
- `apps/desktop/tests/installer-narration-experience.test.ts`
- `apps/desktop/tests/monthly-release-version.test.ts`
- `scripts/verify-product-brand-identity.mjs`

Production Authenticode sertifikası ve temiz harici Windows kurulum UAT’si bu kararın dışında, açık dış kanıt olarak kalır.
