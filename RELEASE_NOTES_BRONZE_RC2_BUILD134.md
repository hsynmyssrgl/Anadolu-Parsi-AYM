# Bronze RC2 Build 134 Sürüm Notları

- Application Version: `27.07.2026.134`
- Package Version: `27.7.2026-134`
- Stage: **Bronze RC2 Active Development**

## Eklenenler

- Yerel profilde saklanan standart, büyük ve çok büyük metin ölçeği.
- İşletim sistemi tercihinden başlangıç değeri alabilen yüksek kontrast ve hareket azaltma.
- Bölüm değişiminde ana içerik odağı ve Türkçe ekran okuyucu duyurusu.
- Komut aramasında `listbox/option`, seçili durum ve roving klavye odağı.
- Yukarı/aşağı, Home/End, Enter, Escape ve Tab odak tuzağı davranışı.
- Komut araması kapanınca odağın önceki kontrole geri verilmesi.
- Forced-colors desteği, belirgin odak halkası ve genel 44 px etkileşim hedefi.
- Durum mesajlarında `polite`, kritik hatalarda `assertive` canlı bölge politikası.
- Form içindeki düğmelerde güvenli `type=button` varsayılanı.
- Arşiv araç çubuğundaki placeholder-only kontrollere erişilebilir adlar.

## Aşama notu

Bu artırım kaynak düzeyi erişilebilirliği geliştirir. Gerçek Windows renderer,
ekran okuyucu, kontrast ölçümü, büyütülmüş metin taşması ve kullanıcı kabul
kanıtları ayrıca çalıştırılmadan PASS sayılmaz.
