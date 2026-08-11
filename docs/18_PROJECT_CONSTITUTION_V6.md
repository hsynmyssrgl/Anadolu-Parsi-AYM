# Proje Anayasası V6 — Aktif Build 225

**Aktif sürüm:** 02.08.2026.225  
**Yürürlük başlangıcı:** Build 225  
**Kural seti:** `PROJECT-RULES-2026-08-02-V6`  
**Kural sayısı:** 172  
**Kural SHA-256:** `1387db550dd263e396404503b537808f21a37e446c3cbd8585361531bd983a15`  
**Yetkili ana kaynak:** `docs/17_MASTER_BUILD_LEDGER.md`

V5 hükümleri aynen yürürlüktedir. V6 yalnız PR-172 sohbet bağlamı HARD_STOP ölçüm semantiğini kesinleştirir.

## PR-172 — Gerçek bağlam ölçümü ve zorunlu devir

PR-172 yalnız platform tarafından sağlanan gerçek sohbet bağlam kapasitesi yüzde 90 veya üzerindeyken HARD_STOP üretir. Tahmin, geçmiş build tahmini veya kullanılamayan platform sayacı HARD_STOP ya da zorunlu handoff sayılmaz. Gerçek kullanım yüzde 90 altındaysa zorunlu devir üretilmez. Gerçek HARD_STOP durumunda aynı sohbette yeni build başlatılmaz; aynı yanıt içinde tam kopyalanabilir devir metni gösterilir ve NEW_CHAT_HANDOFF_BUILDxxx.md oluşturulur.

## Devralınan bağlayıcı sınırlar

- Proje kaynağı yalnız 20.07.2026 ve sonrasıdır.
- Build224 ve daha eski tarihsel kayıtlar değiştirilemez.
- NOT_RUN sonucu PASS sayılamaz.
- Gerçek Windows EFS ve safeStorage kanıtları gerçek Windows altında çalışmadan PASS sayılamaz.
