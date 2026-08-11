# Bronze RC2 Build 158 Sürüm Notları

- Uygulama sürümü: `29.07.2026.158`
- Paket sürümü: `29.7.2026-158`
- Aşama: **Bronze RC2 Active Development**

## Tek ana geliştirme konusu

Oturum güvenli asenkron state sıralaması ve monoton mutasyon revizyon filigranı.

## Eklenenler

- Kapsam, oturum çağı ve sıra numaralı `AsyncWriteGuard`.
- Mutasyon kimliği tekrar önleme ve anahtar bazlı `MutationRevisionWatermark`.
- Kişi/olay katalogları, aile ilişkili olayları, soy ağacı, zaman tüneli ve arşiv
  için latest-request-wins state yazımı.
- Snapshot bölümleri, yardımcı ekranlar, dashboard, aile yenilemesi ve kimlik
  geçişleri için oturum bağlı biletler.
- Mutasyon sırasında devam eden eski graph/timeline snapshot'ını iptal edip ekran
  yükünü yeniden başlatan yarış koruması.
- Eski promise'in yeni tek-uçuş kaydını silememesi için kimlik kontrollü cleanup.

## Hedefli doğrulama

- Stale write contract: **PASS — 36/36**
- Async guard runtime: **PASS — 22/22**
- Renderer syntax: **PASS — 6/6 files**
- Controlled TypeScript: **PASS — 2/2**

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
