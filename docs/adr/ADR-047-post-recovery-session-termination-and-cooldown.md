# ADR-047 — Kurtarma Sonrası Oturum Sonlandırma ve Soğuma Süresi

## Karar
Başarılı bakım kilidi kurtarmasından sonra bütün bakım oturumları iptal edilir, kullanıcı oturumu kapatılır ve cihaz/güven ilişkisi yeni oturumda yeniden değerlendirilir. Aynı kimlik bağlamında 15 dakikalık, işletim sistemi korumalı kalıcı soğuma süresi başlatılır.

## Güvenlik sınırı
Soğuma kaydı mevcut cihaz bağlı şifreli yeniden doğrulama durum deposunu kullanır. Parola, TOTP, kurtarma kodu veya oturum belirteci saklanmaz. Soğuma süresi bakım kilidini atlamaz; yalnız art arda kurtarma kullanımını engeller.
