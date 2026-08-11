# Bronze RC2 Build 155 Sürüm Notları

- Uygulama sürümü: `29.07.2026.155`
- Paket sürümü: `29.7.2026-155`
- Aşama: **Bronze RC2 Active Development**

## Tek ana geliştirme konusu

Büyük aile verilerinde sınırlı dashboard başlangıcı, bölümlü aile snapshot'ı ve
ekran bazlı tembel veri yükleme.

## Eklenenler

- `data:getSnapshotSections` IPC kanalı.
- `graph` ve `timeline` veri bölümleri.
- Renderer single-flight bölüm yükleme ve ekran hazırlık sınırı.
- Finans, sağlık, yaşam, otomasyon, rapor ve arşivlenmiş olay listelerinde lazy load.
- Dashboard için SQL `COUNT/SUM` agregaları.
- Yaklaşan olaylarda `LIMIT 6`, son olaylarda `LIMIT 4`.
- Katılımcı ve açık izin/ret görünürlüğünün SQL tarafında korunması.

## Hedefli doğrulama

- Build 155 bounded bootstrap contract: **PASS — 33/33**
- Dashboard SQL runtime: **PASS — 9/9**
- Renderer/preload/global/main/policy syntax: **PASS — 5/5**
- Controlled package-source TypeScript: **PASS**
- Controlled desktop-main TypeScript: **PASS**

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
