# Ek Kural Toplu Birleştirme Sicili

- Tarih: **20.08.2026**
- Görünür sürüm: **Bronze 22.08.2026.44**
- Karar: `DEC-260`
- Kaynak tampon: `C:\PPT\AYM\01_YONETIM\01_GUNCEL_KURAL_KAYITLARI\01_18.08.2026_YENI_KURAL_KAYDI.md`
- Durum: **ANA SİCİLLERE BİRLEŞTİRİLDİ**

Kaynak tampon değişmez tarihsel karar kanıtıdır. Aktif uygulama davranışı bu dosyadaki eşlemeler, daha yeni DEC kararları ve `config/canonical-rule-registry.json` üzerinden yürütülür.

## Eşleme

| Ek kayıt | Aktif bağ | Sonuç |
|---|---|---|
| EK-001 | PR-218 | Bronze/Silver/Gold renk paleti merkezileştirildi; kanal ve sürümden türetilir. |
| EK-002 | PR-214 | Dosya ve klasör adları Türkçe anlamlı, ASCII ve konu bazlıdır. |
| EK-003 | DEC-251, PR-186, PR-187 | Geçici karar tamponu korunur; her yeni karar aynı değişiklikte ana sicillere bağlanır. |
| EK-004 | PR-219 | Parola görünürlük denetimi güvenli, erişilebilir ve varsayılan kapalıdır. |
| EK-005 | PR-214 | `12_GUNCEL_DOSYALAR` yaklaşımı daha yeni konu klasörü kararıyla superseded edilmiştir. |
| EK-006 | PR-220, PR-209, DEC-261 | Kurulum adı Türkçe anlamlı ASCII biçimindedir; eski Anadolu Parsı ve `ParsYuva AYM` adları tam `ParsYuva Aile Yaşam Merkezi` adıyla superseded edilmiştir. |
| EK-007 | PR-221 | Paketli uygulama açılış, tek örnek, tepsi ve tam kapanış kanıtı zorunludur. |
| EK-008 | DEC-252, PR-214 | Tarihçe konu klasörlerinde tutulur; 20 Temmuz 2026 sonrası aktif tarihçe ayrıca sürdürülür. |
| EK-009 | PR-217, PR-220, DEC-261 | Kurulum başlıklarında tam `ParsYuva Aile Yaşam Merkezi` adı ve DPI uyumlu okunabilir metin kullanılır; kısaltma kullanılmaz. |
| EK-010 | PR-222 | Her resmî derleme gün, ay ve aylık sıra numarasıyla atomik olarak ayrılır. |
| EK-011 | PR-209, DEC-261 | Eski kısayol adları superseded; aktif kısayol `ParsYuva Aile Yaşam Merkezi`dir. |
| EK-012 | PR-223 | Bronze/Silver ve etkinleştirilmemiş Gold 30 gün; Gold kalıcı kullanım cihaz bağlı etkinleştirme kanıtına tabidir. |
| EK-013 | PR-224 | Kaldırma yedek/silme kararı ve ilk kurulum durumuna dönme işlemi açık onaylı, fail-closed ve kanıtlıdır. |
| EK-014 | PR-225 | Pencere kapatma tepsiye küçültür; tamamen kapanma yalnız açık komutla yapılır. |
| EK-015 | PR-226 | Güncelleme kullanıcı verisini korur; migration, rollback ve N-1 uyumluluk kanıtı gerektirir. |
| EK-016 | PR-218 | Tüm kanal paletleri ana kodda; başlangıçta imzalı sürüm kanalından seçilir. |
| EK-017 | PR-218 | Saydamlık/glass erişilebilir geri dönüşle ve kanal paletiyle yönetilir. |
| EK-018 | PR-227, PR-187 | Karar-belge-kod-test farkı kapanışı engeller; açık iş nedeni ve eksik kanıt yazılır. |
| EK-019 | PR-227, PR-179 | Yerel full-auto işler yürütülür; dış izin/sertifika/UAT/hukuk kanıtı sessizce PASS yapılamaz. |

## Daha yeni kararların üstünlüğü

`DEC-255` dil, `DEC-256` tek gerçek kurulum ilerlemesi, `DEC-258` çevrimdışı harita, `DEC-259` ticari temel, `DEC-260` toplu birleştirme ve `DEC-261` tam ürün adı kararları EK kayıtlarından sonra alınmıştır. `DEC-257` marka adlandırması `DEC-261` ile superseded edilmiştir. Çatışmada en yeni kararlar ve PR-218–PR-227 aktiftir.

## Açık dış kanıtlar

- üretim Authenticode sertifikası ve güvenilir zaman damgası,
- temiz Windows makine/VM kurulum-güncelleme-kaldırma UAT’si,
- gerçek Gold üretim anahtar yönetimi,
- mağaza, banka, harita/veri sağlayıcı ve gerçek cihaz UAT’leri,
- hukuk, gizlilik, vergi ve marka onayları,
- erişilemeyen bulut kopyalarında fiziksel silme garantisi.

Bu maddeler yerel kodlama eksikliği gibi gizlenmez; uygun kapıda `NOT_RUN` veya `BLOCKED_EXTERNAL` kalır.
