# PPK-026 Typed Policy SDK Tehdit Modeli

## Korunan varlıklar

- Core Service tarafından üretilen imzalı policy kararı ve receipt.
- Doğrulanmış policy paketi kimliği.
- Monotonic cluster write-fence epoch ve writable durumu.
- Finans ve sağlık dahil korunan üretim işlemlerinin tek policy yorum yolu.

## Güven sınırları

Core Service local authenticated transport ham sözleşme cevabı üretir. Generated client yalnız exact wire metodunu taşır. `CoreServicePolicySdk` cevabı uygulamanın kullanabildiği provider biçimine daraltır ve gözlenen paket/fence durumunu yönetir. `PlatformPolicyEnforcementPoint` karar, obligation, receipt, replay ve transaction doğrulamasını sürdürür. Renderer bu katmanların hiçbirine doğrudan erişmez.

## Tehditler ve kontroller

| Tehdit | Kontrol |
|---|---|
| Uygulamanın `allowed` veya `valid` sonucunu kendine göre yorumlaması | Ham sonuç tipleri uygulama katmanında yasak; mapping yalnız SDK içindedir. |
| Ham `policy.authorize` / `policy.verify` çağrısıyla SDK'nın aşılması | Exact AST boundary ve generated-client-only allowlist. |
| Doğrudan PEP kurup farklı seçeneklerle daha zayıf yol açılması | Yedi üretim consumer'ı tek typed factory kullanır; direct constructor build'de reddedilir. |
| Eski veya aynı epoch içinde değişmiş fence kullanılması | Monotonic fence doğrulaması, fail-closed ret ve trusted-state temizliği. |
| Önceki doğrulanmış paketin unverified health sonrasında kullanılmaya devam etmesi | Unverified health paket ve fence'i atomik olarak temizler. |
| Bozuk transport sonucunun TypeScript tipine güvenilerek kabulü | SDK runtime shape kontrolleri ve PEP'in tam kriptografik/context doğrulaması. |
| Generated kaynağın elle değiştirilmesi | Canonical JSON schema, deterministik renderer, kaynak ve manifest exact-byte verifier. |
| Finans veya sağlığın ortak yükümlülüklerden sapması | Her iki runtime aynı factory/provider/receipt/fence yolunda ve ortak targeted regression paketindedir. |

## Kalan riskler

Local transport, signing kernel ve platform-policy PEP kendi önceki threat modellerine bağlıdır. 32-V dağıtık public API, WebSocket veya gRPC güven sınırı kurmaz; DHA-011 açık kalır. Production Authenticode ve provenance girdileri PPK-025'in ayrı dış bağımlılığıdır ve bu karar tarafından genişletilmez.
