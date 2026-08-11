# ADR-035 — İstek, oturum ve revizyon bağlı IPC taşıması

## Durum

Kabul edildi — Build 159, Bronze RC2 Active Development.

## Karar

Bütün preload `invoke` çağrıları uygulama payload'ından ayrı, kesin şemalı taşıma bağlamı kullanır. Ana süreç aynı renderer göndericisi için oturum çağı gerilemesini ve yinelenen istek kimliğini fail-closed reddeder. Başarılı sonuç yalnız aynı bağlamı yankılayan doğrulanmış yanıt zarfıyla döner.

## Gerekçe

Renderer state koruması eski yanıtların state yazmasını engellese de, eski yanıt yine preload API sınırını geçebiliyordu. Taşıma bağlamı bu reddi renderer state katmanından önce uygular ve log/correlation kanıtını istek kimliğiyle ilişkilendirir.

## Sonuçlar

- Eski oturum yanıtı renderer API'sine veri olarak ulaşmaz.
- Kanal politikası taşıma metadata'sından etkilenmez.
- Paralel aynı-oturum istekleri sıra dışı tamamlanabilir; yalnız bağlam eşleşmesi aranır.
- Yeni renderer dokümanı ilk sıra numarasıyla yeni oturum kimliği başlatır.
