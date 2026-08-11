# IPC Adaptif Bütçe Kalıcı Durum ve Karar Günlüğü V1

- Ürün: Anadolu Parsı Aile Yaşam Merkezi
- İlk uygulama: Build 165
- Aşama: Bronze RC2 Active Development

## Amaç

Build 164 adaptif IPC bütçeleri çalışma sırasında güvenli sınırlar içinde daraltır ve kademeli olarak tabana döndürür. Build 165 bu kararların uygulama çökmesi veya yeniden başlatma sonrasında doğrulanmış biçimde sürdürülebilmesini sağlar.

## Kalıcı dosyalar

`userData/runtime-state` altında iki dosya tutulur:

1. `ipc-adaptive-budget-state.json`: atomik ve hızlı geri yükleme durumu.
2. `ipc-adaptive-budget-decisions.jsonl`: append-only, SHA-256 zincirli karar günlüğü.

Her karar girdisi önceki girdinin hash değerini, mevcut politika parmak izini, uygulama sürümünü ve kalıcı durumun SHA-256 özetini içerir. Ham IPC argümanları, payload, kullanıcı kimliği, renderer oturumu veya istek kimliği yazılmaz.

## Geri yükleme kuralları

- Günlük zinciri baştan sona doğrulanır.
- Uygulama sürümü ve adaptif politika parmak izi birebir eşleşmelidir.
- Son doğrulanmış kayıt en fazla **15 dakika** eski olabilir.
- Durum dosyası eksik veya bozuk, günlük geçerliyse durum günlükten yeniden oluşturulur.
- Günlük bozuk, eski veya farklı sürüm/politikaya bağlıysa iki dosya karantinaya alınır ve denetleyici `baseline` modunda başlar.
- Geri yükleme reddi Sistem Sağlığı görünümünde `rejected` olarak gösterilir.

## Dayanıklılık

- Durum dosyası aynı klasörde geçici dosyaya yazılır, `fsync` edilir ve atomik yeniden adlandırılır.
- Günlük satırı append edildikten sonra dosya `fsync` edilir.
- Günlük en fazla 512 girdi ve yaklaşık 1 MiB olacak şekilde sınırlandırılır.
- Sınır aşımında son doğrulanmış zincir başı `compactedThroughHash` alanıyla yeni kontrol noktasına bağlanır.
- Uygulama düzgün kapanırken çalışma durumu silinmez; yalnız bellek içi kaynaklar temizlenir.

## Fail-closed davranış

Bozuk veya doğrulanamayan kalıcı durum hiçbir zaman doğrudan uygulanmaz. Denetleyici taban bütçeye döner, reddedilen dosyaları zaman damgalı adla karantinaya alır ve yeni temiz zincir başlatır.
