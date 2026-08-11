# Bronze RC2 Build 108 — Sürüm Yönetişimi ve Drift Önleme

- Uygulama: `25.07.2026.108`
- Paket: `25.7.2026-108`
- Kanal: Bronze RC2 Active Development

## Değişiklikler

- Ana build durumu ile aktif geliştirme belgesindeki eski sürüm driftleri giderildi.
- Sürüm güncelleyicisi tüm aktif sürüm yüzeylerini senkronize edecek şekilde genişletildi.
- Paketler, internal workspace bağımlılıkları, lockfile, `APP_META`, sürüm defteri, repository metadata, build durumu ve kaynak manifesti için genel aktif sürüm sözleşmesi eklendi.
- Repository metadata workspace sayıları gerçek monorepo yapısına bağlandı.
- Aktif sürüm sözleşmesi RC2 doğrulama kapılarına eklendi ve JSON kanıt üretimi sağlandı.
- Aktif Bronze database doğrulayıcısındaki eski Build 56, eski aşama ve `2.1.0` bağımlılık sabitleri kaldırıldı.
- Migration sahipliği ile audit append-only kontrolleri güncel runtime ve katman sınırlarına uyarlandı.

Bu sürüm üretim sürümü değildir; Bronze RC2 aktif geliştirme devam etmektedir.
