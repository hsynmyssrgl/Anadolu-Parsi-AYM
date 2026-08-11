# ADR-046 — Yetkili bakım kilidi kurtarma

- Durum: Kabul edildi
- Tarih: 2026-07-29
- Build: 173

## Bağlam

Build 170–172, adaptif IPC bakım güçlü yeniden doğrulamasını sınırlı deneme, geçici kilit, işletim sistemi korumalı kalıcılık ve cihaz bağlama ile fail-closed hale getirdi. Cihaz veya koruma sağlayıcısı değişikliği, bozuk kayıt ya da uzun süreli operatör hatası sonucunda yetkili aile yöneticisinin güvenli ve denetlenebilir bir kurtarma yoluna ihtiyacı vardır. Normal bakım oturumu kilitliyken aynı doğrulama bağlamını kullanmak kurtarmayı imkânsız kılar; kilidi koşulsuz atlamak ise kaba kuvvet korumasını zayıflatır.

## Karar

- Kurtarma yalnız kilit etkinse, yani mevcut bakım yetkisi `REAUTHENTICATION_LOCKED` durumundayken sunulur.
- Etkin ve süresi dolmamış `family_admin` oturumu ile güvenilir cihaz koşulları korunur.
- Kurtarma, normal bakım bağlamından SHA-256 ile alan ayrımlı biçimde türetilen ayrı bağlam anahtarını kullanır.
- Kurtarma için ayrı deneme sayacı kullanılır; ayrı bağlam aynı işletim sistemi korumalı kalıcı deneme sayacına bağlıdır; böylece normal kilit atlanmaz ve kurtarma girişimleri bağımsız olarak sınırlandırılır.
- Operatör parola ile, hesapta etkinse TOTP veya tek kullanımlık kurtarma koduyla güçlü yeniden doğrulama yapar.
- Renderer açık onay olarak `BAKIM KİLİDİNİ SIFIRLA` ifadesini ister; ana süreç ayrıca geri alınamaz işlem için yerel uyarı penceresi gösterir.
- Başarılı kurtarma, açık bakım oturumlarını iptal eder ve kalıcı sayaç/kilit durumunu güvenli silme yoluyla temizler.
- İşlem yalnız mevcut kilit durumunu kaldırır; aile verilerini, adaptif kaynak bütçesini, telemetriyi veya yedekleri değiştirmez.
- Parola, TOTP/kurtarma kodu ve onay metni günlük, telemetri veya tanı paketine yazılmaz. Denetim yalnız sonuç, önceki neden, temizlenen bağlam sayısı ve kısaltılmış kurtarma bağlam parmak izini taşır.

## Sonuçlar

- Yetkili operatör cihaz taşıma veya koruma kaydı sorununda uygulamayı yeniden kullanılabilir duruma getirebilir.
- Kurtarma yolu da kaba kuvvet saldırısına karşı kalıcı ve sınırlı kalır.
- Kurtarma geri alınamaz bir güvenlik durumu temizliğidir; bu nedenle güçlü kimlik doğrulama ve iki ayrı açık onay katmanı zorunludur.
