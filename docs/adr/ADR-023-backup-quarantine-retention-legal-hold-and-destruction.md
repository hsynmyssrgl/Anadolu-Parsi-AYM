# ADR-023 — Yedek karantinası saklama, hukuki bekletme ve devam ettirilebilir nihai imha

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Tarih: 28.07.2026
- Karar: DEC-052
- Build: 138

## Bağlam

Build 137, eski yönetilen yedekleri yanlış silmeye karşı geri alınabilir
`.purge-quarantine` alanına taşıdı. Karantinanın ne kadar tutulacağı, hangi durumda
bekletileceği ve süre sonunda nasıl denetlenebilir biçimde yok edileceği kaynakta
bağlayıcı değildi. Doğrudan klasör silme; yanlışlık, hukuki yükümlülük ve yarım
işlem riskleri taşıyordu.

## Karar

1. Her karantina grubu SQLite içinde ayrı bir yaşam döngüsü kaydıdır.
2. Varsayılan saklama süresi 90 gündür ve yalnız operasyonel güvenlik başlangıcıdır.
3. Politika değişikliği geriye dönük olarak mevcut `retainUntil` tarihlerini sessizce
   değiştirmez.
4. Hukuki/koruma bekletmesi bulunan grup imha edilemez.
5. Politika değişikliği, bekletme ve imha aile yöneticisi + güçlü yeniden doğrulama
   gerektirir.
6. İmha kesin kayıt kimliği içeren onay metni olmadan başlamaz.
7. Veritabanı önce `destroying` durumuna CAS ile geçer; sonra dosya işlemi yapılır.
8. Manifest boyut ve SHA-256 doğrulamasından geçmeden hiçbir karantina dosyası
   imha edilmez.
9. Karantina dizini atomik olarak `.destroying-*` adına taşınır ve dayanıklı durum
   kaydıyla yarım işlem devam ettirilebilir.
10. Tamamlanan dosya işlemi kalıcı bir makbuzla idempotent hâle gelir; veritabanı
    güncellemesi başarısız olsa bile tekrar deneme aynı dosyayı yeniden varsaymaz.
11. Sıfır yazma + `fsync` + unlink en iyi çabadır; fiziksel yok etme garantisi değildir.

## Sonuçlar

- Yanlış veya erken imha fail-closed reddedilir.
- Hukuki bekletme teknik olarak uygulanabilir.
- Süreç kesintisi veri tabanı ile dosya sistemi arasında sessiz belirsizlik yaratmaz.
- İmha makbuzu içerik taşımadan sayı, bayt ve zaman kanıtı sağlar.
- Manuel kopyalar, çevrimdışı medya, snapshot ve bulut sürüm geçmişi bu ADR'nin
  otomatik dosya imha kapsamı dışında kalır.

## Doğrulama

- `scripts/verify-build138-backup-quarantine-lifecycle-contract.mjs`
- `scripts/verify-build138-backup-quarantine-lifecycle-runtime.mjs`
- `scripts/verify-build138-renderer-bridge-syntax.mjs`

Gerçek Windows/NTFS, SSD, harici disk ve bulut sağlayıcı kanıtları ayrı promotion
kapısıdır.
