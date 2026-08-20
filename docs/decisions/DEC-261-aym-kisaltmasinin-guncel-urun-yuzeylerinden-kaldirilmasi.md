# DEC-261 — AYM Kısaltmasının Güncel Ürün Yüzeylerinden Kaldırılması

- Tarih: 20.08.2026
- Durum: ACTIVE
- Görünür sürüm: Bronze 20.08.2026.36

## Karar

Güncel ürün adı **ParsYuva Aile Yaşam Merkezi**dir. `AYM` kısaltması yeni veya güncel kullanıcı yüzeylerinde, kurulum dosyası adında, pencere ve kısayol adında, yardım ve sesli anlatım metinlerinde, aktif belge başlıklarında ve kullanıcıya dönük yeni metadata içinde kullanılamaz.

`C:\PPT\AYM` çalışma kökü, kararlı Windows appId, geçmiş kullanıcı veri dizini, eski kanıt kimlikleri ve tarihsel belgelerdeki özgün metinler geriye dönük uyumluluk ve kanıt bütünlüğü için değişmeden kalabilir. Bu teknik ve tarihsel kullanımlar güncel marka adı sayılmaz ve kullanıcıya yeni ürün adı olarak gösterilemez.

Kurulum dosya adı Türkçe anlamlı, Türkçe karaktersiz ve tam ürün adını taşıyan `ParsYuva-Aile-Yasam-Merkezi-<Kanal>-<GG.AA.YYYY.NN>-<Mimari>-Kurulum.exe` biçimindedir.

## Sonuç

- PR-209, PR-211, PR-212, PR-217 ve PR-220 bu kararla güncellenmiştir.
- Güncel aktif belgeler ve ticari temel ürün adı tam ada geçirilir.
- Tarihsel kayıtlar yeniden yazılmaz.
- Marka doğrulama ve installer kapıları `AYM` kısaltmasını güncel kullanıcı yüzeylerinde fail-closed reddeder.
