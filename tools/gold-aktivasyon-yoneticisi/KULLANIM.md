# Gold Aktivasyon Yoneticisi

Bu arac uygulamadan ayridir. Gold ozel anahtarini uygulama paketine, Git deposuna, loglara veya aktivasyon koduna koymaz.

## Gorsel uygulama

Depo kokunde once `npm run build --workspace @ppt/security`, ardindan
`npm run gold:aktivasyon:merkezi` calistirilir. ParsYuva Gold Aktivasyon Merkezi:

1. Ed25519 ozel anahtarini Windows kullanici korumasiyla sifrelenmis kasada olusturur.
2. Yalniz acik anahtari `gold-activation-trust.json` dosyasina aktarir.
3. Kurulu Gold uygulamasindan main-only cihaz bagini alir.
4. Kodu renderer veya loga acmadan `.parsyuva-gold` dosyasina yazar ve ayni acik anahtarla geri dogrular.
5. Istendiginde dosyayi ana uygulamanin main-only aktivasyon girisine gonderir.

Gorsel arac ana uygulamanin Gold renk, tipografi, ParsYuva marka kilidi ve sicak beyaz yuzey kurallarini kullanir.

1. `anahtar-olustur`: Ed25519 ozel anahtari depo disinda, acik anahtari secilen konumda olusturur.
2. `guven-anahtarini-yukle`: Yalniz acik anahtari Gold paket guven yapilandirmasina aktarir.
3. `cihaz-bagi-al`: Kurulu uygulamadan tek yonlu SHA-256 cihaz bagini dosyaya alir.
4. `kod-uret`: Cihaz bagli, imzali ve suresiz Gold kodunu bir dosyaya yazar.
5. `aktivasyonu-kur`: Gold uygulamasini ana sureci icinde kodu dogrulayip kurmasi icin baslatir.

Bronze ve Silver surumleri Gold kodu kabul etmez. Bir Gold kodu yalniz uretildigi cihaz baginda gecerlidir.
