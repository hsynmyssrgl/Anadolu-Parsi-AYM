# Panthera pardus tulliana — Bronze MVP-50 Release Notları

**Sürüm:** `23.07.2026.50`  
**Milestone:** `B060-M10 — Authentication & Session Application Migration`

## Eklenenler

- `AuthApplicationUnitOfWork`
- `GetAuthStateUseCase`
- `SetupAdminUseCase`
- `LoginUseCase`
- `LogoutUseCase`
- `ChangePasswordUseCase`
- `SqliteAccountRepository`
- `RepositoryBackedAuthApplicationUnitOfWork`
- `InMemorySessionManager`
- `AUTH-CREDENTIALS-001` ve `AUTH-LOCKED-001` hata kodları
- Auth/session otomatik doğrulama paketi

## Değiştirilenler

- `FamilyDataStore` temel auth işlemlerinde doğrudan SQL kullanmıyor.
- Session yönetimi tek kullanıcı kimliği alanından güvenlik yöneticisine taşındı.
- E-posta küçük harf dönüşümü Türkçe locale etkisinden çıkarıldı.
- Davet oluşturma ve kabul tarihleri merkezi Clock ile uyumlu hâle getirildi.
- `AuthStateView` oturum bitiş zamanını opsiyonel olarak taşıyor.
- Desktop ve security workspace bağımlılıkları düzeltildi.

## Güvenlik davranışı

- Parola politikası: en az 12 karakter, büyük/küçük harf, rakam ve simge.
- Beş hatalı parola girişinden sonra 15 dakika kilit.
- Başarılı girişte hata sayacı ve kilit temizlenir.
- Oturum 15 dakika etkinlik olmaması durumunda sona erer.
- Parola değişikliği mevcut parolanın doğrulanmasını gerektirir.
- Giriş hata mesajı hesap varlığını açığa çıkarmaz.
