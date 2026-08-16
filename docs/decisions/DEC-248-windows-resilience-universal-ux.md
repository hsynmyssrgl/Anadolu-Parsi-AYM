# DEC-248 — Windows dayanıklılık ve evrensel UX konsolidasyonu

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED

34-K, tek aile görünümü, komut paleti, son kullanılanlar/favoriler, kişisel kart sırası, sessiz saat/haftalık özet, persona modları ve offline/last-sync göstergeleri için yerel ve fail-closed bir temel kurar. Renderer'daki sabit komut listesi yalnız gezinme önizlemesidir; kişi, belge, ileti veya olay verisinde yetkilendirilmiş evrensel arama değildir.

Evrensel arama adayları renderer ya da çağıran tarafından verilemez. Sonuçlar yalnız yapılandırılmış ve production doğrulaması yapılmış `UniversalUxSearchAuthorityPort` üzerinden gelir; aday bazında yetkilendirme kanıtı yoksa arama kapanır. Bu sağlayıcı henüz production bileşimine bağlanmadığı için arama requirement'ı kapanmaz.

PPK-027 politika zayıflatmasını dört ayrı SHA-256 bağına bağlar: açık kullanıcı kararı, risk analizi, geri alma planı ve önerilen imzalı politika paketi. Kabul ancak production doğrulanmış verifier bütün bağları exact doğrularsa kaydedilir; kabul kaydı otomatik etkinleştirme yetkisi vermez. Verifier yoksa biçimi geçerli öneri yalnız reddedilmiş kanıt olarak kaydedilir.

Windows yaşam döngüsü ve 168 saat soak sonucu çağıran boolean'larından alınmaz. `WindowsResilienceEvidenceProviderPort` gözlemi, sağlayıcı kimliği, kanıt özeti, gözlem zamanı ve gerçek veri sayılarıyla doğrulanır; gelecekte tarihli kanıt reddedilir. Production sağlayıcı bu snapshotta bileşime bağlı değildir.

Migration 115 dört `STRICT` tablo, immutable operasyon/politika/dayanıklılık ledger'ları, exact sahip/aile/hesap/kişi bağı ve writable fence + journal projection içeren dayanıklı PEP receipt zorunluluğu kurar. Migration SHA-256 değeri `e43ccbe70eecee7c7572f3c78cd26f357ab0c69357da712664bb50ed3c81279b` olarak doğrulanmıştır. Üç hedef dosyada 13 test geçer.

Güncel statik ratchet kanıtı: PPK-015 555 dosya / `dd417d3278b872587fa1ef32cda41e5dcf44a22c9781f29c311d78d845d48e29`; PPK-021 555 dosya / 873 yüzey / `843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc`; PPK-022 555 dosya / 392 yüzey / `cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c`.

Yerel teknik kanıt 3 dosya/13 hedef testi, 286 dosya/1920 tam regresyon testi, kök typecheck, 16 workspace paket derlemesi, core-service ve desktop derlemelerinde PASS'tir. Gerçek Windows clean install/upgrade/repair/uninstall, 168 saat soak, production arama/verifier sağlayıcıları, QR/kamera/ses, mini panel, Apple widget ve accessibility UAT `NOT_RUN` kalır. Append-only operasyon ve immutable kanıt ledger'larının uzun dönem retention/destruction kararı verilmemiştir. Bu nedenle `countsAsRequirementPass=false` korunur.
