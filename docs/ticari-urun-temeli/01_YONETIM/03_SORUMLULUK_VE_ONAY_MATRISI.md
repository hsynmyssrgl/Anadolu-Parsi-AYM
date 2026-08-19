# Sorumluluk ve Onay Matrisi

| Alan | Codex tarafindan yapilabilir | Kullanici gerekir | Dis uzman/kaynak gerekir |
|---|---|---|---|
| Kod, test, mimari, belge | Evet | Nihai urun tercihi | Hayir |
| Yerel kurulum ve teknik test | Evet | PC erisimi/acik izin | Sertifika yoksa test imzasi uretim sayilmaz |
| Marka ve alan adi arastirmasi | On inceleme | Secim ve satin alma | Tescil kurumu/marka vekili |
| Sirket kurma | Belge ve kontrol listesi | Kurucu kararlari | Mali musavir, avukat, MERSIS/TOBB |
| Gizlilik ve kullanim kosullari | Taslak ve veri envanteri | Ticari model karari | Hukuk/gizlilik uzmani |
| Kod imzalama | Pipeline ve dogrulama | Sertifika satin alma/emanet | Sertifika otoritesi |
| Apple/Microsoft/Google hesaplari | Entegrasyon kodu | Hesap acma ve kimlik dogrulama | Platform saglayicisi |
| Gercek cihaz UAT | Test plani ve otomasyon | Cihaz ve hesap | Donanim/saglayici |
| Bulut yedekleme | Guvenli adapter ve test | OAuth oturumu/hedef secimi | Microsoft/Google/Apple |
| Harita/OCR/yerel AI | Kod ve yerel kurulum | Kaynak verisi/model onayi | Veri/lisans saglayicisi gerekebilir |

Codex bir dis kurum veya uzman adina onay veremez. Eksik dis onaylar `NOT_RUN` olarak kalir ve yerel teknik ilerlemeyi durdurmadan ticari yayin kapisini kapali tutar.

