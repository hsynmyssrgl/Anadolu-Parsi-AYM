# UI Görsel Referans Manifestosu — Aktif Baseline

**Aktif sürüm:** 02.08.2026.228
**Düzeltme buildi:** 212  
**Onaylı görsel SHA-256:** `f2f2a083fb74a50fc31459c8236eff9be74e01f9b359c5889fdb740395850357`

Bağlayıcı görsel dosya: `UI_VISUAL_REFERENCE_MANIFESTO_ACTIVE.png`  
Makine okunur sözleşme: `../../config/ui-visual-reference-manifest.json`

Bu görsel, kullanıcının 01.08.2026 tarihinde Anadolu parsı logosu ile önceki font ve renk kurallarını esas alarak onayladığı **açık tema** görsel yönün birebir kaynak görselidir. Build208–211 teslimlerinde yanlışlıkla taşınan koyu dashboard baseline aktif referans değildir.

Bağlayıcı görsel özellikler: Anadolu parsı marka işareti, açık ve sıcak-nötr yüzeyler, yeşil/soft-yeşil/bej/gri palet, Apple esintili sade masaüstü hiyerarşisi, sol modül navigasyonu, merkezi çalışma alanı, bağlamsal sağ panel, kart tabanlı bileşen dili ve yüksek erişilebilirlik.

Bağlayıcı sürüm-paleti kuralı: görünür sürüm Bronze ise Bronze, Silver ise Silver, Gold ise Gold paleti uygulama açılışından ana kabuğa ve Windows kurulum sihirbazına kadar kesintisiz uygulanır. Üç tam yüzey paletinin exact tokenları `config/ui-visual-reference-manifest.json` içindedir. Sürüm etiketi, renderer paleti ve kurulum bitmap/renk eşleşmesi farklıysa doğrulama ve paketleme kapanamaz.

17.08.2026 tarihinde marka işareti, kullanıcının sıcak ve daha albenili Bronze yönü onayıyla altın-sarı Anadolu parsı, bakır rozetler ve koyu yeşil kontur olarak yenilendi. Üretim varlığı `apps/desktop/src/renderer/assets/brand-mark.png`, exact SHA-256 değeri `8eed255430dd27c886ad2808071cfb114923230bd8712db8f03d46d2f0ef641a` değeridir; arka planı şeffaftır. Bu işaret güncellemesi açık, sıcak-nötr ekran yerleşimi ve erişilebilirlik kurallarını değiştirmez.

Görsel içindeki örnek sayılar/metinler **kullanıcı verisi veya production seed sözleşmesi değildir**; production kişisel/demo veri yasağı aynen yürürlüktedir. Ölçülebilir tipografi, erişilebilirlik ve kanal rengi kurallarında kaynak CSS/JSON sözleşmeleri uygulanır.

Silver’a geçmeden önce gerçek uygulama ekranları bu aktif görselin SHA-256 ile sabitlenmiş kopyası ve 20 Temmuz 2026 sonrası onaylı görsel setiyle karşılaştırılır. Hash uyuşmazlığı görsel baseline driftidir ve doğrulama kapısını düşürür.
