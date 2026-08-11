# DEC-143 — PPK-002 archive core-table receipt fence

## Karar

30-R, `archive_items` ve `archive_versions` üzerindeki yeni iş yazılarını SQLite seviyesinde geçerli, izin verilmiş ve tam kapsamı eşleşen PPK-002 receipt’ine bağlar. Uygulama katmanındaki tür ve repository kontrolleri korunur; veritabanı tetikleyicileri bu kontrollerden bağımsız son savunma katmanıdır.

Her yeni çekirdek arşiv yazısı exact receipt hash, nonce, correlation, resource, action ve capability bağını taşır. Receipt’in ilgili tablo/işlem için daha önce tüketilmediği doğrulanır; başarılı yazı immutable tüketim siciline kaydedilir. Receipt’siz, kapsamı farklı, tekrar kullanılan veya doğrudan SQL ile yapılan yazılar fail-closed reddedilir.

## Kapsam sınırı

Bu karar yalnız `archive_items` ile `archive_versions` çekirdek tablolarını ve bunları kullanan governed repository akışını kapsar. Arşiv kategori, etiket, item-tag, retention-policy ve event attachment çapraz-aggregate tablolarının evrensel fence kapsamı tamamlanmış sayılmaz. Koordineli veritabanı+journal geri dönüşüne karşı haricî monoton otorite, yeni-correlation unknown-commit idempotency, expired reservation pruning, obligation execution, secure file deletion/database atomikliği ve kurulu Core Service kanıtı açık kalır.

PPK-002 `PARTIAL`; evrensel repository enforcement `NOT_COMPLETE`; Silver ve Gold `FORBIDDEN_NOT_READY` kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
