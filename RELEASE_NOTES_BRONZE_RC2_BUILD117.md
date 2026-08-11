# Bronze RC2 Build 117 Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.117`
- Package Version: `25.7.2026-117`
- Kanal: **Bronze RC2 Active Development**

## Eklenenler

- Deterministik npm cache transfer paketi üretimi.
- Paket-lock SHA-256 ve tarball SHA-512 çapraz doğrulaması.
- Resmî npm registry dışındaki kökenlerin reddi.
- Eksik cache’den yanlışlıkla tam paket üretiminin engellenmesi.
- Bozuk, değiştirilmiş, farklı sürüm veya farklı lockfile’a ait paketlerin reddi.
- Mevcut cache’i değiştirmeyen, yalıtılmış hedef cache köküne staged import.
- İçe aktarılan cache’in npm `content-v2` ve `index-v5` yapısıyla yeniden doğrulanması.

## Doğruluk kuralı

Taşıma paketi cache içeriğini internet olmadan başka makineye aktarmak içindir; eksik kaynak cache tam sayılmaz. Clean install, derleme ve Windows kapıları gerçekten çalıştırılmadan PASS raporlanmaz.
