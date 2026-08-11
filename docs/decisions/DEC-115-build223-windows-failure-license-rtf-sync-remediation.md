# DEC-115 — Build223 gerçek Windows failure evidence ve Build224 NSIS lisans senkronizasyonu

Build223 exact-source gerçek Windows koşusunda source integrity, root `npm ci`, isolated Windows packager bootstrap, workspace package build, dist guard, Electron main/preload build ve renderer build PASS oldu. Installer ön doğrulaması ise `build/LICENSE_TR.rtf` dosyasının güncel UTF-8 `build/LICENSE_TR.txt` lisans kaynağıyla deterministik olarak eşleşmemesi nedeniyle FAIL oldu.

Build224, `LICENSE_TR.txt` dosyasını tek lisans içerik kaynağı kabul eder. `LICENSE_TR.rtf` aynı paylaşılan renderer fonksiyonuyla deterministik üretilir ve kaynak snapshotında senkron halde tutulur. Windows paketleme kaynak snapshotını sessizce değiştirmez; `verify:license-sync` paketlemeden önce exact byte eşliğini fail-closed doğrular. Açık authoring komutu `sync:license:rtf` yalnız bilinçli kaynak güncellemesi için kullanılır.

Gerçek Build224 Windows EFS/DPAPI/paketli Electron kanıtı dönmeden OPEN-021 ve OPEN-022 kapanmaz. ADR-098 ve `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD224.md` bağlayıcıdır.
