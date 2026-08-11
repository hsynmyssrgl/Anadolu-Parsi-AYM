# Proje Anayasası V3 — Build 208

**Aktif sürüm:** 01.08.2026.208  
**Kural seti:** `PROJECT-RULES-2026-08-01-V3`  
**Yetkili ana kaynak:** `docs/17_MASTER_BUILD_LEDGER.md`

Bu belge Ana Build Defteri içindeki bağlayıcı kural setinin uygulama çerçevesidir. Kural seti istisnasızdır; sessiz istisna veya eski sohbet/belge üstünlüğü yoktur.

## Kaynak kökeni

- Proje başlangıcı 20.07.2026’dır.
- Bu tarihten önceki sohbet, proje, dosya veya karar bu projeye kaynak olamaz ve proje yanıtlarında geçmiş olarak sunulamaz.
- Eski yatırım/otomatik işlem çalışması bu proje bağlamına taşınamaz.

## Marka ve kimlik

- Üst marka: `Panthera pardus tulliana`.
- Kullanıcıya görünen uygulama adı: `Anadolu Parsı Aile Yaşam Merkezi`.
- Latin üst marka normal uygulama ekranlarında gösterilmez.
- Aktif kaynak, belge, görsel ve teslim metadata’sında doğal kişi/aile kimliği bulunmaz; marka kimliği kullanılır.

## Üretim verisi

- Production başlangıcı boş ve nötrdür.
- Hazır aile/kişi/demo/seed kişisel verisi yasaktır.
- Test fixture’ları yalnız test alanında anonim ve nötr olabilir; production bundle’a giremez.

## Görsel baseline

- `config/ui-visual-reference-manifest.json` ve `docs/ui/UI_VISUAL_REFERENCE_MANIFESTO_BUILD208.png` bağlayıcı UI baseline’dır.
- Ölçülebilir font/renk/token değerlerinde kaynak CSS ve JSON manifest yetkilidir.
- Silver öncesi gerçek ekranlar baseline ile doğrulanır.

## Build kapanış kapıları

- Project Provenance Gate
- Version Sweep Gate
- Personal Identity Sweep Gate
- Production Clean Data Gate
- Artifact Index Gate
- Documentation Closure Gate
- Project Progress Report Gate
- Ana Build Defteri / kural SHA kabul kapısı
- Sohbet kapasitesi ve %90 hard-stop kapısı

Bronze Final ayrıca Dead Code / Dead UI sıfır hedefini karşılamadan ilan edilemez.
