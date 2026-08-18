# Gold Aktivasyon Yoneticisi

Bu arac uygulamadan ayridir. Gold ozel anahtarini uygulama paketine, Git deposuna, loglara veya aktivasyon koduna koymaz.

1. `anahtar-olustur`: Ed25519 ozel anahtari depo disinda, acik anahtari secilen konumda olusturur.
2. `guven-anahtarini-yukle`: Yalniz acik anahtari Gold paket guven yapilandirmasina aktarir.
3. `cihaz-bagi-al`: Kurulu uygulamadan tek yonlu SHA-256 cihaz bagini dosyaya alir.
4. `kod-uret`: Cihaz bagli, imzali ve suresiz Gold kodunu bir dosyaya yazar.
5. `aktivasyonu-kur`: Gold uygulamasini ana sureci icinde kodu dogrulayip kurmasi icin baslatir.

Bronze ve Silver surumleri Gold kodu kabul etmez. Bir Gold kodu yalniz uretildigi cihaz baginda gecerlidir.
