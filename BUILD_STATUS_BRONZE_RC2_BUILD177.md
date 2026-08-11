# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 177

- Application Version: `30.07.2026.177`
- Package Version: `30.7.2026-177`
- Stage: **Bronze RC2 Active Development**
- Main topic: **Ayrı Güvenlik Merkezi menüsü, görünür renderer bağlantısı ve yeniden yetkilendirme hazır olma kapısı**

## Uygulanan değişiklik

Build 176 güvenlik özellikleri ayrı **Güvenlik Merkezi** route'una taşındı. Sol menü, profil menüsü ve komut paleti aynı hedefe bağlandı. Güvenlik dönemi uyuşmazlığı menü uyarısı üretir. Yeniden yetkilendirme butonu parola, 2FA kodu ve tam açık onay hazır olmadan IPC çağrısı yapmaz.

Sistem ve Bakım ekranının içindeki güvenlik bileşeni kaldırıldı. Erişilebilirlik durumu `SettingsSecurity` bileşeninin açık prop sözleşmesine bağlanarak renderer kapsam hatası giderildi.

## Hedefli doğrulama

- Build 177 sözleşme: **31/31 PASS**
- Build 177 izole runtime: **13/13 PASS**
- Build 177 sözdizimi/bağlantı: **10/10 PASS**
- Build 176 devamlılığı: **52/52 + 23/23 + 14/14 PASS**

## Nihai kaynak doğrulaması

- Source preflight: **147/147 PASS**
- Source integrity: **PASS**
- Validation boundary: **2 PASS / 0 FAIL / 6 NOT_RUN — INCOMPLETE**

## Aşama sınırı

Build 177 Final, Code Freeze, Silver veya Gold değildir. Geniş bağımlılık, production ve Windows kapıları çalıştırılmadan promotion yapılmaz.
