# ADR-086 — Bellek-içi SQLite ve Windows EFS korumalı bounded staging

## Bağlam
Vanilla SQLite aktif veritabanı sayfalarını yerleşik olarak şifrelemez. SQLCipher yeni native bağımlılık, paketleme ve anahtar yaşam döngüsü riski getirir; mevcut ortamda clean dependency zinciri de henüz doğrulanmış değildir.

## Karar
Aktif kullanıcı veritabanı `DatabaseSync(':memory:')` ile yalnız süreç belleğinde çalıştırılır. Kalıcı kaynak AES-256-GCM kasadır. Diskte SQLite görüntüsü gerektiğinde yalnız benzersiz oturum staging dizini kullanılır. Windows production'da dizin önceden EFS ile şifrelenmeden hydration/snapshot/restore dosyası oluşturulmaz. Non-Windows geliştirme doğrulamasında 0700/0600 özel izinler kullanılabilir fakat bu Windows EFS PASS kanıtı sayılmaz.

Snapshot `VACUUM main INTO` ile staging içine alınır; kullanım bittiğinde dosya kaldırılır. Restore de normal data klasörüne düz DB bırakmak yerine aynı korumalı staging alanında tamamlanır ve AES-256-GCM kasaya yeniden mühürlenir.

## Sonuçlar
- Normal aktif kullanımda diskte okunabilir SQLite çalışma dosyası bulunmaz.
- Yedek/export kodları dosya yolu istediğinde bounded snapshot provider kullanır.
- Migration için düz safety-backup üretilmez; önceki şifreli kasa rollback kaynağıdır.
- 30 saniyelik encrypted checkpoint veri kaybı penceresini sınırlar.
- EFS kurulamazsa Windows production staging fail-closed olur.
- Aynı kullanıcı/malware/admin için mutlak gizlilik iddiası yapılmaz.
- Gerçek Windows EFS ve paketli uygulama testi promotion-blocking kanıt olarak kalır.
