# Bronze RC2 Build 136 Sürüm Notları

- Application Version: `28.07.2026.136`
- Package Version: `28.7.2026-136`
- Stage: **Bronze RC2 Active Development**

## Eklenenler

- `data_retention_policies` ve `data_lifecycle` SQLite tabloları.
- Etkin, arşivlenmiş, imha bekleyen ve imha edilmiş durum modeli.
- Geri alınabilir arşivleme ve normal modül listelerinden gizleme.
- Kayıt türü, saklama günü ve geri alma penceresi tanımlayan politikalar.
- Kayıt kimliğine bağlı iki ayrı kesin imha onay metni.
- Parola ve etkinse TOTP ile güçlü yeniden doğrulama.
- Hukuki/koruma bekletmesi ve güçlü doğrulamalı kaldırma.
- Nesne düzeyi mahremiyet ve açık izin/ret kararlarının silme akışında korunması.
- Kaynakla birlikte nesne izinleri ve AI izinlerinin transaction içinde kaldırılması.
- İmha sonrası içeriksiz tombstone ve `backupPropagationPending` uyarısı.
- SQLite `secure_delete` ve WAL checkpoint en iyi çaba sınırı.
- Güvenlik ve Ayarlar ekranında politika ve kayıt yaşam döngüsü yönetimi.

## Aşama notu

Bu artırım kaynak düzeyi veri yaşam döngüsü yönetişimini geliştirir. Gerçek yasal
saklama süreleri, eski yedeklere imha yayılımı, Windows/SSD kalıntı incelemesi,
renderer UAT, production build ve installer kanıtları ayrıca tamamlanmadan PASS
sayılmaz.

## Kaynak doğrulaması

- Build 136 sözleşmesi: **PASS — 70/70**
- Veri yaşam döngüsü runtime: **PASS — 30/30**
- Renderer/bridge söz dizimi: **PASS — 3/3**
- Kaynak preflight: **PASS — 27/27**
- Ağır derleme, tam test ve Windows/installer kapıları: **NOT_RUN**
