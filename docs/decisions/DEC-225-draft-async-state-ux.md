# DEC-225 — Taslak, geri alma ve asenkron ekran durumu UX'i

- Tarih: 2026-08-14
- Durum: COMPLETED
- İş adımı: 33-N
- Gereksinimler: B3-02, B7-14, B7-15
- Doğrulama: PASS_AUTOMATED_MANUAL_NOT_RUN_NO_CERTIFICATION

## Karar

B3-02, B7-14 ve B7-15 tek bir fail-closed form yaşam döngüsü olarak yürütülür. Form girdisi kaybolmamalı; otomatik kayıt, açık kullanıcı kaydı ve geri alma aynı yetkili taslak kaydı ile immutable değişiklik geçmişini kullanmalıdır. Canlı doğrulama kullanıcı girdisini korur, erişilebilir hata özeti üretir, ilk geçersiz alana odak taşır ve sonucu canlı bölgede duyurur. Her ilgili ekran `empty`, `loading`, `offline`, `error` ve `retry` durumlarını anlamlı ve erişilebilir biçimde sunar.

Kalıcı taslak yetkisi migration 91 içindeki `governed_form_drafts` ve `governed_form_draft_mutations` tablolarıdır. Kaynak kimliği `form_draft/{accountId}/{formKey}`, hassasiyet `personal`, amaç `general`, yetenek `family.write` olarak exact bağlanır. `save` ve `undo`; merkezi PEP kararı, transaction-time yeniden doğrulama, SQLite UoW, policy receipt, mutation, current-row güncellemesi, audit ve outbox ile tek atomik sınırda yürür. Renderer veya preload doğrudan veritabanı yetkisi taşımaz.

Her yazma optimistic `expectedRevision`, benzersiz `clientOperationId` ve canonical istek parmak izi ister. Aynı kimlik ve aynı parmak izi idempotent replay olabilir; farklı parmak izi, stale revizyon, yabancı aile/hesap/kişi, sahte receipt ve sonradan değişmiş yetki fail-closed reddedilir. `undo`, yalnız hemen önceki immutable revizyonun payload ve fingerprint değerini yeni bir revizyon olarak geri yükler; geçmiş satır değiştirilmez veya silinmez.

Renderer `form-ux.tsx`, kayıt durumu ile doğrulama durumunu birbirine karıştırmaz. Kapsam başına son yazma kazanır; route, hesap veya oturum değişiminde eski promise sonucu invalidate edilir. Mutation kimliği tekrarları bastırılır ve revizyon watermark'ı geriye gitmez. Offline durum veri kaybı iddiası üretmez; yerel, yetkisiz bir kalıcı kaynak oluşturmaz ve yeniden deneme aynı idempotency kimliğini güvenle kullanır.

## Negatif sözleşme

Boş veya aşırı büyük payload, geçersiz JSON şekli, prototype anahtarları, geçersiz form anahtarı, stale revizyon, idempotency mismatch, yabancı subject/resource bağı, sahte ya da süresi geçmiş receipt, receipt-to-transaction fence yarışı ve illegal undo reddedilir. Eski asenkron sonuç route/oturum değişiminden sonra UI'a yazamaz. Hata özeti olmayan, ilk geçersiz alanı odaklamayan, yalnız renk ile durum bildiren veya retry eylemini belirsiz bırakan ekran sözleşmeye uymaz.

## Kapanış koşulu

Karar→domain→schema/migration 91→use-case→repository→merkezi PEP/UoW→IPC/preload→`form-ux.tsx`→menü/ekran→negatif hedefli test→dokümantasyon→kanıt halkaları eksiksiz olmadan otomatik uygulama kapanışı `COMPLETE` olamaz. Bu otomatik kapanış; boundary/contract/runtime, tam test/build, güvenlik denetimi, kalıcı receipt, kaynak koruması ve Git eşitliği PASS olduğunda tamamlanabilir. Windows Narrator, Windows Magnifier, gerçek cihaz ve insan UAT kanıtları ayrı manuel kanıtlardır; şu anda `NOT_RUN` kalır ve `certificationClaimed=false` olduğundan otomatik `COMPLETE` durumu bir erişilebilirlik sertifikası iddiası oluşturmaz.
