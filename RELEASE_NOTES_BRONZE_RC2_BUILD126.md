# Release Notes — Bronze RC2 Build 126

## Apple sistem tipografisi

- Yeni `apps/desktop/src/renderer/typography.css` katmanı eklendi.
- Font ailesi Apple sistem fontları öncelikli olacak şekilde merkezi tokena bağlandı.
- iOS tipografi kademelerine karşılık gelen 34, 28, 22, 20, 17, 16, 15, 13, 12 ve 11 px tokenları tanımlandı.
- `main.tsx`, tipografi katmanını mevcut görsel stillerden sonra yükler.
- Sayfa başlıkları, bölüm başlıkları, gövde metni, kontroller, menü öğeleri, dipnotlar ve etiketler semantik kurallara bağlandı.
- Genel etiketlerde yapay büyük harf dönüşümü kaldırıldı.
- Form ve düğme hedefleri en az 44 px yüksekliğe getirildi.

## Korunan sınırlar

- Mevcut Build 124 Apple-esintili bileşen dili korunur.
- Renderer veri ve IPC sınırları değiştirilmez.
- Uygulamaya `.ttf`, `.otf`, `.woff`, `.woff2` veya `.eot` font dosyası eklenmez.
- Bronze RC2 Final, Code Freeze, Silver veya Gold geçişi yapılmaz.
