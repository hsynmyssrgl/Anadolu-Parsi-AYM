# Bronze Gereksinim ve Karar İzlenebilirliği — Build 183

**Aktif sürüm:** 02.08.2026.228

Bu matris, aktif kararları kaynak, kullanıcı akışı ve gerçek kanıtla eşleştirir.
`Karşılandı` ifadesi promotion kapılarının tamamlandığı anlamına gelmez.

## Ürün ve veri kapsamı

| Karar/gereksinim | Durum | Kaynak karşılığı | Kanıt / takip |
|---|---|---|---|
| Güncel ürün adı Anadolu Parsı Aile Yaşam Merkezi | Karşılandı | APP_META, installer, renderer, veri yolu ve marka varlıkları | Build 124 ürün sözleşmesi |
| Yatırım uygulaması kapsam dışı | Belgelendi | Aktif kapsam ve ana karar kaydı | Build 127 belge sözleşmesi |
| Aile, kişi, hesap, hane, dal ve üyelik ayrımı | Karşılandı | Domain/repository ve family-membership akışları | Family/membership testleri |
| Yetişkin özel veri sahipliği | Karşılandı | Nesne düzeyi authorization | Authorization/audit testleri |
| 17 ürün modülü + 5 yönetişim yüzeyi = 22 rotalı gerçek uygulama kabuğu | Karşılandı | Paylaşılan domain navigasyon sözleşmesi, `App.tsx` menü ve ekran dispatch akışları | DEC-208 ve 32-W fail-closed ürün yüzeyi kanıtları |
| Kişisel/aile ortak olay ağı | Karşılandı | Timeline domain/use-case/repository | Timeline testleri ve ADR-006 |
| Olay tam yaşam döngüsü | Karşılandı | Create/edit/search/filter/archive/restore | Build 125 — 42 assertion, 60 test |
| Etkinlik–arşiv bağlantısı | Karşılandı | Event filtreli arşiv sorgusu | Build 122 regresyon testi |
| Finans sahiplik yüzdesi ve özel veri ayrımı | Kaynakta karşılandı | Mahremiyet farkındalıklı finance adapter/use-case ve merkezi authorization | Build 133 hassas kayıt mahremiyet sınırı; Silver UAT genişletilecek |
| Sağlık ayrı hassas izin alanı | Kaynakta karşılandı | Mahremiyet farkındalıklı health adapter/use-case ve merkezi authorization | Build 133 hassas kayıt mahremiyet sınırı; Silver UAT genişletilecek |
| Dijital miras çoklu onay/rollback | Karşılandı | Legacy use-case/repository | Legacy doğrulama kapıları |

## Mimari ve güvenlik

| Karar/gereksinim | Durum | Kaynak karşılığı | Kanıt / takip |
|---|---|---|---|
| Modüler monolit ve katman yönü | Karşılandı | Workspace paketleri | Repository/workspace contracts |
| Application katmanında ham SQL yok | Karşılandı | Repository port ve composition root | Build 99–107 mimari doğrulamaları |
| Yerel-öncelikli SQLite + şifreli kasa | Karşılandı | Database/repositories/vault | Database ve archive testleri |
| Varsayılan reddetme | Karşılandı | Authz, Electron session, IPC | Build 118–120 sözleşmeleri |
| IPC sender ve payload sınırı | Karşılandı | Main-frame/document/payload validation | Build 118/120 assertions |
| Webview/download/navigation reddi | Karşılandı | Renderer session policy | Build 119 — 33 assertion |
| B2-03 erişilebilir idle lock ve yeniden doğrulama | Karşılandı | 15 dakika/60 saniye session state, gerçek input activity IPC, mounted lock overlay, parola ve etkin TOTP yeniden doğrulaması | DEC-209 ve 32-X session unit/application/integration kanıtları |
| B2-04 Electron özel protokol, CSP ve fuse kapanışı | Karşılandı | `pardus-app://renderer`, kök yol hapsi, response CSP, sandbox/context isolation ve Electron 43 dokuz-fuse afterPack/readback | DEC-209 ve 32-X gerçek Electron ikili 9/9 kanıtı |
| TOTP ve güvenilir cihaz | Karşılandı | Auth security adapter/repositories | MFA/trusted-device tests |
| Cihaz özel anahtarının OS korumalı saklanması | Kaynakta karşılandı | `device-secret-protector.ts`, şifreli zarf ve legacy migration | Build 128 güvenlik sözleşmesi; gerçek Windows DPAPI açılışı bekliyor |
| TOTP sırrının OS korumalı saklanması | Kaynakta karşılandı | `mfa-secret-protection.ts`, auth adapter ve atomik repository migration | Build 129 sözleşmesi; gerçek Windows DPAPI migration kanıtı bekliyor |
| Dijital arşiv kasa anahtarının OS korumalı saklanması | Kaynakta karşılandı | `archive-vault-key-provider.ts`, archive/full-backup adapter composition ve legacy migration | Build 135 sözleşme/runtime; gerçek Windows DPAPI migration ve cihazlar arası yeniden sarma kanıtı bekliyor |
| Başlangıç OS sır koruması ve sandbox kapısı | Kaynakta karşılandı | `startup-security-preflight.ts`, `renderer-window-security.ts`, `app.enableSandbox()` | Build 132 başlangıç güvenlik kapısı; gerçek Windows development/paketli iki süreç kanıtı bekliyor |
| Restore sonrası yeniden cihaz yetkisi | Kaynakta karşılandı | Durable restore journal, staged DB trust revocation, restart marker | Build 131 sözleşme/runtime kanıtı; gerçek Windows Final provası bekliyor |
| AI izin sınırı | Karşılandı | Consent/use-case, hassas nesnelerde açık `ai_process` izni | Build 133 policy runtime + AI consent tests |
| Audit append-only/hash zinciri | Karşılandı | Audit repositories | Audit integrity tests |

## UI/UX ve erişilebilirlik

| Karar/gereksinim | Durum | Kaynak karşılığı | Kanıt / takip |
|---|---|---|---|
| Apple esintili özgün kabuk | Karşılandı | Renderer shell/styles | Build 123/124 |
| Açık/koyu tema ve daraltılabilir menü | Karşılandı | Local preference state | Build 123 UI contract |
| Komut araması/bildirim/profil menüsü | Karşılandı | Renderer interactions | Build 123 UI contract |
| Merkezi Apple sistem font zinciri | Karşılandı | `typography.css` | Build 126 — 28 assertion |
| Semantik 34/28/22/20/17/15/13/11–12 px ölçek | Karşılandı | Typography tokens | Build 126 contract |
| 44 px temel etkileşim hedefi | Kaynakta karşılandı | Typography/control layer ve Build 134 genel etkileşim hedefi | Render edilmiş UI doğrulaması bekliyor |
| Klavye, ekran okuyucu, kontrast | Kaynakta karşılandı | Kalıcı erişilebilirlik tercihleri, bölüm odak/duyuru yönetimi, komut listbox/roving keyboard, forced-colors | Build 134 — 64 sözleşme + 19 runtime; gerçek renderer/ekran okuyucu/UAT bekliyor |

## Teslim ve sürüm yönetişimi

| Karar/gereksinim | Durum | Kanıt |
|---|---|---|
| Aktif sürüm drift engeli | Karşılandı | Build 108 |
| Cross-platform validation runner | Karşılandı | Build 109/121 |
| Clean install dış servis sınıflandırması | Karşılandı | Build 110/116/117 |
| Kaynak preflight ve manifest bütünlüğü | Karşılandı | Build 111/112 |
| Deterministik ZIP | Karşılandı | Build 113 |
| Aktif teslim belge sözleşmesi | Karşılandı | Build 114 |
| Ayrık teslim tasdiki | Karşılandı altyapı | Build 115 |
| PASS/FAIL/NOT_RUN dürüstlüğü | Karşılandı | RC2 gate runner ve aktif belgeler |
| Otomatik Final/Silver/Gold geçişinin engellenmesi | Belgelendi/korunuyor | Ana karar kaydı ve release governance |
| Kararların ilgili belgelere işlenmesi | Karşılandı | Build 127 document governance contract |
| OS korumalı cihaz kimliği kararı ve belge etkisi | Karşılandı | DEC-042, ADR-013 ve Build 128 sözleşmesi |

| Finans/sağlık özel nesne mahremiyeti | Kaynakta karşılandı | `privacy` + `sensitiveDomain`, owner/explicit grant ve deny precedence | Build 133 — sözleşme/runtime |

| Veri saklama, geri alınabilir silme ve iki aşamalı kalıcı imha | Kaynakta karşılandı | `data_retention_policies`, `data_lifecycle`, use-case/repository/IPC/UI | Build 136 — sözleşme ve 30/30 runtime; gerçek yedek yayılımı/UAT açık |


| Kalıcı imhanın yönetilen yedeklere doğrulanmış yayılımı | Kaynakta karşılandı | `backup_propagation_runs`, yönetilen yayılım use-case’i, görev kuyruğu, IPC/UI | Build 137 — sözleşme/runtime; gerçek Windows/harici disk/bulut kanıtı açık |

## Bronze Final promotion kapıları

| Kapı | Son bilinen kanıt | Build 137 durumu |
|---|---|---|
| Clean `npm ci` | Build 125 PASS | NOT_RUN — Build 137 için yeniden çalıştırılmadı |
| Tam `tsc --noEmit` | Build 125 PASS | NOT_RUN |
| Birim/entegrasyon testleri | Build 125 PASS — 60 test | NOT_RUN |
| Electron production build | Build 125 PASS | NOT_RUN |
| Blocking smoke | Build 125 PASS | NOT_RUN |
| Windows sandbox’lı açılış | Yönetilen hostta GPU/sandbox FAIL | NOT_RUN / açık blocker |
| Installer yaşam döngüsü | Tanısal PASS, resmî açılış bekliyor | NOT_RUN |
| Yedek/restore provası | Kısmi geçmiş kanıt | NOT_RUN |
| Erişilebilirlik/UAT/ekran kanıtı | Ertelendi | NOT_RUN |
| Installer imzası | Yok | Silver/dağıtım öncesi |

Build 137 yönetilen yedek imha yayılımı artırımıdır. Build 136 veri yaşam döngüsü yönetişimi korunur. Build 134 erişilebilirlik, Build 133 mahremiyet ve Build 132 başlangıç güvenlik sınırları korunur. Önceki build PASS sonuçları tarihsel kanıttır; Build 137 ağır doğrulaması olarak yeniden kullanılmaz.

| Kalıcı imhanın yönetilen eski yedeklere güvenli yayılımı | Kaynakta karşılandı | Önce doğrulanmış taze yedek, tombstone parmak izi, atomik karantina manifesti ve tüm-hedef tamamlama kapısı | Build 137 — sözleşme/runtime; gerçek Windows/harici disk/bulut provası açık |


## Build 138 yedek karantina yaşam döngüsü izlenebilirliği

| Gereksinim | Kaynak karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Karantina hemen silinmemeli | `backup_quarantine_policy`, `backup_quarantine_batches`, `retainUntil` | Build 138 contract/runtime | PASS |
| Erken imha engellenmeli | `DestroyBackupQuarantineBatchUseCase` tarih kontrolü | Runtime erken imha senaryosu | PASS |
| Hukuki bekletme uygulanmalı | `SetBackupQuarantineLegalHoldUseCase`, CAS repository güncellemesi | Runtime hold engelleme senaryosu | PASS |
| Kritik işlem güçlü doğrulama istemeli | `StrongAuthenticationPort` bağlantısı | Runtime auth sırası ve ret senaryoları | PASS |
| Kesin onay kimliğe bağlı olmalı | `KARANTİNA İMHA <batchId>` | Runtime yanlış onayın auth öncesi reddi | PASS |
| Dosya bütünlüğü imha öncesi doğrulanmalı | `FileSystemBackupQuarantineDestructionPort.#validateManifest` | Gerçek dosya sistemi hash bozulma senaryosu | PASS |
| Yarım işlem devam ettirilebilmeli | `.destroying-*`, `destruction-state.json`, receipt | Gerçek dosya sistemi resume/idempotency senaryoları | PASS |
| Renderer yönetimi erişilebilir köprüden geçmeli | IPC, preload, global API, `DataLifecycleSettings` | Renderer/bridge sözdizimi | PASS |
| Gerçek fiziksel imha iddiası kurulmamaları | ADR-023 ve güvenlik standardı | Belge sözleşmesi | PASS |
| Windows/SSD/bulut gerçek kanıtı | Haricî promotion kapısı | Henüz çalıştırılmadı | NOT_RUN |

## Build 139 uygulama dışı yedek envanteri izlenebilirliği

| Gereksinim | Kaynak karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Manuel/çevrimdışı/bulut geçmişi kopyaları görünür olmalı | `external_backup_copies`, repository ve use-case katmanı | Build 139 contract/runtime | PASS |
| Tarihsel veri riski ve inceleme tarihi izlenmeli | `contains_historical_data_risk`, `next_review_at` | Runtime özet ve teyit senaryoları | PASS |
| Teyit ve imha beyanı güçlü doğrulama istemeli | `StrongAuthenticationPort` bağlantısı | Runtime auth sırası ve ret senaryoları | PASS |
| Hukuki bekletme imha beyanını engellemeli | `setLegalHold`, `legal_hold=0` CAS koşulu | Runtime hold senaryosu | PASS |
| Kesin onay kayıt kimliğine bağlı olmalı | `HARİCİ YEDEK TEYİT/İMHA <copyId>` | Runtime yanlış onay reddi | PASS |
| Eşzamanlı değişiklikler korunmalı | `expectedUpdatedAt` repository koşulları | Sözleşme ve runtime conflict senaryosu | PASS |
| Kanıt özeti doğrulanmalı | 64 karakter küçük/büyük hex SHA-256 doğrulaması | Runtime geçersiz SHA reddi | PASS |
| Kullanıcı beyanı fiziksel imha sayılmamalı | UI açıklaması, güvenlik standardı, ADR-024 | Belge/renderer sözleşmesi | PASS |
| Gerçek çevrimdışı medya ve bulut sağlayıcı kanıtı | Haricî promotion kapısı | Henüz çalıştırılmadı | NOT_RUN |

## Build 140 imzalı haricî yedek imha kanıtı izlenebilirliği

| Gereksinim | Kod karşılığı | Kanıt | Durum |
|---|---|---|---|
| Kullanıcı beyanı ve doğrulanmış kanıt ayrılmalı | `evidenceVerificationStatus`, evidence repository/use-case | Build 140 contract/runtime | PASS |
| Yalnız güvenilen Ed25519 açık anahtarı kabul edilmeli | Node crypto adapter ve issuer use-case | Özel/RSA anahtar ret senaryosu | PASS |
| Makbuz sabit kanonik içeriği imzalamalı | `canonicalExternalBackupDestructionReceipt` | Gerçek Ed25519 sign/verify runtime | PASS |
| Replay, tarih ve hukuki bekletme fail-closed olmalı | Duplicate receipt, timestamp ve legal-hold kontrolleri | Runtime senaryoları | PASS |
| Sağlayıcı iptali bağlı kanıta yayılmalı | Repository transaction ve `revoked` durumları | Runtime iptal yayılımı | PASS |
| Fiziksel imha ayrı kanıt kapısı olmalı | UI, ADR-025 ve güvenlik standardı | Belge/renderer sözleşmesi | PASS |
| Gerçek sağlayıcı API ve fiziksel imha kanıtı | Haricî promotion kapısı | Henüz çalıştırılmadı | NOT_RUN |

## Build 141 imzalı sağlayıcı anahtarı döndürme izlenebilirliği

| Gereksinim | Kod karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Yeni anahtar önceki anahtarla yetkilendirilmeli | `canonicalExternalBackupEvidenceKeyRotation`, `RotateExternalBackupEvidenceIssuerUseCase` | Build 141 contract/runtime | PASS |
| Kesim anı atomik ve çakışmasız olmalı | Repository `rotateEvidenceIssuer`, CAS `expectedPredecessorUpdatedAt` | Sözleşme ve runtime | PASS |
| Aynı anahtar/makbuz tekrar kullanılamamalı | Fingerprint ve rotation receipt sorguları | Runtime replay/collision retleri | PASS |
| Makbuz-zamanı güveni uygulanmalı | `externalBackupEvidenceIssuerTrustedAt` | Kesim öncesi/sonrası runtime | PASS |
| Güçlü doğrulama ve kesin onay zorunlu olmalı | `KANIT ANAHTARI DÖNDÜR <issuerId>` ve `StrongAuthenticationPort` | Runtime auth sırası | PASS |
| Döndürme geçmişi kullanıcıya gösterilmeli | Electron IPC, preload ve renderer geçmiş bölümü | Renderer/bridge syntax | PASS |
| Gerçek sağlayıcı anahtar yönetimi ve çevrimiçi iptal | Haricî promotion kapısı | Henüz çalıştırılmadı | NOT_RUN |

## Build 142 imzalı sağlayıcı iptal listesi izlenebilirliği

| Gereksinim | Kod karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Liste Ed25519 ile doğrulanmalı | `canonicalExternalBackupEvidenceRevocationList`, `ApplyExternalBackupEvidenceRevocationListUseCase` | Build 142 contract/runtime | PASS |
| Sıra numarası geri alma saldırısını engellemeli | Son güncel liste sorgusu ve repository monoton sequence sınırı | Runtime rollback/replay retleri | PASS |
| Geçerlilik penceresi fail-closed olmalı | `thisUpdate`, `nextUpdate`, 31 günlük üst sınır | Runtime süre/gelecek senaryoları | PASS |
| Hedefler aynı güven zincirinde olmalı | Kök sağlayıcı çözümlemesi ve zincir kapsam kontrolü | Runtime foreign-chain reddi | PASS |
| Uygulama atomik ve denetlenebilir olmalı | Repository `applyEvidenceRevocationList` transaction akışı | Sözleşme ve runtime | PASS |
| Güçlü doğrulama ve kesin onay zorunlu olmalı | `KANIT İPTAL LİSTESİ <issuerId> <sequence>` | Runtime auth sırası | PASS |
| Liste geçmişi kullanıcıya gösterilmeli | Electron IPC, preload ve renderer listesi | Renderer/bridge syntax | PASS |
| Gerçek HTTPS sağlayıcı senkronizasyonu | Haricî promotion kapısı | Uygulanmadı/çalıştırılmadı | NOT_RUN |


## Build 143–144 ağ güveni izlenebilirliği

| Karar/gereksinim | Durum | Kaynak karşılığı | Kanıt / takip |
|---|---|---|---|
| İptal listesi yalnız güvenli HTTPS sınırından alınır | Kaynakta karşılandı | `secure-revocation-list-fetcher.ts` | Build 143 hedefli sözleşme; gerçek sağlayıcı testi bekliyor |
| TLS kanalı SPKI SHA-256 pinleriyle sınırlandırılır | Kaynakta karşılandı | Secure fetcher ve endpoint profile use-case | Build 144 sözleşme/runtime |
| Renderer serbest URL/pin sağlayamaz | Kaynakta karşılandı | IPC, preload ve domain input sözleşmeleri | Build 144 renderer köprü kontrolü |
| Sertifika geçişi sınırlı çift-pin penceresi kullanır | Kaynakta karşılandı | `resolveExternalBackupRevocationEndpointPins` | Build 144 runtime; gerçek sertifika geçişi bekliyor |
| Ağdan alınan belge otomatik uygulanmaz | Karşılandı | Fetch/apply ayrımı ve Build 142 apply use-case | Build 142–144 devamlılığı |

## Build 147 büyük aile okuma modeli performans izlenebilirliği

| Gereksinim | Kod karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Büyük soy ağacı sınırsız yüklenmemeli | `LargeFamilyReadModelService.listTreePage`, `SqliteLargeFamilyReadModelRepository` | Build 147 contract ve SQL runtime | PASS |
| Offset yerine kararlı imleç kullanılmalı | Tree/timeline/archive cursor sözleşmeleri | Servis runtime sayfa çakışmama senaryoları | PASS |
| Sayfa boyutu sınırlanmalı | 20–200 sınırı, varsayılan 80 | Servis runtime sınır retleri | PASS |
| Zaman tüneli filtreleri veritabanında uygulanmalı | query/person/kind/year SQL koşulları | SQL runtime kişi/yıl/sıra senaryoları | PASS |
| Arşiv filtreleri veritabanında uygulanmalı | category/sensitivity/tag/MIME/event SQL koşulları | SQL runtime kategori/etiket/MIME senaryoları | PASS |
| Olay ve arşiv izinleri korunmalı | `canReadEvent`, `canReadArchiveItem` | Servis runtime izin filtreleri | PASS |
| Renderer tam arşiv listesini açılışta almamalı | `archiveRevision`, `listLargeArchive` | Build 147 sözleşme ve sözdizimi | PASS |
| Büyük sorgular indekslenmeli | Migration 25 performans indeksleri | `EXPLAIN QUERY PLAN` hedefli kontrolü | PASS |
| Üretim Windows/render performansı | Build 149 toplu doğrulama kapısı | Henüz çalıştırılmadı | NOT_RUN |

## Build 155 sınırlı başlangıç ve tembel yükleme izlenebilirliği

| Gereksinim | Kod karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Oturum açılışında tam aile snapshot'ı yüklenmemeli | `bootstrapAuthenticatedSession`, `snapshotFromOverview` | Build 155 contract | PASS |
| Aile grafiği ve zaman tüneli ayrı yüklenebilmeli | `data:getSnapshotSections`, `FamilySnapshotPatchView` | IPC/policy contract | PASS |
| Yinelenen bölüm istekleri birleştirilmeli | `snapshotSectionLoadsRef` | Build 155 contract | PASS |
| İkincil modüller yalnız ekran açıldığında yüklenmeli | `ensureAuxiliaryScreen` | Build 155 contract | PASS |
| Dashboard tam olay koleksiyonunu taşımamalı | SQL aggregate + `LIMIT 6` / `LIMIT 4` | Build 155 SQL runtime | PASS |
| Olay görünürlüğü sorgu içinde korunmalı | participant JSON ve allow/deny permission koşulları | Build 155 SQL runtime | PASS |
| Gerçek Windows açılış ve render süresi | Promotion/UAT kapısı | Henüz çalıştırılmadı | NOT_RUN |

## Build 156 arama destekli kişi/olay katalogları izlenebilirliği

| Gereksinim | Kod karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Aile ekranı tam kişi listesini yüklememeli | `FamilyScreen`, `usePersonCatalogData` | Build 156 contract ve renderer syntax | PASS |
| Kişi seçimi arama ve keyset sayfalama kullanmalı | `catalog:listPeople`, `PersonCatalogSelect` | SQL runtime + service runtime | PASS |
| Olay seçimi arama/filtre ve keyset sayfalama kullanmalı | `catalog:listEvents`, `EventCatalogSelect` | SQL runtime + service runtime | PASS |
| Seçili kimlik tam koleksiyon olmadan çözümlenmeli | `catalog:lookup` | Service runtime bounded lookup | PASS |
| Katalog imleci kullanıcı ve filtre kapsamına bağlı olmalı | `EntityCatalogService.scopeHash` | Service runtime cursor mismatch senaryoları | PASS |
| Olay izinleri katalog ve lookup'ta korunmalı | `canReadEvent` | Service runtime izin filtresi | PASS |
| Sayfa/arama/lookup sınırları IPC'de uygulanmalı | `ipc-integration-policy.ts` | IPC policy runtime | PASS |
| Gerçek Windows render ve tam build performansı | Promotion/UAT kapısı | Bağımlılık yanıtı bekliyor | NOT_RUN |

## Build 158 oturum güvenli asenkron state izlenebilirliği

| Gereksinim | Kod karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Eski katalog yanıtı yeni sorguyu ezmemeli | `AsyncWriteGuard`, kişi/olay katalog kapsamları | Build 158 runtime ve contract | PASS |
| Ekran değişiminden sonra eski sayfa state yazmamalı | tree/timeline/archive kapsam biletleri | Build 158 contract ve syntax | PASS |
| Oturum değişiminde bekleyen tüm yazılar geçersiz olmalı | `invalidateAll`, auth/session bootstrap kapsamları | Build 158 runtime | PASS |
| Eski mutasyon yeni revizyonu geri alamamalı | `MutationRevisionWatermark` | Build 158 runtime | PASS |
| Snapshot mutasyondan sonra eski veri yazmamalı | `snapshot:graph/timeline` invalidation ve retry | Build 158 contract | PASS |
| Tam production build ve Windows yaşam döngüsü | Geniş promotion kapıları | Bağımlılık yanıtı bekliyor | NOT_RUN |

## Build 159 uçtan uca IPC taşıma izlenebilirliği

| Gereksinim | Uygulama | Kanıt | Durum |
|---|---|---|---|
| Yanıt benzersiz isteğe bağlı olmalı | `IpcTransportRequestContext`, response envelope | Build 159 contract/runtime | PASS |
| Eski oturum çağı ana süreç ve preload'da reddedilmeli | `IpcTransportSessionRegistry`, `unwrapIpcTransportResponse` | Build 159 runtime | PASS |
| Yinelenen istek kimliği reddedilmeli | bounded request-id window | Build 159 runtime | PASS |
| Uygulama argümanları taşıma metadata'sından ayrılmalı | `handlerArguments = rawArguments.slice(1)` | Build 159 contract | PASS |
| 183 kanal aynı sarmalayıcıdan geçmeli | preload `invoke` helper ve kanal parity | Build 159 syntax | PASS |

## Build 160 iptal edilebilir IPC yaşam döngüsü izlenebilirliği

| Gereksinim | Kod karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Aynı kanaldaki eski okuma ana süreçte sonlandırılmalı | preload latest-wins registry, `transport:cancel` | Build 160 contract/runtime | PASS |
| Süre aşımı bounded ve audit edilebilir olmalı | lifecycle policy, request lease timeout | Build 160 runtime | PASS |
| İptal başka oturum/isteğe uygulanmamalı | exact sender/session/epoch/request/channel doğrulaması | Build 160 runtime | PASS |
| Oturum ve pencere kapanışı aktif işleri temizlemeli | `transport:cancelAll`, `clearSender` | Build 160 contract/runtime | PASS |
| Mutasyonlar otomatik iptal edilmemeli | non-cancellable default policy | Build 160 runtime | PASS |
| Uzun HTTPS işi kooperatif iptal almalı | `getIpcRequestAbortSignal`, secure fetch/sync signal | Build 160 contract/syntax | PASS |
| Tam production ve Windows yaşam döngüsü | Geniş promotion kapıları | Bağımlılık yanıtı bekliyor | NOT_RUN |

## Build 162 revizyon kapsamlı IPC salt okuma paylaşımı izlenebilirliği

| Gereksinim | Kod karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Aynı kapsamlı eşzamanlı okuma tek yürütmeye inmeli | `IpcReadSharingClient`, `#inFlight` | Build 162 runtime | PASS |
| Oturum, argüman ve revizyon değişince paylaşım kesilmeli | `createIpcReadSharingKey` | Anahtar varyasyon runtime senaryoları | PASS |
| Cache göndericiler arasında paylaşılmamalı | `IpcReadResultCacheRegistry` sender map | Build 162 runtime | PASS |
| Mutasyon eski cache'i yeniden dolduramamalı | sender generation / expectedGeneration | Build 162 runtime | PASS |
| Sonuçlar çağıranlar arasında mutable paylaşılmamalı | `structuredClone` | Klon izolasyonu runtime | PASS |
| TTL, giriş ve byte sınırları uygulanmalı | sharing policy ve bounded registry | Build 162 contract/runtime | PASS |
| Mutasyon ve ağ senkronizasyonu paylaşım dışı olmalı | policy allowlist / invalidation classifier | Build 162 contract | PASS |
| Gerçek production performans kazancı | Geniş promotion kapıları | Bağımlılık yanıtı bekliyor | NOT_RUN |

## Build 163 izlenebilirliği

- IPC-PERF-01: p95 yanıt ve kuyruk bekleme ölçümü — `ipc-performance-telemetry.ts`
- IPC-PERF-02: süre aşımı ve geri basınç alarmı — Build 163 runtime doğrulaması
- IPC-PERF-03: veri minimizasyonu — ADR-038 ve Build 163 sözleşme doğrulaması
- IPC-PERF-04: Sistem Sağlığı görünümü — `SystemManagementScreen`

## Build 164 izlenebilirliği

- IPC-ADAPT-01: telemetriye bağlı fail-closed admission bütçesi — Build 164 sözleşme ve runtime doğrulaması
- IPC-ADAPT-02: tabanı aşmayan cache sınırları — ADR-039 ve Build 164 runtime doğrulaması
- IPC-ADAPT-03: geçersiz ölçümde büyümeme ve iki aşamalı recovery — Build 164 runtime doğrulaması
- IPC-ADAPT-04: kimlik/argüman/payload içermeyen karar görünümü — Build 164 sözleşme doğrulaması

## Build 165 — Adaptif IPC bütçe durum sürekliliği

| Gereksinim | Uygulama | Kanıt |
|---|---|---|
| Yeniden başlatmada son doğrulanmış adaptif mod korunmalı | `ipc-adaptive-resource-budget-state.ts` | Build 165 runtime testi |
| Bozuk/eski/farklı politika durumu uygulanmamalı | SHA-256 zinciri, sürüm/politika/tazelik doğrulaması | Build 165 sözleşme + runtime |
| Kalıcı yazma atomik ve dayanıklı olmalı | geçici dosya + `fsync` + rename, günlük `fsync` | Build 165 sözleşme |
| Günlük sınırlı ve gizlilik güvenli olmalı | girdi/byte sınırı, hash kontrollü compaction, PII/payload yok | Build 165 runtime |

## Build 166 — Adaptif IPC bütçe operatör kurtarma sınırı

| Gereksinim | Uygulama | Kanıt |
|---|---|---|
| Yetkili kullanıcı adaptif bütçeyi güvenli başlangıç moduna döndürebilmeli | `IpcAdaptiveResourceBudgetController.manualReset`, `system:resetIpcAdaptiveBudget` | `build166-ipc-adaptive-budget-operator-runtime.json` |
| Sıfırlama cache ve toplu telemetriyi temizlemeli | `ipcReadResults.clearAll`, `ipcPerformanceTelemetry.clear` | Build 166 sözleşme/runtime raporları |
| Teknik tanı paketi kullanıcı ve IPC payload verisi taşımamalı | `IpcAdaptiveResourceBudgetStateStore.exportDiagnosticBundle` | Build 166 runtime gizlilik kontrolleri |
| Tanı paketi bütünlüğü doğrulanabilmeli | Atomik JSON + `.sha256` | Build 166 runtime checksum kontrolleri |
| Karantina disk kullanımı sınırlı olmalı | Yaş ve adet tabanlı `pruneQuarantine` | Build 166 runtime retention kontrolleri |

## Build 167 — Adaptif IPC bakım oturumu sınırı

| Gereksinim | Uygulama | Kanıt |
|---|---|---|
| Operatör işlemi doğrudan çalıştırılmamalı | `system:beginIpcAdaptiveBudgetMaintenanceSession` | Build 167 sözleşme |
| Yetki işlem türüne bağlı olmalı | `IpcAdaptiveBudgetMaintenanceOperation` | Build 167 runtime operation mismatch |
| Yetki sender ve renderer oturumuna bağlı olmalı | `IpcAdaptiveBudgetMaintenanceSessionRegistry` | Build 167 runtime sender/renderer mismatch |
| Kimlik bağlamı değişince işlem reddedilmeli | SHA-256 auth fingerprint | Build 167 runtime auth mismatch |
| Yetki tek kullanımlık ve süre sınırlı olmalı | 90 saniye TTL, consumed state | Build 167 runtime replay/expiry |
| Pencere kapanınca bakım yetkisi temizlenmeli | `clearSender` | Build 167 sözleşme |
| Bakım işlemleri ayrı denetim olaylarına sahip olmalı | opened/consumed/rejected log events | Build 167 sözleşme |

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 179–180 katı karar izlenebilirliği

| Karar/gereksinim | Durum | Kaynak karşılığı | Kanıt / takip |
|---|---|---|---|
| Kanal rengine bağlı menü metni/ikon/hover/seçili durum | Karşılandı | `App.tsx`, `styles.css`, ADR-052 | Build 179 sözleşme/runtime/sözdizimi |
| Varsayılan kapsamlı aile yakınlık kataloğu | Karşılandı | `family-relationship-catalog.ts`, aile formu | Build 179 sözleşme/runtime |
| Referans kişiye göre ileri/ters bağın tek işlemde kurulması | Karşılandı | `CreateFamilyMemberUseCase` unit-of-work | Build 179 runtime |
| Silver/Gold planlı bütün ürün geliştirmelerinin Bronze’da yapılması | Bağlayıcı | `product-lifecycle-policy.ts`, `product-lifecycle-policy.json` | Build 180 politika sözleşmesi |
| Ağır API ertelemesinde Bronze-hazır port/adaptör/fallback/test/güvenlik sınırı | Bağlayıcı | `deferred-api-integrations.json` | Build 180 runtime ve sözleşme |
| Her kararın bütün aktif bilgi ve belgelere yayılması | Bağlayıcı | DEC-070, ADR-053, belge yetki matrisi | Build 180 belge tarama sözleşmesi |

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 kök güven doğrulama izlenebilirliği

| Gereksinim | Kod karşılığı | Hedefli kanıt | Durum |
|---|---|---|---|
| Kök anahtar yalnız iki bağımsız kurum dışı kanıtla eklenmeli | `RegisterExternalBackupEvidenceIssuerUseCase` | Build 182 contract/runtime | PASS |
| Beklenen SHA-256 parmak izi gerçek Ed25519 anahtarıyla birebir eşleşmeli | `inspectEd25519PublicKey`, `expectedFingerprintSha256` | Yanlış parmak izi runtime senaryosu | PASS |
| Aynı referans iki kanıt kanalı sayılamamalı | bağımsız referans karşılaştırması | Aynı kanal runtime senaryosu | PASS |
| Tanık ve kontrol zamanı zorunlu olmalı | domain input + migration 28 | Build 182 contract/runtime | PASS |
| Doğrulama makbuzu değişikliğe duyarlı olmalı | `canonicalExternalBackupEvidenceRootTrustVerification`, SHA-256 | Deterministik hash runtime | PASS |
| Eski ve döndürülmüş anahtarların kaynağı ayırt edilmeli | `legacy_unverified`, `rotation_inherited` | Repository/renderer contract | PASS |
| Gerçek insan/kurum doğrulaması ve Windows UAT | Silver doğrulama kampanyası | Gerçek dış kanıt bekliyor | NOT_RUN |
## Build 183 temiz yedek yeniden yazım izlenebilirliği

| Gereksinim | Uygulama | Kanıt | Durum |
|---|---|---|---|
| Süresi dolmuş tombstone seçimi | politika saklama süresi + lifecycle sorgusu | Build 183 contract/runtime | PASS |
| Doğrulanmış yeni yedek önce gelmeli | `executeManagedBackupPropagation` | Build 183 runtime | PASS |
| Eski yönetilen kopya karantinaya alınmalı | backup quarantine portu | Build 183 contract/runtime | PASS |
| Kesinti kalıcı geri çekilmeye dönüşmeli | migrasyon 29 + service recovery | Build 183 runtime | PASS |
| Kullanıcı görünür durum/tanı | IPC + Güvenlik Merkezi | Build 183 contract/syntax | PASS |

## Build 184 izlenebilirliği

| Gereksinim | Karar / ADR | Kaynak | Kanıt |
|---|---|---|---|
| Atomik temiz yedek sonuçlandırma | DEC-074 / ADR-057 | migration 30, repository complete/recover | Build 184 contract + SQLite runtime |
| Kalıcı çalışma defteri ve görünür geçmiş | DEC-074 / ADR-057 | domain/application/IPC/renderer | Build 184 runtime + syntax |
| Eski çalışma sahibi reddi | ADR-057 | repository owner checks | Build 184 SQLite runtime |

## Build 185 izlenebilirliği

| Gereksinim | Karar / ADR | Kaynak | Kanıt |
|---|---|---|---|
| Final zaman hedef işlemlerinden sonra alınmalı | DEC-075 / ADR-058 | `managed-backup-propagation-use-case.ts` | Build 185 runtime |
| Karantina zamanları monotonik ve hedef bazlı olmalı | ADR-058 | `captureChronology` | Build 185 runtime |
| Tombstone ve run tamamlanma zamanı aynı olmalı | DEC-075 | `completePending(..., completedAt)` | Build 185 SQLite runtime |
| Geriye giden/geçersiz saat fail-closed reddedilmeli | ADR-058 | monotonik doğrulama | Build 185 runtime |
| Desktop main süreç saati kullanmalı | DEC-075 | `performance.now()` | Build 185 contract/typecheck |

## Build 186 izlenebilirliği

| Gereksinim | Kaynak | Karar | Kanıt |
|---|---|---|---|
| Başarı/kısmi temiz-yedek sonucu propagation kimliği taşır | automatic-clean-backup-rewrite-service + SQLite triggers | DEC-076 / ADR-059 | Build 186 runtime + SQLite |
| Üst tamamlanma propagation tamamlanmasından önce olamaz | migration 31 | DEC-076 / ADR-059 | Build 186 SQLite |

## Build 187 izlenebilirliği

| Gereksinim | Kaynak | Karar | Kanıt |
|---|---|---|---|
| Saat geri alınsa da kesilmiş çalışma bırakılmalı | automatic-clean-backup-rewrite-service + repository | DEC-077 / ADR-060 | Build 187 runtime + SQLite |
| Kurtarma zamanı kalıcı başlangıçtan önce olamaz | repository safe floor | DEC-077 / ADR-060 | 20/20 runtime |
| Sonraki deneme tamamlanmadan önce olamaz | migration 32 triggers | DEC-077 / ADR-060 | 22/22 SQLite |
| Yeni claim eski geri çekilme zamanını taşımaz | repository claim SQL | DEC-077 | contract + SQLite |

## Build 188 izlenebilirliği

| Gereksinim | Kaynak | Karar | Kanıt |
|---|---|---|---|
| Yeni claim geçmiş politika kronolojisinden önce olamaz | automatic-clean-backup-rewrite-service + repository | DEC-078 / ADR-061 | Build 188 runtime + SQLite |
| Saat geri alınırsa durum güvenli zamanda yeniden hesaplanır | service status refresh | DEC-078 | 24/24 runtime |
| `nextAttemptAt` saat tabanına katılıp backoff'u aşamaz | claim floor helper + repository condition | ADR-061 | runtime |
| Çalışma başlangıcı ve saklama kesimi değiştirilemez | migration 33 triggers | DEC-078 | 26/26 SQLite |
| Aynı anda ikinci `running` defter kaydı olamaz | partial unique index | DEC-078 | SQLite runtime |

## Build 189 izlenebilirliği

DEC-079 → ADR-062 → operasyonel izolasyon sözleşmesi → uygulama/repository/migrasyon 34 → dört hedefli doğrulama kanıtı.


## Build 190 izlenebilirliği

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 izlenebilirliği

DEC-081 → servis trigger gecikme seçimi → repository kesinti kurtarması → migration 35 SQLite tetikleyicileri → Build 191 hedefli kanıtlar.

## Build 192 izlenebilirliği

`DEC-082` → `ADR-065` → manuel kullanılabilirlik teknik sözleşmesi → servis/repository/migrasyon 36 → hedefli davranış, SQLite ve TypeScript kanıtları → segmentli kaynak preflight → ayrık teslim tasdiki.



## Build 193 izlenebilirliği

DEC-083 → ADR-066 → repository claim doğrulaması → migrasyon 37 → Build 193 runtime/SQLite/syntax kanıtları. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 izlenebilirliği

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 izlenebilirliği

DEC-086 → ADR-069 → migrasyon 40 → Build 196 hedefli doğrulama zinciri.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 izlenebilirlik ekleri

| Gereksinim | Durum | Kanıt |
|---|---|---|
| 20.07.2026 provenance sınırı | Uygulandı | `config/project-constitution.json`, Build 208 contract |
| Production demo/kişisel seed = 0 | Uygulandı | `apps/desktop/src/main/data-store.ts`, clean-data gate |
| UI Görsel Referans Manifestosu | Uygulandı | `config/ui-visual-reference-manifest.json`, `docs/ui/` |
| Build-sonu ilerleme ve ETA | Uygulandı | `config/project-progress-model.json`, Build 208 progress report |
| Artifact Index + Master DOCX/PDF | Uygulandı | Build 208 documentation closure |

## Build 210 izlenebilirlik — Terminal clean-backup ledger immutability

| Gereksinim | Kod | Karar/ADR | Kanıt |
|---|---|---|---|
| Terminal UPDATE mutation reddi | Migrasyon 49 UPDATE trigger | DEC-100 / ADR-083 | Build210 contract + SQLite runtime |
| Terminal DELETE reddi | Migrasyon 49 DELETE trigger | DEC-100 / ADR-083 | Build210 SQLite runtime |
| INSERT OR REPLACE bypass reddi | Migrasyon 49 BEFORE INSERT guard | DEC-100 / ADR-083 | `recursive_triggers=0` SQLite runtime |
| No-op UPDATE korunması | `IS NOT` değişiklik predicate'i | ADR-083 | Build210 SQLite runtime |
| running→terminal korunması | Guard yalnız `OLD.status<>'running'` | Build197 + ADR-083 | Build210 SQLite runtime |
