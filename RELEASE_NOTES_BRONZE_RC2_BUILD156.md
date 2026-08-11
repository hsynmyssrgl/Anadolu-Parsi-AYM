# Bronze RC2 Build 156 Sürüm Notları

- Uygulama sürümü: `29.07.2026.156`
- Paket sürümü: `29.7.2026-156`
- Aşama: **Bronze RC2 Active Development**

## Tek ana geliştirme konusu

Tam aile ekranı ve ortak kişi/olay seçim alanlarında arama destekli, keyset sayfalı
kataloglar.

## Eklenenler

- `catalog:listPeople`, `catalog:listEvents` ve `catalog:lookup` IPC kanalları.
- Kişiler için ad + kimlik, olaylar için tarih + kimlik keyset sayfalama.
- Kullanıcı ve etkin filtre kapsamına bağlı SHA-256 katalog imleci.
- Tür başına en fazla 100 kimliklik seçili değer çözümlemesi.
- Olay katalog ve lookup sonuçlarında nesne bazlı izin filtresi.
- Aile ekranında 30 kişilik sayfalar ve seçili kişi için 10 olay.
- İlişki oluşturma için iki bağımsız kişi araması.
- Olay oluşturma/düzenleme için aramalı çoklu katılımcı seçimi.
- Zaman tüneli, arşiv ve bağlı kişi alanlarında ortak katalog bileşenleri.
- Migration 26 kişi katalog performans indeksi.

## Hedefli doğrulama

- Entity catalog contract: **PASS — 54/54**
- SQLite runtime: **PASS — 17/17**
- Service runtime: **PASS — 15/15**
- Syntax and IPC parity: **PASS — 8/8 files, 183/183 channels**
- IPC policy runtime: **PASS — 22/22**
- Controlled TypeScript: **PASS — 2/2**

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
