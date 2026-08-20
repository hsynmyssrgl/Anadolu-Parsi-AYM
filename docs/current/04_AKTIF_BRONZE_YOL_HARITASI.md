# Aktif Bronze Yol Haritası

## İlk resmî sıra

1. Kapsam sicili ve aylık sürüm sözleşmesi — bu sürümde başladı.
2. Platform Policy Kernel ve politika receipt — bu sürümde başladı.
3. Core Service süreç sınırı — bu sürümde başladı.
4. Mevcut doğrudan rol kontrollerini merkezi politikaya taşıma.
5. Hane/aile dalı/üyelik ve amaçlı yetki modeli.
6. Finans ve bankacılık domain/şema/UI zinciri.
7. Dağıtık mutation log, node, witness, snapshot ve API.
8. İletişim, toplantı, çeviri ve dosya paylaşımı.
9. OCR ve türetilmiş veri zinciri.
10. Günlük yaşamın kabul edilmiş altı çekirdek merkezi.
11. Birinci taraf imzalı uzantılar.
12. Görsel/erişilebilirlik/kurulum/dayanıklılık kapanışı.
13. Feature Reality Gate tüm zorunlu öğeleri COMPLETE+PASS göstermeden Silver yok.

## Güncel durum — 20.08.2026

- Aktif sürüm: Bronze 20.08.2026.35
- Silver: BLOCKED
- 33-M–34-L paketlerinde yerel kaynak, sözleşme, hedefli test ve closure otomasyonu önemli ölçüde oluşturulmuştur; ancak roadmap kabul durumları dış ve manuel kanıt eksikleri nedeniyle atomik olarak kapatılmamıştır.
- Güncel yerel doğrulama: 344 test dosyası / 2169 test, root typecheck ve 18 workspace production build PASS. Bu kanıtlar gerçek Windows installer yaşam döngüsü, 168 saat soak, gerçek çoklu node, gerçek Apple istemcileri, gerçek uzak sağlayıcılar veya sertifikasyon yerine geçmez.
- 33-P yerel otomatik kanıtı boundary 21/21, contract 17/17, runtime 24/24 ve 19 dosya/116+ test PASS durumundadır. Gerçek dış kanıt kabulü güvenilir imzacı, canlı sağlayıcı, gerçek authenticator/cross-device ve insan inceleme paketi bulunmadığı için fail-closed `NOT_RUN`; `countsAsRequirementPass=false` korunur.
- Silver: **BLOCKED**; `countsAsRequirementPass=false` ve `allRoadmapPackagesAccepted=false` korunur.
- İngilizce yerelleştirme altyapısı, 18 uzman panel dalgası ve 18 ana kabuk dalgasıyla tamamlandı; sistem dili fallback, kalıcı kullanıcı tercihi ve iki dilli kurulum dahil tam İngilizce uygulama kabulü yerel otomatik kanıtla PASS durumundadır.
- Kurulum öncesi sahte ilerleme kaldırıldı ve gerçek NSIS ilerlemesi tek yüzde görünümüne bağlandı. İmzalı üretim kurulum EXE'si için Authenticode sertifikası ve PPK-025 dış release kanıtı hâlâ `BLOCKED_EXTERNAL`; yerel test paketi bu dış kanıtın yerine geçmez.
