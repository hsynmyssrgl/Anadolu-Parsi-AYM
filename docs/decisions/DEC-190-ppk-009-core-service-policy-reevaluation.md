# DEC-190 — PPK-009 Core Service politika yeniden değerlendirmesi

## Durum

32-E kapsamında kabul edildi ve tamamlandı. PPK-009 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Bir butonun, menünün veya ekran alanının gizlenmesi yetkilendirme sayılmaz. Korumalı Desktop kanalları yalnız kanal kimliği ve correlation kimliğinden kanonik politika intenti üretir; renderer tarafından gönderilen görünürlük, rol, capability veya izin iddiası karar girdisi olamaz.

Üretim politika paketi `decisionAuthorityId: windows-core-service` alanını imzalı payload içinde taşır. Desktop evrensel PEP, yalnız `windows-core-service` karar otoritesi işaretli Core Service sağlayıcısını kabul eder. PEP tam strict isteği süreç sınırından Core Service'e gönderir; Core Service kendi Kernel'iyle isteği yeniden değerlendirir ve kendi güncel cluster fence durumuyla yazılabilirliği yalnız daraltabilir.

Strict request, karar, imzalı receipt, aktif işlem bağlamı ve kalıcı receipt record aynı karar otoritesini taşır. Eksik veya `local-policy-kernel` ile değiştirilmiş otorite `DECISION_AUTHORITY_MISMATCH` ya da makbuz doğrulama reddiyle işlem callback'i ve kalıcılaştırma açılmadan kapanır. Provider'ın yalnız metadata etiketi yeterli değildir; değer imzalı politika paketi ve imzalı receipt kararıyla eşleşmelidir.

Kimliği doğrulanmamış oturumlarda politika subject'i henüz bulunmadığı için yalnız kapalı `BOOTSTRAP_CHANNELS` sözlüğündeki kurulum, giriş ve davet kabul kanalları receiptless çalışabilir. Çıkış, yeniden yetkilendirme ve bütün aile işlemleri bu istisnaya dahil değildir. Auth use-case'lerinin kendi parola/MFA/cihaz kontrolleri korunur.

Göç 74, tarihsel satırları koruyarak `decision_authority_id` sütununu ekler. Yeni Core-bağlı makbuzlarda değer request, decision, signed receipt ve record boyunca exact eşleşir. Repository aktif PEP işlem bağlamından farklı karar otoritesi yazamaz.

## Gerçeklik sınırı

Bu karar gerçek aile verisini Core Service'e taşımaz, SQLite yazma sahipliğini değiştirmez, DEC-171 cutover kilidini kaldırmaz ve yeni Build vermez. Core Service yalnız politika karar otoritesidir; mevcut Desktop kasası yetkili veri yolu olarak kalır.

## Kapanış kanıtı

- Hedefli PPK-009 testi: 10/10 PASS.
- Platform Policy + evrensel PEP regresyonu: 100/100 PASS.
- Kapanış sözleşmesi: 32/32 PASS.
- Runtime kapanış demeti: 8/8 PASS.
- Veritabanı göç zinciri: 74/74 PASS.
- Tam Vitest: 58 dosya, 370 test PASS.
- Kök TypeScript: 0 diagnostic.

Bu kapanış yalnız PPK-009 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
