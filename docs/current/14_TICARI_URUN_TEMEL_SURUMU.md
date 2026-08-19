# Ticari Urun Temel Surumu

- Karar: `DEC-259`
- Baslangic tarihi: 19.08.2026
- Urun: ParsYuva AYM
- Durum: `ACTIVE_WORKING_BASELINE`
- Ticari yayin uygunlugu: `false`

Yeni ticari calisma alani:

`C:\PPT\AYM\06_KOD\app\docs\ticari-urun-temeli`

Ana giris:

`C:\PPT\AYM\06_KOD\app\docs\ticari-urun-temeli\00_OKU_BENI.md`

Kullanici erisimi icin eski `C:\PPT\AYM\12_TICARI_URUN_TEMEL_SURUMU` yolu ayni kanonik klasore baglanan NTFS junction olarak korunur; ikinci bir belge kopyasi degildir.

Bu repo belgesi yalniz aktif yonetisim baglantisidir. Asil kural otoritesi `config/canonical-rule-registry.json` ve `config/active-governance-ledger.json` ikilisidir. Yeni ticari alan bu otoriteyi SHA-256 ve sayimlarla baglar; ikinci veya daha zayif bir kural kaynagi olusturmaz.

## Zorunlu dogrulama

```powershell
npm run verify:commercial-baseline
```

Bu komut PASS olmadan governed preflight ve ticari belge teslimi PASS olamaz.

## Tarihsel sinir

`C:\PPT\AYM\00_PROJE` ile `C:\PPT\AYM\11_FUTURE_PATCHES` arasindaki eski kayitlar tarihsel ve degismezdir. Aktif karar veya gereksinim kaynagi degildir.
