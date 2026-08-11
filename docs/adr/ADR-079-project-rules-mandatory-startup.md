# ADR-079 — Bağlayıcı proje kurallarının zorunlu başlangıç kapısı

- Durum: Kabul edildi
- Build: 206
- Tarih: 2026-08-01
- Karar: DEC-096

## Bağlam

Proje farklı sohbet ve geliştirme oturumlarında devam ettiği için geçmiş kararların
yeniden öğretilmesi veya araştırılması süreklilik riski oluşturur. Build 205 Ana Build
Defteri devam noktasını tekleştirmiştir; Build 206 bu deftere bağlayıcı proje
anayasasını da dahil eder.

## Karar

1. Güncel kural seti Ana Build Defteri'nin makine kaynağı ve okunabilir Markdown
   görünümü içinde tutulur.
2. Yeni sohbet/geliştirme oturumu önce `docs/17_MASTER_BUILD_LEDGER.md` dosyasını
   okur.
3. Her build başlangıcı yürürlükteki kural setinin SHA-256 özetini açıkça kabul eder.
4. `scripts/update-master-build-ledger.mjs start` ve `scripts/set-workspace-version.mjs`
   yanlış veya eksik kural özetiyle build başlatmayı reddeder.
5. Kural seti yalnız yeni build, açık kullanıcı kararı, yeni sürüm ve yeni SHA-256 ile
   değiştirilebilir; eski sürümler silinmez.
6. Kaynak preflight, Ana Build Defteri ile kural seti bütünlüğünü doğrular.

## Sonuç

Yeni sohbetlerde proje kurallarının kullanıcı tarafından yeniden anlatılması normal
akış değildir. Kaynak içindeki Ana Build Defteri tek başlangıç kaynağıdır.
