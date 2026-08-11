# Çevrimdışı bağımlılık paketini kabul etme

Bağlantılı bilgisayarda oluşturulan iki dosyayı proje köküne taşıyın:

- `npm-cache-transfer-bundle.zip`
- `npm-cache-transfer-bundle.zip.sha256`

Windows:

```powershell
.\scripts\accept-npm-dependencies-offline-machine.ps1 -Archive .\npm-cache-transfer-bundle.zip
```

Linux/macOS:

```sh
./scripts/accept-npm-dependencies-offline-machine.sh ./npm-cache-transfer-bundle.zip
```

Kabul zinciri ZIP ve SHA dosyasını, aktif `package-lock.json` değerini, paket
sürümünü, deterministik arşiv yapısını ve her npm tarballının SHA-512 bütünlüğünü
yeniden doğrular. Başarılı paket atomik olarak kabul alanına ve npm cache'ine
aktarılır. Hatalı paketler kabul alanına giremez; karantina ve red makbuzu oluşur.
