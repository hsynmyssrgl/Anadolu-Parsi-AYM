# DEC-244 — E2EE dosya paylaşımı ve kalan iletişim UX

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED

34-G, dosya byte'larını SQLite veya renderer'a vermeden E2EE zarf referansı, tam dosya SHA-256 değeri, 4 MiB parça receipt'leri, resumable durum, sürüm, yorum, tek arşiv kopyası ve süreli preview/download grant metadatasını yönetir. Tarama sonucu `clean` olmadan erişim verilemez; sağlayıcı yoksa `provider_unavailable` fail-closed kalır.

Haricî link üretimi kapalıdır. Uzaktan yardım tek kullanımlık açık rıza, görünür gösterge, hassas masaüstü gizleme ve anlık iptal ister. Acil aile duyurusu acil servis garantisi değildir. SharePlay, sesli komut çalıştırma, gerçek dosya transportu, malware scanner ve remote-control sağlayıcısı yapılandırılmamıştır.

Migration 111 ve hedefli testler yerel modeli kanıtlar; üretim provider/API bileşimi ve gerçek UAT olmadığı için `countsAsRequirementPass=false` ve registry/roadmap değiştirilmez.
