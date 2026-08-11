# Aktif Oturum Kullanıcı Verisi Koruması — Build 213

**Sürüm:** 01.08.2026.213  
**Durum:** Source implementation complete; Windows EFS proof pending.

## Güvenlik modeli

1. Kullanıcı doğrulanmadan veri kasası açılamaz.
2. Kalıcı kullanıcı verisi AES-256-GCM kapsayıcıdadır.
3. Girişten sonra SQLite ana veritabanı yalnız süreç belleğinde çalışır; normal `.db/.sqlite` çalışma dosyası oluşturulmaz.
4. Hydration, snapshot, yedek ve restore için gerekli dosya görüntüsü benzersiz kısa ömürlü staging alanındadır.
5. Windows production staging dizini dosya yaratılmadan önce EFS ile korunur; EFS başarısızsa akış durur.
6. Snapshot bittiğinde staging dosyası kaldırılır; best-effort overwrite fiziksel secure-delete garantisi değildir.
7. Aktif oturum en fazla 30 saniyede bir şifreli kasaya checkpoint edilir.
8. Logout/timeout/quit son snapshotı mühürler, data key'i bırakır ve staging alanını kaldırır.

## Tehdit modeli sınırı

Bu kontrol diskte düz aktif SQLite içeriği bırakmama ve yetkisiz dosya açma riskini azaltır. Aynı Windows kullanıcısı yetkisindeki malware, debugger/process-memory erişimi veya yönetici ayrıcalığına karşı mutlak engel iddia edilmez. Bu iddia ancak ayrı OS/EDR/credential-guard benzeri katman ve gerçek tehdit testiyle yapılabilir.

## Doğrulama durumu

- Bellek-içi SQLite + snapshot/hydration round-trip: PASS
- Kalıcı AES-256-GCM kasa: PASS
- Kilitli durumda düz `.db/.sqlite` kalmaması: PASS (non-Windows runtime harness)
- Windows EFS `cipher.exe` gerçek çalışma: NOT_RUN
- Paketlenmiş Windows uygulaması: NOT_RUN
