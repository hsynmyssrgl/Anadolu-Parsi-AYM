# DEC-265 — Her işlem öncesi zorunlu kural kontrolü

- Tarih: 22.08.2026
- Durum: ACTIVE
- Etkili sürüm: Bronze 22.08.2026.43
- Kaynak: Açık kullanıcı kararı

## Karar

ParsYuva çalışma alanında herhangi bir durum değiştiren işlem başlamadan önce güncel kanonik kurallar doğrulanır. Kod, dosya, yapılandırma, belge, test, derleme, paketleme, kurulum, silme, yayımlama ve dış sisteme yazma işlemleri kural kontrolü PASS olmadan başlatılamaz.

Kontrol; kanonik sicilin yeniden hesaplanan SHA-256 değerini, görünür sürüm bağını, kullanıcı kural onayını, Proje Anayasası bağını, aktif kural sayısını ve her aktif kuralın fail-closed, waiver'sız ve atlanamaz enforcement kaydını doğrular. Eksik, eski veya çelişkili durumda işlem engellenir.

Salt okunur inceleme yalnız uygulanacak kuralları ve kesin hedefleri belirlemek için yapılabilir. Kural, karar veya kural hash'i görev sırasında değişirse sonraki durum değiştiren işlemden önce kontrol yeniden çalıştırılır.

## Teknik uygulama

- Çalışma alanı talimatı: `C:\PPT\AYM\AGENTS.md`
- Sürümlenen depo talimatı: `AGENTS.md`
- Zorunlu kontrol: `scripts/verify-operation-rule-check.mjs`
- Makine makbuzu: `artifacts/validation/operation-rule-check.json`
- Build, test ve governed preflight girişleri kontrolü otomatik çağırır.

## Doğrulama

- `apps/desktop/tests/operation-rule-check-policy.test.ts`
- `scripts/verify-canonical-rule-registry.mjs`
- `scripts/verify-universal-rule-enforcement.mjs`

Bu kontrol için waiver, sessiz atlama veya geçerliliği belirsiz eski makbuz kullanımı yasaktır.
