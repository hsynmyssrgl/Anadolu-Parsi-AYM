# PPK-017 hassas log politikası tehdit modeli

Durum: `VALIDATED / COMPLETE`

## Korunan varlıklar

- OCR metni dahil kullanıcı payload'ları ve semantik içerik.
- Kimlik doğrulama verileri, secret/token/credential, hata stack'leri ve kalıcı dosya/kasa yolları.
- Desktop cihaz anahtarlı korumalı yan artefakt sınırı.
- SQLite `diagnostic_entries` kayıtları ile tanı raporu/arşiv zinciri.
- Correlation ve teknik sonuç metadata'sının bütünlüğü.
- PPK-012–PPK-016 güvenlik çitleri ve DEC-171 cutover yasağı.

## Güven sınırları

1. Her yapılandırılmış olay `SensitiveLogPolicy.evaluate` tarafından serialization öncesi değerlendirilir. Ret kararı sink callback'ini açmaz ve hassas değeri hata nesnesine geri taşımaz.
2. Desktop üretim sink'i merkezi serializer sonrasında cihaz anahtarlı korumalı `.pplog` artefaktına yazar. Plaintext JSONL sınıfı yalnız paket düzeyinde kalır ve production composition'da kullanılamaz.
3. Core Service ile erken Desktop başlangıç yolu doğrudan console veya process stream kullanamaz; yalnız content-free merkezi writer kullanır.
4. `RecordDiagnosticUseCase` ham tanıyı sabit teknik mesaja ve tek yönlü SHA-256 hash'e dönüştürür. Repository doğrudan çağrıda yeniden sanitize eder ve read-back'te content-free sözleşmesini tekrar doğrular.
5. Diagnostic report/archive projeksiyonu yalnız skor, sayaç, teknik sonuç ve content-free tanı kayıtları taşır; kullanıcı hedef adları/yolları ve queue semantiği projeksiyona girmez.
6. Renderer yalnız sıfır argümanlı, no-cache politika duruşu IPC'sini görür; payload veya sink yolu alamaz.

## Tehditler ve fail-closed kontroller

| Tehdit | Kontrol |
| --- | --- |
| Metadata içinde payload/OCR/transcript/body/message/details/content/stack taşıma | Yasak anahtar sınıfları, düz allowlist ve serializer öncesi merkezi ret |
| Zararsız görünen key altında kullanıcı metni taşıma | String yalnız identifier, SHA-256, timestamp veya sabit sonuç anahtarlarında teknik token biçimiyle kabul edilir; boşluklu/uzun serbest metin reddedilir |
| Nested nesne, array veya spread ile tarayıcı/politika kaçışı | Nested metadata yasaktır; yalnız üç migration version dizisi sayısal liste olabilir; statik gate spread ve nested literal kullanımlarını reddeder |
| Raw `Error.message`, `Error.stack` veya `String(error)` sızıntısı | Kaynak taraması ve olay politikası; erken fatal kanıtında yalnız errorName + SHA-256 fingerprint |
| Doğrudan `console.*` veya process stream ile merkezi politikanın atlanması | 18 üretim alanını tarayan statik fail gate; yalnız logging paketindeki bracket stream writer yetkilidir |
| Plaintext Desktop log sink'inin production composition'a eklenmesi | `JsonLinesFileLogger` production import yasağı; Desktop bileşimi yalnız `ProtectedSideArtifactLogger` kullanır |
| Diagnostic repository'ye ham mesaj veya ayrıntı yazılması | Use-case ve repository çift sanitize; kaynak metin saklanmaz, yalnız sabit mesaj + SHA-256 hash |
| Bozuk/restore edilmiş politika dışı diagnostic satırının okunması | Repository read mapper `verifyDiagnostic` ile fail-closed reddeder |
| Diagnostic report/archive ile kullanıcı yolu, hedef adı, queue payload'ı veya serbest hata metni dışa aktarma | Content-free domain projection ve sentetik canary'nin report/archive dosyalarında bulunmadığını doğrulayan gerçek DataStore regresyonu |
| UI/IPC paylaşımı üzerinden politika, payload veya yol cache'i | Sıfır argümanlı tipli boundary view; policy-sensitive no-cache listesi ve payload/path/secret alanlarının sabit false olması |
| PPK-017 kanıtını değişmez karar audit zinciri yerine sayma | PPK-018 açıkça ayrı kapsamdadır; envanter ve kapsam `auditDecisionChainCompletedByThisPackage:false` taşır |

## Bozuk veri ve hata semantiği

Politika dışı olay sink'e yazılmaz. Memory logger yalnız content-free ret kodu/nedeni tutar; dosya sink'i yalnız `SafeLogWriteFailure` verir. Diagnostic input zarfı bozuksa yazma açılmaz; kalıcı satır bozuksa liste/arama read path'i payload döndürmeden hata verir. Hiçbir hata yolu ham kaynak metni, stack'i veya kalıcı yolu ikincil loga kopyalamaz.

## Kalan riskler ve kapsam dışı öğeler

- Hash, düşük entropili bir değerin sözlük saldırısıyla tahmin edilmesini tek başına engellemez; bu nedenle hash yalnız teknik korelasyon/fingerprint içindir ve yetki kanıtı sayılmaz.
- İşletim sistemi veya üçüncü taraf native runtime'ın proje logger'ı dışındaki kendi telemetry davranışı bu kaynak kapısının doğrudan kontrolünde değildir. Uygulama kodu bu kanallara hassas değer aktarmamalıdır.
- PPK-018 değişmez audit zinciri ayrı pakettir. PPK-017 log content sınırını kapatır; audit bütünlüğü veya retention politikasını tamamlamaz.

## Gerçeklik sınırı

Gerçek OCR/AI çalıştırılmamış, gerçek kullanıcı payload'ı taşınmamış, diagnostic backfill yapılmamış ve migration eklenmemiştir. Desktop kasası ve SQLite sahipliği değişmez; Core Service family-data oturumu ve cutover yetkisi eklenmez. Hedefli, tam regresyon, üretim build'i, bütünlük, contract ve runtime doğrulaması tamamlanmıştır.
