# ParsYuva Aile Yaşam Merkezi — Güncel Karar, Kural ve İş Akışı Sicili

- Belge sürümü: **GUNCEL-2026-08-27-V5**
- Tarih: **27.08.2026**
- Görünür ürün sürümü: **Bronze 27.08.2026.52**
- Kaynak HEAD: `61f09ed5d138ea482a58449135bb10c1b65f88cd`
- Statü: **ACTIVE_CURRENT_MASTER_REFERENCE**
- Kararlar: **DEC-250–DEC-276**

> Bu sürüm geçmiş PDF/DOCX ve build kapanış belgelerinin üzerine yazmaz. Yerel PASS ile dış kabul kanıtını ayırır; NOT_RUN/PARTIAL/BLOCKED sonuçlarını tamamlanmış göstermez.

## 1. Denetim sonucu

- Aktif repo Word/PDF tarihsel taraması: **50 dosya / 25 çift / 50 okunabilir**.
- `C:\PPT\AYM` tüm belge türü taraması: **37023 dosya / 36854 okunabilir / 0 sorun**.
- Office/RTF/PDF: **872**; benzersiz içerik hash'i: **7585**; tekrar kopya: **29269**.
- Build209–228 master çiftleri ve eski Bronze aktif referans çifti tarihsel olarak korunmuştur.
- Karar dosyası: **185**; ADR: **107**; security/threat belgesi: **72**.
- Mevcut tam belge/config/kanıt envanteri: **2145** (yeni sürümden önceki indeks).

## 2. Yetki ve öncelik

1. Kanonik kural sicili ve Proje Anayasası
2. Aktif yönetişim, kullanıcı karar ve kabul edilmiş kapsam sicilleri
3. Güncel birleşik sicil ve aktif çalışma belgeleri
4. DEC/ADR/threat model ve makine okunur scope/inventory
5. Kaynak kod, test ve üretilmiş kanıt
6. Tarihsel build belgeleri (yalnız kendi zamanlarının kanıtı)

## 3. Kapsam ve kural özeti

- Gereksinim: **358** — COMPLETE 109, PARTIAL 25, FOUNDATION_STARTED 1, NOT_IMPLEMENTED 223.
- Kural sicili: **PPT-CANONICAL-RULE-REGISTRY-V29**, toplam 241, aktif 216, superseded 25, SHA-256 `103e269ab67eed8423a03b726d00bc36616660ca2f0f3c65eea3491103640936`.
- Kullanıcı karar defteri: **105** toplam kullanıcı kararı; **100** aktif, **5** superseded.

## 4. İş akışları

### Karar ve kural değişikliği

Açık kullanıcı kararı → aynı değişiklikte DEC kaydı + makine defteri + etkilenen aktif belgeler + iş listesi açık/kapalı/neden alanları → etki analizi → gerekiyorsa kanonik kural/scope ve kod → doğrulama → indeks/master DOCX/PDF. Eşzamanlılık eksikse karar veya iş tamamlandı sayılamaz; sessiz istisna ve waiver yoktur.

### Paket yürütme

Aynı anda tek paket/adım IN_PROGRESS olabilir. Paket, yerel PASS üretse bile dış ve manuel kabul kanıtı eksikse açık kalır. Sonraki paketin başlaması, öncekinin kalıcı receipt ve kabul koşullarına bağlıdır.

### Yetkilendirilmiş işlem

Oturum kimliği + hesap + kişi + aile + cihaz + güvenlik epoch + amaç + kaynak + hassasiyet merkezi PEP tarafından değerlendirilir; receipt/UoW/optimistic revision/audit/outbox aynı yönetilen işlem sınırında korunur.

### Veri yaşam döngüsü

Kaynak sınıflandırma → sahiplik ve saklama → erişim/işleme gözlemi → türetilmiş veri mirası → geri alınabilir silme → kaynak silme yayılımı → içeriksiz tombstone → yedek/haricî kopya için açık risk. Fiziksel güvenli silme garantisi verilmez.

### Kimlik ve cihaz

Passkey challenge ve doğrulama → cihaz/epoch bağlama → kayıp anahtar kurtarma → yerel oturum iptali. Federated kimlik yalnız yapılandırılmış ve güvenilen sağlayıcı/JWKS/ağ zinciriyle görünür; gerçek sağlayıcı testi yoksa PASS yoktur.

### Yerel OCR

Archive kaynağı PEP + ayrı hassas işleme rızası → main-only byte okuma → bounded child process → malware kapısı → sealed sonuç kasası → düzeltme/rerun lineage → source deletion propagation. PDF/malware/low privilege eksikleri fail-closed kalır.

### İletişim

Kimlik/politika → MLS/E2EE oturum → içerikten ayrı audit → mesaj/dosya yaşam döngüsü → çağrı preflight → açık kayıt rızası → medya retention → çeviri/altyazı. Gerçek provider/cihaz/ağ UAT olmadan üretim iddiası yoktur.

### Dağıtık çalışma

Windows tek-yazar yerel veri otoritesi → mutation log → node kimliği/mTLS → quorum/witness → snapshot/failover → istemci API/cache → operasyon ve DR. Yerel simülasyon gerçek çoklu node kanıtı değildir.

### Windows teslim

Governed preflight → typecheck/test/build → Electron fuse/ASAR doğrulama → imzalama/provenance → installer → kurulu uygulama açılışı → update/rollback → uninstall/residue → postflight. Sertifika veya lifecycle UAT eksikse dağıtım hazır sayılmaz.

### Belge güncelleme

Canlı kaynak ve JSON sicilleri taranır → açık/kapalı/neden matrisi güncellenir → Markdown tek kaynak oluşturulur → DOCX/PDF aynı veriden üretilir → bütün sayfalar render edilir → hash manifesti yenilenir → tarihsel belgeler korunur.

## 5. Paket iş listesi — açık/kapalı/neden

| Paket | Resmî durum | Yerel durum | Requirement PASS | Açık kalma nedeni | Eksik kanıt |
|---|---|---|---:|---|---|
| 33-M | COMPLETED | ACCEPTED_COMPLETED_WITH_PERSISTENT_RECEIPT | EVET | Kapalı: erişilebilirlik tercih merkezi için yerel zincir, doğrulama ve kalıcı kabul receipti tamamlandı. | Yok/yerel tamamlandı |
| 33-N | COMPLETED | ACCEPTED_COMPLETED_WITH_PERSISTENT_RECEIPT | EVET | Kapalı: taslak ve asenkron durum UX paketi için yerel zincir, doğrulama ve kalıcı kabul receipti tamamlandı. | Yok/yerel tamamlandı |
| 33-O | COMPLETED | ACCEPTED_COMPLETED_WITH_PERSISTENT_RECEIPT | EVET | Kapalı: gizlilik, sahiplik, veri hakları ve yerel olay kontrol paketi için yerel zincir, doğrulama ve kalıcı kabul receipti tamamlandı. | Yok/yerel tamamlandı |
| 33-P | IN_PROGRESS | IMPLEMENTED_LOCAL_AUTOMATED | HAYIR | Gerçek passkey/authenticator, canlı ve güvenilen federated kimlik sağlayıcısı, cross-device doğrulama, insan UAT ile gizlilik/kimlik incelemeleri tamamlanmadı. | liveProviderAccountTest, realAuthenticatorDevice, crossDeviceSync, credentialVerifierUat, humanUat, privacyReview, legalReview, identityReview |
| 33-Q | PLANNED | PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE | HAYIR | Varsayılan gerçek malware/PDF sağlayıcısı, doğrulanmış düşük-yetkili worker ve işletim sistemi ağ izolasyonu, gerçek Windows/Apple cihaz kabulü, denetlenmiş offline fallback ile haricî ve insan UAT kanıtları tamamlanmadı. Yerel eşzamanlı iptal, kaynak silme crash auto-resume, retention purge ve owner-bound zamanlanmış orphan sweep testleri PASS durumundadır. | realWindowsLocalOcr, realAppleVisionOcr, offlineFallback, maliciousDocumentMatrix, multilingualAndHandwriting, lowQualityAndAccessibility, crossDevice, legacyArchiveOwnershipReattestation (+5) |
| 33-R | PLANNED | LOCAL_FEATURE_COMPLETE_EXTERNAL_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek büyük arşiv, medya yaşam döngüsü, arama doğruluğu/performansı ve kullanıcı UAT kanıtları tamamlanmadı. | realUserArchiveEvidenceUat, realMediaVersionRecoveryUat, largeFamilyUnifiedSearchUat, accessibilityReview, privacyReview, legalReview, securityReview |
| 33-S | PLANNED | PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek sağlık/bakım sağlayıcıları, cihaz akışları, klinik doğruluk ve hukuk-gizlilik incelemesi tamamlanmadı. | realCaregiverUat, realElderlyUserUat, medicalProfessionalReview, sensorAdapterUat, emergencyContactDeliveryUat, accessibilityReview, privacyReview, legalReview (+1) |
| 33-T | PLANNED | LOCAL_FEATURE_COMPLETE_EXTERNAL_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek hane verisi, uzun süreli görev/teslimat akışı ve farklı kullanıcı profilleriyle UAT tamamlanmadı. | realFamilyHouseholdUat, realShoppingInventoryMealUat, realExpenseDeliveryGuestPetUat, nutritionAllergyReview, financialReview, accessibilityReview, privacyReview, legalReview (+1) |
| 33-U | PLANNED | LOCAL_FEATURE_COMPLETE_EXTERNAL_ACCEPTANCE_INCOMPLETE | HAYIR | Çocuk/veli mahremiyeti, okul/servis sağlayıcısı, yaşa uygun açıklama ve hukuk-gizlilik/UAT kanıtı tamamlanmadı. | realFamilyUat, childAndGuardianPrivacyReview, adolescentSafetyReview, legalPrivacyReview, realSchoolWorkflowUat, realCredentialPickupUat |
| 33-V | PLANNED | PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek harita, seyahat, araç/evcil hayvan sağlayıcıları, çevrimdışı saha akışı ve UAT tamamlanmadı. | realFamilyUat, realMapAndOfflineFallbackUat, realMovingInventoryUat, realPetWorkflowReview, realTravelWorkflowUat, legalPrivacyReview |
| 33-W | PLANNED | PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek AI sağlayıcısı, model/veri sözleşmesi, maliyet-mahremiyet sınırı, güvenlik değerlendirmesi ve insan UAT tamamlanmadı. | realFamilyUat, realProviderAndModelUat, speechAndTranslationUat, ocrClassificationUat, financialMedicalSafetyReview, privacyLegalReview |
| 33-X | PLANNED | PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek ses/transkript, yüz gruplama, basılı çıktı, zaman kapsülü rıza akışı ve insan UAT tamamlanmadı. | realFamilyMemoryUat, realMediaTranscriptionUat, realFaceGroupingUat, photoDuplicateDetectionUat, documentaryBookAndPrintUat, timeCapsuleReleaseAndRecoveryUat, multiAccountApprovalDiscoveryUat, terminalRetentionAndCapacityRecoveryReview (+1) |
| 33-Y | PLANNED | PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek Matter/enerji cihazları, üretici adaptörleri, güvenlik/safety değerlendirmesi ve saha UAT tamamlanmadı. | realMatterCommissioningUat, realSensorProviderUat, realEnergyMeterUat, realCameraDoorbellUat, realDeviceControlUat, privacyAndSafetyReview, legalReview |
| 33-Z | PLANNED | PARTIAL_LOCAL_CANDIDATE_REGISTRY_COMPOSED_ACCEPTANCE_INCOMPLETE | HAYIR | Üretim kod imzalama sertifikası, gerçek eklenti sağlayıcıları, dağıtım/rollback ve güven zinciri kanıtı tamamlanmadı. | productionSigningTrustProvisioning, productionCodeSigningCertificate, realSignedPackageAuthenticode, realSandboxRuntimeUat, realOsNetworkIsolationUat, realBankProviderUat, realSchoolProviderUat, realMatterProviderUat (+10) |
| 34-A | PLANNED | PARTIAL_LOCAL_POLICY_METADATA_FOUNDATION_COMPOSED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek MLS sağlayıcısı, çoklu istemci birlikte çalışabilirliği, cihaz kimliği ve haricî güvenlik incelemesi tamamlanmadı. | productionRfc9420Provider, rfc9420ConformanceSuite, realMultiDeviceForwardSecrecyUat, realPostCompromiseSecurityUat, realLostDeviceGroupRecoveryUat, realMessageEventSignatureUat, realRelayContentBlindnessUat, realNetworkDeliveryUat (+4) |
| 34-B | PLANNED | EXPANDED_LOCAL_COMPOSED_AND_TESTED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek çoklu istemci mesaj teslimi, presence, çevrimdışı/replay ve uzun süreli yaşam döngüsü UAT tamamlanmadı. | realTextMessageExchangeUat, realVoicePhotoVideoLocationDocumentUat, realMultiDevicePresenceAggregationUat, realScheduledReminderUat, realRelayDeliveryAndReceiptUat, messageSignatureVerificationUat, contentSearchAuthorizationUat, retentionExpiryAndOrphanSweepUat (+6) |
| 34-C | PLANNED | PARTIAL_LOCAL_COMPOSED_AND_TESTED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek WebRTC/SFU/TURN, kamera-mikrofon cihazları, ağ bozulması ve erişilebilir çağrı UAT tamamlanmadı. | realOneToOneCallUat, realGroupCallUat, realWebRtcSfuStunTurnUat, realSFrameMlsMediaBindingUat, realScreenShareUat, realBackgroundProcessingUat, realLiveCaptionAndRttUat, realDevicePreflightUat (+9) |
| 34-D | PLANNED | PARTIAL_LOCAL_COMPOSED_AND_TESTED_ACCEPTANCE_INCOMPLETE | HAYIR | Kayıt için gerçek katılımcı rızası, medya saklama/imha, hukuk-gizlilik incelemesi ve cihaz UAT tamamlanmadı. | realRecordingProviderUat, realAudioVideoRecordingUat, realTranscriptTranslationPersistenceUat, visibleRedIndicatorUat, audibleStartStopAnnouncementUat, lateJoinerPauseRealCaptureUat, e2eeRecorderRoleUat, encryptedMediaVaultHashSignatureUat (+6) |
| 34-E | PLANNED | PARTIAL_LOCAL_COMPOSED_AND_TESTED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek çeviri/altyazı sağlayıcısı, dil kalite ölçümü, cihaz performansı ve insan UAT tamamlanmadı. | realLocalLanguagePackUat, realLanguageDetectionUat, realTranslationUat, realSpeechToTextAndLiveCaptionUat, realSpeakerDiarizationUat, realTextToSpeechOriginalAudioUat, externalProviderPreviewConsentUat, encryptedCrossDevicePreferenceSyncUat (+5) |
| 34-F | PLANNED | PARTIAL_LOCAL_COMPOSED_AND_TESTED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek aile toplantısı, karar/rıza uyuşmazlığı, tutanak UAT ve hukuk-gizlilik incelemesi tamamlanmadı. | realMultiParticipantMeetingUat, realRecurringReminderUat, realRecordingConsentUat, realAiMinutesProviderUat, realEncryptedMinutesRecoveryUat, externalCalendarReminderUat, remoteCollaborationUat, privacyReview (+4) |
| 34-G | PLANNED | LOCAL_PRODUCTION_COMPOSITION_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek çoklu cihaz E2EE dosya aktarımı, büyük dosya/kesinti, sağlayıcı ve kullanıcı UAT tamamlanmadı. | realE2eeTransferUat, realMalwareScannerUat, safePreviewUat, remoteAssistanceUat, sharePlayUat, voiceExecutionUat, accessibilityReview, securityReview (+1) |
| 34-H | PLANNED | LOCAL_PRODUCTION_QUERY_COMPOSED_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek uzun süreli iletişim audit/arşiv bütünlüğü, saklama/imha ve bağımsız inceleme tamamlanmadı. | realRestoreDrill, remoteReplicationUat, externalBackupReview, securityReview |
| 34-I | PLANNED | LOCAL_HARDENED_FAIL_CLOSED_FOUNDATION_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek çoklu node quorum/witness/failover, mTLS kimliği, ağ bölünmesi ve uzun süreli soak tamamlanmadı. | realThreeNodeQuorum, realNetworkPartition, realWindowsServiceLifecycle, realMtlsPairing, realSnapshotBootstrap, realAutomaticFailover, localVolumeIdentityReview, securityReview |
| 34-J | PLANNED | LOCAL_HARDENED_FAIL_CLOSED_FOUNDATION_ACCEPTANCE_INCOMPLETE | HAYIR | Gerçek dağıtık istemciler, Apple companion, operasyon/felaket kurtarma ve saha provası tamamlanmadı. | realMdnsDiscovery, realRelayOrVpn, realAppleClient, realDifferentDeviceRestore, realRollingUpdate, realWindowsFaultMatrix, realBreakGlassRecovery, securityReview |
| 34-K | PLANNED | LOCAL_HARDENED_FAIL_CLOSED_FOUNDATION_ACCEPTANCE_INCOMPLETE | HAYIR | Animasyonlu kurulum, sesli Yardım Merkezi, DPAPI korumalı Core Service companion ve gerçek repository-backed anlık evrensel arama yerel kaynakta oluşturulup hedef testlerle doğrulandı. Production Authenticode sertifikası sağlanmadı; temiz işletim sistemi, signed installer, upgrade/repair/yeni uninstall-veri koruma, yeniden başlatma/güç kesintisi, 168 saat soak, üretim politika-zayıflatma doğrulayıcısı ve erişilebilirlik UAT tamamlanmadı. | productionCodeSigningCertificate, signedInstallerAndInstalledExecutableAuthenticode, realCleanInstall, realUpgrade, realRepair, realUninstallDataProtection, sevenDaySoak, productionPolicyWeakeningVerifier (+3) |
| 34-L | PLANNED_FINAL | LOCAL_CLOSURE_AUTOMATION_COMPOSED_ACCEPTANCE_BLOCKED | HAYIR | Bütün roadmap paketleri kabul edilmedi; gerçek Windows/dağıtık/Apple/uzak sağlayıcı/soak/sertifikasyon ve dış incelemeler NOT_RUN kaldı. | realWindowsLifecycle, sevenDaySoak, realMultiNodeConsensus, realAppleClients, realRemoteProviders, certification |

## 6. 34-L yerel kapanış gerçeği

- Boundary: PASS / 52 kontrol.
- Contract: PASS / 30 kontrol.
- Runtime: PASS / 182 kontrol.
- Full regression: PASS / 350 dosya / 2187 test.
- Production build: PASS / 18 workspace.
- Güncel Core Service companion: PASS_LOCAL_NOT_INSTALLER_ACCEPTANCE / 292 dosya / 1986 test / 2 normal paket açılışı.
- Güncel dağıtım imzası: NotSigned; yerel imzasız ParsYuva-Bronze-20.08.2026.37.exe üretildi ve aynı win-unpacked paketinin iki ardışık açılışı PASS verdi. Production sertifikası ve yükseltilmiş kurulu yaşam döngüsü PASS olmadığı için ticari dağıtım hazır sayılmaz.
- Buna rağmen allRoadmapPackagesAccepted=false, requirementsClosed=false ve countsAsRequirementPass=false.

## 7. Dış bağımlılıklar ve neden açık

- **Üretim sertifikası ve provenance:** Authenticode/kod imzalama sertifikası, güvenilir zaman damgası ve üretim provenance kanıtı yoksa installer yayıma hazır sayılamaz.
- **Gerçek cihaz ve sağlayıcı UAT:** Passkey/authenticator, Windows cihazları, kamera/mikrofon, Matter, OCR/AI/çeviri, OIDC, WebRTC/SFU/TURN, bulut/kurum bağlantıları ve Apple istemcileri gerçek ortamda sınanmalıdır.
- **Gerçek dağıtık sistem:** En az gerçek çoklu node, quorum/witness, mTLS, ağ bölünmesi, failover, snapshot ve felaket kurtarma provası gerekir.
- **Uzun süreli işletim:** 168 saat soak, yeniden başlatma, güç kesintisi, disk doluluğu, saat değişimi, uyku/uyanma ve güncelleme/rollback kanıtları gerekir.
- **Hukuk ve gizlilik:** Saklama/imha süreleri, çocuk/sağlık/iletişim kaydı, delil niteliği, sağlayıcı sözleşmeleri ve ülke bazlı yükümlülükler uzman incelemesi olmadan ürün gerçeği olarak sunulamaz.
- **İnsan ve erişilebilirlik UAT:** Narrator, büyütme, klavye, contrast, metin taşması, çocuk/yetişkin/ileri yaş/bakım veren profilleri ve gerçek kritik akışlar insanlarla doğrulanmalıdır.

## 8. Belge sapmaları ve yapılan düzeltmeler

- Aktif kapsam toplamı 344 → 358 olarak düzeltildi ve durum dağılımı eklendi.
- Kanonik kural sicili V10/214/194 ve güncel SHA ile ParsYuva marka, kurumsallaşma, platform ve belge sınıflandırma kurallarına yükseltildi.
- Kullanıcı karar defteri 83 kayda yükseltildi; DEC-254 marka uyumluluğu ve kurumsallaşma kararını bağladı.
- Platform mimarisindeki 'OCR/iletişim başlamadı' anlatımı yerel bileşim var fakat kabul dış kanıta bağlı şeklinde düzeltildi.
- Yol haritasına her açık paket için yerel uygulama durumu, açık kalma nedeni, eksik kanıt ve requirement PASS alanları eklendi.
- Görsel sözleşme 17 px body, exact Bronze/Silver/Gold tokenları ve onaylı 512 px sıcak-bronz logo SHA'sıyla hizalandı.
- Geçici .tmp/.tmp-runtime-dist içeriğinin aktif belge envanterine girmesi engellendi.
- Build209–228 ve eski Bronze master çiftleri tarihsel olarak korundu; yeni sürüm ayrı adla oluşturuldu.
- Word/PDF dışındaki RTF, Markdown, JSON/YAML, TXT, CSV ve HTML kayıtları da kök klasör düzeyinde hash ve okunabilirlik denetimine alındı; Excel/PowerPoint bulunmadığı açıkça kaydedildi.
- Her yeni kararın DEC, makine defteri, etkilenen belgeler ve açık/kapalı iş gerekçeleriyle aynı değişiklikte güncellenmesi fail-closed kurala bağlandı.
- Bu kapsamlı tarama tarihsel kayıtların son içerik temelidir; DEC-252 gereği gelecekte eski build/arşiv/checkpoint içeriği yeniden denetlenmeyecek, yalnız değişmez HISTORICAL kayıt olarak korunacaktır.
- Core Service companion ASAR paketine bağlandı; güncel tam regresyonda 350/350 test dosyası ve 2187/2187 test, root typecheck/build ve aynı profilde iki ardışık normal win-unpacked açılışı PASS verdi. Production Authenticode sertifikası bulunmadığından signed installer/kurulu yaşam döngüsü açık bırakıldı.
- EK-001–EK-019 tarihsel karar tamponu DEC-260 ile ana sicillere bağlandı; daha yeni ParsYuva, dil ve kurulum kararları çatışmada üstün tutuldu.
- Kanonik kural sicili V16/228/207 durumuna yükseltildi; tam ParsYuva Aile Yaşam Merkezi adı, sürüm paleti, parola görünürlüğü, installer yaşam döngüsü, aylık build, deneme/Gold, kaldırma-sıfırlama, tepsi ve migration/rollback kararları fail-closed kapılara bağlandı.
- DEC-261 ile AYM kısaltması güncel kullanıcı yüzeylerinden kaldırıldı; yalnız tarihsel kayıtlar ve değiştirilemeyen teknik uyumluluk yolları güncel marka olmadığı açıkça belirtilerek korunur.
- DEC-262 ile Windows kurulum hedefi C:\Program Files\PPT\ParsYuva, ana program ve kısayol adı ParsYuva, teslim adı ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe olarak sabitlendi.
- DEC-271 ile güncel kanal program kökleri legacy dizinin dışındaki C:\Program Files\PPT\ParsYuva-<Kanal> kardeş yollarına taşındı; AppData ParsYuva/<Kanal> ve diğer kanal yalıtımı korunurken otomatik legacy veri migration veya silme yasaklandı.
- DEC-272 ile sürüm tahsisi exact expected release ID alan açık tek mutasyon oldu; preview yazmaz, uyuşmazlık yazım ve temizliğe geçmeden durur, signed/local/dir yalnız önceden tahsisli exact current kimliğini tüketir.
- DEC-273 ile Windows installer teslimi metadata-only kanonik UAT110 gerçek N→N+1 ve same-version maintenance koruması ile source/package/expected release bağlı schema2 kurulu ön yüz UAT111 makbuzuna bağlandı.
- DEC-274/PR-239 ile Windows teslim zinciri canlı PR-235 readback, schema2 package provenance, Bronze 50 bootstrap veya normal Bronze 52+ exact sibling continuation modlu UAT110 V3, installer-experience V2, parent-run bağlı UAT111 V3 ve final V3 geri-okuma kapılarıyla adversarial olarak güçlendirildi; exact Bronze 51 recovery modu DEC-276/PR-241 ile ayrıca ayrıldı.
- PR-235 ile en küçük değişiklik dahi exact değişen yol, bağımlı kural/karar/belge/manifest/ratchet/test/UAT kayıtları ve aynı temiz committe hedefli-tam-bütünlük kanıtlarıyla fail-closed eşlemeye bağlandı.
- PR-235 BOOTSTRAP_ADOPTION diff tabanı sabit kalırken producer yalnız pointer sourceCommit kayıt commitinde external-pointer exact eşitliği ve baseCommit → pointer.sourceCommit → HEAD ancestry ile; normal PRE_MUTATION producer ise kendi baseline commitinde doğrulanır.
- PR-239 UAT111 kapsamı Git'te izlenen TypeScript kanonik rota otoritesi, tüm görünür ve uygun kontrollerin dinamik outcome matrisi, gerçek native CANCEL/ACCEPT ve exclusive reparse-korumalı kanıt köküyle güncellendi.
- PR-240 filtresiz tam regresyon guard hatası 4c6652e0 ile korunmuştur. PPK-022 masaüstü başlangıç zincirinde --no-write aktarımı çağrı, sarmalayıcı ve son makbuz üreticilerinde kapatılmış; kaynak regresyonu 1 dosya/6 test, çalışma 51/51, sözleşme 41/41 ve uçtan uca PPK-022 24/24 PASS verirken 1.571 doğrulama dosyasında sıfır değişiklik kanıtlanmıştır. Bundled render aracının yinelenen LibreOffice PATH hatası 6ec632c8 ile korunmuş, mutlak LibreOffice/Poppler yollarıyla ana belge 28/28 sayfa görsel QA PASS vermiştir.
- PR-240 hedefli test üreticisinin zorunlu açık test listesi verilmeden çağrılması 4c8b6b7d ile fail-closed korunmuştur. Etki değerlendirmesi ve analizi 577 değişen yol ile 94 test dosyasını PASS hesaplamıştır; yeni exact koşu bu 94 dosyayı analizden türetilen sırayla açıkça aktarır ve ret PASS olarak yorumlanmaz.
- PR-240 kanonik Git-index üretimi ile varsayılan canlı-ağaç doğrulama modu uyuşmazlığı 47f441e1 ile fail-closed korunmuştur. Eş --git-index --no-report doğrulaması 13.146 kontrol/4.407 dosya/2.143 belge ve kaynak bütünlüğü 4.868/4.868 dosya/4.869 SHA PASS vermiştir; yanlış-mod ret PASS değildir.
- PR-240 Bronze runtime önkoşul zinciri 703be65a, 0a118f5f ve 7fb288cd ile; 33-Y/33-Z/34-A alt süreç no-write sızıntısı ddb1abff ile fail-closed korunmuştur. Paket/core-service/desktop çıktılarından sonra 16/16 ek runtime PASS; ortak no-write aktarımından sonra 1 dosya/6 test, üç runtime ve üç byte-exact manifest SHA karşılaştırması PASS vermiştir. Yeni exact commit tam regresyonunun yerine geçmez.
- PR-240 güncel master DOCX ilk PNG renderında bundled Poppler yolunun çözülememesi dd675310 ile fail-closed korunmuştur. Exact Poppler/LibreOffice retry 28/28 sayfa üretmiş; 10–25 byte-identical, değişen 1–9 ve 26–28 sayfalar özgün çözünürlükte görsel QA PASS vermiştir.
- PR-240 release kaynak bütünlüğü doğrulayıcısının ana app çalışma ağacında çağrılması 99ad48dd ile fail-closed korunmuştur. Bu ret ürün kaynak bozulması değildir; exact Bronze çalışma ağacındaki retry PASS olmadan paket üretilemez.
- PR-240 final master DOCX 0669cb38 kaynak commitinden exact bundled LibreOffice/Poppler yollarıyla 28/28 sayfa render ve görsel QA PASS vermiştir; 2–6 byte-exact aynı, değişen 1 ve 7–28 özgün çözünürlükte kusursuzdur.
- PR-240 exact 80cf2a39 Bronze koşusunda hedefli 94 dosya/598 test ve filtresiz 398 dosya/2.469 test PASS sonrasında 33-R alt sürecinin migration manifestinde yalnız generatedAt değiştirmesi c7a3c130 ile fail-closed korunmuştur. Dört alt doğrulayıcıya no-write aktarımı eklendikten sonra odaklı 1 dosya/6 test ve gerçek 33-R matrisi 11/11, 8 dosya/30 test PASS; manifest SHA byte-exact değişmezdir. Yeni temiz exact commit tam regresyonunun yerine geçmez.
- PR-240 exact bfb6db9f Bronze koşusunda hedefli 94 dosya/598 test ve filtresiz 398 dosya/2.469 test PASS iken üreticinin direct-node çağrısı npm ortam bağını kaldırdığı için 171 ek komuttan 34-B/C/D/F FAIL olmuş ve 51316ac3 ile korunmuştur. Kanonik npm ortamında 34-B 13/13, 5 dosya/30 test PASS; final tur yalnız resmi npm scriptiyle yeniden çalıştırılır.
- PR-240 c02744cd exact Bronze resmi npm tam regresyonu 398 dosya/2.469 test ve 171/171 ek komut PASS vermiştir. Kaynak bütünlüğü 683 eksik Git-dışı manifest payloadı ve linked-worktree .git yönetim dosyasının yanlış kaynak sayılması nedeniyle 684 bulguyla FAIL olmuş ve 7d67fcff ile korunmuştur. Kanal kurulumu üç ayrı kanala güvenli yol/normal dosya/byte/SHA-256/atomik readback bağlı payload eşitlemesi yapar; kaynak toplayıcı .git dosya ve klasörünü dışlar. Odaklı 2 dosya/9 test PASS; yeni exact kapılar zorunludur.
- PR-240 96b9faac kaynaklı güncel ana DOCX ilk PNG renderında yanlış bundled PATH nedeniyle Poppler pdfinfo çözülememiş ve e5787764 ile fail-closed korunmuştur. Doğru native\poppler\Library\bin ve LibreOffice yollarıyla retry 28/28 sayfa üretmiş; bütün sayfalar temas sayfalarında, metin yoğun 6–7 ve tablo yoğun 27–28 ayrıca özgün çözünürlükte taşma, örtüşme, kesilme, font ve bozuk karakter açısından görsel QA PASS vermiştir.
- PR-240 kapanış kayıtlarını içeren 7f866e69 kaynak commitinden final master DOCX doğru native Poppler/LibreOffice zinciriyle 29/29 sayfa görsel QA PASS vermiştir. Tüm sayfalar beş temas sayfasında; 6–7 ve yoğun kural/envanter tablolarını taşıyan 26–29 ayrıca özgün çözünürlükte kusursuzdur.
- PR-240 d421c299 exact Bronze turunda hedefli 95 dosya/600 test, filtresiz 399 dosya/2.471 test, 172/172 ek komut ve 4.869/4.869 kaynak bütünlüğü PASS sonrasında governed preflight; önce güncel retention/görünür sürüm makbuzu eksikliğini 607a9a53, ardından tamamlanmış çalışma adımlarının 1.428 kanıt yolundan 803 Git-dışı checkpoint payload dosyasının kanal eksikliğini 8b2b5ccc ile fail-closed korumuştur. Kanal kurulumu tamamlanmış localEvidence ve persistent receipt yollarını tracked/manifest dışlamalı kanonik yol, normal dosya, SHA-256, atomik yazım ve readback ile üç kanala eşitler. Seçici 809 yol, odaklı 1 dosya/9 test ve ticari temel 1.234 kontrol PASS; yeni exact preflight PASS olmadan paket yoktur.
- PR-240 0f0a4653 exact Bronze etki analizi 95 hedefli test dosyası hesaplamış; hedefli turda 600 test PASS iken operation-rule-check-policy current-mutation preflightStatus alanındaki tarihsel 607a9a53/8b2b5ccc FAIL metnini reddetmiş ve 50f4d9e5 ile fail-closed korunmuştur. Tarihsel retler QA alanlarında kalır; güncel mutasyon durumu NOT_RUN_CURRENT_MUTATION olur. Bronze/Silver/Gold hidrasyonu her kanalda 1.428/1.428 ve eksik 0 PASS; yeni exact testler zorunludur.
- PR-241/DEC-276 Bronze 50 immutable REJECTED_INVALID_PACKAGE geçmişini trusted runtime saymadan korur. b0615638, 3eec5426 ve 86602f7a tarihsel retlerdir. Exact etki değerlendirmesinin eşlenmemiş Windows paketleyici lockfile reddi 3e496f47, ters ruleIds assertionı 398de9c8 ile korunmuş; assertion düzeltmesi 3 dosya/14 test PASS vermiştir. Render çağrı retleri 75e4072c/0f98c7cc ve kural FAIL sonrasında başlayan generator çağrısı 9a370e51 ile korunur. Temiz 9f16699d kapanışı sonrasında pre-sync kanal reddi dbefb586 ile korunmuştur. Ana kaynak ve Bronze/Silver/Gold 63c55074 commitinde exact temiz eşitlik PASS; etki zinciri 105 değişen yol/19 hedef test hesaplamış ve hedefli 19 dosya/188 test PASS vermiştir. Filtresiz turda 399 dosya/2.480 test PASS iken yalnız PPK-015 üretim kaynak ratchet hash eşliği düşmüş, gerçek FAIL cc922201 ile korunmuştur. Canlı sınır 18 bölge/590 dosya/0 bulgu/2 adapter/3 amaçtır; ağ yetkisi değişmemiştir. Ratchet debfeecf460834f50cf328bff58b2c19ad94ef229610c4c829a35c4331ef235a özetine eşlenir. V5 DOCX sayfa 15 Durum token sarımı FAIL'i 787c5570 ile korunmuş; görünür karar durumları okunur boşluklarla sarmalandıktan sonra final belge 29/29 görsel QA PASS vermiştir. Yalnız Bronze 51 rejected-parent provenance bundle'ını history-only lineage olarak kullanıp temiz recovery fresh-install ve ayrı same-version maintenance yolunu çalıştırabilir; bütün exact test, kaynak bütünlüğü, preflight/postflight, paket ve kurulu uygulama UAT kapıları zorunludur.
- V5 belge becerisi başlangıcında tek format bekleyen yardımcıya birleşik docx,pdf değeri verilmesi içerik üretmeden reddedilmiş ve df92cdba ile korunmuştur. Bu ürün veya belge içerik kusuru ve PASS değildir; desteklenen tek docx retry PASS olmuş, üretim ancak bundan sonra başlatılmıştır. Kapanış renderındaki sayfa 15 Durum token-ortası bölünme 787c5570 ile korunmuş; üretici görünür durum değerlerindeki alt çizgileri izinli boşluklara dönüştürdükten sonra final DOCX 29/29 görsel QA PASS vermiştir.
- 6f9139e1 exact Bronze zincirinde assessment 107 değişen yol/21 hedef test; hedefli 21 dosya/211 test ve filtresiz 399 dosya/2.481 test PASS vermiştir. Source-integrity governed preflight sonrasında yenilenen yedi indeks/dizin dosyası ile ticari temel kanıtının manifestte stale SHA taşımasını reddetmiş ve üretici sırası FAIL'i 2abcf853 ile korunmuştur. Final üretici sırası governed preflight writer ardından manifest/SHA256SUMS son üretimdir; yeni exact committe tüm kapılar tekrarlanır.
- V5 30 sayfa renderında sayfa 12/14 ilk çoklu önizleme yorumu görüntüleyici kırpmasını dosya kusuru sanmış ve d1e0b803 ile tarihsel yanlış pozitif olarak korunmuştur. Ayrı özgün çözünürlük/piksel doğrulaması dört sütun başlıklarını eksiksiz bulmuş ve 30/30 görsel PASS vermiştir. Ana karar sicilinin bağlayıcı saydığı halde kaynakta bulunmayan ADR-067 gerçek kayıt bütünlüğü FAIL'i f1590772 ile korunmuş; DEC-084 ve Migrasyon 38'in mevcut claim rezervasyonu gerçeğinden ADR geri kurulmuş, kesintisiz ADR numarası ve bağlayıcı referans eşliği fail-closed kapıya alınmıştır.
- V5 PDF Poppler renderı 26 sayfa vermiş; ilk turda sayfa 4/5 Yerel makine durum kodlarının token ortasında bölünmesi okunabilirlik FAIL olmuş ve 6d94ab9e ile korunmuştur. Kanonik makine değerleri değişmeden görünür DOCX/PDF durumları alt çizgi yerine anlamsal boşluklarla sarılmış; final DOCX 30/30 ve PDF 26/26, toplam 56/56 özgün çözünürlük sayfa taşma, örtüşme, kırpılma, font/glyph, tablo, footer ve sayfa numarası kusuru olmadan PASS vermiştir.
- Final-freeze render aracının desteklenmeyen argümanlarla ilk çağrısı belge testi başlamadan durmuş ve 764e856b boş reddedilmiş checkpointiyle korunmuştur. Doğru PATH tabanlı retry DOCX 30 ve PDF 26 sayfayı eksiksiz üretmiştir; bu çağrı reddi ürün veya belge kusuru değildir.
- Final-freeze2 çoklu önizlemesindeki DOCX header/footer ve PDF çift sayfa footer kırpması tam sayfa readback ile yanlış pozitiftir. PDF karar dizinindeki exact yolların karakter ortasından sarılması gerçek FAIL olup 17ad92d0 ile korunmuştur; karar/ADR yol hücreleri exact metni değiştirmeyen ayraç-sonrası sıfır-genişlikli kırma noktalarıyla yeniden üretilir.
- Final-freeze3 makine kapısı 30 DOCX ve 27 PDF sayfayı eksiksiz bulmuş, ancak U+200B ReportLab token bölmesini engellememiştir. PDF karar/ADR yollarındaki ayraç dışı sarım a0d9df42 ile korunmuş; yol üreticisi yalnız /, -, _ sonrasında en çok 48 karakterlik deterministik satırlar üretir. Final-freeze4 DOCX 30/30 ve PDF 27/27, toplam 57/57 tam tek-sayfa özgün çözünürlük QA PASS vermiştir.
- 0099e39e yanlış ana kaynak kökü mutation assessment çağrısını fail-closed reddeder; exact Bronze retry 109 değişen yol/21 hedef test ve analysis 109 yol PASS vermiştir. P2 kayıt bütünlüğü sertleştirmesi assessment sourceCommit değerini canlı release provenance HEAD, baselineCommit değerini doğrulanmış harici baseline pointer HEAD ile exact bağlar. Eksik veya drift kimlik yedi tüketicide reddedilir; odaklı 2 dosya/8 test PASS, yeni exact hedefli/tam/bütünlük ve kurulu UAT zinciri pendingdir.
- 27.08.2026 Bronze 52 kapanışında Bronze 51 predecessor PASS'tir. d68fd2a4 invocation-only; 3976994d, fb8683dc, a6020cb4 ve 61f09ed5 gerçek retlerdir. ASCII char düzeltmesi 2 dosya/18 test, bütün TICARI-052 marker retryı 1.254 kontrol/87 dosya/61 iş/241 kural PASS'tir. Bronze 27.08.2026.52 tek kez tahsis edilmiştir; yeni exact test, kaynak bütünlüğü, belge QA, paket ve N-to-N+1 kurulu UAT kapanmadan teslim yoktur.
- Final-freeze6 P2 belge QA sonucunda önceki onayla byte-exact aynı 25 sayfa korunmuş, değişen DOCX 1 ve 9-19 ile PDF 1 ve 9-27 sayfaları üç bağımsız denetimde 32/32 PASS bulunmuştur. Toplam DOCX 30/30 ve PDF 27/27, yani 57/57 sayfa; taşma, örtüşme, kırpılma, font/glyph, tablo, footer, marj, sayfa numarası ve güvenli ayraç dışı token bölünmesi olmadan PASS'tir.
- Bronze 27.08.2026.52 güncel master belge QA turunda DOCX 30/30 ve PDF 28/28, toplam 58/58 sayfa özgün çözünürlükte PASS vermiştir. Taşma, örtüşme, kırpılma, token-ortası sarım, font/glyph, tablo, header/footer, marj veya sayfa numarası kusuru yoktur; exact ürün, paket ve kurulu tam UI UAT kapıları ayrıca zorunludur.

## 9. Görsel kimlik ve erişilebilirlik

- Logo: `apps/desktop/src/renderer/assets/brand-mark.png`, `warm_bronze_anatolian_leopard`, SHA-256 `8eed255430dd27c886ad2808071cfb114923230bd8712db8f03d46d2f0ef641a`, 512×512, şeffaf arka plan.
- Tipografi: large title 34 px; title1 28 px; title2 22 px; body 17 px; control 15 px; minimum 11 px.
- Bronze: text #d8ad78, strong #ffd39b, icon #e4a85f, edge #dc9852.
- Silver: text #bcc8d2, strong #f3f7fa, icon #d4dde4, edge #d7e0e7.
- Gold: text #d5b85f, strong #ffe9a0, icon #edca62, edge #f0cc58.

## 10. Tüm belge türü denetimi

- `.csv`: 128
- `.docx`: 420
- `.html`: 21
- `.json`: 14126
- `.md`: 21398
- `.pdf`: 431
- `.rtf`: 21
- `.txt`: 429
- `.yaml`: 15
- `.yml`: 34
- Bulunmayan Office türleri: .doc, .odp, .ods, .odt, .ppt, .pptx, .xls, .xlsx.
- Tam yol/hash/okuma sonucu: `artifacts/manifests/ALL_PROJECT_DOCUMENT_FORMAT_AUDIT.json`.

## 11. DEC karar dizini

- `DEC-090` — DEC-090 — KAYITLI — `docs/decisions/DEC-090-clean-backup-rewrite-propagation-status-integrity.md`
- `DEC-091` — DEC-091 — Temiz yedek yayılım sonucu tekil kullanımı — KAYITLI — `docs/decisions/DEC-091-clean-backup-rewrite-propagation-uniqueness.md`
- `DEC-092` — DEC-092 — Clean backup rewrite propagation reference permanence — KAYITLI — `docs/decisions/DEC-092-clean-backup-rewrite-propagation-reference-permanence.md`
- `DEC-093` — DEC-093 — Bağlı propagation kanıtının değiştirilemezliği — KAYITLI — `docs/decisions/DEC-093-clean-backup-rewrite-propagation-evidence-immutability.md`
- `DEC-094` — DEC-094 — Bağlı propagation kanıtında REPLACE kaçışını kapatma — KAYITLI — `docs/decisions/DEC-094-clean-backup-rewrite-propagation-replace-bypass-protection.md`
- `DEC-097` — DEC-097 — Her build sonrası sohbet kapasitesi ölçülür; %90 kullanımda yeni build durur — Aktif — `docs/decisions/DEC-097-conversation-context-capacity-handoff-gate.md`
- `DEC-098` — DEC-098 — Proje Anayasası V3 ve kaynak/kimlik/görsel yönetişimi — Kabul edildi — `docs/decisions/DEC-098-project-constitution-v3.md`
- `DEC-099` — DEC-099 — Güvenli ilk kurulum ve kullanıcı veri kasası — KAYITLI — `docs/decisions/DEC-099-secure-onboarding-and-user-data-vault.md`
- `DEC-100` — DEC-100 — Terminal temiz-yedek çalışma defteri değişmezliği — KAYITLI — `docs/decisions/DEC-100-clean-backup-terminal-ledger-immutability.md`
- `DEC-101` — DEC-101 - Temiz kurulum dış erişim handoff kararı — KAYITLI — `docs/decisions/DEC-101-clean-install-external-access-handoff.md`
- `DEC-102` — DEC-102 — Onaylı UI görsel baseline düzeltmesi — KABUL EDİLDİ — `docs/decisions/DEC-102-approved-ui-visual-baseline-correction.md`
- `DEC-103` — DEC-103 — Bellek-içi aktif kullanıcı verisi oturumu — KABUL EDİLDİ — `docs/decisions/DEC-103-memory-resident-user-data-session.md`
- `DEC-104` — DEC-104 — Hassas yan-artifactlar varsayılan şifreli kapsayıcıdır — KABUL EDİLDİ — `docs/decisions/DEC-104-protected-side-artifact-encryption.md`
- `DEC-105` — DEC-105 — Uzun işler bağımsız doğrulanabilir adımlara bölünür — KABUL EDİLDİ — `docs/decisions/DEC-105-pr171-atomic-work-segmentation.md`
- `DEC-106` — DEC-106 — OPEN-021/022 kapanışı gerçek Windows kanıt zinciri gerektirir — KABUL EDİLDİ — `docs/decisions/DEC-106-windows-security-evidence-harness.md`
- `DEC-107` — DEC-107 — Windows kanıt kabulü exact kaynak snapshotına bağlanır — KABUL EDİLDİ — `docs/decisions/DEC-107-windows-evidence-intake-source-binding.md`
- `DEC-108` — DEC-108 — OPEN-021 gerçek Windows kapanışı ayrı ve dar bir kapıdır — Kabul edildi — `docs/decisions/DEC-108-open021-isolated-windows-closure-gate.md`
- `DEC-109` — DEC-109 — OPEN-022 gerçek Windows kapanışı ayrı ve dar bir kapıdır — Kabul edildi — `docs/decisions/DEC-109-open022-isolated-windows-closure-gate.md`
- `DEC-110` — DEC-110 — OPEN-021 ve OPEN-022 tek Build219 Windows güvenlik kapanışında birleştirilir — KAYITLI — `docs/decisions/DEC-110-unified-bronze-windows-security-closure.md`
- `DEC-111` — DEC-111 — Build219 gerçek Windows failure evidence ve Build220 bootstrap düzeltmesi — KAYITLI — `docs/decisions/DEC-111-build219-windows-failure-bootstrap-remediation.md`
- `DEC-112` — DEC-112 — Build220 gerçek Windows failure evidence ve Build221 workspace-build düzeltmesi — KAYITLI — `docs/decisions/DEC-112-build220-windows-failure-workspace-build-remediation.md`
- `DEC-113` — DEC-113 — Build221 gerçek Windows failure evidence ve Build222 preload TypeScript düzeltmesi — KAYITLI — `docs/decisions/DEC-113-build221-windows-failure-preload-typescript-remediation.md`
- `DEC-114` — DEC-114 — Build222 gerçek Windows failure evidence ve Build223 preload CJS graph düzeltmesi — KAYITLI — `docs/decisions/DEC-114-build222-windows-failure-preload-cjs-graph-remediation.md`
- `DEC-115` — DEC-115 — Build223 gerçek Windows failure evidence ve Build224 NSIS lisans senkronizasyonu — KAYITLI — `docs/decisions/DEC-115-build223-windows-failure-license-rtf-sync-remediation.md`
- `DEC-116` — DEC-116 — Build224 Windows security root-cause remediation — Accepted — `docs/decisions/DEC-116-build224-windows-security-root-cause-remediation.md`
- `DEC-117` — DEC-117 — PR-172 platform-actual context HARD_STOP — Accepted — `docs/decisions/DEC-117-pr172-platform-actual-context-hard-stop.md`
- `DEC-118` — DEC-118 — Build225 Fresh-Profile Device Identity Initialization Order — KAYITLI — `docs/decisions/DEC-118-build225-fresh-profile-device-identity-initialization-order.md`
- `DEC-119` — DEC-119 — Build227 Four Proven Windows Root Causes — KAYITLI — `docs/decisions/DEC-119-build227-four-proven-windows-root-causes.md`
- `DEC-120` — DEC-120 — Build228 OPEN-021/OPEN-022 Official Closure — KAYITLI — `docs/decisions/DEC-120-build228-open021-open022-official-closure.md`
- `DEC-121` — DEC-121 — Accepted Scope, Monthly Release Identity and Channel Gates — ACCEPTED — `docs/decisions/DEC-121-accepted-scope-monthly-release-and-channel-gates.md`
- `DEC-122` — DEC-122 — Platform Policy Kernel and Core Service Foundation — ACCEPTED / FOUNDATION STARTED — `docs/decisions/DEC-122-platform-policy-kernel-and-core-service-foundation.md`
- `DEC-123` — DEC-123 — All proposed family capabilities accepted as binding Bronze scope — ACTIVE — `docs/decisions/DEC-123-all-proposed-family-capabilities-accepted-as-binding-bronze-scope.md`
- `DEC-124` — DEC-124 — Exceptionless canonical rule lock and automatic fail-closed gates — ACTIVE — `docs/decisions/DEC-124-exceptionless-canonical-rule-lock-and-automatic-fail-closed-gates.md`
- `DEC-125` — DEC-125 — Persistent Library hierarchy is mandatory for every delivery — ACTIVE — `docs/decisions/DEC-125-persistent-library-hierarchy-is-mandatory-for-every-delivery.md`
- `DEC-126` — DEC-126 — Every delivery reports progress, ETA, Silver/Gold, conversation status and handoff state — ACTIVE — `docs/decisions/DEC-126-every-delivery-reports-progress-eta-silver-gold-conversation-status-and-handoff-state.md`
- `DEC-127` — DEC-127 — All documents and artifacts must be exhaustively indexed and listed — ACTIVE — `docs/decisions/DEC-127-all-documents-and-artifacts-must-be-exhaustively-indexed-and-listed.md`
- `DEC-128` — DEC-128 — Completed releases are immutable; new work continues in monthly next sequence — ACTIVE — `docs/decisions/DEC-128-completed-releases-are-immutable-new-work-continues-in-monthly-next-sequence.md`
- `DEC-129` — DEC-129 — Tüm aktif kurallar aşılamaz yürütme çekirdeğine bağlanır — ACTIVE — `docs/decisions/DEC-129-tum-kurallar-asilamaz-yurutme-cekirdegi.md`
- `DEC-130` — DEC-130 — B1-03 Bağlamsal Merkezi Yetkilendirme — KAYITLI — `docs/decisions/DEC-130-b1-03-contextual-central-authorization.md`
- `DEC-131` — DEC-131 — B1-04 Güvenli Davet Yaşam Döngüsü — KAYITLI — `docs/decisions/DEC-131-b1-04-invitation-lifecycle.md`
- `DEC-132` — DEC-132 — B1-04 davet IPC, kullanıcı arayüzü ve menü kararı — KAYITLI — `docs/decisions/DEC-132-b1-04-invitation-ipc-ui-menu.md`
- `DEC-133` — DEC-133 — B1-05 Güvenli Veri Onarma Merkezi — KAYITLI — `docs/decisions/DEC-133-b1-05-data-repair-center.md`
- `DEC-134` — DEC-134 — B1-05 Veri Onarma Merkezi Masaüstü Çalışma Alanı — KAYITLI — `docs/decisions/DEC-134-b1-05-data-repair-desktop-workspace.md`
- `DEC-135` — DEC-135 — B2-01 Windows Hello Temeli — KAYITLI — `docs/decisions/DEC-135-b2-01-windows-hello-foundation.md`
- `DEC-136` — DEC-136 — B2-01 Windows Hello IPC, Arayüz ve Menü Sınırı — KAYITLI — `docs/decisions/DEC-136-b2-01-windows-hello-ipc-ui-menu.md`
- `DEC-137` — DEC-137 — Eksik Bronze Kapsamının Tam Otomatik Önceliklendirilmesi — KAYITLI — `docs/decisions/DEC-137-incomplete-bronze-backlog-full-auto-prioritization.md`
- `DEC-138` — DEC-138 — PPK-002 Merkezi Policy Enforcement Temeli — KAYITLI — `docs/decisions/DEC-138-ppk-002-central-policy-enforcement-foundation.md`
- `DEC-139` — DEC-139 — PPK-002 Arşiv Policy Enforcement Dikey Dilimi — KAYITLI — `docs/decisions/DEC-139-ppk-002-archive-policy-enforcement-vertical-slice.md`
- `DEC-140` — DEC-140 — PPK-002 Arşiv Üretim Bileşimi ve SQLite Runtime Dilimi — KAYITLI — `docs/decisions/DEC-140-ppk-002-archive-production-composition-and-sqlite-runtime.md`
- `DEC-141` — DEC-141 — PPK-002 Kalıcı Policy Transaction, Replay ve Database Fence Dilimi — KAYITLI — `docs/decisions/DEC-141-ppk-002-durable-policy-transaction-replay-and-fencing.md`
- `DEC-142` — DEC-142 — PPK-002 journal proof and rollback anchor — KAYITLI — `docs/decisions/DEC-142-ppk-002-journal-proof-and-rollback-anchor.md`
- `DEC-143` — DEC-143 — PPK-002 archive core-table receipt fence — KAYITLI — `docs/decisions/DEC-143-ppk-002-archive-core-table-receipt-fence.md`
- `DEC-144` — DEC-144 — PPK-002 archive accessory and event-attachment receipt fence — KAYITLI — `docs/decisions/DEC-144-ppk-002-archive-accessory-and-event-attachment-receipt-fence.md`
- `DEC-145` — DEC-145 — PPK-002 new-correlation operation idempotency — KAYITLI — `docs/decisions/DEC-145-ppk-002-new-correlation-operation-idempotency.md`
- `DEC-146` — DEC-146 — PPK-002 kalıcı bekleyen işlem kimliği kurtarma — KAYITLI — `docs/decisions/DEC-146-ppk-002-durable-pending-operation-identity-recovery.md`
- `DEC-147` — DEC-147 — PPK-002 süresi dolmuş kullanılmamış replay rezervasyonu temizliği — KAYITLI — `docs/decisions/DEC-147-ppk-002-expired-replay-reservation-pruning.md`
- `DEC-148` — DEC-148 — PPK-002 finans politika enforcement dikey dilimi — KAYITLI — `docs/decisions/DEC-148-ppk-002-finance-policy-enforcement.md`
- `DEC-149` — DEC-149 — PPK-002 sağlık politika enforcement dikey dilimi — KAYITLI — `docs/decisions/DEC-149-ppk-002-health-policy-enforcement.md`
- `DEC-150` — DEC-150 — PPK-002 yaşam politika enforcement dikey dilimi — KAYITLI — `docs/decisions/DEC-150-ppk-002-life-policy-enforcement.md`
- `DEC-151` — DEC-151 — PPK-002 konum politika enforcement dikey dilimi — KAYITLI — `docs/decisions/DEC-151-ppk-002-location-policy-enforcement.md`
- `DEC-152` — DEC-152 - Tek yetkili kaynak, yerel receipt ve Build numaralandirmasi — KAYITLI — `docs/decisions/DEC-152-authoritative-source-local-receipt-and-build-numbering.md`
- `DEC-153` — DEC-153 - B0-01 tek yonetisim ve ozellik gercekligi matrisi kapanisi — KAYITLI — `docs/decisions/DEC-153-b0-01-governance-reality-matrix-closure.md`
- `DEC-154` — DEC-154 - GOV-004 guncel teslim raporu kapanisi — KAYITLI — `docs/decisions/DEC-154-gov-004-current-delivery-report-closure.md`
- `DEC-155` — DEC-155 - GOV-005 harici Library engel siniflandirmasi — KAYITLI — `docs/decisions/DEC-155-gov-005-external-library-blocker-classification.md`
- `DEC-156` — DEC-156 - PPK-002 timeline-event politika enforcement yerel devam dilimi — KAYITLI — `docs/decisions/DEC-156-ppk-002-timeline-event-policy-local-continuation.md`
- `DEC-157` — DEC-157 - PPK-002 aile veri aktarımı merkezi yetkilendirme yerel devam dilimi — KAYITLI — `docs/decisions/DEC-157-ppk-002-family-data-import-central-authorization-local-continuation.md`
- `DEC-158` — DEC-158 — 30-Z harici USB Library makbuzu — Kabul edildi — `docs/decisions/DEC-158-30-z-external-usb-library-receipt.md`
- `DEC-159` — DEC-159 — PPK-002 timeline-event Policy Enforcement resmî checkpoint seçimi — KAYITLI — `docs/decisions/DEC-159-ppk-002-timeline-event-policy-official-checkpoint.md`
- `DEC-160` — DEC-160 — PPK-002 aile veri aktarımı merkezi yetkilendirme resmî checkpoint seçimi — KAYITLI — `docs/decisions/DEC-160-ppk-002-family-data-import-central-authorization-official-checkpoint.md`
- `DEC-161` — DEC-161 — PPK-002 aile içe aktarma çoklu politika makbuzu batch checkpoint’i — KAYITLI — `docs/decisions/DEC-161-ppk-002-family-import-multi-policy-receipt-batch.md`
- `DEC-162` — DEC-162 — Windows Hello donanım doğrulamasının geçici ertelenmesi — KAYITLI — `docs/decisions/DEC-162-windows-hello-hardware-validation-deferral.md`
- `DEC-163` — DEC-163 — PPK-002 aile içe aktarma mevcut-konum okuma makbuzu — KAYITLI — `docs/decisions/DEC-163-ppk-002-family-import-reused-location-read-receipt.md`
- `DEC-164` — DEC-164 — GOV-005 haricî USB ana kaynak koruması kapanışı — KAYITLI — `docs/decisions/DEC-164-gov-005-external-usb-source-protection-closure.md`
- `DEC-165` — DEC-165 — B0-02 kullanıcıya görünür sürüm metadata sınırı — KAYITLI — `docs/decisions/DEC-165-b0-02-user-visible-release-metadata-boundary.md`
- `DEC-166` — DEC-166 — PPK-002 aile içe aktarma yeni-konum bağlı etkinlik zinciri — KAYITLI — `docs/decisions/DEC-166-ppk-002-family-import-created-location-linked-event.md`
- `DEC-167` — DEC-167 — PPK-002 aile içe aktarma governed rollback makbuz çiti — KAYITLI — `docs/decisions/DEC-167-ppk-002-family-import-governed-rollback-receipt-fence.md`
- `DEC-168` — DEC-168 — Ana yapı önce: Core Service API omurgası — KAYITLI — `docs/decisions/DEC-168-main-structure-first-core-service-api-foundation.md`
- `DEC-169` — DEC-169 — Core Service korumalı aile-verisi oturumu sahiplik kontrol düzlemi — KAYITLI — `docs/decisions/DEC-169-core-service-protected-family-data-session-ownership-control-plane.md`
- `DEC-170` — DEC-170 — Headless cihaz-sır koruma sınırı — KAYITLI — `docs/decisions/DEC-170-headless-device-secret-protection-boundary.md`
- `DEC-171` — DEC-171 — Family-data coexistence and default-deny cutover gate — ACTIVE — `docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md`
- `DEC-172` — DEC-172 — Monotonic cutover-readiness evidence and tamper-evident acceptance state — ACTIVE — `docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md`
- `DEC-173` — DEC-173 — Protected cutover-readiness journal port and detached default-deny boundary — ACTIVE — `docs/decisions/DEC-173-protected-cutover-readiness-journal-port.md`
- `DEC-174` — DEC-174 — Signed cutover-readiness evidence verifier public-key-only boundary — ACTIVE — `docs/decisions/DEC-174-signed-cutover-readiness-evidence-verifier-boundary.md`
- `DEC-175` — DEC-175 — Synthetic single-writer proof harness detached non-authoritative boundary — ACTIVE — `docs/decisions/DEC-175-synthetic-single-writer-proof-harness-boundary.md`
- `DEC-176` — DEC-176 — Synthetic key lifecycle proof harness detached non-submittable boundary — ACTIVE — `docs/decisions/DEC-176-synthetic-key-lifecycle-proof-harness-boundary.md`
- `DEC-177` — DEC-177 — Synthetic rollback and recovery drill detached non-submittable boundary — ACTIVE — `docs/decisions/DEC-177-synthetic-rollback-recovery-drill-boundary.md`
- `DEC-178` — DEC-178 — End-to-end security evidence aggregator detached non-submittable boundary — ACTIVE — `docs/decisions/DEC-178-end-to-end-security-evidence-aggregator-boundary.md`
- `DEC-179` — DEC-179 — Explicit user approval receipt detached no-cutover boundary — ACTIVE — `docs/decisions/DEC-179-explicit-user-approval-receipt-boundary.md`
- `DEC-180` — DEC-180 — Versioned cutover decision preflight detached no-authority boundary — ACTIVE — `docs/decisions/DEC-180-versioned-cutover-decision-preflight-boundary.md`
- `DEC-181` — DEC-181 — PPK-002 aile içe aktarma governed rollback makbuz çiti — ACTIVE — `docs/decisions/DEC-181-ppk-002-family-import-governed-rollback-receipt-fence.md`
- `DEC-182` — DEC-182 — PPK-002 kalan teknik sınırları — KAYITLI — `docs/decisions/DEC-182-ppk-002-remaining-technical-boundaries.md`
- `DEC-183` — DEC-183 — PPK-002 evrensel enforcement üst kapanışı — KAYITLI — `docs/decisions/DEC-183-ppk-002-universal-enforcement-top-closure.md`
- `DEC-184` — DEC-184 — PPK-003 sınırlı süreli varsayılan-ret politika kararı erişilebilirliği — KAYITLI — `docs/decisions/DEC-184-ppk-003-bounded-default-deny-policy-decision-availability.md`
- `DEC-185` — DEC-185 — PPK-004 tam politika bağlamı ve kriptografik işlem bağı — KAYITLI — `docs/decisions/DEC-185-ppk-004-complete-policy-context-binding.md`
- `DEC-186` — DEC-186 — PPK-005 tam ve çoklu veri sınıflandırması — KAYITLI — `docs/decisions/DEC-186-ppk-005-complete-data-classification.md`
- `DEC-187` — DEC-187 — PPK-006 tam politika yükümlülükleri — KAYITLI — `docs/decisions/DEC-187-ppk-006-complete-policy-obligation-suite.md`
- `DEC-188` — DEC-188 — PPK-007 imzalı ve sürümlü politika paketi — KAYITLI — `docs/decisions/DEC-188-ppk-007-signed-versioned-policy-package.md`
- `DEC-189` — DEC-189 — PPK-008 uygulama kimliği, cihaz sertifikası ve capability manifesti — KAYITLI — `docs/decisions/DEC-189-ppk-008-application-identity-device-certificate-manifest.md`
- `DEC-190` — DEC-190 — PPK-009 Core Service politika yeniden değerlendirmesi — KAYITLI — `docs/decisions/DEC-190-ppk-009-core-service-policy-reevaluation.md`
- `DEC-191` — DEC-191 — PPK-010 merkezi politika ve sıfır doğrudan-rol istisnası — KAYITLI — `docs/decisions/DEC-191-ppk-010-central-policy-zero-exception.md`
- `DEC-192` — DEC-192 — PPK-011 bağlamsal yetki ve sahiplik oranı — KAYITLI — `docs/decisions/DEC-192-ppk-011-contextual-ownership-policy.md`
- `DEC-193` — DEC-193 — PPK-012 sonlu çevrimdışı capability lease ve hassas cache kilidi — KAYITLI — `docs/decisions/DEC-193-ppk-012-offline-capability-lease-cache-fence.md`
- `DEC-194` — DEC-194 — PPK-013 istemci veri erişim güvenlik çiti — KAYITLI — `docs/decisions/DEC-194-ppk-013-client-data-access-boundary.md`
- `DEC-195` — DEC-195 — PPK-014 sürümlü Core Service API güvenlik sınırı — KAYITLI — `docs/decisions/DEC-195-ppk-014-versioned-core-service-api-boundary.md`
- `DEC-196` — DEC-196 — PPK-015 allowlist ve TLS/mTLS ağ çıkış sınırı — KAYITLI — `docs/decisions/DEC-196-ppk-015-network-egress-policy.md`
- `DEC-197` — DEC-197 — PPK-016 türetilmiş veri politika mirası — KAYITLI — `docs/decisions/DEC-197-ppk-016-derived-data-policy-inheritance.md`
- `DEC-198` — DEC-198 — PPK-017 hassas log ve content-free tanı sınırı — KAYITLI — `docs/decisions/DEC-198-ppk-017-sensitive-log-policy.md`
- `DEC-199` — DEC-199 — PPK-018 değişmez policy karar audit zinciri — KAYITLI — `docs/decisions/DEC-199-ppk-018-immutable-policy-decision-audit.md`
- `DEC-200` — DEC-200 — PPK-019 kaynak silme ve retention yayılımı — KAYITLI — `docs/decisions/DEC-200-ppk-019-source-deletion-propagation.md`
- `DEC-201` — DEC-201 — PPK-020 çok platformlu ortak policy conformance suite — KAYITLI — `docs/decisions/DEC-201-ppk-020-cross-platform-policy-conformance-suite.md`
- `DEC-202` — DEC-202 — PPK-021 AST tabanlı fail-closed Platform Policy build kapısı — KAYITLI — `docs/decisions/DEC-202-ppk-021-platform-policy-ast-fail-gate.md`
- `DEC-203` — DEC-203 — PPK-022 imzalı capability manifest build/runtime kapısı — KAYITLI — `docs/decisions/DEC-203-ppk-022-capability-manifest-build-runtime-gate.md`
- `DEC-204` — DEC-204 — PPK-023 uygulama güvenlik profili build kapısı — KAYITLI — `docs/decisions/DEC-204-ppk-023-application-security-profile-gate.md`
- `DEC-205` — DEC-205 — PPK-024 canlı Policy Service availability runtime kapısı — KAYITLI — `docs/decisions/DEC-205-ppk-024-policy-service-availability-runtime-gate.md`
- `DEC-206` — DEC-206 — PPK-025 fail-closed yazılım tedarik zinciri kapıları — KAYITLI — `docs/decisions/DEC-206-ppk-025-software-supply-chain-gates.md`
- `DEC-207` — DEC-207 — PPK-026 typed policy SDK ve XPF-003 ortak finans/sağlık policy yolu — ACTIVE — `docs/decisions/DEC-207-ppk-026-typed-policy-sdk-and-xpf003.md`
- `DEC-208` — DEC-208 — B0-03/B0-04 ürün yüzeyi ve Feature Reality Gate — ACTIVE — `docs/decisions/DEC-208-b0-03-b0-04-product-surface-governance.md`
- `DEC-209` — DEC-209 — B2-03/B2-04 masaüstü oturum ve Electron güvenliği — ACTIVE — `docs/decisions/DEC-209-b2-03-b2-04-desktop-session-electron-security.md`
- `DEC-210` — DEC-210 — B2-05/B6-03 hassas veri rızası ve dışa gönderim önizlemesi — ACTIVE — `docs/decisions/DEC-210-b2-05-b6-03-sensitive-data-consent-and-export-preview.md`
- `DEC-211` — DEC-211 — B4 banka kurumu, hesap, IBAN doğrulama ve sır reddi temeli — ACTIVE — `docs/decisions/DEC-211-b4-banking-foundation.md`
- `DEC-212` — DEC-212 — B4 kart ürünü ve takip otomasyonları — ACTIVE — `docs/decisions/DEC-212-b4-payment-card-management.md`
- `DEC-213` — DEC-213 — B4 kredi ve ödeme geçmişi yönetimi — ACTIVE — `docs/decisions/DEC-213-b4-loan-management.md`
- `DEC-214` — DEC-214 — B4 finans planlama, portföy ve analiz merkezi — ACTIVE — `docs/decisions/DEC-214-b4-finance-planning-portfolio-analytics.md`
- `DEC-215` — DEC-215 — Kontrollü finans içe aktarma ve ağsız ÖHVPS sınırı — ACTIVE — `docs/decisions/DEC-215-b4-controlled-import-open-banking.md`
- `DEC-216` — DEC-216 — Kategoriye özgü yaşam, ev ve araç defteri — ACTIVE — `docs/decisions/DEC-216-b5-category-life-home-vehicle.md`
- `DEC-217` — DEC-217 — Ev envanteri, sayaç, tüketim, eşya, garanti ve servis defteri — ACTIVE — `docs/decisions/DEC-217-home-inventory-utility-belongings.md`
- `DEC-218` — DEC-218 — Çevrimdışı aile acil durum planı ve kişi durumu — ACTIVE — `docs/decisions/DEC-218-family-emergency-planning.md`
- `DEC-219` — DEC-219 — Çevrimdışı 72 saat çantası ve afet tatbikatı defteri — ACTIVE — `docs/decisions/DEC-219-family-emergency-preparedness-kits-and-drills.md`
- `DEC-220` — DEC-220 — Çevrimdışı özel acil sağlık/iletişim kartı ve yardım profili — ACTIVE — `docs/decisions/DEC-220-family-emergency-assistance-card.md`
- `DEC-221` — DEC-221 — Governed offline emergency card portability — ACTIVE / IMPLEMENTED, FINAL LOCAL COUNTS PENDING — `docs/decisions/DEC-221-family-emergency-card-portability.md`
- `DEC-222` — DEC-222 — Gizlilik, süreli rıza ve kayıp cihaz kapatma merkezi — Aktif uygulama (33-K) — `docs/decisions/DEC-222-privacy-consent-lost-device-control-center.md`
- `DEC-223` — DEC-223 — Finans / Uzun Vadeli Portföy merkezi — Aktif uygulama (33-L) — `docs/decisions/DEC-223-long-term-portfolio-center.md`
- `DEC-224` — DEC-224 — Erişilebilirlik tercih merkezi — ACTIVE / IMPLEMENTATION IN PROGRESS — `docs/decisions/DEC-224-accessibility-preference-center.md`
- `DEC-225` — DEC-225 — Taslak, geri alma ve asenkron ekran durumu UX'i — COMPLETED — `docs/decisions/DEC-225-draft-async-state-ux.md`
- `DEC-226` — DEC-226 — Gizlilik, sahiplik, veri hakları ve olay kontrol merkezi — COMPLETED — `docs/decisions/DEC-226-privacy-ownership-data-rights-incident-control.md`
- `DEC-227` — DEC-227 — Passkey, federated kimlik ve doğrulanabilir geçici yetki belgeleri — IN PROGRESS — `docs/decisions/DEC-227-passkeys-federated-identity-verifiable-temporary-credentials.md`
- `DEC-228` — DEC-228 — Yerel, yönetişimli OCR ve türetilmiş veri hattı — PLANNED / LOCAL IMPLEMENTATION STARTED — `docs/decisions/DEC-228-local-governed-ocr-derived-data-pipeline.md`
- `DEC-229` — DEC-229 — Arşiv kanıt ilişkileri, medya yaşam döngüsü ve birleşik yetkili arama — KAYITLI — `docs/decisions/DEC-229-archive-evidence-relations-media-lifecycle-unified-authorized-search.md`
- `DEC-230` — DEC-230 — Sağlık koordinasyonu ve yaşlı desteği günlüğü — KAYITLI — `docs/decisions/DEC-230-health-care-coordination-elderly-support-ledger.md`
- `DEC-231` — DEC-231 — Hane operasyonları merkezi — KAYITLI — `docs/decisions/DEC-231-household-operations-center.md`
- `DEC-232` — DEC-232 — Çocuk eğitim koordinasyonu — KAYITLI — `docs/decisions/DEC-232-child-education-coordination.md`
- `DEC-233` — DEC-233 — Yer, seyahat, taşınma ve evcil hayvan iş akışları — PLANNED / LOCAL IMPLEMENTATION STARTED — `docs/decisions/DEC-233-places-travel-asset-pet.md`
- `DEC-234` — DEC-234 — Onaya bağlı aile AI asistanı — KAYITLI — `docs/decisions/DEC-234-consent-bound-family-ai-assistant.md`
- `DEC-235` — DEC-235 — Hafıza stüdyosu ve zaman kapsülü — KAYITLI — `docs/decisions/DEC-235-memory-studio-time-capsule.md`
- `DEC-236` — DEC-236 — Yerel-first akıllı ev ve enerji adapterleri — KAYITLI — `docs/decisions/DEC-236-local-first-smart-home-energy-adapters.md`
- `DEC-237` — DEC-237 — İmzalı eklenti ve dış sağlayıcı aday platformu — KAYITLI — `docs/decisions/DEC-237-signed-plugin-external-provider-platform.md`
- `DEC-238` — DEC-238 — İletişim politika çekirdeği ve MLS güvenlik temeli — KAYITLI — `docs/decisions/DEC-238-communication-policy-mls-foundation.md`
- `DEC-239` — DEC-239 — Mesaj yaşam döngüsü ve mahremiyet koruyan presence — KAYITLI — `docs/decisions/DEC-239-communication-messaging-lifecycle-privacy-presence.md`
- `DEC-240` — DEC-240 — Gerçek zamanlı arama planlama ve erişilebilir arama deneyimi — KAYITLI — `docs/decisions/DEC-240-realtime-calling-media-accessible-ux.md`
- `DEC-241` — DEC-241 — Açık rızalı görüşme kaydı ve medya saklama — KAYITLI — `docs/decisions/DEC-241-explicit-consent-recording-media-retention.md`
- `DEC-242` — DEC-242 — Yerel öncelikli çeviri, altyazı ve dil sağlayıcısı — PLANNED / LOCAL IMPLEMENTATION STARTED — `docs/decisions/DEC-242-local-first-translation-caption-language-provider.md`
- `DEC-243` — DEC-243 — Aile toplantıları, kararlar ve rızaya bağlı tutanaklar — PLANNED / LOCAL IMPLEMENTATION STARTED — `docs/decisions/DEC-243-family-meetings-decisions-consent-minutes.md`
- `DEC-244` — DEC-244 — E2EE dosya paylaşımı ve kalan iletişim UX — PLANNED / LOCAL IMPLEMENTATION STARTED — `docs/decisions/DEC-244-e2ee-file-sharing-remaining-communication-ux.md`
- `DEC-245` — DEC-245 — İletişim audit ve arşiv bütünlüğü — PLANNED / LOCAL IMPLEMENTATION STARTED — `docs/decisions/DEC-245-communication-audit-archive-integrity.md`
- `DEC-246` — DEC-246 — Dağıtık Core Service consensus ve tenancy temeli — PLANNED / LOCAL IMPLEMENTATION STARTED — `docs/decisions/DEC-246-distributed-core-consensus-tenancy.md`
- `DEC-247` — DEC-247 — Dağıtık istemciler, bağlantı, operasyon ve felaket kurtarma — PLANNED / LOCAL IMPLEMENTATION STARTED — `docs/decisions/DEC-247-distributed-clients-operations-disaster-recovery.md`
- `DEC-248` — DEC-248 — Windows dayanıklılık ve evrensel UX konsolidasyonu — PLANNED / LOCAL IMPLEMENTATION STARTED — `docs/decisions/DEC-248-windows-resilience-universal-ux.md`
- `DEC-249` — DEC-249 — Bronze final drift, dokümantasyon ve deterministik teslim kapanışı — PLANNED FINAL / LOCAL CLOSURE AUDIT STARTED — `docs/decisions/DEC-249-bronze-final-drift-deterministic-delivery-closure.md`
- `DEC-250` — DEC-250 — Güncel dokümantasyon yenilemesi ve tarihsel kayıtların korunması — ACTIVE — `docs/decisions/DEC-250-current-documentation-refresh-historical-preservation.md`
- `DEC-251` — DEC-251 — Karar anında eşzamanlı belge ve iş listesi güncellemesi — ACTIVE — `docs/decisions/DEC-251-synchronous-decision-documentation-enforcement.md`
- `DEC-252` — DEC-252 — Tarihsel kayıtların gelecek içerik denetimlerinden çıkarılması — ACTIVE — `docs/decisions/DEC-252-freeze-historical-records-from-future-content-review.md`
- `DEC-253` — DEC-253 — Animasyonlu kurulum, yenilenmiş anlatım ve Silver sesli Yardım Merkezi — ACTIVE — `docs/decisions/DEC-253-animated-installer-narration-and-silver-help-center.md`
- `DEC-254` — DEC-254 — ParsYuva marka kimliği ve kurumsallaşma yol haritası — ACTIVE / PARTIAL EXTERNAL ACTION — `docs/decisions/DEC-254-parsyuva-brand-and-institutionalization-roadmap.md`
- `DEC-255` — DEC-255 — Sistem Dili ve İngilizce Arayüz Altyapısı — KAYITLI — `docs/decisions/DEC-255-sistem-dili-ve-ingilizce-arayuz-altyapisi.md`
- `DEC-256` — DEC-256 — Tek gerçek kurulum ilerlemesi ve yerel yüzde görünümü — ACTIVE — `docs/decisions/DEC-256-tek-gercek-kurulum-ilerlemesi.md`
- `DEC-257` — DEC-257 — Başlıklarda ParsYuva AYM adının tekrarsız kullanımı — SUPERSEDED BY DEC 261 — `docs/decisions/DEC-257-parsyuva-aym-baslik-tekrar-yasagi.md`
- `DEC-258` — DEC-258 — Çevrimdışı aile haritası altyapısı — UYGULANDI — YEREL HARİTA PAKETİ OPSİYONEL — `docs/decisions/DEC-258-cevrimdisi-aile-haritasi-altyapisi.md`
- `DEC-259` — DEC-259 — Ticari Temel Alani ve Asilamaz Belge Kapisi — ACTIVE — `docs/decisions/DEC-259-ticari-temel-alani-ve-asilamaz-belge-kapisi.md`
- `DEC-260` — DEC-260 — Ek kural toplu birleştirme ve doğrulanmış Git teslimi — ACTIVE — `docs/decisions/DEC-260-ek-kural-toplu-birlestirme-ve-dogrulanmis-git-teslimi.md`
- `DEC-261` — DEC-261 — AYM Kısaltmasının Güncel Ürün Yüzeylerinden Kaldırılması — ACTIVE — `docs/decisions/DEC-261-aym-kisaltmasinin-guncel-urun-yuzeylerinden-kaldirilmasi.md`
- `DEC-262` — DEC-262 — ParsYuva kurulum yolu, program dosyası ve kısa teslim adı — ACTIVE — `docs/decisions/DEC-262-parsyuva-kurulum-yolu-program-dosyasi-ve-kisa-teslim-adi.md`
- `DEC-263` — DEC-263 — Kod değişikliğinde eski Windows kurulum artefaktlarının silinmesi — ACTIVE — `docs/decisions/DEC-263-kod-degisikliginde-eski-windows-kurulum-artefaktlarinin-silinmesi.md`
- `DEC-264` — DEC-264 — Görünür sürüm kanalının tek kez gösterilmesi — ACTIVE — `docs/decisions/DEC-264-gorunur-surum-kanalinin-tek-kez-gosterilmesi.md`
- `DEC-265` — DEC-265 — Her işlem öncesi zorunlu kural kontrolü — ACTIVE — `docs/decisions/DEC-265-her-islem-oncesi-zorunlu-kural-kontrolu.md`
- `DEC-266` — DEC-266 — Özel kurulum, ilk aile, temiz paket ve çift yedek kabul zinciri — ACTIVE — `docs/decisions/DEC-266-ozel-kurulum-ilk-aile-temiz-paket-ve-cift-yedek-kabul-zinciri.md`
- `DEC-267` — DEC-267 — Geçişli sesli kurulum, tek pars ve kasa kilidi düzeltmesi — ACTIVE — `docs/decisions/DEC-267-gecisli-sesli-kurulum-tek-pars-ve-kasa-kilidi-duzeltmesi.md`
- `DEC-268` — DEC-268 — Windows installer timer callback ve tam ön yüz kullanıcı UAT teslimi — ACTIVE — `docs/decisions/DEC-268-windows-installer-timer-callback-ve-tam-on-yuz-kullanici-uat-teslimi.md`
- `DEC-269` — DEC-269 — Bronze, Silver ve Gold kurulum, veri ve kaynak yalıtımı — SUPERSEDED BY DEC-271 — `docs/decisions/DEC-269-bronze-silver-gold-kurulum-veri-ve-kaynak-yalitimi.md`
- `DEC-270` — DEC-270 — Her mutasyon sonrası exact commit kanıtı ve taze kurulu EXE UAT teslim kapısı — ACTIVE — `docs/decisions/DEC-270-her-mutasyon-sonrasi-exact-commit-kaniti-ve-taze-kurulu-exe-uat-teslim-kapisi.md`
- `DEC-271` — DEC-271 — Kardeş kanal program kökleri ve legacy kaldırma güvenliği — ACTIVE — `docs/decisions/DEC-271-sibling-channel-program-roots-and-legacy-uninstall-safety.md`
- `DEC-272` — DEC-272 — Açık tek seferli sürüm tahsisi ve önceden tahsisli paket kimliği — ACTIVE — `docs/decisions/DEC-272-explicit-single-release-allocation-and-preallocated-package-identity.md`
- `DEC-273` — DEC-273 — Kanonik Windows kurulu yükseltme, maintenance ve ön yüz UAT zinciri — ACTIVE — `docs/decisions/DEC-273-canonical-windows-installed-upgrade-maintenance-and-frontend-uat.md`
- `DEC-274` — DEC-274 — Adversarial Windows paket, kurulum ve final teslim kanıt zinciri — ACTIVE — `docs/decisions/DEC-274-adversarial-windows-delivery-evidence-chain.md`
- `DEC-275` — DEC-275 — En küçük değişiklikte tüm kayıt ve test kapanışı — ACTIVE — `docs/decisions/DEC-275-mutation-wide-record-and-test-closure.md`
- `DEC-276` — DEC-276 — Bronze 51 rejected predecessor recovery bootstrap — ACTIVE — `docs/decisions/DEC-276-bronze-51-rejected-predecessor-recovery-bootstrap.md`

## 12. ADR dizini

- `ADR-001` — ADR-001: Modüler Monolit ve Katman Yönü — `docs/adr/ADR-001-modular-monolith.md`
- `ADR-002` — ADR-002: Windows Öncelikli Electron + React + TypeScript — `docs/adr/ADR-002-electron-react-typescript.md`
- `ADR-003` — ADR-003: Yerel-Öncelikli Veri ve Kullanıcı Sahipliği — `docs/adr/ADR-003-local-first-data.md`
- `ADR-004` — ADR-004: Nesne Düzeyi Yetkilendirme ve Açık Ret Önceliği — `docs/adr/ADR-004-object-level-authorization.md`
- `ADR-005` — ADR-005: AI Rıza, Veri Erişimi ve İnsan Onayı Sınırı — `docs/adr/ADR-005-ai-consent-boundary.md`
- `ADR-006` — ADR-006: Ortak Olay Ağı ve Arşivlenebilir Yaşam Döngüsü — `docs/adr/ADR-006-timeline-event-graph.md`
- `ADR-007` — ADR-007: Sağlayıcı Soyutlama — `docs/adr/ADR-007-provider-abstraction.md`
- `ADR-008` — ADR-008: Ürün Kimliği ve Yatırım Kapsamından Ayrım — `docs/adr/ADR-008-product-identity-and-scope-separation.md`
- `ADR-009` — ADR-009: Doğrulama Kanıtı Dürüstlüğü ve Promotion Kontrolü — `docs/adr/ADR-009-release-evidence-honesty.md`
- `ADR-010` — ADR-010: Apple Esintili Özgün UI ve Merkezi Tipografi — `docs/adr/ADR-010-apple-inspired-ui-typography.md`
- `ADR-011` — ADR-011: Bağımsız Yedek Hedefleri ve Cihazın Yeniden Yetkilendirilmesi — `docs/adr/ADR-011-independent-backup-and-device-reauthorization.md`
- `ADR-012` — ADR-012: Belge Yetkisi ve Ana Karar Defteri — `docs/adr/ADR-012-document-authority-and-decision-ledger.md`
- `ADR-013` — ADR-013 — İşletim Sistemi Korumalı Cihaz Kimliği Sırrı — `docs/adr/ADR-013-os-protected-device-identity-secret.md`
- `ADR-014` — ADR-014 — İşletim Sistemi Korumalı MFA Sırrı — `docs/adr/ADR-014-os-protected-mfa-secret.md`
- `ADR-015` — ADR-015 — Parola Korumalı Tam Yedek Kapsayıcısı — `docs/adr/ADR-015-password-protected-full-backup-container.md`
- `ADR-016` — ADR-016 — Dayanıklı Tam Yedek Geri Yükleme İşlemi — `docs/adr/ADR-016-durable-full-backup-restore-transaction.md`
- `ADR-017` — ADR-017 — Başlangıç Güvenlik Ön Kontrolü ve Windows DPAPI Kanıtı — `docs/adr/ADR-017-startup-security-preflight-and-windows-dpapi-proof.md`
- `ADR-018` — ADR-018 — Finans ve Sağlık Nesnelerinde Mahremiyet Öncelikli Yetkilendirme — `docs/adr/ADR-018-sensitive-finance-health-object-privacy.md`
- `ADR-019` — ADR-019 — Kalıcı erişilebilirlik tercihleri ve kritik klavye akışı — `docs/adr/ADR-019-persistent-accessibility-preferences-and-keyboard-flow.md`
- `ADR-020` — ADR-020 — İşletim sistemi korumalı arşiv kasa anahtarı ve taşınabilir yeniden sarma — `docs/adr/ADR-020-os-protected-archive-vault-key-and-portable-rewrap.md`
- `ADR-021` — ADR-021 — Veri saklama, geri alınabilir silme ve kalıcı imha — `docs/adr/ADR-021-data-retention-recoverable-deletion-and-purge.md`
- `ADR-022` — ADR-022 — Yönetilen yedeklerde doğrulanmış imha yayılımı ve karantina — `docs/adr/ADR-022-verified-managed-backup-purge-propagation.md`
- `ADR-023` — ADR-023 — Yedek karantinası saklama, hukuki bekletme ve devam ettirilebilir nihai imha — `docs/adr/ADR-023-backup-quarantine-retention-legal-hold-and-destruction.md`
- `ADR-024` — ADR-024 — Uygulama Dışı Yedek Envanteri ve Kullanıcı İmha Beyanı — `docs/adr/ADR-024-external-backup-inventory-and-user-attestation.md`
- `ADR-025` — ADR-025 — İmzalı Haricî Yedek İmha Kanıtı ve Sağlayıcı Güven Zinciri — `docs/adr/ADR-025-signed-external-backup-destruction-evidence.md`
- `ADR-026` — ADR-026 — İmzalı kanıt sağlayıcısı anahtar döndürme ve zamansal güven — `docs/adr/ADR-026-signed-evidence-key-rotation-and-temporal-trust.md`
- `ADR-027` — ADR-027 — İmzalı kanıt sağlayıcısı iptal listesi ve çevrimdışı güven önbelleği — `docs/adr/ADR-027-signed-evidence-revocation-list-and-offline-cache.md`
- `ADR-028` — ADR-028 — Güvenilen iptal listesi uç noktası ve TLS SPKI pin döndürme — `docs/adr/ADR-028-trusted-revocation-endpoint-and-tls-pin-rotation.md`
- `ADR-029` — ADR-029 — Doğrulanmış Aile Verisi İçe Aktarma ve Kontrollü Geri Alma — `docs/adr/ADR-029-validated-family-data-import-and-controlled-rollback.md`
- `ADR-030` — ADR-030 — Anahtar Tabanlı Sayfalama ve Sınırlı Renderer Penceresi — `docs/adr/ADR-030-keyset-pagination-and-bounded-rendering.md`
- `ADR-031` — ADR-031 — Content-addressed npm dependency handoff — `docs/adr/ADR-031-content-addressed-npm-dependency-handoff.md`
- `ADR-032` — ADR-032 — Sınırlı Başlangıç ve Ekran Bazlı Tembel Veri Yükleme — `docs/adr/ADR-032-bounded-bootstrap-and-screen-lazy-loading.md`
- `ADR-033` — ADR-033 — Arama Destekli Keyset Kişi ve Olay Katalogları — `docs/adr/ADR-033-searchable-keyset-entity-catalogs.md`
- `ADR-034` — ADR-034 — Oturum güvenli asenkron state ve monoton mutasyon sıralaması — `docs/adr/ADR-034-session-safe-async-state-ordering.md`
- `ADR-035` — ADR-035 — İstek, oturum ve revizyon bağlı IPC taşıması — `docs/adr/ADR-035-request-session-revision-bound-ipc-transport.md`
- `ADR-036` — ADR-036 — İptal edilebilir IPC istek yaşam döngüsü — `docs/adr/ADR-036-cancellable-ipc-request-lifecycle.md`
- `ADR-037` — ADR-037 — Revizyon kapsamlı IPC salt okuma paylaşımı — `docs/adr/ADR-037-revision-scoped-ipc-read-sharing.md`
- `ADR-038` — ADR-038 — Gizlilik Güvenli IPC Performans Telemetrisi — `docs/adr/ADR-038-privacy-safe-ipc-performance-telemetry.md`
- `ADR-039` — ADR-039 — Fail-Closed Adaptif IPC Kaynak Bütçeleri — `docs/adr/ADR-039-fail-closed-adaptive-ipc-resource-budgets.md`
- `ADR-040` — ADR-040 — Crash-Safe Adaptive Budget State and Tamper-Evident Decision Journal — `docs/adr/ADR-040-crash-safe-adaptive-budget-state-and-decision-journal.md`
- `ADR-041` — ADR-041 — Yetkili Adaptif Bütçe Sıfırlama ve Gizlilik Güvenli Tanı Paketi — `docs/adr/ADR-041-authenticated-adaptive-budget-reset-and-privacy-safe-diagnostics.md`
- `ADR-042` — ADR-042 — Tek Kullanımlık Adaptif Bütçe Bakım Oturumları — `docs/adr/ADR-042-single-use-adaptive-budget-maintenance-sessions.md`
- `ADR-043` — ADR-043 — Adaptif IPC bakım yeniden doğrulamasında sınırlı deneme ve geçici kilit — `docs/adr/ADR-043-bounded-maintenance-reauthentication-attempts.md`
- `ADR-044` — ADR-044 — Bakım yeniden doğrulama kilidinin işletim sistemi korumasıyla kalıcılaştırılması — `docs/adr/ADR-044-os-protected-maintenance-reauthentication-state.md`
- `ADR-045` — ADR-045 — Cihaz bağlı bakım yeniden doğrulama durumu yaşam döngüsü — `docs/adr/ADR-045-device-bound-maintenance-reauthentication-state-lifecycle.md`
- `ADR-046` — ADR-046 — Yetkili bakım kilidi kurtarma — `docs/adr/ADR-046-authorized-maintenance-lock-recovery.md`
- `ADR-047` — ADR-047 — Kurtarma Sonrası Oturum Sonlandırma ve Soğuma Süresi — `docs/adr/ADR-047-post-recovery-session-termination-and-cooldown.md`
- `ADR-048` — ADR-048 — Bakım kurtarması sonrası hesap güvenlik dönemi — `docs/adr/ADR-048-account-security-epoch-after-maintenance-recovery.md`
- `ADR-049` — ADR-049 — Güvenlik Dönemine Bağlı Oturum, Cihaz Yeniden Yetkilendirme ve İmzalı Makbuz — `docs/adr/ADR-049-epoch-bound-session-device-reauthorization-receipts.md`
- `ADR-050` — ADR-050 — Ayrı Güvenlik Merkezi Menüsü ve Renderer Bileşen Sınırı — `docs/adr/ADR-050-dedicated-security-center-menu-and-renderer-boundary.md`
- `ADR-051` — ADR-051 — Kalıcı İmzalı Güvenlik Makbuzu Geçmişi — `docs/adr/ADR-051-persistent-signed-security-receipt-history.md`
- `ADR-052` — ADR-052 — Sürüm kanalı menü rengi ve aile yakınlık kataloğu — `docs/adr/ADR-052-release-channel-menu-color-and-family-relationship-catalog.md`
- `ADR-053` — ADR-053 — Katı Bronze geliştirme ve ağır API erteleme yönetişimi — `docs/adr/ADR-053-strict-bronze-development-and-api-deferral-governance.md`
- `ADR-054` — ADR-054 — Korumalı periyodik iptal listesi eşitleme durumu — `docs/adr/ADR-054-protected-periodic-revocation-sync-state.md`
- `ADR-055` — ADR-055 — Kurum Dışı Çift Kanıtlı Kök Güven Doğrulaması — `docs/adr/ADR-055-out-of-band-dual-evidence-root-trust-verification.md`
- `ADR-056` — ADR-056 — Otomatik Temiz Yedek Yeniden Yazımı ve Karantina — `docs/adr/ADR-056-automatic-clean-backup-rewrite-and-quarantine.md`
- `ADR-057` — ADR-057 — Atomik Temiz Yedek Sonuçlandırma ve Kalıcı Çalışma Defteri — `docs/adr/ADR-057-atomic-clean-backup-rewrite-finalization-ledger.md`
- `ADR-058` — ADR-058 — Monotonik Yönetilen Yedek Yayılım Kronolojisi — `docs/adr/ADR-058-monotonic-managed-backup-propagation-chronology.md`
- `ADR-059` — ADR-059: Bağlı Temiz Yedek Yeniden Yazım Kronolojisi — `docs/adr/ADR-059-linked-clean-backup-rewrite-chronology.md`
- `ADR-060` — ADR-060 — Yeniden Başlatmaya Dayanıklı Temiz Yedek Kurtarma Kronolojisi — `docs/adr/ADR-060-restart-safe-clean-backup-rewrite-recovery.md`
- `ADR-061` — ADR-061 — Geri Alma Güvenli Temiz Yedek Çalışma Sahiplenmesi — `docs/adr/ADR-061-rollback-safe-clean-backup-rewrite-claim.md`
- `ADR-062` — ADR-062 — Temiz Yedek Yeniden Yazım Operasyonel İzolasyonu — `docs/adr/ADR-062-clean-backup-rewrite-operational-isolation.md`
- `ADR-063` — ADR-063 — Monotonik Temiz Yedek Terminal Kronolojisi — `docs/adr/ADR-063-monotonic-clean-backup-rewrite-terminal-chronology.md`
- `ADR-064` — ADR-064 — Tetikleyiciye Duyarlı Temiz Yedek Geri Çekilmesi — `docs/adr/ADR-064-trigger-aware-clean-backup-rewrite-backoff.md`
- `ADR-065` — ADR-065 — Otomatik Politikadan Bağımsız Manuel Temiz-Yedek Kullanılabilirliği — `docs/adr/ADR-065-manual-clean-backup-rewrite-availability.md`
- `ADR-066` — ADR-066 — Çalışan Temiz-Yedek Defteri Sahip Kimliği — `docs/adr/ADR-066-running-clean-backup-ledger-owner-identity.md`
- `ADR-067` — ADR-067 — Temiz-Yedek Claim Rezervasyonu — `docs/adr/ADR-067-clean-backup-rewrite-claim-reservation.md`
- `ADR-068` — ADR-068 — Değiştirilemez Aktif Temiz-Yedek Sahiplik Anlık Görüntüsü — `docs/adr/ADR-068-immutable-active-clean-rewrite-ownership-snapshot.md`
- `ADR-069` — ADR-069 — Aktif Temiz-Yedek Politika Parametreleri Değiştirilemez — `docs/adr/ADR-069-immutable-active-clean-rewrite-policy-parameters.md`
- `ADR-070` — ADR-070 — Atomik temiz-yedek terminal geçişi — `docs/adr/ADR-070-atomic-clean-rewrite-terminal-transition.md`
- `ADR-071` — ADR-071 — Terminal temiz-yedek kronoloji monotonluğu — `docs/adr/ADR-071-terminal-clean-rewrite-chronology-monotonicity.md`
- `ADR-072` — ADR-072 — Clean Backup Rewrite Propagation Outcome Integrity — `docs/adr/ADR-072-clean-backup-rewrite-propagation-outcome-integrity.md`
- `ADR-073` — ADR-073 — Clean backup rewrite propagation status integrity — `docs/adr/ADR-073-clean-backup-rewrite-propagation-status-integrity.md`
- `ADR-074` — ADR-074 — Propagation sonucu tekil sahipliği — `docs/adr/ADR-074-clean-backup-rewrite-propagation-uniqueness.md`
- `ADR-075` — ADR-075 — Propagation reference permanence — `docs/adr/ADR-075-clean-backup-rewrite-propagation-reference-permanence.md`
- `ADR-076` — ADR-076 — Bağlı propagation kanıtını dondurma — `docs/adr/ADR-076-clean-backup-rewrite-propagation-evidence-immutability.md`
- `ADR-077` — ADR-077 — Referanslanmış propagation kimliğinde INSERT koruması — `docs/adr/ADR-077-clean-backup-rewrite-propagation-replace-bypass-protection.md`
- `ADR-078` — ADR-078 — Ana Build Defteri ve Sohbetten Bağımsız Süreklilik — `docs/adr/ADR-078-master-build-ledger-continuity.md`
- `ADR-079` — ADR-079 — Bağlayıcı proje kurallarının zorunlu başlangıç kapısı — `docs/adr/ADR-079-project-rules-mandatory-startup.md`
- `ADR-080` — ADR-080 — Sohbet bağlam kapasitesi ve zorunlu yeni-sohbet devir kapısı — `docs/adr/ADR-080-conversation-context-capacity-handoff-gate.md`
- `ADR-081` — ADR-081 — Proje Anayasası V3 fail-closed yönetişim kapıları — `docs/adr/ADR-081-project-constitution-v3-governance.md`
- `ADR-082` — ADR-082 — Secure onboarding and user-data vault — `docs/adr/ADR-082-secure-onboarding-user-data-vault.md`
- `ADR-083` — ADR-083 — Terminal temiz-yedek ledger satırlarını SQLite düzeyinde değişmez kılma — `docs/adr/ADR-083-clean-backup-terminal-ledger-immutability.md`
- `ADR-084` — ADR-084 - fail-closed dependency acquisition handoff — `docs/adr/ADR-084-clean-install-external-access-handoff.md`
- `ADR-085` — ADR-085 — Onaylı UI baseline hash sabitlemesi — `docs/adr/ADR-085-approved-ui-visual-baseline-hash-pinning.md`
- `ADR-086` — ADR-086 — Bellek-içi SQLite ve Windows EFS korumalı bounded staging — `docs/adr/ADR-086-memory-resident-sqlite-windows-efs-staging.md`
- `ADR-087` — ADR-087 — Protected Side Artifact güvenlik sınırı — `docs/adr/ADR-087-protected-side-artifact-boundary.md`
- `ADR-088` — ADR-088 — Adımlı doğrulama ve kalıcı ilerleme kanıtı — `docs/adr/ADR-088-pr171-stepwise-validation-persistence.md`
- `ADR-089` — ADR-089 — Gerçek Windows EFS/DPAPI ve paketli Electron kanıt mimarisi — `docs/adr/ADR-089-real-windows-efs-dpapi-packaged-evidence.md`
- `ADR-090` — ADR-090 — Windows evidence intake ve exact-source binding mimarisi — `docs/adr/ADR-090-windows-evidence-intake-and-source-binding.md`
- `ADR-091` — ADR-091 — OPEN-021 EFS-only gerçek Windows kanıt mimarisi — `docs/adr/ADR-091-open021-efs-only-real-windows-proof.md`
- `ADR-092` — ADR-092 — OPEN-022 safeStorage/DPAPI ve Protected Side Artifact gerçek Windows kanıt mimarisi — `docs/adr/ADR-092-open022-dpapi-protected-side-artifact-proof.md`
- `ADR-093` — ADR-093 — Birleşik Bronze gerçek Windows güvenlik yaşam döngüsü — `docs/adr/ADR-093-unified-bronze-windows-security-lifecycle.md`
- `ADR-094` — ADR-094 — Isolated Windows packager bootstrap ve PowerShell 5.1 kanıt kodlaması — `docs/adr/ADR-094-windows-packager-bootstrap-and-ps51-evidence-encoding.md`
- `ADR-095` — ADR-095 — Windows package lifecycle öncesi workspace build prerequisite — `docs/adr/ADR-095-workspace-package-build-before-windows-package.md`
- `ADR-096` — ADR-096 — Preload global lifecycle typing — `docs/adr/ADR-096-preload-global-lifecycle-typing.md`
- `ADR-097` — ADR-097 — Preload CommonJS staging graph — `docs/adr/ADR-097-preload-commonjs-staging-graph.md`
- `ADR-098` — ADR-098 — Deterministik NSIS lisans kaynak senkronizasyonu — `docs/adr/ADR-098-deterministic-nsis-license-source-sync.md`
- `ADR-099` — ADR-099 — Fail-closed Windows EFS, safeStorage and startup evidence — `docs/adr/ADR-099-fail-closed-windows-efs-safestorage-startup-evidence.md`
- `ADR-100` — ADR-100 — Platform-actual conversation capacity gate — `docs/adr/ADR-100-platform-actual-conversation-capacity-gate.md`
- `ADR-101` — ADR-101 — Protected Device Identity Before Device-Bound Maintenance Restore — `docs/adr/ADR-101-protected-device-identity-before-device-bound-maintenance-restore.md`
- `ADR-102` — ADR-102 — Build227 Windows Persistence and Closure Remediation — `docs/adr/ADR-102-build227-windows-persistence-and-closure-remediation.md`
- `ADR-103` — ADR-103 — Build227 Evidence-Bound Bronze OPEN Closure — `docs/adr/ADR-103-build227-evidence-bound-bronze-open-closure.md`
- `ADR-104` — ADR-104 — Monthly Channel Release Identity — `docs/adr/ADR-104-monthly-channel-release-identity.md`
- `ADR-105` — ADR-105 — Single Platform Policy Kernel — `docs/adr/ADR-105-platform-policy-kernel.md`
- `ADR-106` — ADR-106 — Headless Core Service Boundary — `docs/adr/ADR-106-headless-core-service-boundary.md`
- `ADR-107` — ADR-107 — Adaptif IPC bakımında güçlü yeniden doğrulama — `docs/adr/ADR-107-adaptive-ipc-maintenance-strong-reauthentication.md`

## 13. Kanonik kurallar — eksiksiz

- **PR-001 [SUPERSEDED]** — Tüm proje ailesinin üst markası Latince “Panthera pardus tulliana”dır. Uygulama adı üst markadan ayrıdır ve bu uygulamanın resmî adı “Anadolu Parsı Aile Yaşam Merkezi”dir; yeni uygulamalar “Anadolu Parsı” adına içeriklerini tanımlayan ek ad alır. Üst marka adı normal uygulama kullanıcı arayüzünde gösterilmez.
- **PR-002 [ACTIVE]** — Bu projenin tek geçerli kaynak başlangıcı 20 Temmuz 2026’dır. Bu tarihten önceki sohbet, dosya, karar, proje veya yatırım/otomatik alım-satım çalışması bu projeyle ilişkilendirilemez, bağlam kaynağı yapılamaz veya proje geçmişi olarak kullanıcıya sunulamaz.
- **PR-003 [ACTIVE]** — Sistemin kök iş varlığı Aile’dir; kişi, hesap, aile, aile dalı, hane ve üyelik ayrı kavramlardır.
- **PR-004 [ACTIVE]** — Kullanıcı kapsamı yalnız çekirdek aileyle sınırlı değildir; uygun rol, amaç ve süreyle yetkilendirilen diğer kişiler de sisteme dahil olabilir.
- **PR-005 [SUPERSEDED]** — Aktif ana ürün 16 modülden oluşur: Gösterge Paneli, Aile, Soy Ağacı, Zaman Tüneli, Önemli Günler, Arşiv, Finans, Sağlık, Yaşam Merkezi, Bildirim ve Otomasyon, Raporlama, Konum, Yetkiler, Yapay Zekâ, Dijital Miras ve Ayarlar.
- **PR-006 [ACTIVE]** — Her yetişkin kendi özel verisinin sahibidir.
- **PR-007 [ACTIVE]** — Aile yöneticisi olmak sağlık, finans, konum, özel belge veya kişisel zaman tüneli verilerine otomatik erişim sağlamaz.
- **PR-008 [ACTIVE]** — Yetkilendirme yalnız role göre yapılamaz; veri sahibi, nesne, işlem, aile dalı, amaç, süre ve açık izin/ret birlikte değerlendirilir.
- **PR-009 [ACTIVE]** — Açık ret, rol veya varsayılan iznin her zaman üzerindedir.
- **PR-010 [ACTIVE]** — Finans ve sağlık yüksek hassasiyetli veri alanlarıdır; kişisel varlık ve borçlar başka aile üyesine otomatik katılmaz, ortak varlık/borç sahiplik oranıyla ele alınır.
- **PR-011 [ACTIVE]** — Canlı konum yalnız açık rıza, amaç ve süreyle paylaşılır; görünür gösterge, otomatik sona erme ve audit kaydı zorunludur.
- **PR-012 [ACTIVE]** — Başlangıç mimarisi modüler monolittir ve gelecekte servis/platform ayrışmasına açık kalmalıdır.
- **PR-013 [ACTIVE]** — Temel bağımlılık yönü UI → Application → Domain → Infrastructure şeklindedir.
- **PR-014 [ACTIVE]** — Renderer ve Application katmanı doğrudan ham SQL veya native SQLite çalıştıramaz.
- **PR-015 [ACTIVE]** — Migration SQL sahipliği database katmanındadır.
- **PR-016 [ACTIVE]** — Somut repository implementasyonları merkezi composition root üzerinden oluşturulur.
- **PR-017 [ACTIVE]** — Ortak servislerin tek otoritesi Core Platform’dur; modüller içinde ikinci bağımsız ortak servis kopyaları oluşturulamaz.
- **PR-018 [ACTIVE]** — Sistem yerel öncelikli (local-first) çalışır.
- **PR-019 [ACTIVE]** — Birincil veri kullanıcının cihazındadır.
- **PR-020 [ACTIVE]** — Bulut hesabı temel kullanım için zorunlu değildir.
- **PR-021 [ACTIVE]** — Çevrimdışı kullanım temel davranıştır.
- **PR-022 [ACTIVE]** — Büyük dosyalar şifreli kasada, metadata ve ilişkiler SQLite’ta tutulur.
- **PR-023 [ACTIVE]** — Veri şeması sürümlüdür.
- **PR-024 [ACTIVE]** — Geri döndürülemez migration, gerçek veri silme veya veri mülkiyetini değiştiren işlem açık kullanıcı onayı olmadan yapılamaz.
- **PR-025 [ACTIVE]** — Önemli veri değişiklikleri aktör, zaman, eski/yeni değer ve gerekçeyle izlenebilir olmalıdır.
- **PR-026 [ACTIVE]** — Temel güvenlik ilkesi varsayılan reddetmedir; açık izin yoksa kritik işlem reddedilir.
- **PR-027 [ACTIVE]** — En az yetki ilkesi zorunludur.
- **PR-028 [ACTIVE]** — Windows Hello tercihli kimlik doğrulamadır; güçlü yerel parola yedek yöntemdir.
- **PR-029 [ACTIVE]** — TOTP, tek kullanımlık kurtarma kodları ve FIDO2/WebAuthn desteklenir.
- **PR-030 [ACTIVE]** — Varsayılan boşta kalma oturum süresi 15 dakikadır.
- **PR-031 [ACTIVE]** — Beş başarısız giriş 15 dakikalık kilit oluşturur.
- **PR-032 [ACTIVE]** — Giriş, kilit, parola ve cihaz işlemleri audit edilir.
- **PR-033 [ACTIVE]** — Yeni cihaz eski cihaz güvenini otomatik devralamaz.
- **PR-034 [ACTIVE]** — Yedekten geri yükleme yeni cihaza otomatik yetki vermez.
- **PR-035 [ACTIVE]** — Taşınabilir kullanıcı verisi ile cihaza bağlı güvenlik sırları ayrıdır.
- **PR-036 [ACTIVE]** — Güvenlik kontrolü sessizce kaldırılamaz veya zayıflatılamaz; karar kaydı, risk/etki analizi ve ürün sahibi onayı gerekir.
- **PR-037 [ACTIVE]** — Electron renderer nodeIntegration:false, contextIsolation:true ve sandbox:true ile çalışır.
- **PR-038 [ACTIVE]** — IPC yalnız kayıtlı ana renderer, ana frame ve güvenilir belgeden kabul edilir.
- **PR-039 [ACTIVE]** — IPC payload’ları merkezi boyut, derinlik ve güvenlik kontrolünden geçer.
- **PR-040 [ACTIVE]** — Webview, izinsiz navigation, redirect, download ve permission talepleri varsayılan reddedilir.
- **PR-041 [ACTIVE]** — AI sağlayıcısı varsayılan kapalıdır.
- **PR-042 [ACTIVE]** — AI yalnız kullanıcının hem veri erişimine hem AI işlemesine izin verdiği kayıtları kullanabilir.
- **PR-043 [ACTIVE]** — Sağlık, finans, çocuk ve canlı konum AI açısından yüksek hassasiyetlidir.
- **PR-044 [ACTIVE]** — AI önerileri insan onayı olmadan kesin veya otoritatif kayıt oluşturamaz.
- **PR-045 [ACTIVE]** — Kullanıcı AI hafızasını görebilmeli, düzeltebilmeli, sınırlandırabilmeli ve silebilmelidir.
- **PR-046 [ACTIVE]** — Yedek hedefleri yerel disk, harici disk ve bulut sağlayıcı adaptörü olarak birbirinden bağımsız çalışır.
- **PR-047 [ACTIVE]** — Bir yedek hedefinin arızası diğer hedefleri durduramaz.
- **PR-048 [ACTIVE]** — Her yedek hedefi için bağlantı, boş alan, son başarı, doğrulama, boyut, hash, hız ve hata ayrı izlenir.
- **PR-049 [ACTIVE]** — Her zaman en az bir tam ve doğrulanmış yedek korunmalıdır.
- **PR-050 [ACTIVE]** — OneDrive ilk öncelikli bulut hedefidir; mimari iCloud, Google Drive ve diğer sağlayıcılara adapter ile açık kalır.
- **PR-051 [ACTIVE]** — Yedek şifreli ve doğrulanmış olmak zorundadır.
- **PR-052 [ACTIVE]** — Restore öncesi bütünlük kontrolü yapılır.
- **PR-053 [ACTIVE]** — Bozuk veri izole edilir ve rollback imkânı bulunur.
- **PR-054 [ACTIVE]** — Yeni cihaz restore işleminden sonra yeniden kimlik ve cihaz yetkilendirmesi gerekir.
- **PR-055 [ACTIVE]** — İlk içe alınan dosya sürümü değişmez dijital kanıt olarak korunur.
- **PR-056 [ACTIVE]** — Arşivleme silme değildir; arşivlenen kayıt aktif görünümden çıkar fakat veri korunur.
- **PR-057 [ACTIVE]** — Kalıcı imha işlemleri güçlü doğrulama ve kayıt gerektirir.
- **PR-058 [ACTIVE]** — SSD/TRIM/wear-leveling gibi teknik sınırlar nedeniyle doğrulanamayan fiziksel silme için mutlak imha iddiası yapılamaz.
- **PR-059 [ACTIVE]** — Dijital miras işlemleri geri döndürülebilir tasarlanır.
- **PR-060 [ACTIVE]** — Vefat sonrası kritik erişim/içerik işlemleri en az iki yönetici onayı, bekleme süresi, audit ve iptal/geri alma mekanizması gerektirir.
- **PR-061 [ACTIVE]** — İlk gerçek geliştirme ve kullanım platformu Windows masaüstüdür.
- **PR-062 [ACTIVE]** — Mimari macOS, iPhone, iPad, Apple Watch ve Apple Vision Pro’ya genişlemeye uygun tutulur.
- **PR-063 [ACTIVE]** — Apple/mobil istemciler ilk aşamada Windows çekirdeğinden veri alan companion istemcilerdir.
- **PR-064 [ACTIVE]** — Mobil istemci bağımsız ana veri kaynağı veya bağımsız işlem motoru değildir.
- **PR-065 [ACTIVE]** — Arayüz Apple tasarım ilkelerinden esinlenir ancak özgün Anadolu Parsı marka kimliği kullanır.
- **PR-066 [ACTIVE]** — Apple font dosyaları uygulamaya gömülmez; yerel sistem fontu ve güvenli fallback zinciri kullanılır.
- **PR-067 [ACTIVE]** — Klavye kullanımı desteklenmek zorundadır.
- **PR-068 [ACTIVE]** — Ekran okuyucu etiketleri zorunludur.
- **PR-069 [ACTIVE]** — Ölçeklenebilir metin, yüksek kontrast, görünür odak ve renk dışı durum anlatımı zorunludur.
- **PR-070 [ACTIVE]** — Hata mesajı sorunu ve kullanıcının yapması gereken eylemi birlikte açıklamalıdır.
- **PR-071 [ACTIVE]** — Temel etkileşim hedefi en az 44 px olmalıdır.
- **PR-072 [ACTIVE]** — Geri döndürülebilir teknik iyileştirmeler için her seferinde ayrıca kullanıcı onayı gerekmez.
- **PR-073 [ACTIVE]** — Kapsam değişikliği ayrıca açık kullanıcı onayı gerektirir.
- **PR-074 [ACTIVE]** — Geri döndürülemez işlem ayrıca açık kullanıcı onayı gerektirir.
- **PR-075 [ACTIVE]** — Gerçek veri silme ayrıca açık kullanıcı onayı gerektirir.
- **PR-076 [ACTIVE]** — Veri mülkiyetini etkileyen değişiklik ayrıca açık kullanıcı onayı gerektirir.
- **PR-077 [ACTIVE]** — Hukuki veya finansal taahhüt ayrıca açık kullanıcı onayı gerektirir.
- **PR-078 [ACTIVE]** — Güvenlik kontrolünü zayıflatma ayrıca açık kullanıcı onayı gerektirir.
- **PR-079 [ACTIVE]** — Üretim yayını ayrıca açık kullanıcı onayı gerektirir.
- **PR-080 [ACTIVE]** — Bronze aktif geliştirme kanalıdır.
- **PR-081 [ACTIVE]** — Silver test, kullanıcı kabulü ve geniş doğrulama kanalıdır.
- **PR-082 [ACTIVE]** — Gold gerçek üretim ve gerçek kullanım kanalıdır.
- **PR-083 [ACTIVE]** — Hiçbir yayın aşamasına otomatik terfi yapılmaz.
- **PR-084 [SUPERSEDED]** — Güncel aşama kullanıcı tarafından değiştirilmedikçe Bronze RC2 Active Development olarak kabul edilir.
- **PR-085 [SUPERSEDED]** — Bronze Final, Code Freeze, Silver veya Gold kendiliğinden ilan edilemez.
- **PR-086 [ACTIVE]** — Çalıştırılmamış hiçbir test veya doğrulama PASS sayılamaz.
- **PR-087 [ACTIVE]** — Çalıştırılmayan compile, type-check, test, build, smoke, Windows launch, installer, screenshot veya UAT kapısı NOT_RUN kalır.
- **PR-088 [ACTIVE]** — Tanı amaçlı --no-sandbox çalıştırması resmî PASS değildir; yalnız DIAGNOSTIC_PASS olarak ayrılır.
- **PR-089 [ACTIVE]** — Ara Bronze buildlerinde hedefli regresyon, mimari ve güvenlik kontrolleri uygulanabilir; tam UAT ve toplu ekran görüntüleri final hazırlığına bırakılabilir.
- **PR-090 [ACTIVE]** — Final hazırlığında doğrulama sırası: temiz npm ci, tam tsc --noEmit, tüm testler, Electron production build, blocking smoke, sandbox’lı gerçek Windows açılışı, kurulum/açılış/kaldırma, installer doğrulaması, ekran görüntüleri ve kullanıcı dokümantasyonudur.
- **PR-091 [ACTIVE]** — Zorunlu doğrulama kapıları geçmeden Final, Silver veya Gold kararı verilmez.
- **PR-092 [ACTIVE]** — Her kaynak teslimi manifest ile doğrulanır.
- **PR-093 [ACTIVE]** — Her kaynak tesliminde SHA256SUMS.txt bulunur.
- **PR-094 [ACTIVE]** — Kaynak ZIP deterministik olmalıdır.
- **PR-095 [ACTIVE]** — Kaynak ZIP’in ayrı dış SHA-256 kanıtı bulunmalıdır.
- **PR-096 [ACTIVE]** — Aynı kaynak ağacından iki kez üretilen arşiv byte düzeyinde aynı olmalıdır.
- **PR-097 [ACTIVE]** — Kod ile bağlayıcı belge çelişemez.
- **PR-098 [ACTIVE]** — Mimari, veri şeması, güvenlik, UI/UX, platform, kapsam veya sürüm değişikliği ilgili belgelere işlenir.
- **PR-099 [ACTIVE]** — Her yeni bağlayıcı karar benzersiz DEC-xxx kimliğiyle izlenir.
- **PR-100 [ACTIVE]** — Karar kaydında tarih, etkilenen belgeler, kod karşılığı ve doğrulama kanıtı bulunur.
- **PR-101 [ACTIVE]** — Gerekli belge güncellenmeden ilgili kapsam tamamlandı sayılamaz.
- **PR-102 [ACTIVE]** — Tarihsel belgeler silinmez ancak güncel aktif belgelerin önüne geçemez.
- **PR-103 [SUPERSEDED]** — Ana Build Defteri projenin tek yetkili devam noktasıdır; yeni sohbet veya geliştirme oturumu önce bu dosyayı ve güncel kural setini okumalıdır.
- **PR-104 [SUPERSEDED]** — Her build Ana Build Defteri’ne işlenmeden, kural seti SHA-256 özetiyle kabul edilmeden ve build sonrası kullanıcı durum bildirimi kaydedilmeden tamamlanmış sayılamaz.
- **PR-105 [SUPERSEDED]** — Geçmiş build kayıtları geriye dönük değiştirilmez; düzeltme yeni build kaydıyla açıklanır ve yapılan/kalan işler tek Ana Build Defteri üzerinden yürütülür.
- **PR-106 [SUPERSEDED]** — Her build tamamlandıktan sonra sohbet bağlamının tahmini kullanılan ve kalan yüzdesi hesaplanır, Ana Build Defteri build kaydına yazılır ve build sonu kullanıcı durum bildiriminde açıkça belirtilir.
- **PR-107 [SUPERSEDED]** — Sohbet bağlamı için yüzde 85-89 tahmini kullanım uyarı bölgesidir; kullanıcıya yaklaşan sohbet devri bildirilir ve uzun yeni işlerin aynı sohbette başlatılmasından kaçınılır.
- **PR-108 [SUPERSEDED]** — Sohbet bağlamının tahmini kullanımı yüzde 90 veya üzerindeyse yeni build başlatılamaz; mevcut tamamlanmış build devir noktası olarak korunur ve build başlangıç kapısı işlemi reddeder.
- **PR-109 [SUPERSEDED]** — Yüzde 90 veya üzeri tahmini sohbet kullanımında yeni sohbet için kopyalanabilir devir promptu zorunlu olarak üretilir; prompt son build/sürüm/durum, güncel kural sürümü ve SHA-256, sıradaki açık iş, kalan işler, yetkili Ana Build Defteri ve kaynak paket konumunu içermelidir.
- **PR-110 [ACTIVE]** — Yeni sohbet, üretilmiş devir promptu ve Ana Build Defteri üzerinden devam eder; kullanıcıdan proje kurallarını veya nerede kalındığını yeniden öğretmesi istenmez.
- **PR-111 [ACTIVE]** — Yüzde 90 sohbet devri eşiği istisnasızdır; eşik aşıldığında teknik kolaylık, aciliyet veya küçük değişiklik gerekçesiyle aynı sohbette yeni build başlatma yolu açılamaz.
- **PR-112 [ACTIVE]** — 20 Temmuz 2026 öncesi bütün sohbet, belge, dosya, karar ve bağlam bu proje için FORBIDDEN_SOURCE kabul edilir; aynı bilgi ancak 20 Temmuz 2026 veya sonrasında açıkça yeniden kabul edilmiş bir kaynakta yer alıyorsa kullanılabilir.
- **PR-113 [ACTIVE]** — Eski sohbetler veya eski projeler silinemese dahi bu projeyle ilişkilendirilemez, bunlardan bilgi aktarılmaz, proje yanıtlarında gösterilmez ve yeni build planı türetilmez.
- **PR-114 [ACTIVE]** — Kullanıcı yeni bir öneri ilettiğinde öneri uygulanmadan önce kapsam, mimari, güvenlik, gizlilik, veri bütünlüğü, performans, UI/UX, erişilebilirlik, yedekleme, migration, rollback, test, platform, belge, süre ve teknik borç etkileri kapsamlı analiz edilir; optimize edilmiş öneri kullanıcıya sunulur ve kesin karar bu analiz üzerinden alınır.
- **PR-115 [ACTIVE]** — Her build sonunda tahmini kodlama tamamlanma yüzdesi, kalan kodlama yüzdesi, 20.07.2026 başlangıcından geçen süre, yakın dönem geliştirme hızı, tahmini Bronze Final/Silver/Gold veya genel bitiş tarihleri ve tahmin güven düzeyi hesaplanır; build sonu zorunlu bildirime ve Ana Build Defteri kaydına eklenir.
- **PR-116 [SUPERSEDED]** — Marka mimarisi zorunludur: üst marka “Panthera pardus tulliana”, kullanıcıya görünen uygulama adı “Anadolu Parsı Aile Yaşam Merkezi”dir; Latin üst marka adı normal uygulama ekranlarında kullanılmaz ve yeni uygulama adları “Anadolu Parsı + işlevsel ad” kuralını izler.
- **PR-117 [SUPERSEDED]** — Her buildde tüm aktif sürüm taşıyan kaynak, paket, APP_META, config, manifest, installer metadata, aktif belge ve teslim yüzeyi aynı build sürümüne yükseltilir; aktif alanda eski sürüm driftine veya build atlamasına izin verilmez. Tarihsel kanıt dosyaları kendi özgün build numarasını korur ve aktif dosyalardan açıkça ayrılır.
- **PR-118 [ACTIVE]** — 20 Temmuz 2026 öncesinde geliştirilmiş yatırım/otomatik işlem projesi, broker, Matriks, İş Yatırım, Deniz Yatırım, piyasa verisi veya otomatik emir kararları bu projede bağlam, tasarım veya gereksinim kaynağı olarak kullanılamaz.
- **PR-119 [SUPERSEDED]** — API geliştirme önceliği yaşamsal ihtiyaca göre P0/P1/P2 olarak sınıflandırılır: yedekleme, yapay zekâ ve sistemin zorunlu çalışması için gerekli API/adapter sınırları P0’dır; çekirdek işlevi tamamlayanlar P1’dir; banka ve diğer kurum entegrasyonları P2’dir ve proje kararlı üretime girdikten yaklaşık 5-6 ay sonra değerlendirilir.
- **PR-120 [ACTIVE]** — UI Görsel Referans Manifestosu ve 20 Temmuz 2026 sonrası onaylanmış görseller bağlayıcı görsel baseline’dır. Silver’a geçmeden önce gerçek ekranlar bu baseline ile doğrulanır; renk, tipografi, hiyerarşi, navigasyon, bileşen ve erişilebilirlik sözleşmeleri karşılanmadan Silver başlatılamaz.
- **PR-121 [ACTIVE]** — Bronze Final’e kadar kullanıcıya sunulan bütün menü, düğme, form, bağlantı ve akış işlevsel olmalıdır. İşlevsiz placeholder UI, boş handler, erişilemeyen özellik veya kullanıcı yüzeyinde atıl işlev bulunamaz. Kararı iptal edilmiş üretim kodu ve UI kaldırılır.
- **PR-122 [ACTIVE]** — Üretim uygulaması nötr ve boş başlangıçla açılır; production seed/demo aile, kişi, soy ağacı, finans, sağlık, belge, konum veya olay verisi içeremez. Test fixture’ları yalnız test alanında anonim/nötr olabilir ve üretim paketine giremez.
- **PR-123 [ACTIVE]** — Her build sonunda bu projeye ait güncel bilgi, belge, kaynak, kural, karar, test, kanıt, görsel ve teslim dosyalarının tamamını indeksleyen PROJECT_ARTIFACT_INDEX.md ve PROJECT_ARTIFACT_INDEX.json üretilir; kullanıcıya ana teslim bağlantıları ve Artifact Index bağlantısı paylaşılır.
- **PR-124 [ACTIVE]** — Alınan her karar aynı build içinde güncel kural setine, Ana Karar Kaydı’na, etkilenen aktif mimari/güvenlik/UI/kapsam/test belgelerine, makine okunur politikalara, kod karşılığına ve Ana Build Defteri’ne yansıtılır; kod ve belge arasında bilinen drift ile build tamamlanamaz.
- **PR-125 [ACTIVE]** — Her build sonunda güncel Master Proje Dokümantasyonu hem DOCX hem PDF olarak üretilir ve doğrulanır; etkilenmiş aktif belgeler güncellenmeden ve güncel Word/PDF paketi oluşmadan build COMPLETED olamaz.
- **PR-126 [ACTIVE]** — Üretim uygulamasında, aktif kaynakta, aktif belgelerde, görsellerde ve teslim paketlerinde gerçek kişi adı, soyadı, aile adı, kişisel kimlik izi veya özel aile temsili bulunamaz; geçmiş demo aile/kişi kimlikleri de kaynakta tutulamaz. Kullanıcı tarafından sonradan girilen gerçek veriler bu kaynak yasağının dışındadır.
- **PR-127 [SUPERSEDED]** — Geliştirici/üretici/owner/author/copyright metadata dahil aktif proje metadata’sında doğal kişi kimliği kullanılmaz; gerekli sahiplik ve üretici ifadeleri yalnız marka kimliği “Panthera pardus tulliana” ve ürün kimliği üzerinden tutulur.
- **PR-128 [ACTIVE]** — Bağlayıcı UI baseline gerçek kaynak sözleşmeleriyle tutarlı olmalıdır: Apple uyumlu sistem font zinciri kullanılır, proprietary SF font dosyası gömülmez; aktif kanal menü rengi Bronze için bakır/bronz, Silver için gümüş, Gold için altın tokenlarından gelir ve renk tek başına anlam taşımaz.
- **PR-129 [ACTIVE]** — UI Görsel Referans Manifestosu kişisel/demo içerikten arındırılmış marka ve boş durum referansıdır; örnek kişi, aile, dosya, sağlık, finans veya özel yaşam verisi görsel baseline’a konulamaz.
- **PR-130 [ACTIVE]** — Aktif dosyalar ile tarihsel kanıt dosyaları açıkça sınıflandırılır. Aktif dosyalar güncel build sürümünde olmak zorundadır; tarihsel kanıtlar özgün sürümünü korur ve aktif ürün davranışını belirleyemez.
- **PR-131 [ACTIVE]** — Her buildde VERSION_SWEEP_GATE çalıştırılır; aktif sürüm taşıyan dosyalarda eski build/sürüm bulunursa build kapanışı reddedilir.
- **PR-132 [ACTIVE]** — Her buildde PERSONAL_IDENTITY_SWEEP_GATE çalıştırılır; aktif kaynak, üretim bundle girdileri, aktif belge ve görsel metadata’sında yasak kişisel kimlik bulunursa build kapanışı reddedilir.
- **PR-133 [ACTIVE]** — Her buildde PRODUCTION_CLEAN_DATA_GATE çalıştırılır; üretim başlangıç seed’i, demo kullanıcı/aile/kişisel kayıt ve production fixture sayısı sıfır olmadan build kapanışı reddedilir.
- **PR-134 [ACTIVE]** — Bronze Final öncesi DEAD_CODE_DEAD_UI_GATE çalıştırılır; kullanıcıya görünen işlevsiz UI ve açıkça iptal edilmiş/erişilemeyen üretim kodu sıfır hedefidir ve tespit edilen kalıntı Final’den önce kaldırılır.
- **PR-135 [ACTIVE]** — DOCUMENTATION_CLOSURE_GATE her buildde zorunludur; kararların etkilediği aktif belgeler, Master DOCX/PDF, Ana Build Defteri ve Artifact Index güncel değilse build kapanışı reddedilir.
- **PR-136 [ACTIVE]** — ARTIFACT_INDEX_GATE her buildde zorunludur; güncel buildin bütün ana teslimleri ve proje bilgi/belge bağlantıları tek indeks üzerinden izlenebilir olmadan teslim tamamlanmış sayılamaz.
- **PR-137 [ACTIVE]** — PROJECT_PROGRESS_MODEL ölçülebilir ve açıklanabilir olmalıdır; kodlama yüzdesi yalnız build sayısından türetilmez, tamamlanan/açık kod işlerinin ağırlıkları ve geliştirme hızıyla hesaplanır; tahminler kesin tarih değil güven düzeyi belirtilmiş yönetim tahminidir.
- **PR-138 [ACTIVE]** — PROJECT_PROVENANCE_GATE her sohbet ve build başında zorunludur; 20.07.2026 öncesi kaynağa dayanma girişimi fail-closed reddedilir ve yeni sohbet yalnız Ana Build Defteri ile 20 Temmuz sonrası yetkili kaynaklardan devam eder.
- **PR-139 [SUPERSEDED]** — API_PRIORITY_GATE çekirdek projeyi banka/kurum entegrasyonları nedeniyle geciktiremez; P0 yaşamsal adapter/altyapı işleri önce tamamlanır, P2 kurum entegrasyonları kararlı üretim sonrası döneme ertelenir.
- **PR-140 [ACTIVE]** — Bu proje kural seti Proje Anayasasıdır. Güncel anayasa kuralları istisnasız bağlayıcıdır; teknik kolaylık, hız, geçmiş uygulama, eski belge veya sohbet gerekçesiyle aşılamaz, sessizce esnetilemez veya atlanamaz. Değişiklik yalnız açık kullanıcı kararı, yeni build, yeni kural sürümü ve yeni SHA-256 ile yapılabilir.
- **PR-141 [ACTIVE]** — Windows ilk kurulumunda normal uygulama ekranından önce Anadolu Parsı marka kimliğine uygun tek seferlik tanıtım ve ilk kullanım sihirbazı çalışır; kullanıcı isterse tanıtımı daha sonra Ayarlar üzerinden yeniden açabilir.
- **PR-142 [ACTIVE]** — İlk kullanım tanıtımı sesli Türkçe anlatım, görünür altyazı, sesi kapatma, anlatımı yeniden oynatma ve tanıtımı geçme seçeneklerini işlevsel olarak sunar; erişilebilirlik kullanıcı kontrolündedir.
- **PR-143 [ACTIVE]** — Marka anlatım sesi sakin, güven veren ve Anadolu Parsı kimliğine uygun olmalı; kesintisiz veya zorlayıcı ses kullanılmaz, kullanıcı sesleri tamamen kapatabilir.
- **PR-144 [ACTIVE]** — İlk kurulum tamamlandığında kısa ve rahatsız etmeyen Anadolu Parsı marka sesi ile onaylı geçiş animasyonu çalışır; sonraki açılışlarda bu efekt zorunlu değildir.
- **PR-145 [ACTIVE]** — İlk kurulum akışı kesintiye dayanıklıdır; tanıtım, kimlik oluşturma, güvenlik, kurtarma ve tamamlama adımları açık durum modeliyle yönetilir ve yarım kurulum normal uygulamaya geçemez.
- **PR-146 [ACTIVE]** — İlk kullanıcı yerel güçlü parola ile oluşturulabilir; parola koşulları ve eşleşme durumu yazım sırasında canlı ve erişilebilir biçimde gösterilir.
- **PR-147 [ACTIVE]** — Apple, Google ve Microsoft haricî kimlik sağlayıcıları aynı sağlayıcı-bağımsız OIDC katmanında tasarlanır; hiçbir sağlayıcı uygulama içi yetkilendirme veya aile verisine otomatik erişim vermez.
- **PR-148 [ACTIVE]** — Haricî OIDC akışları Authorization Code, PKCE, state ve nonce kontrolleri olmadan üretime açılamaz; tokenlar düz metin dosyada tutulamaz.
- **PR-149 [ACTIVE]** — Apple, Google veya Microsoft ile kimlik oluşturulsa bile çevrimdışı yerel erişim ve hesap kurtarma için Windows Hello, yerel parola veya eşdeğer cihaz-bağlı güvenli yöntem zorunlu olarak korunur.
- **PR-150 [ACTIVE]** — Yapılandırılmamış veya üretim kabulü tamamlanmamış haricî kimlik sağlayıcısı işlevsiz aktif düğme olarak gösterilemez; özellik fail-closed ve görünmez/kapalı kalır.
- **PR-151 [ACTIVE]** — İlk oluşturulan kullanıcı aile yöneticisi olabilir ancak bu rol diğer yetişkinlerin özel sağlık, finans, belge veya konum verilerine otomatik erişim hakkı vermez.
- **PR-152 [ACTIVE]** — İlk kurulumun güvenlik adımında Windows Hello uygun olduğunda önerilir; TOTP, tek kullanımlık kurtarma kodları ve FIDO2/WebAuthn destekleri mevcut anayasal güvenlik sınırlarıyla korunur.
- **PR-153 [ACTIVE]** — Kurtarma yöntemi oluşturulmadan ilk kimlik kurulumu güvenlik açısından tamamlanmış sayılmaz; kurtarma materyali kullanıcıya kontrollü biçimde sunulur ve production loglarına yazılmaz.
- **PR-154 [ACTIVE]** — Uygulama açılışında kullanıcı kimliği doğrulanmadan aile veritabanı, arşiv içerikleri, sağlık, finans, soy ağacı, zaman tüneli veya diğer kişisel veri depoları açılamaz ve okunamaz.
- **PR-155 [ACTIVE]** — Kalıcı kullanıcı verisi diskte AES-256-GCM veya eşdeğer güçlü doğrulanmış şifreleme altında tutulur; düz SQLite ana veritabanı uygulama kapalıyken kalıcı dosya olarak bırakılamaz.
- **PR-156 [ACTIVE]** — Kullanıcı veri anahtarının açılması hem kullanıcı sırrına/parolasına hem Windows safeStorage/DPAPI cihaz korumasına bağlanır; yalnız cihaz bağı veya yalnız parola tek başına kalıcı veri kasasını açmaya yetmez.
- **PR-157 [ACTIVE]** — Kasa başlığı kişisel veri içeremez; yalnız KDF parametreleri, rastgele tuzlar, anonim anahtar yuvası kimlikleri ve cihaz-korumalı şifreli anahtar zarfları gibi zorunlu kriptografik metadata tutulabilir.
- **PR-158 [ACTIVE]** — Başarısız parola veya kimlik doğrulama denemesinde şifresi çözülmüş kullanıcı verisi oturumu kalıcılaştırılamaz; geçici çalışma alanı derhal kapatılır ve silinir.
- **PR-159 [ACTIVE]** — Başarılı oturum kapatma, oturum zaman aşımı veya uygulama kapanışında veri deposu önce güvenli biçimde kapatılır, WAL checkpoint uygulanır, kalıcı kasa yeniden şifrelenir ve geçici düz çalışma dosyaları silinir.
- **PR-160 [ACTIVE]** — Geçici oturum verisi yalnız kimliği doğrulanmış aktif uygulama oturumu süresince oluşturulabilir; işletim sistemi izinleri mümkün olan en dar kullanıcı erişimiyle ayarlanır ve yol rastgele oturum kimliği taşır.
- **PR-161 [ACTIVE]** — Aynı Windows kullanıcı hesabı altında çalışan yönetici yetkili zararlı yazılıma karşı mutlak dosya erişim engeli iddia edilemez; Bronze Final öncesi sayfa-seviyesi/in-use şifreleme veya eşdeğer koruma değerlendirilip kanıtlanmalıdır.
- **PR-162 [ACTIVE]** — Arşiv belgesi şifresi çözülmüş geçici dosya olarak haricî uygulamaya shell/openPath ile verilemez; desteklenen türler yalnız uygulamanın güvenli önizleme yüzeyinde gösterilir ve geçici materyal mümkün olan en kısa sürede silinir.
- **PR-163 [ACTIVE]** — Desteklenmeyen belge türü güvenlik sınırını aşmak yerine fail-closed reddedilir; haricî uygulama açma ancak gelecekte açık kullanıcı kararı ve ayrı güvenlik tasarımıyla eklenebilir.
- **PR-164 [ACTIVE]** — Log, cache, diagnostic, export, migration backup, crash/evidence ve diğer yan artifactlar kişisel veya hassas içerik taşımayacak şekilde sanitize edilmeli veya şifrelenmelidir; bu kapanış Bronze Final kapısıdır.
- **PR-165 [ACTIVE]** — Uygulama öncesi oluşturulan runtime/log dosyaları yalnız kişisel olmayan operasyon metadata içerir; kimlik doğrulama öncesi hiçbir kişisel veri log, cache veya diagnostic alana yazılamaz.
- **PR-166 [ACTIVE]** — Parola değiştirildiğinde kullanıcı veri kasasının anahtar sarma bilgisi de atomik olarak yeni parolaya geçirilir; eski parola kasayı açmaya devam edemez.
- **PR-167 [ACTIVE]** — Haricî kimlik sağlayıcıları için gerçek üretim PASS iddiası sağlayıcı uygulama kaydı, Client ID/redirect URI, gerçek Windows oturumu, token kasası, iptal/çıkış ve hata senaryoları doğrulanmadan yapılamaz; aksi durum NOT_RUN/PENDING olarak raporlanır.
- **PR-168 [SUPERSEDED]** — Kalıcı proje kütüphanesi hiyerarşisi /Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi şeklindedir; bu uygulamaya ait yeni build, kaynak, belge, görsel, hash ve teslim kanıtları yalnız bu dal altında tutulur.
- **PR-169 [SUPERSEDED]** — Üst marka altındaki başka/eski proje dosyaları yalnız ad benzerliği nedeniyle Anadolu Parsı Aile Yaşam Merkezi klasörüne taşınamaz veya bağlam kaynağı sayılamaz; proje provenance sınırı fail-closed uygulanır.
- **PR-170 [ACTIVE]** — Build209 ve sonrasında onboarding, kimlik, veri kasası ve dosya erişimi güvenlik kapıları Anayasanın ayrılmaz parçasıdır; bu maddeler de diğer anayasa kuralları gibi yalnız açık kullanıcı kararı, yeni build, yeni sürüm ve yeni SHA-256 ile değiştirilebilir.
- **PR-171 [ACTIVE]** — Uzun veya zaman aşımı riski taşıyan geliştirme, doğrulama, belge üretimi, paketleme ve teslim işleri mümkün olan en küçük mantıksal ve bağımsız adımlara bölünmelidir. Her adım: 1. uygulanır, 2. doğrulanır, 3. sonucu kalıcı olarak kaydedilir, 4. kısa durum verilir, 5. ancak bundan sonra sonraki adıma geçilir. Tek seferde dev işlem zincirleri çalıştırma. Yalnız teknik olarak atomik olması zorunlu işlemler istisnadır. Bu kural anayasal ve aşılamazdır.
- **PR-172 [SUPERSEDED]** — PR-172 yalnız platform tarafından sağlanan gerçek sohbet bağlam kapasitesi yüzde 90 veya üzerindeyken HARD_STOP üretir. Tahmin, geçmiş build tahmini veya kullanılamayan platform sayacı HARD_STOP ya da zorunlu handoff sayılmaz. Gerçek kullanım yüzde 90 altındaysa zorunlu devir üretilmez. Gerçek HARD_STOP durumunda aynı sohbette yeni build başlatılmaz; aynı yanıt içinde tam kopyalanabilir devir metni gösterilir ve NEW_CHAT_HANDOFF_BUILDxxx.md oluşturulur.
- **PR-173 [ACTIVE]** — Kullanıcıya görünen aktif sürüm ve teslim adları yalnız “Bronze|Silver|Gold gg.aa.yyyy.aylık-sıra” biçimindedir. RC, RC2, MVP ve küresel Build numarası yalnız tarihsel kanıtlarda kalabilir; aktif UI, paket, belge ve teslim yüzeyinde kullanılamaz.
- **PR-174 [ACTIVE]** — Aylık derleme sayacı her takvim ayında yeniden başlar; ancak yeni ayın veya günün ilk geliştirmesi keyfî olarak 1 sayılmaz. Aynı ay içinde daha önce tamamlanmış gerçek derlemeler sayılır ve sıradaki sayı bu tarihsel sayının bir fazlasıdır.
- **PR-175 [ACTIVE]** — 04.08.2026 tarihine kadar kullanıcı tarafından kabul edilen tamamlama sözleşmesi, finans/bankacılık, dağıtık Windows platformu, Apple companion istemcileri, aile iletişimi ve toplantıları, uçtan uca şifreleme, çeviri, OCR, Platform Policy Kernel, hane operasyonları, afet, çocuk/eğitim, bakım/ileri yaş, ev-araç-eşya-evcil hayvan, mahremiyet, AI, aile hafızası, seyahat, Matter/akıllı ev, doğrulanabilir yetki kartları ve imzalı eklenti sistemi bağlayıcı Bronze kapsamıdır. Bu alanlar öneri olarak geri düşürülemez.
- **PR-176 [ACTIVE]** — Windows Desktop, Windows Core Service, cluster node/witness, macOS, iPhone, iPad, Apple Watch, Vision Pro, OCR/AI/çeviri workerları, iletişim ve entegrasyon servisleri aynı Platform Policy Kernel kararını ve security/privacy/retention/consent/audit yükümlülüklerini uygular; yerel bypass veya yalnız rol kontrolü yeni kodda yasaktır.
- **PR-177 [ACTIVE]** — Tek aktif yönetişim kaynağı config/canonical-rule-registry.json ve config/active-governance-ledger.json ikilisidir. Eski Ana Build Defteri, RC/MVP/Build belgeleri ve eski kural setleri tarihsel kanıttır; aktif kararı veya sürümü geçersiz kılamaz.
- **PR-178 [ACTIVE]** — Her geliştirme oturumu ve her aktif sürüm değişikliği, güncel kanonik kural SHA-256 özeti açıkça doğrulanmadan ve GOVERNED_PREFLIGHT PASS olmadan başlayamaz. Kapı başarısızsa işlem fail-closed durur.
- **PR-179 [ACTIVE]** — Her geliştirme teslimi GOVERNED_POSTFLIGHT çalıştırılmadan tamamlanamaz. Postflight; kural sicili, karar defteri, sürüm, kapsam gerçekliği, policy, kaynak bütünlüğü, belge envanteri, rapor alanları, kalıcı Library hedefi ve yapılmayan testlerin dürüst durumunu denetler.
- **PR-180 [SUPERSEDED]** — Yeni kaynak, belge, görsel, hash, manifest, doğrulama ve teslim kanıtları kalıcı olarak yalnız /Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi/<Görünür Sürüm>/ dalında tutulur. Library yükleme kanıtı olmadan teslim COMPLETED sayılamaz.
- **PR-181 [ACTIVE]** — /mnt/data yalnız geçici çalışma alanıdır. Kullanıcının Windows yerel diski, haricî diski veya OneDrive hedeflerine gerçek erişim ve yazma kanıtı yoksa bu hedeflere kayıt yapıldığı söylenemez; durum NOT_RUN/UNAVAILABLE olarak raporlanır.
- **PR-182 [ACTIVE]** — Her sürümde kaynak ağacındaki bütün dosyalar ve bütün belge/config/kanıt dosyaları hash, boyut, sınıf, aktif/tarihsel durumu ve göreli yolu ile eksiksiz indekslenir. Kullanıcıya tam belge dizini ile tam artifact index bağlantısı verilir; seçilmiş birkaç belgeyi “tüm belgeler” diye sunmak yasaktır.
- **PR-183 [ACTIVE]** — Her geliştirme sonu bildirimi en az şu alanları taşır: görünür sürüm; yapılan iş; tamamlanan gereksinim ve karar kimlikleri; değişen kaynak alanları; gerçek PASS/FAIL/NOT_RUN/BLOCKED sonuçları; açık hata ve riskler; ağırlıklı Bronze tamamlanma ve kalan yüzdesi; tahmini Bronze bitişi; tahmini Silver ve Gold geçiş tarih aralıkları; tahmin güveni; sohbet kapasitesi platform actual veya UNAVAILABLE; devir promptu durumu; kaynak ZIP/manifest/SHA; kalıcı Library yolu ve yükleme durumu; bütün belge indeksi; sıradaki tek resmî iş; zorunlu doğruluk cümlesi.
- **PR-184 [ACTIVE]** — Sohbet kapasitesi için yalnız platformun sağladığı gerçek kullanılan yüzde kabul edilir. Gerçek yüzde mevcut değilse UNAVAILABLE yazılır; tahmin uydurulmaz. Gerçek kullanım yüzde 85-89 ise uyarı, yüzde 90 veya üzerindeyse HARD_STOP uygulanır ve aynı sohbette yeni sürüm başlatılmaz.
- **PR-185 [ACTIVE]** — Gerçek sohbet kapasitesi HARD_STOP düzeyine ulaştığında aynı yanıtta eksiksiz kopyalanabilir yeni sohbet devir promptu ve NEW_CHAT_HANDOFF_<görünür-sürüm>.md üretilir. Eşik altında zorunlu devir yapılmaz; her teslimde yalnız devir durumunun GEREKMİYOR/HAZIR/UNAVAILABLE olduğu belirtilir.
- **PR-186 [ACTIVE]** — Kullanıcının her bağlayıcı kararı aynı sürüm içinde benzersiz DEC kimliği, tarih/saat, kaynak/provenance, karar özeti, etkilediği kurallar, belgeler, kod alanları ve doğrulama kanıtıyla config/user-decision-ledger.json ve docs/decisions altında kaydedilir.
- **PR-187 [ACTIVE]** — Kod, karar, kural, kapsam sicili, aktif belge seti, manifest, sürüm, test kanıtı, durum metni ve teslim raporu arasında bilinen drift varken sürüm tamamlanamaz. Drift kapısı sıfır bilinen çelişki hedefiyle fail-closed çalışır.
- **PR-188 [ACTIVE]** — Bütün dosyalar ACTIVE_AUTHORITY, ACTIVE_REFERENCE, SOURCE_CODE, TEST_OR_GATE, EVIDENCE, HISTORICAL veya GENERATED sınıflarından biriyle işaretlenir. Sınıflandırılmamış dosya ve envanter dışı belge teslim kapanışını engeller.
- **PR-189 [ACTIVE]** — Hassas veri okuma/yazma işlemleri geçerli policy decision ve doğrulanmış policy receipt olmadan repository/API/IPC transactionına giremez. Politika servisi, imza anahtarı, cihaz kimliği veya sürüm uyumu yoksa işlem varsayılan reddedilir.
- **PR-190 [ACTIVE]** — Canlı banka, açık bankacılık, OIDC, OneDrive, harita, AI, APNs, TURN/SFU veya diğer haricî entegrasyonlar yalnız adapter ve capability sınırından çalışır. Sözleşme, yetkili hesap, kimlik bilgisi ve gerçek kabul testi yoksa canlı entegrasyon PASS sayılamaz.
- **PR-191 [ACTIVE]** — Mesaj ve dosya içerikleri uçtan uca şifreli saklanır; audit içerikten ayrıdır. Ses, görüntü, transkript ve çeviri kaydı varsayılan kapalıdır ve bütün katılımcıların ayrı, görünür ve geri çekilebilir onayı olmadan başlatılamaz.
- **PR-192 [ACTIVE]** — Çoklu Windows cihazlarında aynı SQLite dosyası paylaşılmaz. Her node yerel şifreli projection kullanır; otomatik failover yalnız güvenli quorum/witness, fencing ve çoğunluk onayı ile mümkündür. Replica bağımsız yedek değildir.
- **PR-193 [ACTIVE]** — Bronze’da kabul edilmiş bütün özellik, güvenlik, entegrasyon sınırı, erişilebilirlik, UI ve altyapı kodlanıp tamamlanmadan Silver yasaktır. Silver yalnız tam test/UAT/güvenlik/Windows kurulum doğrulaması ve kapsam değiştirmeyen düzeltmedir. Gold yalnız bütün Silver kapıları PASS, üretim operasyonları hazır ve ürün sahibi açıkça onayladığında mümkündür.
- **PR-194 [ACTIVE]** — İlerleme yüzdesi ve bitiş tarihleri yalnız ağırlıklı kapsam ve kanıta göre hesaplanır; pazarlama, iyimserlik veya build sayısı kullanılmaz. Belirsizlik ve güven düzeyi açıkça yazılır; çalıştırılmayan kontrol PASS sayılamaz.
- **PR-195 [ACTIVE]** — Her teslimin sonunda sohbetin devam edebilirliği kontrol edilir. Gerçek kapasite metriği yoksa bu açıkça belirtilir; kullanıcıdan aynı kuralları yeniden anlatması istenmez ve gerçek HARD_STOP oluştuğunda devir promptu otomatik hazırlanır.
- **PR-196 [ACTIVE]** — Kullanıcıya sunulan teslim yanıtında o sürümde üretilen veya değiştirilen belgelerin tamamı listelenir; ayrıca tüm proje belgelerini içeren eksiksiz belge dizinine bağlantı verilir. Belge listesi atlanamaz veya “başlıcaları” ile sınırlandırılamaz.
- **PR-197 [ACTIVE]** — Kural ihlali tespit edildiğinde ihlal gizlenmez; türü, nedeni, etkisi, düzeltmesi ve tekrarını önleyen otomatik kapı aynı sürümün durum kaydına yazılır. Sadece sözlü özür, teknik önlem yerine geçmez.
- **PR-198 [ACTIVE]** — Tamamlanmış kaynak sürümü yerinde değiştirilmez. Her yeni kod veya kural değişikliği aylık sıradaki yeni görünür sürümde yapılır; önceki kaynak ZIP ve SHA tarihsel olarak değişmez kalır.
- **PR-199 [ACTIVE]** — Kullanıcının yazılı olarak kabul ettiği kapsam ve kurallar, daha sonraki bir açık kullanıcı kararı olmadan kaldırılamaz, daraltılamaz veya önceliksiz öneri durumuna döndürülemez.
- **PR-200 [ACTIVE]** — Zorunlu bitiş cümlesi her geliştirme tesliminde aynen kullanılır: “Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.”
- **PR-201 [ACTIVE]** — Her ACTIVE kural config/rule-enforcement-registry.json içinde tam bir ve yalnız bir enforcement kaydına sahip olmak zorundadır; kaydı olmayan veya çift kaydı bulunan kural GOVERNED_PREFLIGHT ve GOVERNED_POSTFLIGHT işlemlerini fail-closed durdurur.
- **PR-202 [ACTIVE]** — Bütün ACTIVE kural enforcement kayıtlarında failClosed=true ve waiverAllowed=false zorunludur. Skip, ignore, temporary bypass, soft pass veya kullanıcı karar defterine dayanmayan istisna mekanizması yasaktır.
- **PR-203 [ACTIVE]** — Doğrudan makineyle doğrulanamayan veya dış ortam gerektiren kural sessizce PASS sayılamaz; zorunlu kanıt sağlanıncaya kadar NOT_RUN/BLOCKED olarak izlenir ve kuralın gerektirdiği Silver/Gold veya teslim aşamasını engeller.
- **PR-204 [ACTIVE]** — PR-171 teknik olarak config/work-segmentation-plan.json durum makinesi ve verify-step-checkpoint-gate ile uygulanır. Bir büyük işte aynı anda en fazla bir adım IN_PROGRESS olabilir; önceki adım PASS ve kalıcı checkpoint kanıtı olmadan sonraki adım başlatılamaz.
- **PR-205 [ACTIVE]** — Build, test, package ve publish komutları güncel governed preflight ile aktif work-step/checkpoint doğrulamasını geçmeden çalışamaz. Bu pre-hook zinciri aktif kural kararı olmadan kaldırılamaz veya zayıflatılamaz.
- **PR-206 [ACTIVE]** — ACTIVE bir kuralın metni, durumu, enforcement sınıfı veya kapısı ancak açık kullanıcı kararı, yeni DEC kaydı ve yeni görünür sürümle değiştirilebilir. Sessiz kural silme, daraltma veya enforcement düşürme fail-closed ihlaldir.
- **PR-207 [ACTIVE]** — Universal Rule Enforcement Gate hem GOVERNED_PREFLIGHT hem GOVERNED_POSTFLIGHT içinde zorunlu ilk sınıf kapıdır; registry kapsamı, gate dosyaları, evidence yolları ve waiver yasağı doğrulanmadan sürüm kapanamaz.
- **PR-208 [ACTIVE]** — Büyük iş adımlarının kalıcı checkpoint kanıtı zorunlu Library dalında tutulur. Geçici /mnt/data sonucu, sohbet mesajı veya yalnız yerel dosya kalıcı checkpoint yerine geçmez; persistent receipt yoksa sonraki adım BLOCKED kalır.
- **PR-209 [ACTIVE]** — Marka mimarisi zorunludur: ana marka ParsYuva; kullanıcıya görünen masaüstü ürün, pencere, kısayol ve kurulum adı eksiksiz ParsYuva Aile Yaşam Merkezi'dir. AYM kısaltması yeni kullanıcı yüzeylerinde kullanılamaz. Eski Windows appId, çalışma kökü ve Anadolu Parsı Aile Yaşam Merkezi kullanıcı veri dizini yalnız geriye dönük güncelleme/veri uyumluluğu için değişmez teknik kimlik olarak korunur; bunlar güncel ürün adı değildir.
- **PR-210 [ACTIVE]** — ParsYuva şirket unvanı, marka, alan adı, sosyal hesap, mağaza hesabı ve hukuk-vergi-gizlilik hazırlığı ancak yetkili güncel dış kanıtla tamamlanmış sayılır. Aday unvan, ön araştırma veya yerel kodlama resmî kuruluş, tescil, rezervasyon, uygunluk, yatırım ya da halka arz kanıtı değildir; eksik kanıt fail-closed NOT_RUN veya BLOCKED_EXTERNAL kalır.
- **PR-211 [ACTIVE]** — Aktif geliştirici, üretici, owner, author ve copyright metadata'sı doğal kişi kimliği taşıyamaz; marka metadata'sı ParsYuva, kullanıcıya dönük ürün metadata'sı ParsYuva Aile Yaşam Merkezi kimliğiyle tutulur. AYM yeni metadata'da ürün kısaltması olarak kullanılamaz; tarihsel kanıtların özgün eski metadata'sı değiştirilmez.
- **PR-212 [ACTIVE]** — ParsYuva sonrası yeni kalıcı belge, kaynak, görsel, hash ve teslim kanıtlarının kurumsal kütüphane yolu /ParsYuva/ParsYuva Aile Yasam Merkezi/<Görünür Sürüm> şeklindedir; dosya ve klasör adları Türkçe anlamlı fakat ASCII karakterli olur. Önceki /ParsYuva/ParsYuva AYM ve /Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi kayıtları tarihsel ve değişmez kalır; yeni ürün dalına otomatik taşınmaz, güncel kaynak veya tamamlanma kanıtı sayılmaz.
- **PR-213 [ACTIVE]** — Platform ve cihaz çalışma alanları Microsoft/Windows, Apple/macOS/iOS, ortak cihaz sözleşmeleri ve gelecek Android kapsamı olarak ayrı tutulur. Bir platformun kodu veya kanıtı diğer platformun gerçek cihaz, mağaza, imza ya da UAT kanıtı sayılamaz.
- **PR-214 [ACTIVE]** — Güncel ana belgeler yapı, karar, kural, kurumsallaşma, platform ve cihaz, test ve kanıt, kullanıcı belgeleri konularına göre kurumsal klasörlerde sınıflandırılır. Dosya adları Türkçe anlamlı ve ASCII karakterli olur; tarihsel kayıtların adı, içeriği ve konumu yeniden yazılmaz.
- **PR-215 [ACTIVE]** — Uygulama ve kurulum sihirbazı ilk açılış dilini kurulduğu makinenin işletim sistemi dilinden belirler. Türkçe ve İngilizce desteklenir; sistem dili desteklenmiyorsa veya güvenilir biçimde çözülemiyorsa kullanıcı verisi açılmadan önce İngilizce güvenli varsayılan olarak seçilir. Kullanıcı Ayarlar üzerinden sistem, Türkçe veya İngilizce tercihini değiştirebilir; tercih ana süreçte doğrulanıp kalıcı saklanır ve sonraki açılışlarda sistem dilinin önüne geçer. Renderer dili doğrudan seçemez; yalnız doğrulanmış tercih isteği gönderir ve doğrulanmış dil/locale görünümünü alır. İngilizce sözlük eksik anahtarları Türkçeye sessizce düşüremez.
- **PR-216 [ACTIVE]** — Kurulum öncesi karşılama ve hazır sayfaları işlem yapmıyorsa hareketli ilerleme göstergesi kullanamaz. Kurulum boyunca yalnız gerçek dosya kurulumunu izleyen tek ilerleme çubuğu gösterilir; yüzde değeri NSIS'in yerel kurulum ilerlemesinden okunur ve dekoratif veya simüle ilerleme yasaktır.
- **PR-217 [ACTIVE]** — Güncel ürün ve belge başlıklarında yalnız ParsYuva Aile Yaşam Merkezi tam adı kullanılır. AYM kısaltması ürün adı, kısayol, kurulum dosyası, başlık, yardım, sesli anlatım veya yeni kullanıcıya dönük metadata içinde kullanılamaz. AYM yalnız değiştirilemeyen tarihsel kayıtta ya da geriye dönük uyumluluk için zorunlu teknik yol ve kimliklerde, güncel marka olmadığı açıkça belirtilerek korunabilir.
- **PR-218 [ACTIVE]** — Bronze, Silver ve Gold kanal paletleri ile saydamlık, blur, kenarlık, gölge ve opak erişilebilirlik fallback değerleri tek merkezi tema sicilinde tutulur. Uygulama ve kurulum güvenilir derleme kanalından aynı paleti seçer; kanal kullanıcı ayarı veya dosya adından türetilemez, yüksek kontrast ve hareket azaltma tercihleri görsel efektlerden önce gelir.
- **PR-219 [ACTIVE]** — İlk aile kurulumu ve yerel girişte parola varsayılan olarak gizlidir. Erişilebilir Göster/Gizle denetimi parolayı yalnız kullanıcının geçici isteğiyle görünür yapar; görünürlük tercihi kalıcılaştırılamaz ve parola değeri log, telemetry veya kanıta yazılamaz.
- **PR-220 [SUPERSEDED]** — Kullanıcıya sunulan Windows kurulum dosyası ParsYuva-Aile-Yasam-Merkezi tam ürün adını, güvenilir kanal kimliğini, GG.AA.YYYY.NN sürümünü, mimariyi ve Kurulum amacını Türkçe anlamlı ASCII dosya adıyla taşır. Kurulum yüzeylerinde yalnız ParsYuva Aile Yaşam Merkezi tam adı kullanılır; metin, denetim ve düğmeler yüzde 100-200 DPI aralığında üst üste binemez veya kesilemez.
- **PR-221 [ACTIVE]** — Kurulum paketi teslim edilmeden önce paketlenmiş uygulamanın gerçek Windows sürecinde açılışı, tek-instance davranışı, pencereyi tepsiye gizleme ve onaylı tamamen kapatma yolu sınanır. JavaScript hata penceresi, sıfır dışı normal çıkış veya yeni Windows Application hata olayı bulunan paket teslim kanıtı sayılamaz.
- **PR-222 [ACTIVE]** — Her yeni kaynak, belge veya paket derlemesi GG.AA.YYYY.NN biçiminde benzersiz sürüm kullanır. NN aynı takvim ayındaki kalıcı defterden atomik olarak ayrılır; uygulama, paket manifestleri, installer metadata, dosya adı ve aktif belgeler aynı sürümü taşır, aynı numara ikinci bir farklı paket için kullanılamaz.
- **PR-223 [ACTIVE]** — Bronze, Silver ve aktivasyonsuz Gold ilk güvenilir kullanımdan itibaren 30 gün çalışır. Bronze ve Silver süre sonunda kilitlenir; Gold yalnız cihaz-bağlı doğrulanmış imzalı aktivasyonla süresiz olur. Aktivasyon özel anahtarı son kullanıcı uygulamasına giremez; yeniden kurulum, saat geri alma veya kişisel veri sıfırlama deneme süresini yenileyemez.
- **PR-224 [ACTIVE]** — Kaldırma akışı şifreli ve geri-okumayla doğrulanmış çoklu hedef yedeği, kişisel veriyi kalıcı silerek kaldırma veya vazgeçme seçeneklerini açıkça sunar. İlk kurulum anına dön işlemi güçlü yeniden doğrulama ve iki aşamalı geri döndürülemez onay ister, yeni yedek oluşturmaz ve erişilebilen uygulama-yapımı yedekleri siler; erişilemeyen bulut fiziksel kopyaları için garanti verilemez.
- **PR-225 [ACTIVE]** — Ana pencerenin X düğmesi ve Alt+F4 normal kullanımda uygulamayı sonlandırmaz; hassas ekranı gizleyip sistem tepsisine taşır. Tepsi Aç, Kilitle ve onaylı Tamamen kapat eylemlerini sunar; Windows kapanışı, güvenli güncelleme ve kaldırma kontrollü gerçek çıkış yapabilir.
- **PR-226 [ACTIVE]** — Her güncelleme mevcut kişisel veriyi, ayarı, arşivi ve yedek bağlarını korur. Şema veya altyapı değişimi doğrulanmış şifreli geri dönüş yedeği, atomik migration, başarısızlıkta rollback ve kayıt sayısı, hash, sahiplik ile şifreleme bağı doğrulaması olmadan tamamlanamaz; dönüştürülemeyen kayıt açıkça raporlanır.
- **PR-227 [ACTIVE]** — Geçici ek-kural dosyasında tutulan kararlar toplu birleştirmede tek tek kanonik kurala, karara, iş listesine, kaynak/test kanıtına veya açık dış bağımlılık nedenine eşlenir. Daha yeni kararla değişen eski metin yeniden etkinleştirilemez; birleştirme kaydı korunur ve GitHub/yerel yedek eşitliği canlı commit kanıtı olmadan güncel gösterilemez.
- **PR-228 [SUPERSEDED]** — Windows kurulum hedefi C:\Program Files\PPT\ParsYuva, kurulu ana program dosyası ParsYuva.exe ve masaüstü ile Başlat menüsü kısayolu ParsYuva olur. Dağıtım EXE dosya adı yalnız ParsYuva, güvenilir sürüm kanalı ve GG.AA.YYYY.NN sürümünü ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe biçiminde taşır; mimari, Kurulum, AYM, tam uzun ürün adı veya yerel test eki dosya adına eklenmez. Uygulama içindeki görünür tam ürün adı ParsYuva Aile Yaşam Merkezi olarak kalır; kararlı appId ve eski kullanıcı-veri dizini yalnız yükseltme uyumluluğu için korunur.
- **PR-229 [ACTIVE]** — Kaynak kodda veya Windows paketleme davranışında değişiklik yapıldığında apps/desktop/release altındaki önceki kurulum artefaktları geçersiz olur ve yeni derleme başlamadan önce silinir. Temizlik ParsYuva kurulum EXE dosyalarını ve bunlara bağlı .blockmap ile .sha256 yan dosyalarını kapsar; paketleme sonrasında klasörde yalnız güncel görünür sürüme ait en fazla bir kurulum seti kalabilir. Kullanıcı verisi, kurulu uygulama, kaynak arşivi ve tarihsel yönetişim kanıtları bu temizliğin dışındadır.
- **PR-230 [ACTIVE]** — Kullanıcıya görünür sürüm satırlarında Bronze, Silver veya Gold kanal adı tam bir kez gösterilir. Kanal adı yalnız kanonik releaseLabel alanında bulunur; kanal-bağımsız yaşam döngüsü durumu olan stage alanı kanal adı içeremez. İlk kurulum, güvenli başlangıç, ana uygulama, Türkçe ve İngilizce yüzeyler kanal ile kanal içeren sürüm etiketini yeniden birleştiremez.
- **PR-231 [ACTIVE]** — Her durum değiştiren işlem başlamadan önce güncel kanonik kural sicili, yeniden hesaplanan kural hash'i, kullanıcı onayı, Proje Anayasası bağı ve tüm aktif kuralların fail-closed enforcement kayıtları doğrulanır. Kod, dosya, yapılandırma, belge, test, derleme, paketleme, kurulum, silme, yayımlama veya dış sisteme yazma işlemi kontrol PASS olmadan başlayamaz. Salt okunur inceleme yalnız uygulanacak kuralları belirleyebilir; kural veya hash değişirse sonraki mutasyondan önce kontrol yeniden çalışır. Waiver, sessiz atlama ve eski makbuz kullanımı yasaktır.
- **PR-232 [SUPERSEDED]** — Özel Windows kurulum karşılama yüzeyi, ilk aile oluşturma ekranı ve temiz paket teslim zinciri tek bağlayıcı kabul kapsamıdır. Kurulum sayfası ParsYuva marka/paletini kullanır; dekoratif hareket gerçek ilerleme gibi gösterilemez. İlk aile ekranı 900x640 görünümde yatay taşmadan çalışır, üç pars ailesi hareket azaltma tercihine uyar, pencere ve tepsi simgeleri küçük yüzeyde seçilir. Türkçe ve İngilizce anlatımda aynı dilde kadın sesi önceliklidir; bulunamazsa aynı dilde erkek ses yedeği kullanılır ve ses çıkışı doğrulanmadan duyuldu iddiası kurulamaz. Güncelleme kişisel veriyi korur ve yıkıcı kaldırma seçimini açmaz. Teslimden önce tüm çalışma alanları sıfırdan derlenir, eski installer artefaktları silinir, paketlenmiş gerçek uygulama sürümü ve açılışı sınanır, SHA-256 ile imza durumu kaydedilir; kesin kaynak commit’i GitHub ve haricî Git yedeğine gönderilip haricî disk kaynak arşivi geri-okumayla doğrulanmadan paket teslimi tamamlanmış sayılamaz.
- **PR-233 [ACTIVE]** — Özel Windows kurulum karşılama yüzeyi, ilk kullanıcı ve aile oluşturma ekranının sakin görsel diliyle üç gerçek tanıtım adımı arasında geçiş yapar; bu bilgi geçişi kurulum ilerlemesi değildir, yüzde veya sahte ilerleme çubuğu gösteremez ve gerçek dosya kurulumu yalnız NSIS yerel ilerlemesiyle sunulur. Kurulum anlatımı Türkçe ve İngilizcede aynı dilde kadın sesi önceliğiyle, bulunamazsa aynı dilde erkek veya kurulu ilk ses yedeğiyle çalışır; görünür metin her zaman asıl kaynaktır. İlk aile ve güvenlik yüzeyleri 900x640 görünümde yatay taşmadan, eski tek pars marka görseliyle ve hareket azaltma tercihiyle çalışır. Oturum kilidi açık ilk kurulum veri kasasını yok edemez; yeniden doğrulama yolu kasayı kullanılabilir tutar ve ilk aile oluşturulduktan sonra iki aşamalı doğrulama başlatma çağrısı kilitli kasa hatası veremez. Güncelleme kişisel veriyi korur; eski installer setleri silinir; temiz tam derleme, paketli sürüm/açılış, SHA-256/imza kaydı, GitHub ve haricî Git eşitliği ile geri-okumalı haricî kaynak arşivi tamamlanmadan paket teslimi kabul edilemez.
- **PR-234 [SUPERSEDED]** — Bronze, Silver ve Gold birbirinden yalıtılmış kurulum, kullanıcı verisi ve kaynak çalışma alanları kullanır. Her kanal C:\Program Files\PPT\ParsYuva\<Kanal> dizinine, ParsYuva-<Kanal>.exe ana dosyasıyla ve ParsYuva <Kanal> kısayoluyla kurulur; appId, productName, kaldırma kapsamı ve kullanıcı veri kökü kanal kimliğini taşır. Bir kanalın kurulumu, yükseltmesi veya kaldırılması diğer kanalın programını ya da verisini değiştiremez. Kanal kaynakları C:\PPT\AYM\06_KOD\kanallar\<Kanal> altında ayrı Git worktree ve ayrı branch olarak tutulur; build çıktısı ile kullanıcı verisi kanallar arasında yeniden kullanılamaz. Dağıtım EXE adı ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe olarak kalır; görünür ana ürün adı ParsYuva Aile Yaşam Merkezi'dir.
- **PR-235 [ACTIVE]** — En küçük kaynak, yapılandırma veya belge mutasyonundan sonra kalıcı tamamlanma, Windows paketleme ya da installer teslimi iddiası; değişen dosyaların etki analizi kanonik kural, kullanıcı kararı, aktif belge, manifest, ratchet, hedefli test, tam regresyon, kaynak bütünlüğü ve UAT etkilerini tek tek güncellediğini veya gerekçeli olarak etkilenmediğini aynı exact commit üzerinde göstermeden kurulamaz. Paket yalnız temiz ve kanalına ait exact Git commitinden, bu commit ile aynı kural hash'i ve governed-source fingerprint'ine bağlı hedefli test, tam regresyon ve kaynak bütünlüğü PASS kanıtlarıyla üretilir. Installer teslimi yalnız paket üretiminden sonra aynı paket ve kaynak commitine bağlı kurulu ana EXE üzerinde taze UAT PASS kanıtıyla yapılır; eski, başka committen, kaynak-runtime, win-unpacked veya yalnız metadata kanıtı kabul edilmez. Eksik ya da eski bağ kalıcı completion, paketleme ve teslimi fail-closed engeller; waiver yoktur. Tek seferlik BOOTSTRAP_ADOPTION kaydında sabit diff taban commitinde üretici henüz bulunmadığı için baseline producer path, boyut ve SHA-256 kimliği yalnız repo pointer sourceCommit alanındaki kayıt commitinden, external receipt ve pointer producer alanlarının exact eşitliği ile baseCommit < sourceCommit <= current HEAD Git ancestry kanıtı altında doğrulanır; normal PRE_MUTATION producer bağı kendi baseline commitinde kalır.
- **PR-236 [ACTIVE]** — Bronze, Silver ve Gold program kökleri legacy ParsYuva kökünün dışında C:\Program Files\PPT\ParsYuva-<Kanal> kardeş dizinlerine kurulur; kanal AppData kökü ParsYuva/<Kanal> olarak ayrı kalır. Kanal appId, productName, ParsYuva-<Kanal>.exe ana dosyası, ParsYuva <Kanal> kısayolu, kaldırma kapsamı, kullanıcı verisi, Git worktree ve branch yalıtımı korunur; build çıktısı veya kullanıcı verisi kanallar arasında yeniden kullanılamaz. Yükseltme kişisel veriyi korur ve yalnız etkileşimli kaldırma signed-in kullanıcı AppData bağlamına geçip çıkışta tüm-kullanıcılar bağlamını geri yükleyebilir. Legacy 37-44 uygulama kökü altında Bronze, Silver veya Gold kanal dizini varsa recursive legacy program temizliği veri ve program silmeden fail-closed durur. Legacy kullanıcı verisi otomatik taşınamaz veya silinemez.
- **PR-237 [ACTIVE]** — Resmî aylık sürüm tahsisi yalnız açık ve tek seferlik bir işlem olarak, mutasyon modunda zorunlu beklenen release ID ile yapılır. Hesaplanan kimlik beklenenle uyuşmazsa lock, geçici dosya, kaynak yazımı veya installer temizliği başlamadan fail-closed durur; preview salt okunurdur. Signed, yerel imzasız ve dizin paketleme girişleri yeni sürüm tahsis edemez; yalnız önceden tahsis edilmiş current ledger, kök ve desktop manifest, repository metadata ve APP_META exact kimliğini tüketir. Signed paketleme zorunlu beklenen release ID doğrulamasını installer temizliğinden önce yapar. Tahsis; aktif kök/current/config/ticari sürüm taşıyıcılarını tek atomik planda senkronize eder, tarihsel UAT, evidence ve test fixture kayıtlarını değiştirmez. Aynı beklenen kimlikle ikinci tahsis girişimi sonraki sıra kimliğini hesapladığı anda hiçbir dosyayı değiştirmeden reddedilir.
- **PR-238 [SUPERSEDED]** — Windows installer teslimi; zorunlu explicit installer, packaged EXE, installed EXE, package provenance, governed preflight, yeni containment/reparse korumalı evidence root ve expected release ID girdileriyle çalışan tek kanonik üreticide gerçek N→N+1 yükseltme ile ayrı aynı-sürüm maintenance fazlarını kanıtlar. Üretici yalnız kendi sentetik Bronze markerını yazar; mevcut Bronze, Silver, Gold ve legacy kullanıcı verisi içeriğini okumadan ve adlarını makbuza kaydetmeden metadata hash manifestleri üretir. Yükseltme ve maintenance veri seçim diyaloğu açamaz; bütün kanal/legacy kullanıcı verisi manifestlerini ve sentetik markerı korur, Silver/Gold/legacy program ve registry sınırlarına sıfır yazım yapar, kurulu EXE packaged EXE ile SHA-256, boyut ve sürüm bakımından exact eşleşir ve sibling Bronze install root ile uninstall registry kimliği exact olur. Ardından gerçek kurulu EXE üzerinde schema2 installed frontend UAT çalışır ve installation-preservation SHA, package provenance, expected release ID ile source commit bağlarını taşır. Final local-test teslimi yalnız bu kanonik UAT110/UAT111 makbuzlarını aynı package provenance ve source commit bağlarıyla kabul eder; NotSigned yalnız yerel test sınıfıdır ve imzalı üretim iddiası kuramaz.
- **PR-239 [ACTIVE]** — Bronze Windows local-test teslim zinciri; temiz exact commit ve aynı commitin PR-235 hedefli test, tam regresyon, kaynak bütünlüğü, governed fingerprint ve kanonik kural hash'i canlı geri-okumasına bağlı schema-2 package provenance olmadan başlayamaz. Installer deneyimi schema-2 makbuzu aynı installer/package/source kimliğinde üç gerçek bilgi geçişi, sahte progress bulunmaması, anlatım child-process/dil kanıtı, güvenli iptal ve değişmemiş payloadı zorunlu olarak kanıtlar. Bronze sequence 50 governed bootstrap'tır: current package previousPackageProvenance null olmalı; previous paket/runtime girdisi, mevcut kanonik Bronze kurulum kökü, EXE veya uninstall kaydı bulunmamalı; ilk faz temiz kurulumdur ve hiçbir N→N+1 iddiası üretilemez. Sequence 51 ve üzerindeki gerçek N→N+1 yükseltme yalnız current package parentRelease ile bağlı immutable arşivlenmiş önceki schema-2 package provenance ve kanonik sibling Bronze yolundaki canlı installed N runtime SHA-256, boyut ve FileVersion kimliği exact eşleştiğinde kabul edilir; aynı aylık sıra döneminde sequence tam bir artar, tarih monotoniktir. Legacy nested kurulum yalnız değişmezlik snapshot sınırıdır ve trusted predecessor değildir. UAT110 schema-3 birbirini dışlayan bootstrap-fresh-install veya continuation-N→N+1 ilk fazı ile ayrı same-version maintenance fazında bütün kanal/legacy kullanıcı verisi içerik eşitliğini, sentetik marker temizliği/absence readback'i, diğer kanal ve legacy program/registry sıfır yazımını ve installed==packaged canlı kimliğini kanıtlar. UAT111 schema-3 aynı UAT110 runId/SHA ve package/source/producer bağında yalnız sentetik profile çalışır; görünür uygun bütün kontroller rota/durum/yüzey bazlı dinamik keşif ve doğrulanmış outcome ile sınıflandırılır, sabit tıklama sayısı kabul değildir; ana süreç/renderer hatası, eksik erişilebilirlik-görsel durum, profil cleanup, screenshot hash/readback veya secret taraması PASS değilse kapanamaz. Final schema-3 teslim makbuzu zorunlu installer-experience, UAT110, UAT111, narration, packaged probe ve package provenance kanıtlarını gerçek kurulum modunu yeniden türeterek, distinct run/evidence kökleri, producer SHA, exact kronoloji ve canlı dosya geri-okumasıyla doğrular. NotSigned ve Kaspersky koruması kapalı test zararsızlık ya da üretim uygunluğu kanıtı değildir; imzalı ve koruma açık retest olmadan üretim engeli sürer.
- **PR-240 [ACTIVE]** — En küçük kod, yapılandırma, belge, test veya üretici değişikliği dahi etkilenen ana kaynak, Bronze/Silver/Gold kanal kaynakları, kanonik kural ve kullanıcı karar sicilleri, aktif belgeler, ticari kayıtlar, iş listesi, kapsam, envanter, ratchet, manifest, indeks, ana DOCX/PDF ve kanıt sözleşmeleri aynı mutasyon zincirinde güncellenmeden tamamlanamaz. Etki analizi her bağımlı kayıt sınıfını UPDATED ya da kanıtlı NOT_AFFECTED olarak göstermelidir. Her değişiklik hedefli test, filtresiz tam regresyon, typecheck, değişen komut dosyalarının sözdizimi ve kaynak bütünlüğü PASS gerektirir; kullanıcı arayüzü etkisinde bütün modül, rota, ana ve alt menü, görünür uygun kontrol, durum, erişilebilirlik ve görsel bütünlük UAT kapsamına alınır. Gerçek test hatası boş wip(rejected) checkpoint commit ile kalıcı kaydedilir. Ara installer üretilemez; paket yalnız tüm kaynak ve kayıt kapanışı tamamlanmış temiz exact committen, ana dal ve ilgili kanal kaynak eşitliği doğrulandıktan sonra üretilebilir.
- **PR-241 [ACTIVE]** — Bronze 26.08.2026.51, gecersiz ve degismez Bronze 22.08.2026.50 paketinden sonraki tek recovery bootstrap surumudur. Bu yol yalniz release ledger icinde parent Bronze 50 kaydi REJECTED_INVALID_PACKAGE, current Bronze 51 top-level kaydi ile exact tek release entry statusu birbirine esit ve IN_PROGRESS, recoveryBootstrapDecision RECOVERY_BOOTSTRAP_AFTER_REJECTED_50 ve parentRelease exact Bronze 22.08.2026.50 oldugunda acilir. Bronze 50 immutable package history ve dis append-only zinciri silinmez, ezilmez veya trusted installed runtime sayilmaz; immutable transaction yayimindan hemen once parent bundle kanonik path, size, SHA-256, rejected-parent kimligi ve archived receipt bagi canli geri okunur. Bronze 51 paketi yalniz tarihsel ancestry bagini korur, previous installed runtime girdisini reddeder, kanonik Bronze program koku, EXE ve uninstall kaydinin yoklugunu kanitlayarak RECOVERY_BOOTSTRAP_FRESH_INSTALL_SEQUENCE_51 fazini ve ardindan ayri same-version maintenance veri korumasini calistirir. Sequence 50 bootstrap ve sequence 52+ exact N-to-N+1 continuation kurallari degismez. Bu tek seferlik recovery modu waiver degildir; exact commit, hedefli ve tam regresyon, kaynak butunlugu, preflight, installer experience, UAT110, UAT111 ve final teslim kanitlarinin tumunu zorunlu tutar.

## 14. Aktif repo Word/PDF tarihsel denetim envanteri

- `MASTER_PROJE_DOKUMANTASYONU_BRONZE_04.08.2026.28.docx` — DOCX — 50355 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJE_DOKUMANTASYONU_BRONZE_04.08.2026.28.pdf` — PDF — 270037 bayt, 8 sayfa — OKUNABİLİR
- `MASTER_PROJE_DOKUMANTASYONU_GUNCEL_17.08.2026_V1.docx` — DOCX — 347679 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJE_DOKUMANTASYONU_GUNCEL_17.08.2026_V1.pdf` — PDF — 478084 bayt, 21 sayfa — OKUNABİLİR
- `MASTER_PROJE_DOKUMANTASYONU_GUNCEL_18.08.2026_V2.docx` — DOCX — 348987 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJE_DOKUMANTASYONU_GUNCEL_18.08.2026_V2.pdf` — PDF — 479923 bayt, 21 sayfa — OKUNABİLİR
- `MASTER_PROJE_DOKUMANTASYONU_GUNCEL_19.08.2026_V3.docx` — DOCX — 349713 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJE_DOKUMANTASYONU_GUNCEL_19.08.2026_V3.pdf` — PDF — 481003 bayt, 21 sayfa — OKUNABİLİR
- `MASTER_PROJE_DOKUMANTASYONU_GUNCEL_20.08.2026_V4.docx` — DOCX — 352628 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJE_DOKUMANTASYONU_GUNCEL_20.08.2026_V4.pdf` — PDF — 489570 bayt, 25 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD209.docx` — DOCX — 295186 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD209.pdf` — PDF — 391597 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD210.docx` — DOCX — 295232 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD210.pdf` — PDF — 391568 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD211.docx` — DOCX — 295261 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD211.pdf` — PDF — 392005 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD212.docx` — DOCX — 1450067 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD212.pdf` — PDF — 465627 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD213.docx` — DOCX — 1450174 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD213.pdf` — PDF — 466436 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD214.docx` — DOCX — 1450504 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD214.pdf` — PDF — 471139 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD215.docx` — DOCX — 1450671 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD215.pdf` — PDF — 475135 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD216.docx` — DOCX — 1450820 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD216.pdf` — PDF — 478515 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD217.docx` — DOCX — 1450953 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD217.pdf` — PDF — 480477 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD218.docx` — DOCX — 1451081 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD218.pdf` — PDF — 486085 bayt, 12 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD219.docx` — DOCX — 1451198 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD219.pdf` — PDF — 490035 bayt, 12 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD220.docx` — DOCX — 1451343 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD220.pdf` — PDF — 492179 bayt, 12 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD221.docx` — DOCX — 1451422 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD221.pdf` — PDF — 493963 bayt, 12 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD222.docx` — DOCX — 1451543 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD222.pdf` — PDF — 500845 bayt, 12 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD223.docx` — DOCX — 1451708 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD223.pdf` — PDF — 504411 bayt, 12 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD224.docx` — DOCX — 1451830 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD224.pdf` — PDF — 508458 bayt, 13 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD225.docx` — DOCX — 1452091 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD225.pdf` — PDF — 106165 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD226.docx` — DOCX — 1452193 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD226.pdf` — PDF — 106818 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD227.docx` — DOCX — 1452158 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD227.pdf` — PDF — 106951 bayt, 11 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD228.docx` — DOCX — 1452242 bayt, 1 sayfa — OKUNABİLİR
- `MASTER_PROJECT_DOCUMENTATION_BUILD228.pdf` — PDF — 106893 bayt, 11 sayfa — OKUNABİLİR

## 15. Kapanış sınırı

Bu belge canlı kaynak gerçeğini toplar; build kapanışı, kanal terfisi, sertifika, hukuk görüşü veya gerçek cihaz/sağlayıcı UAT belgesi değildir. Tarihsel kanıtlar değişmeden kalır.
