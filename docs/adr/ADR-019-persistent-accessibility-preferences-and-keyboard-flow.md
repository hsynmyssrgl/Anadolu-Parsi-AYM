# ADR-019 — Kalıcı erişilebilirlik tercihleri ve kritik klavye akışı

- Durum: Kabul edildi
- Tarih: 27.07.2026
- Build: 134
- Karar: DEC-048

## Bağlam

Uygulama temel ARIA etiketlerine, modal odak tuzağına ve 44 px kontrol hedeflerine
sahipti; ancak büyük metin, yüksek kontrast ve hareket azaltma kullanıcı tercihi
olarak saklanmıyor, bölüm değişimi ekran okuyucuya duyurulmuyor ve komut araması
tam roving-keyboard davranışı sunmuyordu. Bu eksikler özellikle yaşlı kullanıcı,
sadece klavye kullanan kullanıcı ve hareket hassasiyeti bulunan kullanıcı için
kritik akışları zorlaştırıyordu.

## Karar

1. Metin ölçeği `standard`, `large`, `extra-large` seçenekleriyle yerel profil
   tercihi olarak saklanır.
2. Yüksek kontrast ve hareket azaltma tercihleri yerel saklanır; kayıt yoksa
   işletim sistemi `prefers-contrast` ve `prefers-reduced-motion` sinyali başlangıç
   değeri olarak kullanılır.
3. Her bölüm değişiminde ana içerik programlı olarak odaklanır ve Türkçe canlı
   bölge duyurusu üretilir.
4. Komut araması `listbox/option`, seçili durum, yukarı/aşağı, Home/End, Enter,
   Escape, Tab odak tuzağı ve kapanışta odak geri yükleme davranışını uygular.
5. Tüm klavye odakları görünür üç piksellik gösterge taşır. Forced-colors ve
   sistem hareket azaltma ortamları ayrıca desteklenir.
6. Durum ve hata mesajları `polite/assertive` canlı bölge politikasına bağlanır.
7. Düğmeler, açıkça `submit` belirtilmedikçe varsayılan olarak `type=button`
   davranır; form içindeki yanlışlıkla gönderim riski azaltılır.

## Sonuçlar

Kaynak düzeyi erişilebilirlik sözleşmesi güçlenir. Bu karar gerçek Windows
renderer, ekran okuyucu, kontrast ölçümü, büyütülmüş metin taşması ve çocuk/
yetişkin/yaşlı UAT kapılarının yerine geçmez; bu kapılar `NOT_RUN` kalır.
