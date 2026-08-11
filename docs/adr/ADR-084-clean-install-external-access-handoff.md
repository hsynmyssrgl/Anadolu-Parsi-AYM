# ADR-084 - fail-closed dependency acquisition handoff

## Bağlam
Clean npm ci resmî registry tarballlarına veya doğrulanmış offline cache'e ihtiyaç duyar. Mevcut ortam bunları sağlayamıyor.

## Karar
fail-closed davranılır: lockfile değiştirilmez, eksik paketler sahte shim ile ikame edilmez, clean install PASS iddia edilmez. 117 tarball için deterministik acquisition planı ve bütünlük doğrulamalı handoff kullanılır.

## Sonuç
Kaynak tekrarlanabilirliği korunur. OPEN-002 gerçek erişilebilir ortamda clean npm ci PASS alınana kadar açık kalır.
