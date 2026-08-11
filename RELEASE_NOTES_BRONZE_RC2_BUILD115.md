# Bronze RC2 Build 115 Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.115`
- Package Version: `25.7.2026-115`
- Kanal: **Bronze RC2 Active Development**

## Eklenenler

- Kaynak ZIP ve doğrulama kanıtlarını SHA-256 ile birbirine bağlayan ayrık teslim tasdiki.
- Tasdik dosyasını yeniden hesaplayarak doğrulayan bağımsız doğrulayıcı.
- Aktif kapı iddialarını RC2 ve temiz kurulum JSON raporlarından türeten durum eşlemesi.
- Kanıt dosyası eksikliği, kanıt hash değişikliği, yanlış PASS ve ZIP değişikliği için fail-closed kontroller.
- Tasdik dosyası için ayrı SHA-256 yan dosyası.
- Linux ve Windows iş akışlarında tasdik sözleşmesi kanıtının korunması.

## Doğruluk kuralı

Ayrık tasdik dijital imza değildir. Bir dosyanın içeriği değişirse hash zinciri ve yeniden doğrulama bunu görünür kılar; çalıştırılmayan kapılar yine PASS sayılmaz.
