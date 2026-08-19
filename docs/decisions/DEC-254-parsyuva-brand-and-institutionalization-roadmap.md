# DEC-254 — ParsYuva marka kimliği ve kurumsallaşma yol haritası

- Tarih: 18.08.2026
- Görünür sürüm: Bronze 18.08.2026.31
- Durum: ACTIVE / PARTIAL_EXTERNAL_ACTION
- Kaynak: Kullanıcının uygulama adını ilk derlemede güncelleme ve önceki kurumsallaşma fikirlerini belgeye bağlama kararı

## Karar

1. Kullanıcıya görünen ana marka `ParsYuva`, masaüstü ürün adı ve kısayol adı `ParsYuva AYM`, açıklayıcı uzun ad `ParsYuva Aile Yaşam Merkezi` olacaktır.
2. Kurulum, pencere, sesli anlatım, güvenlik istemleri, yeni yedek/rapor adları ve yeni teslim belgeleri bu kimliği kullanacaktır.
3. Güncelleme uyumluluğu için Windows `appId` değeri `tr.anadoluparsi.aileyasammerkezi` ve mevcut kullanıcı veri dizini `Anadolu Parsı Aile Yaşam Merkezi` şimdilik değişmez teknik kimlik olarak korunacaktır. Bu iki eski değer kullanıcıya görünen marka değildir.
4. Yeni korumalı yan-artifactlar `ParsYuva AYM` adıyla yazılır; önceki sürümlerin `Anadolu Parsı Aile Yaşam Merkezi` zarfı okunmaya devam eder.
5. Şirket unvanı adayı `ParsYuva Dijital Yaşam Teknolojileri Anonim Şirketi`, İngilizce pazarlama karşılığı `ParsYuva Digital Life Technologies Inc.` olarak kaydedilir. Bunlar tescil tamamlanıncaya kadar yalnız adaydır.
6. Marka, şirket unvanı, alan adı, sosyal hesap ve mağaza adlarının boş veya tescilli olduğu iddia edilemez. TOBB/MERSİS, TÜRKPATENT, alan adı kayıt operatörü ve ilgili mağazalarda güncel dış doğrulama gerekir.

## Kurumsallaşma kapıları

- Tek pay sahipli anonim şirket seçeneği; sermaye, maliyet, yönetim ve yatırım hedefleri mali müşavir ve avukatla doğrulanır.
- AŞ yapısı yatırım ve ileride halka arz için uygun bir yol açabilir; halka arzı garanti etmez.
- Marka araştırması en az 9 ve 42, ticari modele göre 35. sınıfı kapsar; benzerlik araştırması yapılır.
- Kaynak kodu, logo, alan adı ve tüm fikrî hakların şirkete devri veya lisansı yazılı sözleşmeyle kurulur.
- Kurucu payları, yatırımcı hakları, opsiyon havuzu, yönetim yetkisi ve imza düzeni şirket belgelerinde tanımlanır.
- Vergi/NACE, banka, e-fatura, mesafeli satış, gizlilik, kullanım koşulları ve tüketici süreçleri ilgili uzmanlarla doğrulanır.
- Apple, Microsoft ve Google geliştirici hesapları şirket kimliğiyle açılır; kod imzalama sertifikası ve yayın anahtarları şirket kontrolüne alınır.
- İlk küresel ticari dil paketi Türkçe ve İngilizcedir. Sonraki sıra Almanca, İspanyolca ve Fransızca; ardından pt-BR ve Japonca; Arapça ise RTL tasarımı ve ayrı UAT sonrasında ele alınır.

## Kanıt durumu

- Yerel marka kod uyarlaması: IMPLEMENTED_IN_CURRENT_WORKTREE
- Güncellemede veri korunumu: IMPLEMENTED_WITH_STABLE_TECHNICAL_IDENTITY
- Şirket kuruluşu: NOT_RUN
- Ticaret unvanı rezervasyonu: NOT_RUN
- Marka başvurusu/tescili: NOT_RUN
- Alan adı ve sosyal hesap satın alımı: NOT_RUN
- Hukuk, vergi ve gizlilik uzman onayı: NOT_RUN
- Üretim kod imzalama ve mağaza hesapları: NOT_RUN
- `countsAsRequirementPass`: false

## Sonuç

Yerel ürün ve belge kimliği güncellenebilir; ancak dış kayıtlar tamamlanmadan “tescilli”, “kurulmuş şirket”, “boş alan adı”, “yatırıma hazır” veya “halka arza hazır” ifadeleri kullanılamaz.
