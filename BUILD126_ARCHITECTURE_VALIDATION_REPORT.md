# Build 126 Mimari Doğrulama Raporu

Build 126, uygulama tipografisini mevcut görsel bileşenlerden ayıran merkezi bir
sunum katmanı ekler.

## Doğrulanan tasarım

- `typography.css`, mevcut `styles.css` dosyasından sonra yüklenir.
- Apple sistem font yığını tek bir `--font-family-system` tokenında tutulur.
- Başlık ve metin kademeleri isimlendirilmiş boyut, satır yüksekliği ve ağırlık tokenlarıyla yönetilir.
- Sayfa başlıkları, bölüm başlıkları, gövde metni, kontrol metinleri ve ikincil metinler ayrı semantik kurallara sahiptir.
- Doğal Türkçe yazım için genel etiketlerde zorunlu uppercase dönüşümü kaldırılır.
- Etkileşim kontrollerinde en az 44 px hedef yüksekliği uygulanır.
- Proprietary font binary dosyaları kaynak ağacına eklenmez.
- Build 124 ortak bileşen görsel dili korunur.

Sonuç: **PASS — 28 assertion**
