# Bronze RC2 Build 191 Durumu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `31.07.2026.191`
- Package Version: `31.7.2026-191`
- Stage: **Bronze RC2 Active Development**
- Build: **191**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Kapsam

Manuel ve otomatik temiz-yedek `attention`, `partial`, `failed` ve `interrupted` sonuçlarının yeniden deneme zamanını çalışma tetikleyicisine bağlamak; yanlış gecikmeyi repository ve SQLite katmanında fail-closed reddetmek.

## Hedefli doğrulama

- Davranış: **21/21 PASS**
- Gerçek SQLite: **22/22 PASS**
- Kontrollü TypeScript/regresyon: **3/3 PASS**
- Sözleşme: **90/90 PASS**
- Kaynak preflight: **197/197 PASS — 25 segment**
- Kaynak bütünlüğü: **1.682/1.682 PASS; 1.683 SHA-256 girdisi**
- Teslim tasdik sözleşmesi: **143 kanıt / 8 kapı PASS**
