# Build 181 Teslim Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.181`
- Package Version: `30.7.2026-181`
- Stage: **Bronze RC2 Active Development**
- Build: **181**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Kaynak sonuçları

- Kaynak preflight: **159/159 PASS**
- Kaynak bütünlüğü: **1.573/1.573 kaynak dosyası PASS**
- SHA-256 listesi: **1.574 giriş**
- Aktif sürüm sözleşmesi: **178/178 PASS**
- Aktif teslim belgeleri: **121/121 PASS**
- Başarısız kaynak kapısı: **0**

Nihai kaynak taraması aynı dondurulmuş ağaç üzerinde 20 küçük segment halinde çalıştırılır. Segmentler yapılandırma sırası korunarak `build181-source-preflight-final.json` dosyasında birleştirilir.

## Silver test kampanyası sınırı

Temiz kurulum, tam root TypeScript, bütün birim ve entegrasyon testleri, Electron production build, blocking smoke ve gerçek Windows/installer kontrolleri Silver kanalında yürütülecektir. Bronze tesliminde bu kapılar `NOT_RUN` olarak kayıtlıdır.

## Teslim kanıtları

- Deterministik kaynak ZIP’i ve yan SHA-256 dosyası kaynak doğrulaması sonrasında üretilir.
- Ayrık teslim tasdiki: `Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_RC2_Build181_Teslim_Kanit_Tasdiki_30.07.2026.181.json`
