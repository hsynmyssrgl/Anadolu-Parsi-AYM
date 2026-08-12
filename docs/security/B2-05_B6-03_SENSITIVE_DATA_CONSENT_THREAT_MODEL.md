# B2-05/B6-03 Hassas Veri Rızası Tehdit Modeli

## Korunan varlıklar

- 18 yaş altı aile üyelerinin kimlik ve aile bağı bilgileri
- Sağlık kayıtları, ilaç planları ve aile sağlık geçmişi
- Finans kayıtları ve değerlemeler
- Adres, koordinat ve kayıtlı konum bilgileri
- Kullanıcının açık rıza, süre ve iptal kararları

## Tehditler ve kontroller

| Tehdit | Kontrol | Fail-closed kanıt |
|---|---|---|
| Kayıt yokken veri işlenir | Sekiz kategori/amaç durumu kayıt yoksa `default_denied` | Application policy testleri |
| AI onayı dışa gönderim onayı sayılır | `sensitive_processing` ve `external_export` farklı benzersiz izin kimlikleridir | DataStore integration testi |
| Örtük veya süresiz rıza oluşturulur | `explicitConsent === true`, 15 dakika–30 gün ve zorunlu bitiş | Negatif use-case testleri |
| Eski genel AI kanalıyla hassas izin kuralları atlanır | Standart ve hassas amaç tipleri ayrıdır; genel upsert/preview IPC'si hassas amaç ve kaynakları reddeder, süresiz geçmiş grant varsayılan-ret olur | IPC ve application negatif testleri |
| Süresi dolmuş ya da iptal edilmiş rıza kullanılır | Etkin durum saat bazında yeniden hesaplanır; `expired`/`revoked` paylaşımı kapatır | Policy ve runtime testleri |
| Renderer doğrudan rol kontrolüyle yetki kazanır | Production adapter `CentralAuthorizationService` ile `administer` kararı alır | PPK-021 direct-role-bypass=0 ratchet |
| Bozuk veya fazla alanlı IPC payload'ı policy'yi atlar | Üç kanal exact argüman, alan, kategori, amaç, süre ve açık rıza doğrular | IPC integration negatif testleri |
| Önizleme hassas değeri sızdırır | Repository yalnız sayım ve sabit alan etiketleri döndürür; `SELECT *` yoktur | Repository kaynak sözleşmesi ve integration testi |
| Önizleme sessiz gönderim yapar | Sonuç daima `outboundTransferPerformed=false`; send/upload/transfer kanalı yoktur | IPC kapalı-yüzey sözleşmesi |
| Kullanıcı paylaşım durumunu göremez | Dört profil için AI/dışa gönderim durumu ve bitişi aynı ekranda gösterilir | Renderer integration sözleşmesi |
| İptal inkâr edilir | Grant, revoke ve preview mevcut append-only audit zincirine yazılır | DataStore audit testi |

## Güven sınırları

Renderer yalnız profil durumu, zaman sınırı, kategori bazlı sayım ve alan etiketi
alır. Hassas kayıt payload'ı, izin tablosuna kopyalanmaz ve preview IPC yanıtına
girmez. Main process repository erişimi mevcut SQLite transaction, hesap ve audit
zincirinde kalır. Yeni ağ yeteneği eklenmemiştir.

## Kapsam dışı

32-Y gerçek hassas veri aktarımı yapmaz. Gelecekteki bir aktarım veya dosya
üretimi, işlem anında yeniden onay/politika kontrolü ve ayrı güvenlik kararı
olmadan bu önizleme sonucunu kullanamaz.
