# DEC-235 — Hafıza stüdyosu ve zaman kapsülü

## Durum

`33-X` yol haritasında `PLANNED`, yerel uygulama zincirinde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Bu karar registry, roadmap, work plan veya aktif governance ledger üzerinde kapanış mutasyonu yapmaz. `countsAsRequirementPass=false`; kalıcı governance receipt ve bütün manuel kanıtlar `NOT_RUN` kalır.

## Karar

Hafıza stüdyosu yalnız oturumdaki hesap, aile ve kişi sahibiyle bağlanmış merkezi Life PEP receipt'i altında çalışır. Kalıcı kayıtlar medya içeriği yerine başlık, kısa kullanıcı özeti ve korunan arşiv/OCR/kişi kaynaklarına ait içeriksiz referansları tutar. Arşivdeki asıl medya korumalı kaynağında kalır; yeni ikili payload, dosya kopyası veya renderer dosya yetkisi oluşturulmaz.

Sesli hikâye, transkript, fotoğraf kitabı, yıllık albüm, geçmişte bugün, yinelenen fotoğraf incelemesi, kişi grubu, soy ağacı medya bağı, tarif, gelenek, mektup, gelecek mesajı, aile belgeseli ve basılabilir kitap yalnız manuel kürasyon kayıt türleridir. Transkripsiyon, yüz tanıma, duplicate detection, belgesel/kitap render ve yazdırma uygulanmış sayılmaz. Kişi gruplama için açık manuel onay ve exact arşiv/kişi bağları zorunludur.

Zaman kapsülü en az bir korunan kaynağa bağlanır, açılma tarihi en az yedi gün ileride olur ve mühürleme için iki ayrı hesabın onayını gerektirir. Yerel açılış yalnız bekleme süresi dolduktan sonra yapılır; açılış en çok yirmi dört saat içinde geri alınabilir. İptal, onay geri alma ve replay akışları optimistic revision, idempotent client operation, immutable mutation ledger ve aynı receipt/fence eşliğiyle fail-closed uygulanır. Aynı komutun alan sırasından bağımsız canonical fingerprint'i korunur; geç bir replay göreli açılma penceresini yeniden yorumlamaz. Kalıcı durum zamanı geriye gidemez ve kapsül kaynakları mühürleme ile açılış öncesinde yeniden doğrulanır.

Audit ve outbox içeriksizdir. Renderer onaylayan hesap/kişi kimliklerini görmez; yalnız toplam onay sayısı ve mevcut hesabın kendi onay durumu gösterilir. Sahip başına 500 kayıt ve 200 kapsül üst sınırı hem repository hem migration katmanında fail-closed uygulanır ve UI kalan kapasiteyi gösterir. Ağ, bulut veya dış teslimat yoktur; açılış yalnız yerel durum metadata'sını değiştirir.

## Dürüstlük sınırı

Uygulanan yüzey yerel metadata/reference yönetimi ve zaman kapsülü durum makinesidir. Terminal kayıt/kapsül geçmişi kalıcıdır; güvenli süreli retention, tombstone özeti veya kapasite geri kazanım sözleşmesi henüz yoktur. Farklı aile hesaplarının onay bekleyen kapsülleri keşfedebildiği ortak bir onay kutusu yoktur. Kaynaklar create ile seal/release anlarında doğrulanır; geçmiş referans yetkisinin her okumada sürekli yeniden değerlendirilmesi uygulanmamıştır. Gerçek medya transkripsiyonu, yüz gruplama modeli, yinelenen fotoğraf algılama, belgesel/kitap üretimi, yazdırma ve dış alıcıya teslimat çalıştırılmamıştır. Gerçek aile hafıza UAT'ı, medya transkripsiyonu, yüz gruplama, duplicate detection, belgesel/kitap/yazdırma, çok hesaplı onay keşfi, retention/kapasite geri kazanımı, zaman kapsülü release/recovery ve privacy/legal incelemeleri `NOT_RUN` durumundadır. Bu nedenle B6-04 ve EXT-051–EXT-057 tamamlanmış sayılmaz.

## Yerel kanıt

Migration 102 `memory_studio_time_capsule` SHA-256 değeri `0a3313d1e74c92a22202051ccd2032a4b8a62e7079e93083a6f0d1aa706ac04e` ile doğrulanır. Beş hedef dosyada 28 test; PPK-021 için 556 dosya / 876 exact yüzey ve `709379784b8e59727f58d54c6187a4f2924d19c0bcefbe6efb976ed64f825dd0`; PPK-022 için 556 dosya / 395 exact yüzey ve `a3b3f91af4a08d2b4fcb58d71b67a9e40283e6b94364a64519409c4d44a21d0e` ratchetleri yerel teknik kanıttır. Bu kanıtlar kabul, sertifikasyon, basım veya harici teslimat iddiası değildir.
