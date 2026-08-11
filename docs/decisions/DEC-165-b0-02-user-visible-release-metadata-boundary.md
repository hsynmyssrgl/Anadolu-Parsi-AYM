# DEC-165 — B0-02 kullanıcıya görünür sürüm metadata sınırı

## Durum

ACTIVE — DEC-137 sırasındaki ilk eyleme uygun açık iş.

## Karar

İç manifest ve çalışma zamanı kayıtları `packageVersion`, `releaseId`, `revision`, aylık sıra ve SHA-256 değerlerini korur. Renderer IPC’si ve kullanıcı arayüzü bu iç alanları doğrudan alamaz; yalnız dar bir kullanıcı-görünür DTO kullanır.

Kanonik etiket biçimi `Bronze|Silver|Gold + gg.aa.yyyy.sıra` biçimidir. Bu sürümde exact etiket `Bronze 04.08.2026.29` değeridir. Kullanıcıya görünen teslim dosyası adında `RC`, `RC2`, `MVP` veya `Build` bulunamaz.

## Uygulama sınırı

- `app:getInfo` yalnız kullanıcı-görünür DTO döndürür.
- UI `v04…` veya ayrı iç build/sıra sunmaz; kanonik etiketi gösterir.
- Kullanıcı teslim dosyası kanonik kanal ve tarih etiketini taşır.
- Tarihsel RC/MVP/Build belgeleri değiştirilmez.
- Yeni Build verilmez.

## Tamamlanma

31-E; domain şeması, IPC sınırı, UI, hedefli test, tam regresyon, sözleşme kapısı ve D: haricî Library makbuzu PASS olmadan tamamlanmaz.
