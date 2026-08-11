# IPC Adaptif Bütçe Operatör Kurtarma Sınırı V1

## Amaç

Build 166, Build 165 kalıcı durumunu değiştirmeden yetkili kullanıcıya iki güvenli işletim aracı sağlar:

1. Adaptif IPC bütçesini onaylı biçimde `baseline` moda sıfırlama.
2. Kullanıcı verisi içermeyen, SHA-256 doğrulamalı teknik tanı paketi dışa aktarma.

## Manuel sıfırlama

- İşlem yalnız açık oturumda kullanılabilir.
- Ana süreç ayrıca onay iletişim kutusu gösterir.
- Kısa ömürlü IPC okuma cache'i ve toplu performans telemetrisi temizlenir.
- Bütçe modu `baseline`, neden `manual-reset` olur.
- Nesil sayacı ilerletilir ve `manual-clear` kararı hash-zincirli günlüğe yazılır.
- Sıfırlama, Bronze RC2 Final veya üretim yükseltmesi değildir.

## Tanı paketi

JSON tanı paketi şunları içerir:

- Uygulama sürümü ve politika parmak izi.
- Geçerli adaptif bütçe görünümü.
- Durum/günlük dosyalarının boyut, SHA-256 ve doğrulama özeti.
- Karantinadaki dosyaların yalnız adı, boyutu, değiştirilme zamanı ve SHA-256 değeri.
- Gizlilik beyanları.

Paket şunları içermez:

- Kullanıcı kimliği veya aile verisi.
- Oturum ya da istek kimliği.
- IPC argümanı, istek veya yanıt payload'ı.
- Mutlak çalışma dizini.

Paket atomik yazılır ve yanında `.sha256` dosyası oluşturulur.

## Karantina saklama

- Karantina ayrı `runtime-state/quarantine` dizinindedir.
- Varsayılan saklama süresi 30 gündür.
- Varsayılan üst sınır 12 dosyadır.
- Önce süresi dolan, sonra en eski taşan dosyalar kaldırılır.
- Yalnız `ipc-adaptive-budget-` önekli dosyalar yönetilir.
