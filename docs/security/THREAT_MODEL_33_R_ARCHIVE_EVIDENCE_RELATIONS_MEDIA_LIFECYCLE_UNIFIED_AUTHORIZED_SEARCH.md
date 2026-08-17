# 33-R tehdit modeli — arşiv kanıt ilişkileri, medya yaşam döngüsü ve birleşik yetkili arama

## Korunan varlıklar

- Arşiv belgesi, sürüm metadata’sı ve şifreli kasa dosyası
- Aile ilişkisi ile belge arasındaki kanıt bağı ve değişmez geçmiş
- Family/account/owner/resource sınırı ile merkezi PEP receipt/fence/projection kanıtı
- Finans, sağlık, yaşam, olay, aile ve arşiv arama sonuçları
- Audit/outbox içinde yalnız content-free teknik metadata

## Tehditler ve kontroller

### Çapraz sahip veya aile kanıtı ekleme

Repository exact active owner-bound archive item, family, actor account, owner person ve relation identity eşliğini zorunlu kılar. Yabancı family/owner veya ownerless legacy receipt `RESOURCE_NOT_FOUND`/fail-closed sonucuna gider; actor tahmini yapılmaz.

### Sahte receipt, stale revision ve replay

Create/remove/version mutasyonları exact resource action, capability, purpose, sensitivity, cluster fence ve projection receipt’iyle bağlanır. Client operation kimliği request fingerprint ile idempotenttir; aynı kimlikle farklı payload reddedilir. Remove yalnız current `active` ve exact expected revision üzerinde ilerler.

### Geçmişi silerek delil zincirini değiştirme

Evidence mutation ledger append-only’dir. Current evidence fiziksel silinemez ve yalnız `active -> removed` geçişine izin verilir. Removed kayıt UI etkin listesinden çıkar; immutable history sorgusunda kalır.

### Gelecek tarihli veya anlamsız kanıt

Kanıt tarihi authoritative transaction gününden ileri olamaz. Confidence yalnız `low|medium|high`; kimlik ve fingerprint alanları bounded/exact biçimdedir. Validation hem domain/application hem SQLite trigger katmanında fail-closed uygulanır.

### Yeni sürümde dosya yolu veya plaintext sızıntısı

Dosya seçici yalnız ana süreçtedir. Renderer path/stored name/raw bytes/anahtar/receipt almaz. Dosya önce korumalı kasada doğrulanır; audit/outbox yalnız kimlik, hash, boyut, revision ve zaman metadata’sı taşır.

### Dosya ile SQLite arasında crash penceresi

Bilinen non-commit sonucunda sahip olunan yeni dosya temizlenir; belirsiz commit sonucunda retry doğrulaması için şifreli dosya korunur. Main-process inspection aile/actor/kayıt/not/SHA-256/boyut bağıyla deterministik operation ve version kimliği üretir; restart sonrası aynı byte-exact dosya aynı kasaya ve aynı idempotent SQLite sonucuna bağlanır, farklı dosya reddedilir. Bu tasarım filesystem ile SQLite arasında sahte atomiklik veya kullanıcı seçimi olmadan otomatik recovery iddiası üretmez.

### Birleşik aramada yetkisiz sonuç sızıntısı

Arama yeni raw SQL veya tek geniş yetki kullanmaz; her modülün mevcut merkezi yetkili read use-case’i çağrılır. Herhangi bir kaynak fail olursa kısmi sonuç dönmez. Sonuçlar owner/family/account filtreli kaynak görünümünden gelir; query renderer’a echo edilmez ve result/candidate limitleri zorunludur.

### Renderer’ın otorite kazanması

IPC exact key, type, length, prototype/accessor/symbol/path/secret kontrolleri uygular. Renderer yalnız güvenli view ve mutation sonucunu alır; family/account/owner, policy receipt, filesystem path ve ham dosya authority’si taşımaz.

### Statik gate’i runtime yetkisi sanma

PPK-021/022 allowlist ve capability manifesti yalnız build/runtime surface ratchet’idir. Her repository çağrısı için merkezi PEP/UoW receipt’i zorunludur; manifest kaydı tek başına veri erişimi vermez.

## Açık riskler

- Process restart sonrası aynı dosya ve semantik girdinin version mutation replay kanıtı vardır; evidence mutation ve kullanıcı seçimi olmadan otomatik devam kapsam dışıdır.
- Archive file ile SQLite metadata arasında genel crash-atomicity garantisi yoktur.
- Legacy ownerless archive reattestation gerçek kullanıcı UAT’si yapılmamıştır.
- Büyük aile ölçeği, erişilebilirlik, gizlilik, hukuk ve bağımsız güvenlik incelemesi `NOT_RUN` durumundadır.
- 33-P/33-Q atomik yönetişim kapanışı tamamlanmadan 33-R gereksinim PASS sayılmaz.

Bu açıklar nedeniyle yerel teknik testlerin tamamı geçse bile certification veya production acceptance iddiası yapılmaz.
