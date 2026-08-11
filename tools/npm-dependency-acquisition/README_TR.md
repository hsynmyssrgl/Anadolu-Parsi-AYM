# Npm Bağımlılık Edinme Kiti

Bu kit, Anadolu Parsı Aile Yaşam Merkezi kaynak ağacının `package-lock.json`
dosyasında sabitlenen resmî npm tarballarını internet bağlantılı bir makinede
indirir ve mevcut doğrulanmış cache aktarım formatında tek ZIP üretir.

## Güvenlik kuralları

- Yalnız `https://registry.npmjs.org/` kabul edilir.
- Plan aktif `package-lock.json` SHA-256 değeri ve paket sürümüne bağlıdır.
- Her tarball, kilit dosyasındaki SHA-512 değeriyle doğrulanır.
- Başka origin'e yönlendirme reddedilir.
- Yarım dosya atomik adlandırma tamamlanmadan geçerli sayılmaz.
- Önceden indirilmiş dosya ancak SHA-512 tekrar doğrulamasından sonra kullanılır.
- Çıktı deterministik ZIP'tir ve normal cache aktarım doğrulayıcısıyla yeniden doğrulanır.

## Windows

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/fetch-npm-dependencies-connected-machine.ps1
```

## Linux / macOS

```bash
bash scripts/fetch-npm-dependencies-connected-machine.sh
```

Üretilen `artifacts/validation/npm-cache-transfer-bundle.zip` dosyası çevrimdışı
çalışma ortamına taşınır ve şu komutla kullanılır:

```bash
node scripts/run-clean-npm-ci.mjs --cache-bundle artifacts/validation/npm-cache-transfer-bundle.zip
```

Kilit dosyası veya paket sürümü değişmişse paket fail-closed reddedilir.
