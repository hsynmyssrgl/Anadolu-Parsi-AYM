# Saglayici Secim Kriterleri

Her dis saglayici 0-5 araliginda puanlanir. Guvenlik, gizlilik veya ticari lisans puani 3 altindaysa saglayici uretime alinmaz.

| Kriter | Agirlik |
|---|---:|
| Ticari lisans ve dagitim hakki | 20 |
| Gizlilik, veri isleme ve silme | 20 |
| Guvenlik, sifreleme ve olay bildirimi | 15 |
| API kararliligi ve surumleme | 10 |
| Maliyet ve fiyat degisikligi riski | 10 |
| Veri tasinabilirligi ve cikis plani | 10 |
| Global bolge/platform destegi | 5 |
| SLA, destek ve sirket surekliligi | 5 |
| Erisilebilirlik ve yerellestirme | 5 |

## Zorunlu kayit

- Saglayici ve urun adi.
- Resmi kosul/lisans URL'si ve inceleme tarihi.
- Islenen veri sinifi ve veri bolgesi.
- OAuth scope veya API yetkileri.
- Ucretli/ucretsiz kota ve limit.
- Offline/fail-closed davranis.
- Alternatif saglayici ve cikis plani.
- DPA, SCC, KVKK/GDPR ve silme sureci durumu.
- Gercek hesap UAT kaniti.

## Varsayilan secimler

- Yerel AI: ticari acik lisansli model + sabit loopback runtime.
- Harita: MapLibre + yerel PMTiles + OSM attribution.
- OCR: Windows yerel API + cihazdaki Defender; bulut OCR varsayilan kapali.
- Yedek: once yerel/senkron klasor, sonra ayri izinli Microsoft/Google adapteri.
- Kod barindirma/CI: secim yapilmadi; gizli anahtar ve imza yetkisi kurumsal hesapta olmalidir.

