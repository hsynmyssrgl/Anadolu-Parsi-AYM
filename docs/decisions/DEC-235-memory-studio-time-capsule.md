# DEC-235 — Hafıza stüdyosu ve zaman kapsülü

## Durum

`33-X` yol haritasında `PLANNED`, yerel uygulama zincirinde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Bu karar registry, roadmap, work plan veya aktif governance ledger üzerinde kapanış mutasyonu yapmaz. `countsAsRequirementPass=false`; kalıcı governance receipt ve bütün manuel kanıtlar `NOT_RUN` kalır.

## Karar

Hafıza stüdyosu yalnız oturumdaki hesap, aile ve kişi sahibiyle bağlanmış merkezi Life PEP receipt'i altında çalışır. Kalıcı kayıtlar medya içeriği yerine başlık, kısa kullanıcı özeti ve korunan arşiv/OCR/kişi kaynaklarına ait içeriksiz referansları tutar. Arşivdeki asıl medya korumalı kaynağında kalır; yeni ikili payload, dosya kopyası veya renderer dosya yetkisi oluşturulmaz.

Sesli hikâye, transkript, fotoğraf kitabı, yıllık albüm, geçmişte bugün, yinelenen fotoğraf incelemesi, kişi grubu, soy ağacı medya bağı, tarif, gelenek, mektup, gelecek mesajı, aile belgeseli ve basılabilir kitap yalnız manuel kürasyon kayıt türleridir. Transkripsiyon, yüz tanıma, duplicate detection, belgesel/kitap render ve yazdırma uygulanmış sayılmaz. Kişi gruplama için açık manuel onay ve exact arşiv/kişi bağları zorunludur.

Zaman kapsülü en az bir korunan kaynağa bağlanır, açılma tarihi en az yedi gün ileride olur ve mühürleme için iki ayrı hesabın onayını gerektirir. Yerel açılış yalnız bekleme süresi dolduktan sonra yapılır; açılış en çok yirmi dört saat içinde geri alınabilir. İptal, onay geri alma ve replay akışları optimistic revision, idempotent client operation, immutable mutation ledger ve aynı receipt/fence eşliğiyle fail-closed uygulanır.

Audit ve outbox içeriksizdir. Ağ, bulut veya dış teslimat yoktur; açılış yalnız yerel durum metadata'sını değiştirir.

## Dürüstlük sınırı

Uygulanan yüzey yerel metadata/reference yönetimi ve zaman kapsülü durum makinesidir. Gerçek medya transkripsiyonu, yüz gruplama modeli, yinelenen fotoğraf algılama, belgesel/kitap üretimi, yazdırma ve dış alıcıya teslimat çalıştırılmamıştır. Gerçek aile hafıza UAT'ı, medya transkripsiyonu, yüz gruplama, duplicate detection, belgesel/kitap/yazdırma, zaman kapsülü release/recovery ve privacy/legal incelemeleri `NOT_RUN` durumundadır. Bu nedenle B6-04 ve EXT-051–EXT-057 tamamlanmış sayılmaz.

## Yerel kanıt

Migration 102 `memory_studio_time_capsule` SHA-256 değeri `cb719e825fde1269af44900d4ab66d1fa6a550e7cfe1695535a6e4e5c7cceafa` ile doğrulanır. Beş hedef dosyada 21 test; PPK-021 için 480 dosya / 740 exact yüzey ve `be7f27d47e2aa592dd2dc4d077222c030632a346eaad3014288b9b4b8bacf83e`; PPK-022 için 480 dosya / 345 exact yüzey ve `1b8625264023eb79d3f36a3c25ca19480569bea6aa1f4589841b1b4d14d5ec3e` ratchetleri yerel teknik kanıttır. Bu kanıtlar kabul, sertifikasyon, basım veya harici teslimat iddiası değildir.
