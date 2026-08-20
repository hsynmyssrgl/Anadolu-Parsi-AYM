# ParsYuva Aile Yaşam Merkezi — Aktif Ana Kapsam

- Aktif kanal ve sürüm: **Bronze 20.08.2026.37**
- Ana marka: **ParsYuva**; açıklayıcı uzun ad: **ParsYuva Aile Yaşam Merkezi**.
- Kurumsallaşma planı: `docs/current/13_KURUMSALLASMA_VE_GLOBAL_MARKA_PLANI.md`; dış şirket/marka/alan adı işlemleri henüz `NOT_RUN` ve requirement PASS değildir.
- Kapsam kararı: Kullanıcının 4 Ağustos 2026 tarihli açık onayıyla, bu kaynaktaki bütün kabul edilmiş kapsam girdileri bağlayıcıdır.
- Gereksinim sicili: `config/accepted-scope-registry.json`
- Toplam izlenen gereksinim: **358**
- Canlı durum dağılımı (20.08.2026): **109 COMPLETE, 25 PARTIAL, 1 FOUNDATION_STARTED, 223 NOT_IMPLEMENTED**.
- Güncel birleşik anlatım: `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md`
- Tüm belge türü denetimi: `docs/current/12_TUM_BELGE_TURLERI_DENETIMI.md`
- Karar-belge eşzamanlılık politikası: `config/documentation-synchronization-policy.json`
- Durum: Bronze aktif geliştirme; Silver'a geçiş yasaktır.

## Tek tamamlanma tanımı

Bir gereksinim ancak karar → domain → şema → migration → use-case → repository → Platform Policy Kernel → API/IPC → UI → menü → hedefli test → belge → kanıt zincirinin tamamı gerçek PASS olduğunda tamamlanır.

`NOT_IMPLEMENTED`, `FOUNDATION_STARTED`, `PARTIAL`, `BLOCKED`, `NOT_RUN` veya yalnız belge düzeyi hiçbir zaman tamamlandı değildir.

## Bağlayıcı kapsam kümeleri

1. Aile, hane, kişi, üyelik, soy ağacı, zaman tüneli, önemli günler ve arşiv.
2. Finans: banka, IBAN, kart, kredi, bütçe, hedef, varlık, ortak sahiplik ve açık bankacılık adapter sınırı.
3. Sağlık, bakım, yaşam, konum, acil durum, dijital miras ve yapay zekâ.
4. Erişilebilirlik, görsel sistem, Windows kurulum, dayanıklılık, yedek ve güncelleme.
5. Windows Core Service, çoklu node, quorum/witness/failover, güvenli API ve Apple companion altyapısı.
6. E2EE mesajlaşma, çevrimiçi durum, görüntülü toplantı, dosya paylaşımı, çeviri, canlı altyazı ve rızalı kayıt.
7. Platform Policy Kernel, OCR, türetilmiş veri mirası, sıfır güven ve uygulamalar arası politika uyumu.
8. Hane operasyonu, afet/acil durum, çocuk/eğitim, bakım/ileri yaş, ev/araç/eşya/evcil hayvan ve mahremiyet merkezi.
9. AI asistanı, aile hafızası stüdyosu, seyahat, Matter/enerji, doğrulanabilir yetki kartları ve imzalı eklentiler.
10. Genç, yetişkin, ileri yaş, düşük görme, bakım veren ve çocuk için ayrı ama eşit derecede güvenli kullanıcı deneyimi.
11. Makine sistem dilinden Türkçe/İngilizce arayüz seçimi; desteklenmeyen dilde veri açılmadan İngilizce güvenli varsayılan.
12. Kurulum öncesi sayfalarda sahte ilerleme bulunmaması; gerçek kurulumda tek yerel ilerleme çubuğu ve yerel kontrolden okunan yüzde.

## Kanal sınırları

- **Bronze:** Bütün kabul edilmiş işlevler kodlanır ve özellik zincirleri kapatılır.
- **Silver:** Tam Windows/Apple/dağıtık/güvenlik/erişilebilirlik testleri ve testte çıkan düzeltmeler yapılır. Yeni kapsam çıkarsa Bronze'a dönülür.
- **Gold:** Bütün Silver kapıları PASS, üretim kimlik bilgileri/imzalar/operasyon paketi ve ürün sahibinin açık onayı gerekir.
