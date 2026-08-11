# 31-G — Ana yapı Core Service API foundation

## Sonuç

31-G, çalışan Desktop → Core Service v1 yerel yönetim protokolünü kaldırmadan veya davranışını daraltmadan tip güvenli uygulama API omurgasını kurar. Mevcut `health.get`, `policy.authorize` ve `policy.verify` yöntemleri korunmuş; `architecture.get` aynı merkezi, fail-closed dispatcher üzerinden eklenmiştir.

## Kurulan sınırlar

- Tek derleme-zamanı metod haritası payload ve sonuç tiplerini bağlar.
- Sunucu, kimliği doğrulanmış çağrıları tek merkezi dispatcher üzerinden yönlendirir; bilinmeyen metodlar kapalı biçimde reddedilir.
- Core Service süreç, PolicyKernel ve uygulama API sahipliğini makine-okunur manifest ile bildirir.
- Desktop başlangıç bağlantısı protokolü, sahipliği ve zorunlu metodları doğrular; uyuşmazlıkta `ARCHITECTURE_MISMATCH` ile durur.
- Aile verisi ve yedek sahipliği açıkça `desktop-transition`, sync ise `not-implemented` olarak kalır. Bu alanlar taşınmış gibi gösterilmez.

## Geriye uyumluluk ve kapsam gerçeği

Core Service API sürümü `v1`, kablo protokolü `1` olarak korunur. Önceki istemci sarmalayıcıları çalışmaya devam eder. Google Drive veya kullanılmayan bir sürücü yolu eklenmemiştir. Windows servis kurulumu bu checkpoint kapsamında çalıştırılmamış, onay gerektiren son aşama olarak bırakılmıştır.

Bu foundation DHA-001, DHA-011, PPK-001, PPK-003, PPK-014 ve PPK-026 gereksinimlerini tek başına COMPLETE yapmaz; aile verisi, yedek/sync ve evrensel istemci API geçişleri sonraki ana-yapı dilimleridir. Yeni Build verilmez.

## Zorunlu kapılar

- 31-G sözleşme doğrulaması
- kök TypeScript `--noEmit`
- merkezi dispatcher hedefli Vitest
- Core Service, Desktop başlangıç ve System Health sözleşme/çalışma kapıları
- Platform Policy yeni-bypass kapısı
- tam Vitest regresyonu
- Electron main/preload ve renderer üretim derlemesi
- D: harici kitaplık SHA-256 + boyut geri-okuma makbuzu

Çalıştırılmayan hiçbir kontrol PASS sayılmaz.
