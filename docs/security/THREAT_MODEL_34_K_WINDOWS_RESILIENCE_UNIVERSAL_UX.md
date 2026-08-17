# 34-K Tehdit Modeli

- Çağıranın `authorized=true` işareti yetki kanıtı sayılmaz; aday listesi yalnız production doğrulanmış arama authority sağlayıcısından kabul edilir. Prototype, accessor, symbol, sparse-array, fazla anahtar ve sıfır SHA-256 kanıtı okunmadan reddedilir. Sağlayıcı yoksa veri araması fail-closed kapanır.
- Renderer sabit komut listesi yalnız yerel gezinme önizlemesidir ve evrensel veri araması, indeks kapsamı veya veri erişim yetkisi iddiası üretmez.
- Politika zayıflatma aynı sürüm, eksik açık karar, risk analizi, geri alma planı veya önerilen politika paketi özetiyle reddedilir. Provider kimliği/production durumu uyuşmazsa kayıt yapılmaz; kabul otomatik aktivasyon sağlamaz.
- Windows yaşam döngüsü ve soak kanıtı çağıran boolean'larından alınmaz. Production sağlayıcı kimliği, sıfır olmayan kanıt SHA-256'sı, kanonik gözlem zamanı, bounded sayılar ve gerçek Windows lifecycle alanları exact doğrulanır; gelecekte veya 24 saatten eski kanıt reddedilir.
- UX tercihleri accessor içermeyen exact data-object/array biçimi, exact JSON anahtarları, mod/saat/array sınırları, optimistic revision, sahibi bağlı result hash ve durable PEP receipt ile korunur.
- Operasyon ekleme aktif hesap/kişi/aile, personal sensitivity, writable fence, journal projection, receipt nonce/version/correlation ve exact resource/action/capability/purpose bağı olmadan veritabanında reddedilir.
- Operasyon, politika önerisi ve Windows kanıt ledger'ları immutable'dır; preference silme doğrudan yapılamaz.
- QR, kamera, ses, Windows mini paneli ve Apple widget sağlayıcıları yokken ilgili yetenekler yalnız model olarak kalır ve çalıştırılmış sayılmaz.

Residual risk: production universal-search authority, politika verifier ve Windows lifecycle evidence provider bileşime bağlı değildir. Gerçek clean install/upgrade/repair/uninstall, 10k/100k/10k veriyle 168 saat soak, accessibility UAT, mini panel ve Apple widget yoktur. Append-only operasyon ve immutable kanıt tablolarının hukuki/mahremiyet retention ve kontrollü destruction sözleşmesi kararlaştırılmamıştır. Yerel teknik temel bu dış kanıtların veya requirement kapanışının yerine geçmez; `countsAsRequirementPass=false` kalır.
