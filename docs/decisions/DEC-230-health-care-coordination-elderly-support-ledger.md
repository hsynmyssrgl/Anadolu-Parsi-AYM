# DEC-230 — Sağlık koordinasyonu ve yaşlı desteği günlüğü

## Durum

33-S, B5-01, B5-02, EXT-021 ve EXT-023–EXT-029 için yerel uygulama başlangıcıdır. Domain, migration, repository, merkezi PEP/UoW, masaüstü facade, IPC ve mevcut Sağlık ekranına eklenen UI zinciri yerel hedef testlerde çalışır. 33-P aktif öncül olduğu, atomik registry kapanışı yapılmadığı ve dış/manual kabul kanıtları tamamlanmadığı için gereksinimler PASS sayılmaz; `countsAsRequirementPass=false` korunur.

## Karar

Her kişi için ayrı `health_care_center` aggregate kullanılır. Alerji, kronik durum, kan grubu, aşı, randevu, belge bağlantısı, bakım planı/görevi, ilaç teyidi, ulaşım, vardiya/devir, ölçüm, iyi olma, yardım, düşme/acil gözlemi ve kişi arama kaydı aynı yerel, owner-bound günlükte tutulur. Yazımlar optimistic revision, idempotent client operation, state fingerprint ve exact `health.write` / `care` PEP receipt-fence-projection kanıtı gerektirir.

Bakım veren erişimi rol adından türetilmez. Veri sahibi dışındaki erişim exact account/person/family bağlı, süreli, etkin ve minimum-gerekli grant ile; dokuz kapsam ve yalnız `read|record` eylemleri üzerinden verilir. Açık deny grant iptalde aynı transaction içinde yazılır. Genel sağlık erişimi, otomatik paylaşım veya renderer kaynaklı owner/account/family yetkisi yoktur.

## Yerel gerçeklik sınırı

Bu paket tıbbi doğrulama veya dış sağlık kayıt sistemi sorgusu yapmaz. Düşme/acil kayıtları kullanıcı gözlemidir; sensör adapteri, acil servis araması, yardım teslimi ve uzaktan yardım yapılandırılmamıştır. Büyük metin yalnız erişilebilir sunum seçeneğidir; sağlık sonucunun veya yardımın gerçekleştiğini kanıtlamaz.

Migration 97 dört tabloyu ekler: `health_care_mutations`, `health_care_centers`, `health_care_entries`, `health_care_access_grants`. Kanonik checksum `e3d60800e250feb674cd1250449982ac45cd7e700e74a728be7f6500c054d081` değeridir. PPK-021 güncel ratchet’i 563 dosya / 886 yüzey / `58a90febf9382776c2b1472e6ffd6a645c9a24a4cd69e499a8afc1fff2e72b30`; PPK-022 ratchet’i 563 dosya / 422 yüzey / `dc0234d84a50ff1872f9cde4fb7ab286446b236a69019034055fa938dbb3be1e` değerindedir. Statik manifest runtime yetkisi değildir.

## Fail-honest sınırlar

- Yerel 5 dosya / 20 test ve teknik gate sonuçları gereksinim kapanışı değildir.
- Gerçek bakım veren, yaşlı kullanıcı, medikal uzman, erişilebilirlik, gizlilik, hukuk ve güvenlik UAT kanıtları `NOT_RUN` durumundadır.
- Sensör, gerçek acil iletişim, uzaktan yardım ve dış yardım teslimi `NOT_CONFIGURED` veya `NOT_PERFORMED` durumundadır.
- Saklama süresi, kaynak silme yayılımı, yedek yayılımı ve fiziksel secure erase kabulü tamamlanmamıştır.
- Registry, roadmap, work plan ve active ledger değiştirilmez; persistent completion receipt üretilmez.

## Sonuç

33-S `PLANNED / LOCAL_IMPLEMENTATION_STARTED` kalır. Yerel bileşim sonraki kapanış adımına hazırdır; dış/manual kanıtlar ve öncül yönetişim kapanışları tamamlanmadan certification veya production acceptance iddiası üretilmez.
