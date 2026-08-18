# DEC-251 — Karar anında eşzamanlı belge ve iş listesi güncellemesi

Durum: ACTIVE

Tarih: 17 Ağustos 2026

## Karar

Kullanıcının bağlayıcı her yeni kararı, kararın verildiği aynı değişiklik kümesi içinde aşağıdaki kayıtlarla eşzamanlı güncellenir:

1. benzersiz DEC dosyası ve `config/user-decision-ledger.json`;
2. kararın etkilediği bütün aktif Markdown, JSON/YAML, Word, PDF ve diğer belge kaynakları;
3. iş listesi veya yol haritasında açık/kapalı durumu;
4. açık kalan iş için yerel uygulama durumu, açık kalma nedeni, eksik kanıt ve `countsAsRequirementPass` gerçeği;
5. aktif belge seti, belge indeksi ve üretilecek güncel master DOCX/PDF;
6. makineyle çalıştırılabilir eşzamanlılık doğrulaması.

Bu zincir tamamlanmadan karar veya ilgili iş “belgelendi”, “kapandı” ya da “tamamlandı” sayılamaz. Sonradan toplu belge düzeltmesi normal çalışma biçimi olamaz; eksik eşzamanlı güncelleme fail-closed belge driftidir.

## Tarihsel kayıt ilkesi

Önceki build, DOCX, PDF, karar ve kanıt dosyaları değiştirilmez. Yeni gerçek yeni sürüm ve yeni DEC ile kaydedilir. Tarihsel belge yalnız kendi zamanının kanıtıdır ve güncel otoriteyi geçersiz kılamaz.

## Uygulama

- Politika: `config/documentation-synchronization-policy.json`
- Kapı: `scripts/verify-documentation-synchronization-policy.mjs`
- Aktif karar özeti: `docs/current/09_KULLANICI_KARARLARI_KAYDI.md`
- Birleşik güncel sicil: `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md`
- Belge türü denetimi: `docs/current/12_TUM_BELGE_TURLERI_DENETIMI.md`
- İş listesi: `config/remaining-scope-package-roadmap.json`

## Doğruluk sınırı

Bu karar belgelerin eşzamanlı tutulmasını zorunlu kılar; çalıştırılmamış gerçek cihaz, sağlayıcı, sertifika, hukuk, gizlilik veya insan UAT kanıtını PASS yapmaz.
