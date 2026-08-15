# 34-C Gerçek Zamanlı Arama ve Erişilebilir UX Tehdit Modeli

## Korunan varlıklar

- Arama oturumu, oda ve katılımcı ilişkileri.
- Mikrofon, kamera, hoparlör preflight ve gelecekteki kalite kanıtı metadata'sı.
- Bekleme odası, toplantı kilidi, audio-only, altyazı, RTT, ekran paylaşımı isteği ve erişilebilirlik tercihleri.
- PEP receipt/fence, mutation/event ledger, audit ve outbox bütünlüğü.

## Güven sınırları

- Renderer medya cihazı, provider, ağ, relay credential, ekran yakalama veya kalite kanıtı otoritesi değildir.
- DataStore yalnız merkezi Life PEP, repository resolver ve aynı SQLite transaction üzerinden yazım yapar.
- Preflight ve kalite kanıtı yalnız gelecekteki güvenilir main-process adapterından gelebilir; production adapterı yoksa işlem reddedilir.
- Yerel bekleme durumu gerçek bağlantı, teslim, çağrı veya ağ kanıtı değildir.

## Tehditler ve kontroller

| Tehdit | Kontrol | Kalan risk |
|---|---|---|
| Renderer'ın medya/provider/ağ yetkisi enjekte etmesi | Altı exact kanal, recursive plain-object/prototype/accessor/symbol/unknown-field ve safe-result doğrulaması | Gerçek medya providerı yok |
| Başka aile veya kişinin oturumuna erişim | Exact account/person/family/owner PEP receipt ve owner filtreli repository sorguları | Gerçek çoklu hesap UAT yapılmadı |
| Replay veya revision atlama | Unique client operation, request fingerprint, optimistic revision, state fingerprint ve mutation/current trigger bağı | Yaşam boyu mutation/event retention incelemesi yapılmadı |
| Sahte preflight veya kalite iddiası | Renderer bu alanları gönderemez; main-only verified input ve `providerVerified:true` zorunlu | Production evidence adapterı bağlı değil |
| Yerel planın gerçek çağrı sayılması | Truth alanlarında provider/WebRTC/SFU/STUN/TURN/SFrame/MLS/network ve gerçek çağrı false | Gerçek cihaz ve ağ UAT yok |
| Screen-share isteğinin yakalama sayılması | Yalnız boolean istek metadata'sı; renderer capture handle veremez | Screen/window capture uygulanmadı |
| Altyazı ve RTT isteğinin taşıma sayılması | İstek metadata'sı ile provider/transport truth'u ayrıdır | Canlı caption ve RTT transport yok |
| Host yetkisinin aşılması | Toplantı kilidi owner-bound mutationdır; initial participant roster immutable | Kick ve tam host moderation yok |
| Kota ile kalıcı hesap kilidi | 257. session ve 513. quality inserti yazımdan önce fail-closed | Prune/retention yok; yaşam boyu kota riski açık |
| Audit/outbox üzerinden hassas metadata sızıntısı | İçeriksiz mutation kind, resource id ve revision | Harici privacy/security review NOT_RUN |

## Fail-closed ve no-claim sınırları

Central policy, repository, trusted preflight provider veya production media provider yoksa ilgili işlem ilerlemez. WebRTC, SFU, STUN/TURN, relay, SFrame/MLS media, capture, background processing, live caption, RTT transport, CallKit/PushKit, Windows notification, do-not-disturb, gerçek preflight ve gerçek çağrı uygulanmış sayılmaz.

## Açık kanıtlar

Gerçek cihaz, gerçek ağ, bire bir ve grup araması, media encryption, SFU/relay, screen share, background, caption/RTT, OS çağrı entegrasyonları, host kick, retention/prune, privacy/legal/security/accessibility incelemeleri ve kalıcı governance receipt `NOT_RUN` durumundadır.
