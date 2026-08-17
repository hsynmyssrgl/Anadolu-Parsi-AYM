# DEC-248 — Windows dayanıklılık ve evrensel UX konsolidasyonu

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED

34-K, tek aile görünümü, komut paleti, son kullanılanlar/favoriler, kişisel kart sırası, sessiz saat/haftalık özet, persona modları ve offline/last-sync göstergeleri için yerel ve fail-closed bir temel kurar. Renderer'daki sabit komut listesi yalnız gezinme önizlemesidir; kişi, belge, ileti veya olay verisinde yetkilendirilmiş evrensel arama değildir.

Evrensel arama adayları renderer ya da çağıran tarafından verilemez. Sonuçlar yalnız yapılandırılmış ve production doğrulaması yapılmış `UniversalUxSearchAuthorityPort` üzerinden gelir; aday bazında yetkilendirme kanıtı yoksa arama kapanır. Bu sağlayıcı henüz production bileşimine bağlanmadığı için arama requirement'ı kapanmaz.

PPK-027 politika zayıflatmasını dört ayrı SHA-256 bağına bağlar: açık kullanıcı kararı, risk analizi, geri alma planı ve önerilen imzalı politika paketi. Kabul ancak production doğrulanmış verifier bütün bağları exact doğrularsa kaydedilir; kabul kaydı otomatik etkinleştirme yetkisi vermez. Verifier yoksa biçimi geçerli öneri yalnız reddedilmiş kanıt olarak kaydedilir.

Windows yaşam döngüsü ve 168 saat soak sonucu çağıran boolean'larından alınmaz. `WindowsResilienceEvidenceProviderPort` gözlemi, sağlayıcı kimliği, kanıt özeti, gözlem zamanı ve gerçek veri sayılarıyla doğrulanır; gelecekte tarihli kanıt reddedilir. Production sağlayıcı bu snapshotta bileşime bağlı değildir.

Migration 115 dört `STRICT` tablo, immutable operasyon/politika/dayanıklılık ledger'ları, exact sahip/aile/hesap/kişi bağı ve writable fence + journal projection içeren dayanıklı PEP receipt zorunluluğu kurar. Sıfır SHA-256 değerleri kalıcı kanıt sayılamaz; dayanıklılık gözlemi kayıt anından en fazla 24 saat eski olabilir. Migration SHA-256 değeri `e9e67d7ef5c3097f4e39ea3a01aca76a7f9b64fe5b54de8da4de8cfbfc42e5cc` olarak doğrulanmıştır. Üç hedef dosyada 16 test geçer.

Güncel statik ratchet kanıtı: PPK-015 556 dosya / `182b50cca03307c6d475e969d77f02894017c220db4a71b952e1812adeebb155`; PPK-021 556 dosya / 876 yüzey / `709379784b8e59727f58d54c6187a4f2924d19c0bcefbe6efb976ed64f825dd0`; PPK-022 556 dosya / 395 yüzey / `a3b3f91af4a08d2b4fcb58d71b67a9e40283e6b94364a64519409c4d44a21d0e`.

Yerel teknik kanıt 3 dosya/16 hedef testi, 287 dosya/1971 tam regresyon testi, kök ve paket typecheckleri, 18 workspace üretim derlemesi, migration ve güncel güvenlik ratchetlerinde PASS'tir. Arama ve tercih sınırları prototype, accessor, symbol, sparse-array ve sıfır kanıt girdilerini fail-closed reddeder. Gerçek Windows clean install/upgrade/repair/uninstall, 168 saat soak, production arama/verifier sağlayıcıları, QR/kamera/ses, mini panel, Apple widget ve accessibility UAT `NOT_RUN` kalır. Append-only operasyon ve immutable kanıt ledger'larının uzun dönem retention/destruction kararı verilmemiştir. Bu nedenle `countsAsRequirementPass=false` korunur.
