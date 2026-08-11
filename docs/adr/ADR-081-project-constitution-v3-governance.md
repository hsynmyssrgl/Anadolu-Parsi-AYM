# ADR-081 — Proje Anayasası V3 fail-closed yönetişim kapıları

## Bağlam

Uzun build zincirinde sohbet geçmişine bağımlılık, kişisel demo verisi, sürüm driftleri ve dokümantasyon kopukluğu sürdürülebilir değildir.

## Karar

Build 208’den itibaren anayasa hükümleri makine okunur politika dosyaları ve fail-closed doğrulama kapılarıyla uygulanır. Üretim başlangıç seed’i kaldırılır. Aktif metadata marka kimliğine taşınır. 20.07.2026 öncesi kaynaklar yasaklanır. UI baseline Silver öncesi zorunlu kabul kapısıdır. Her build Artifact Index, ilerleme raporu ve Master DOCX/PDF üretmeden kapanamaz.

## Sonuçlar

Tarihsel kanıtlar özgün build numaralarını korur ancak aktif otorite değildir. Kişisel veri gizliliği için aktif kaynak ve teslim yüzeyi sanitizasyonu yeni build kararıyla önceliklidir. Çalıştırılmayan Silver/Windows kapıları PASS sayılamaz.
