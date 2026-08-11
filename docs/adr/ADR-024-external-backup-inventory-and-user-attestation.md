# ADR-024 — Uygulama Dışı Yedek Envanteri ve Kullanıcı İmha Beyanı

- **Durum:** Kabul edildi
- **Karar Build’i:** 139
- **Tarih:** 28.07.2026

## Bağlam

Build 137 ve 138 uygulamanın yönettiği yedekleri karantina ve imha yaşam
döngüsüne bağladı. Ancak manuel kopyalar, çevrimdışı diskler, snapshotlar ve bulut
sürüm geçmişleri uygulamanın doğrudan kontrol alanı dışındadır. Bunları sessizce
yok edilmiş kabul etmek yanlış güvenlik iddiası oluşturur.

## Karar

Uygulama dışı her kopya ayrı envanter kaydı olarak tutulacaktır. Kayıt; tür,
konum, sorumlu, erişilebilirlik, tarihsel veri riski, son teyit ve sonraki inceleme
tarihini taşır. Teyit, hukuki bekletme ve imha beyanı aile yöneticisi ve güçlü
yeniden doğrulama gerektirir. Kesin onay metinleri kopya kimliğine bağlıdır ve
durum geçişleri karşılaştırmalı güncellemeyle korunur.

İmha beyanı yalnız kullanıcının veya sorumlunun beyanıdır. İsteğe bağlı SHA-256
özeti bir kanıt dosyasını bağlayabilir; fiziksel cihazın, bulut sürümünün veya
üçüncü taraf kopyanın gerçekten yok edildiğini otomatik kanıtlamaz.

## Sonuçlar

- Riskli ve incelemesi geçmiş kopyalar görünür olur.
- Hukuki bekletme ve denetim geçmişi korunur.
- Uygulama kontrol alanı dışındaki kopyalar için yanlış “tam imha” iddiası kurulmaz.
- Gerçek medya ve sağlayıcı doğrulaması ayrı promotion kapısı olarak kalır.
