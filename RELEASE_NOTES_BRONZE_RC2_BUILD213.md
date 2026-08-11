# Release Notes — Build 213

- Aktif aile SQLite veritabanı düz disk çalışma dosyasından `DatabaseSync(':memory:')` süreç belleğine taşındı.
- Kalıcı ana kullanıcı verisi AES-256-GCM kasa olarak korunmaya devam eder.
- Girişte kasa içeriği bounded staging üzerinden belleğe hydrate edilir; staging dosyası işlem sonunda kaldırılır.
- Yedek/export işlemleri `VACUUM main INTO` ile yalnız bounded snapshot üzerinden dosya yolu alır.
- Full restore normal data klasörüne düz SQLite bırakmak yerine korumalı staging alanında tamamlanıp AES-256-GCM kasaya mühürlenir.
- Windows production staging dizini dosya oluşmadan önce `cipher.exe /E /B /H` ile EFS korumasına alınır; başarısızlık fail-closed'dur.
- Non-Windows test ortamında 0700/0600 staging yalnız doğrulama kolaylığıdır; Windows EFS PASS sayılmaz.
- Aktif oturum için en fazla 30 saniyelik encrypted checkpoint eklendi.
- Migration sırasında aktif bellek DB'sinden düz safety-backup üretilmesi kapatıldı; şifreli kasa rollback kaynağıdır.
- DEC-103 / ADR-086 oluşturuldu.
- Aynı Windows kullanıcısı/malware/admin bağlamına karşı mutlak izolasyon iddia edilmez.
- OPEN-021 gerçek Windows EFS + paketli uygulama kanıtına kadar IN_PROGRESS kalır.
