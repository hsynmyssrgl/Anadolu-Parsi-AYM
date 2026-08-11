# DEC-168 — Ana yapı önce: Core Service API omurgası

## Durum

ACTIVE — kullanıcının açık “öncelik ana yapının kurulması” kararı.

## Öncelik değişikliği

31-G için başlatılmış governed import rollback dar dilimi henüz veri tabanı veya iş mutasyonu uygulanmadan durdurulmuştur. DEC-167 seçimi tarihsel kanıt olarak korunur, fakat uygulama sırası bu kararla değiştirilir. 31-G kimliği, persistent receipt üretilmeden önce mevcut aktif adım olduğundan ana yapı temel checkpoint'i olarak yeniden kapsamlanır.

## Ana yapı hedefi

- Headless Core Service bütün istemcilerin bağlandığı tek süreç sınırı olarak korunur.
- Local named-pipe/socket protokolü için derleme zamanında tip güvenli tek metod haritası ve merkezi dispatcher kurulur.
- Core Service, API/protokol sürümünü, süreç ve politika sahipliğini, geçişte kalan veri sahipliğini ve desteklediği metodları makine-okunur bir architecture manifest ile bildirir.
- Desktop başlangıç bağlantısı bu manifesti doğrular; protokol, PolicyKernel sahipliği veya beklenen zorunlu metodlar uyuşmazsa fail-closed durur.
- Mevcut health/policy metodları aynı dispatcher omurgasından geçer; sonraki aile, yedek, sync ve diğer modül API'leri bu sözleşmeye eklenecektir.
- Google Drive veya kullanılmayan sürücü yolu eklenmez. Windows servis kurulumu ve makine düzeyi provisioning onay gerektiren son aşama olarak açık kalır.

Bu checkpoint DHA-001, DHA-011, PPK-001, PPK-003, PPK-014 ve PPK-026 için ana yapı foundation'ıdır; hiçbir gereksinimi tek başına COMPLETE saymaz ve yeni Build vermez.

