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

Migration 102 `memory_studio_time_capsule` SHA-256 değeri `cb719e825fde1269af44900d4ab66d1fa6a550e7cfe1695535a6e4e5c7cceafa` ile doğrulanır. Beş hedef dosyada 21 test; PPK-021 için 555 dosya / 873 exact yüzey ve `843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc`; PPK-022 için 555 dosya / 392 exact yüzey ve `cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c` ratchetleri yerel teknik kanıttır. Bu kanıtlar kabul, sertifikasyon, basım veya harici teslimat iddiası değildir.
