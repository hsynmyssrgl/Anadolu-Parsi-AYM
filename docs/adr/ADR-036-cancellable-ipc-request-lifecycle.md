# ADR-036 — İptal edilebilir IPC istek yaşam döngüsü

- Durum: Kabul edildi
- Tarih: 2026-07-29
- Aşama: Bronze RC2 Active Development
- Build: 160

## Bağlam

Build 159 her IPC yanıtını istek, renderer oturumu, oturum çağı ve revizyon
bağlamına bağladı. Buna rağmen preload süre aşımına uğradığında, aynı kanalda daha
yeni bir okuma başladığında veya pencere kapandığında ana süreçteki işin yaşam
döngüsü açıkça sonlandırılmıyordu.

## Karar

Yalnız güvenli biçimde iptal edilebilen okuma ve ağ kanalları merkezi bir yaşam
döngüsü politikasına alınır. Preload aynı kanaldaki yeni bir `latest-wins`
okumasında önceki isteği iptal eder ve sınırlı süre aşımında ana sürece doğrulanmış
iptal mesajı gönderir. Oturum değişimi ile renderer kapanışı güncel oturum çağındaki
iptal edilebilir istekleri topluca sonlandırır.

Ana süreç her kabul edilen istek için bounded bir `AbortController` kaydı açar.
İptal mesajı sender, rendererSessionId, sessionEpoch, requestId ve channel ile
birebir eşleşmeden uygulanmaz. Mutasyon kanalları varsayılan olarak iptal edilemez;
böylece kullanıcı tarafından başlatılmış yazma işlemleri timeout yarışında yarım
kalmış gibi raporlanmaz.

Kooperatif uzun işler `getIpcRequestAbortSignal(event)` ile sinyali alabilir. İlk
entegrasyon güvenli iptal listesi HTTPS senkronizasyonudur; Node HTTPS isteği ve
endpoint döngüsü AbortSignal'i doğrudan kullanır.

## Sonuçlar

- Eski arama/sayfa istekleri ana süreçte gereksiz çalışmaya devam etmez.
- Süre aşımı ve iptal ayrı audit olaylarıdır.
- Pencere kapanışı aktif iptal edilebilir işleri temizler.
- Mutasyonlar otomatik iptal politikasının dışında kalır.
- Tam production/Windows davranışı bağımlılık yanıtı geldikten sonra geniş kapıda
  ayrıca doğrulanacaktır.
