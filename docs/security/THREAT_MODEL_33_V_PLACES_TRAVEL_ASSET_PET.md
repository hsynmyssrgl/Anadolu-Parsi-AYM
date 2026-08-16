# 33‑V tehdit modeli — yer, seyahat, taşınma ve evcil hayvan

Durum: `LOCAL_IMPLEMENTATION_STARTED`; acceptance ve dış kanıtlar `NOT_RUN`.

## Korunan varlıklar ve sınırlar

- Yer koordinatı/adres etiketi, tarih, katılımcı, bütçe ve özel notlar sahip/aile sınırında kalır.
- Arşiv, OCR, rezervasyon, gereksinim ve evcil hayvan bağlantıları opak kimliktir; dosya yolu, token, belge veya sağlık içeriği değildir.
- Renderer hesap/aile yetkisi, PEP makbuzu, parmak izi, yol, ödeme kartı veya sağlayıcı kimlik bilgisi gönderemez.
- Audit ve outbox yalnız kimlik, tür, alan, durum ve revizyon taşır.

## Başlıca tehditler ve kontroller

1. Çapraz aile/sahip okuma: payload-free policy çözümü, merkez okuma receipt’inde exact owner/family/subject bağı ve repository key kontrolü.
2. Özel kayda sahip dışı erişim veya görünürlük aklama: mevcut ve hedef görünürlük için ayrı merkezi authorization ile DB private-owner triggerı.
3. Sahte katılımcı: etkin aynı-aile kişi doğrulaması, sahip dahil olma ve DB benzersizlik kontrolü.
4. Replay/revizyon yarışı: clientOperation fingerprint, unique mutation ledger ve optimistic revision.
5. Sağlayıcı/ödeme/doğrulama overclaim: truth alanları sabit `false/not_performed/not_configured`, IPC sonucu fail-closed.
6. OCR önerisinin gerçek veri sayılması: yalnız opak OCR job kimliği, otomatik kabul `false`.
7. Gizli içeriğin log/event sızıntısı: içeriksiz audit/outbox ve renderer-safe projeksiyon.
8. Eksik veya çapraz-tür iş akışı: on dört türün zorunlu/izinli alan matrisi uygulama, IPC ve SQLite katmanlarında aynı şekilde fail-closed uygulanır; tarihler gerçek takvim günü olarak doğrulanır.

## Açık kanıtlar

Gerçek harita ve çevrimdışı konum, taşınma envanteri, evcil hayvan iş akışı, seyahat operasyonu, hukuk/gizlilik ve dış sağlayıcı UAT `NOT_RUN`. Harici rezervasyon, ödeme, canlı servis takibi, belge doğrulama, fiziksel silme veya certification iddiası yoktur.
