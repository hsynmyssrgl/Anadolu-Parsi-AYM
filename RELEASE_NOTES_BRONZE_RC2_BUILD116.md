# Bronze RC2 Build 116 Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.116`
- Package Version: `25.7.2026-116`
- Kanal: **Bronze RC2 Active Development**

## Eklenenler

- Lockfile ile npm cache arasında SHA-512 temelli offline hazırlık doğrulaması.
- Cache indeks, içerik yolu, byte sayısı ve içerik hash kontrolü.
- Cache tam olduğunda doğrulanmış offline clean-install önceliği.
- Cache eksik olduğunda yalnızca resmî npm registry üzerinde `prefer-offline` fallback.
- Offline fallback öncesi ve başarısız kurulum sonrası güvenli kalıntı temizliği.
- Linux ve Windows doğrulama kanıtlarında cache hazırlık raporu.

## Doğruluk kuralı

Yerel cache tam değilse offline clean install PASS sayılmaz. Alternatif registry kullanılmaz; çalıştırılmayan derleme, test ve Windows kapıları PASS olarak raporlanmaz.
