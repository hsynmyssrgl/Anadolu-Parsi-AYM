# Bronze RC2 Build 173 Sürüm Notları

## Yeni

- Kilitli adaptif IPC bakım yeniden doğrulaması için yetkili kurtarma akışı.
- Normal bakım parmak izinden alan ayrımlı SHA-256 ile türetilen ayrı kurtarma bağlamı.
- Kurtarma girişimleri için işletim sistemi korumalı ayrı kalıcı deneme sayacı.
- Sabit `BAKIM KİLİDİNİ SIFIRLA` onayı ve yerel geri alınamaz işlem uyarısı.
- Başarılı kurtarmada tüm açık bakım oturumlarının iptali ve yalnız kilit/sayaç durumunun temizlenmesi.

## Gizlilik

- Parola, TOTP/kurtarma kodu ve açık onay metni günlüklenmez veya tanı paketine eklenmez.
- Denetim yalnız önceki kilit nedeni, temizlenen bağlam sayısı ve kısaltılmış teknik kurtarma parmak izini taşır.

## Korunan davranış

- Build 167'nin tek kullanımlık bakım oturumları korunur.
- Build 168'in `family_admin` ve güvenilir cihaz yetkisi korunur.
- Build 169'un güçlü yeniden doğrulaması korunur.
- Build 170'in sınırlı deneme ve kilit politikası korunur.
- Build 171–172'nin işletim sistemi korumalı, cihaz bağlı kalıcılığı korunur.
- Aşama Bronze RC2 Active Development olarak kalır.
