# 33-O / DEC-226 gizlilik, veri hakları ve olay kontrolü tehdit modeli

- Durum: VALIDATED_RECEIPT_PENDING
- Doğrulama: PASS_AUTOMATED_MANUAL_NOT_RUN_NO_CERTIFICATION

| Tehdit | Planlanan fail-closed kontrol |
|---|---|
| Yabancı hesap/kişi verisi veya erişim geçmişi görünür | Exact family/account/person/resource bağı, merkezi PEP ve repository execution context. |
| Access inventory hassas içerik sızdırır | Yalnız aktör kimliği, amaç, eylem, kaynak kimliği ve zaman; payload, OCR metni, AI hafıza içeriği ve secret yok. |
| AI hafıza düzeltmesi geçmişi değiştirir | Append-only mutation, optimistic revision, immutable audit ve PPK-016 mirası. |
| Silme doğrudan tablo DELETE ile PPK-019'u atlar | Hak talebi UoW'si, legal-hold/retention denetimi ve PPK-019 owner propagation sonucu zorunlu. |
| İhlal müdahalesi kısmi iptal bırakır | Security epoch, cihaz, lease, rıza, incident ve audit tek yerel UoW içinde; hata rollback. |
| Karantina hassas ham içerik kopyalar | İçeriksiz metadata/hash envanteri; ham veri ancak açık yerel şifreli paket yetkisiyle. |
| Olay paketi plaintext veya değişmiş çıkar | Authenticated encryption, parola KDF, random salt/nonce, canonical manifest, hash/size readback. |
| İzin simülasyonu gerçek grant üretir | Preview-only PEP yolu; repository write, receipt mutation ve permission mutation yasak. |
| Apple/AI/OCR/çeviri görünümü uzaktaki gerçeği uydurur | Yalnız yerel gözlem ve dört durumlu truth; remote/current/completeness iddiası yok. |
| Kayıp cihaz işlemi remote wipe/MDM gibi sunulur | `remoteWipePerformed=false`, `mdmOperationPerformed=false`, `networkDelivery=not_performed`, teslim garantisi false. |
| Dışa aktarım teslim edilmiş veya okunmuş sayılır | Yalnız yerel file/readback kanıtı; delivery, recipient read ve legacy delivery false. |
| Yönetilmeyen kopyaların fiziksel silindiği varsayılır | PPK-019 sonuç kapsamı görünür; external copy physical deletion guarantee false. |
| Async eski sonuç yeni kullanıcı/route'a yazılır | 33-N route/session invalidation ve monoton watermark. |

## Negatif kanıt hedefleri

Wrong-owner, forged receipt, stale fence/revision, prototype alanı, oversized export, plaintext secret, illegal delete, legal hold bypass, partial incident rollback, mutation-producing simulation ve remote-truth overclaim testleri otomatik hedefli pakette PASS olmalıdır. Persistent kapanıştan önce bu sonuç runtime kanıtına exact 11 dosya ve 167 test olarak bağlanır.

## Artık risk ve iddia sınırı

Ağ kanalı veya uzaktan komut yoktur; remote wipe, MDM, network delivery/acknowledgement, uzaktaki cihaz durumu, Apple senkron bütünlüğü, AI/OCR/çeviri dış işleme doğruluğu, harici kopya fiziksel silme, export/legacy teslimi garanti edilmez. İnsan gizlilik UAT'si, hukuk incelemesi ve gerçek cihaz kanıtı `NOT_RUN`; legal/privacy certification claimed değildir.

- Manuel kapanış kanıtı: legalReview=NOT_RUN; privacyReview=NOT_RUN; realDevice=NOT_RUN; humanUat=NOT_RUN; certificationClaimed=false.
