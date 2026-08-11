# 32-G PPK-011 bağlamsal sahiplik oranı üst kapanışı

Durum: `COMPLETE / PASS`

## Kapanan sınırlar

- Amaç, aile dalı, başlangıç/bitiş aralığı ve açık ret aynı izin kaydında korunur.
- Sahiplik oranı 1–10.000 baz puan olarak domain, use-case, repository, IPC ve ekranda taşınır.
- Açık ret, yeterli sahiplik oranı taşıyan izinden önce uygulanır.
- Ret kaydı oran taşıyamaz; geçersiz oranlar use-case ve SQLite seviyesinde reddedilir.
- Merkezi servis ve imzalı Platform Policy Kernel aynı asgari oran eşiğini uygular.
- Asgari oran imzalı politika context hash’ine bağlanır.
- Üretim otoritesi grant oranını ve güvenlik parmak izini kapsar.
- Göç 75 sütun, indeks ve insert/update trigger zincirini kalıcılaştırır.
- Bağlamsal Yetkiler ekranı yüzde girişini ve kayıtlı oranları gösterir.

## Temiz doğrulama

- PPK-011 kapanış sözleşmesi: 32/32 PASS.
- Hedefli test: 12/12 PASS.
- Platform ve merkezi politika regresyonu: 8 dosya / 102 test PASS.
- Yetkilendirme/use-case/repository runtime: 12/12 PASS.
- Veritabanı göç zinciri: 75/75 PASS.
- Tam Vitest: 60 dosya / 392 test PASS.
- Kök TypeScript: 0 diagnostic.
- Bronze güncel denetimi: `PASS_WITH_OPEN_SCOPE`.

## Gerçeklik sınırı

- B4-02 banka hesabı ve ortak finans katılımcı/pay mutabakatı tamamlanmış sayılmamıştır.
- Eski Desktop kasası korunmuştur.
- Gerçek veri taşınmamıştır.
- SQLite yazma sahipliği Core Service'e verilmemiştir.
- Cutover otoritesi bağlanmamış ve DEC-171 kaldırılmamıştır.
- Yeni Build verilmemiştir.

Bu kapanış yalnız PPK-011 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
