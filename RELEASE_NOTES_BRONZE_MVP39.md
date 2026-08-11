# Panthera pardus tulliana — Bronze MVP-39

**Sürüm:** 21.7.2026-39  
**Tarih:** 21.07.2026

## Kullanılabilirlik ve erişilebilirlik

- Klavyeyle doğrudan ana içeriğe geçiş bağlantısı eklendi.
- Ana gezinmeye açıklayıcı erişilebilirlik etiketi ve etkin sayfa bildirimi eklendi.
- Modal pencerelere Escape ile kapatma, odak hapsetme ve kapandıktan sonra önceki odağa dönme davranışı eklendi.
- Modal başlık ve açıklamaları ekran okuyucu ilişkileriyle bağlandı.
- Bildirim düğmesine okunabilir bildirim sayısı eklendi.
- Hareket azaltma işletim sistemi tercihi desteklendi.

## Form kalitesi

- İlk kurulum parolası için canlı koşul listesi eklendi: uzunluk, büyük/küçük harf, rakam ve sembol.
- Eksik parola karakter sayısı canlı gösteriliyor.
- E-posta adresleri doğrulanıyor ve kayıttan önce normalize ediliyor.
- Otomatik doldurma alanları giriş ve ilk kurulum akışlarına eklendi.
- Form hataları ekran okuyucular için `alert` olarak işaretlendi.
- Coğrafi koordinat çiftleri ve geçerli aralıklar için ortak doğrulama işlevi eklendi.

## Testler

- Parola değerlendirmesi testi.
- E-posta normalizasyonu ve doğrulama testi.
- Koordinat çift/aralık doğrulama testi.
- Toplam otomatik test sayısı 41'e yükseldi.
