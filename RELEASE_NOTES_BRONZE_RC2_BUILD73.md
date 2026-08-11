# Panthera pardus tulliana — Bronze RC2 Aktif Geliştirme Build 73

**Sürüm:** 24.07.2026.73  
**Paket:** 24.7.2026-73  
**Durum:** Aktif geliştirme; Code Freeze ve RC2 Final değildir.

## Değişiklikler

- `SqliteAiConsentRepository` eklendi.
- AI izin listeleme ve kimlik çözümleme repository katmanına taşındı.
- İzin ekleme/güncelleme ve etkin izin sorguları repository katmanına taşındı.
- AI erişim önizlemesi application query port üzerinden yetki filtreli çalışır hâle getirildi.
- İzin tarih aralığı, kaynak kimliği ve durum doğrulamaları use-case katmanına taşındı.
- İzin değişiklikleri zincirli audit kaydıyla aynı transaction içinde tamamlanır.
- DataStore içindeki AI izinlerine ait doğrudan SQL kaldırıldı.

## Not

Bu kaynak teslimi Windows installer/EXE değildir.
