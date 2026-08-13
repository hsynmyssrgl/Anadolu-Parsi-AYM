# 33-L üst kapanış — Finans / Uzun Vadeli Portföy merkezi

- Tarih: 13.08.2026
- Karar: DEC-223
- Gereksinimler: LTP-001–LTP-008
- Şema: Migration 89
- Yetkilendirme: `CentralAuthorizationService` ve mevcut Finans UoW
- Kapanış durumu: tam test, build ve kalıcı makbuz zinciri tamamlanana kadar fail-closed

## Tek pakette kapanan işlevler

Finans menüsü altında ayrı Uzun Vadeli Portföy merkezi; sabit kıstas olmayan, her yeni
plan sürümünde değiştirilebilen 20.000 TRY başlangıç varsayılanını,
10.000 baz puanlık verilen dağılımı ve 13 Ağustos 2032 hedefini tek bootstrap işleminde
kurar. ASELS, TUPRS, THYAO, KCHOL, BIMAS, AKBNK, EREGL, BETAE, NETCD, TI2, AFT,
TTE, KZL, GUF ve PPN stable kimlikli katalogda tutulur. Halka arz rezervi uygun ürün
seçilene kadar PPN üzerinde ayrı dilimdir. Yerli/yabancı hisse, fon, ETF, tahvil/bono,
eurobond, mevduat, döviz, altın, gümüş, emtia, BES, halka arz rezervi, nakit/birikim,
kripto, gayrimenkul, araç ve özel ürün sınıfları eklenebilir.

Aylık katkı ile dağılım değişikliği geçmişi ezmez; ileri geçerlilik ayına sahip yeni ve
tam %100 mühürlü sürüm ekler. Kullanılmayan tutar kıymet bazında sonraki aya devreder.
Başka kıymete bütçe aktarımı, farklı kaynak/hedef ve aynı para birimi gerektiren tek
atomik `transfer_out` kaydıdır; adedi veya maliyet katmanını değiştirmez ve kaynak
bütçeyi hiçbir aylık pivotta eksiye düşüremez. `transfer_in` ise haricî saklama/kıymet
girişidir ve belge/dekont referansı zorunludur.

Alım/satım defteri sipariş, gerçekleşme ve takas/valör tarihini; kısmi gerçekleşme,
adet, birim fiyat, brüt/net, komisyon, vergi, kur, aracı kurum/hesap, emir/gerçekleşme,
lot/maliyet ve kaynak alanlarını taşır. Temettü, bedelli kullanım/satış/süre dolumu,
bedelsiz, bölünme/ters bölünme, kupon, faiz, fon dağıtımı, birleşme/değişim, kod
değişimi ve virmanlar append-only olaydır; düzeltme yalnız gerekçeli ters kayıttır.

Kıymet bazında adet, yatırılan tutar, ağırlıklı ortalama maliyet, gerçekleşen ve
gerçekleşmemiş sonuç, gelir, masraf, vergi, manuel fiyat ve devreden bakiye gösterilir.
Eksik fiyat veya baz kura çevrilmemiş yabancı para olduğunda portföy toplamı fail-closed
kalır. Aylık grafikler, hedef/gerçekleşen sapması, altı aylık dengeleme uyarısı ile
kötümser/temel/iyimser nominal ve reel 2032 senaryoları yalnız karar desteğidir.

## Güvenlik ve doğruluk sınırı

Bütün yazmalar aynı UoW içinde durable policy receipt, mutation, audit ve outbox ile
bağlanır. Aile, kişi ve gizlilik kapsamı her tabloda korunur. Plan mühürü, idempotent
`clientOperationId` ve istek parmak izi, tek doğrusal katalog/plan geçmişi, as-of kesiti,
tarih/yön/net-tutar aritmetiği, para birimi/kur ve adet/bütçe zaman çizelgesi kontrolleri
hem uygulama hem repository/SQLite sınırlarında fail-closed uygulanır.

Sistem broker emri veya para hareketi yürütmez; canlı fiyat sağlamaz; yatırım tavsiyesi,
getiri, vergi/hukuk doğruluğu veya 2032 sonucu garanti etmez. Dış doğrulama açıkça
işaretlenmedikçe ürün, fiyat ve işlem verisi kullanıcı beyanıdır.

## Kanıt zinciri

- `artifacts/validation/33-L-long-term-portfolio-boundary.json`
- `artifacts/validation/33-L-long-term-portfolio-contract.json`
- `artifacts/validation/33-L-long-term-portfolio-runtime.json`
- `packages/application/tests/long-term-portfolio-security.test.ts`
- `packages/repositories/long-term-portfolio-repository-policy.test.ts`
- `apps/desktop/tests/b4-long-term-portfolio-ipc-integration.test.ts`
- `docs/security/THREAT_MODEL_33_L_LONG_TERM_PORTFOLIO.md`
- `config/33-l-long-term-portfolio-scope.json`
- `config/33-l-long-term-portfolio-inventory.json`

Doğrulama özeti: boundary 28/28, contract 13/13, runtime 11/11, hedefli güvenlik/IPC
39/39, tam Vitest 130/130 dosya ve 1.083/1.083 test, üretim build 18/18 workspace PASS.
Migration 89 checksum değeri
`1e52fa04e4720830ff3300ceb5a71f78aee216c073b4f4786e393fa45063bbe0` olarak bağlandı.

Kalıcı receipt, yerel ve D: geri-okuma, güncel ana kaynak koruması, Git yedeği ve
GitHub `main` HEAD eşitliği ayrıca mühürlenmeden resmî 33-L tamamlanma iddiası yapılmaz.
