# ADR-087 — Protected Side Artifact güvenlik sınırı

## Bağlam

Build213 ana kullanıcı verisini bellek-içi SQLite + AES-256-GCM kalıcı kasaya taşıdı; ancak log, diagnostic/export, health report, receipt, browser session/cache/temp ve crash alanları ayrı yan-artifact yüzeyleridir. Ana veritabanının korunması bu dosyaların plaintext kalmasını otomatik olarak engellemez.

## Karar

Tek bir `ProtectedSideArtifactStore` kalıcı yan-artifact şifreleme otoritesidir. İçerik AES-256-GCM ile şifrelenir; 32 bayt veri anahtarı kalıcı olarak plaintext tutulmaz, `DeviceSecretProtector` üzerinden Electron `safeStorage`/Windows DPAPI ile sarılır. Kapsayıcı başlığı yalnız ürün/sürüm/artifact türü/zaman ve kriptografik envelope metadata taşır.

Logger her kayıt için ayrı authenticated envelope yazar ve `.pplog` döndürür. Operasyonel text/gzip portu aynı store üzerinden şifreli dosya üretip transparan decrypt/verify sağlar. Security receipt ve startup preflight evidence aynı koruma katmanına bağlanır. Health-report PDF yalnız bellekte üretilir; diske doğrudan PDF yazılmaz, `.pptreport` ciphertext kapsayıcı yazılır.

Browser `sessionData`, crash dump, application cache/temp alanları süreç-özel volatil root'a yönlendirilir. Kullanıcı tarafından bilinçli export yapılması plaintext istisna oluşturmaz.

## Sonuçlar

- Plaintext JSONL log yerine `.pplog` kullanılır.
- Diagnostic/maintenance export `.pptdiag`; health report `.pptreport` olur.
- Şifreli kapsayıcı üzerinde SHA-256 bütünlük/teslim descriptor'ı tutulur; içerik bütünlüğü ayrıca AES-GCM auth tag ile korunur.
- Gerçek Windows DPAPI/safeStorage testi çalıştırılmadan platform davranışı PASS değildir.
- Aynı kullanıcı bağlamındaki malware/admin veya process-memory okuma yeteneğine karşı mutlak gizlilik iddia edilmez.
