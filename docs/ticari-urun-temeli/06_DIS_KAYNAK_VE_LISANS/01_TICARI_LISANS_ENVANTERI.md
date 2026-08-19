# Ticari Lisans Envanteri

- Inceleme tarihi: 19.08.2026
- Durum: ILK_ON_INCELEME / HUKUK_ONAYI_NOT_RUN

Bu liste teknik lisans on incelemesidir; hukuk gorusu degildir. Her yayin oncesi kilit dosyadaki tum transitif bagimliliklar otomatik SBOM ve lisans taramasindan gecmelidir.

| Bilesen/veri | Amac | Lisans/koşul | Ticari on durum | Zorunlu is |
|---|---|---|---|---|
| Electron | Windows masaustu kabugu | MIT; guncel uc stable major destek politikasi | UYGUN_ADAY | LICENSE/NOTICE, guvenlik guncelleme politikasi |
| React | Renderer UI | MIT | UYGUN_ADAY | Copyright ve lisans bildirimi |
| TypeScript/Vite/Vitest | Gelistirme ve test | Acik kaynak lisanslari | UYGUN_ADAY | Exact transitif SBOM kontrolu |
| SQLite | Yerel veritabani | Public domain yaklasimi | UYGUN_ADAY | Dagitilan binary ve build kaynagini kaydet |
| NSIS | Windows installer | Zlib/libpng tipi lisans | UYGUN_ADAY | Pluginlerin lisansini ayri tara |
| MapLibre GL JS | Harita renderer | BSD-3-Clause | UYGUN_ADAY | Copyright ve BSD metni |
| PMTiles JS/spec | Cevrimdisi harita dosyasi | Kod BSD-3; spesifikasyon public domain/CC0 | UYGUN_ADAY | Ornek tileset lisansini kod lisansiyla karistirma |
| OpenStreetMap verisi | Turkiye harita verisi | ODbL | KOSULLU_UYGUN | Gorunur attribution, ODbL bildirimi, turetilmis DB paylasim kosulu |
| Protomaps basemap build | PMTiles veri uretimi | Veri kaynagi ve build kosullari ayrica incelenir | INCELEME_GEREKLI | Secilen build icin tarih/hash/lisans/provenance kaydi |
| Ollama motoru | Yerel model calistirma | Kaynak repo MIT | KOSULLU_UYGUN | Dagitilan Windows GUI/paket lisansi ayrica teyit; servis bagimsiz kurulum secenegi |
| Qwen3-4B | Yerel AI modeli | Apache-2.0 model karti | UYGUN_ADAY | LICENSE/NOTICE, model hash, kullanim ve AI bildirimleri |
| Windows Media OCR | Yerel OCR | Windows API kosullari | KOSULLU_UYGUN | Desteklenen Windows surumu ve store/desktop kosullari |
| Microsoft Defender MpCmdRun | Malware tarama | Windows sistem bileseni | KOSULLU_UYGUN | Yeniden dagitma yok; cihazda mevcutsa kullan, yoksa fail-closed |
| OneDrive/Graph | Bulut yedek | Microsoft API ve OAuth kosullari | DIS_HESAP_GEREKLI | Uygulama kaydi, scope minimizasyonu, DPA/gizlilik |
| Google Drive API | Bulut yedek | Google API Services kosullari | DIS_HESAP_GEREKLI | OAuth verification, privacy policy, veri silme akisi |
| iCloud Drive | Windows senkron klasoru | Apple iCloud istemcisi kosullari | KOSULLU | Dosya sistemi hedefi; resmi ucuncu taraf API iddiasi yok |

## Resmi kaynaklar

- Ollama MIT: https://github.com/ollama/ollama/blob/main/LICENSE
- Qwen3-4B model karti: https://huggingface.co/Qwen/Qwen3-4B
- MapLibre lisans bilgisi: https://github.com/maplibre/maplibre-gl-js
- PMTiles lisansi: https://github.com/protomaps/PMTiles/blob/main/LICENSE
- OpenStreetMap lisans/attribution: https://www.openstreetmap.org/copyright
- Electron destek politikasi: https://www.electronjs.org/docs/latest/tutorial/electron-timelines

## Yasak veya yuksek riskli siniflar

- Ticari kullanim hakki belirsiz model, font, ikon, gorsel veya tileset.
- GPL/AGPL bilesenin dagitim etkisi incelenmeden urun binarysine baglanmasi.
- Mapbox veya baska ucretli servisin anahtar/kosul olmadan kullanilmasi.
- Bireysel/egitim lisansli arac veya verinin ticari uretime sokulmasi.
- Kullanicinin gizli verisini egitim veya telemetri icin varsayilan gonderen servis.
- Surum, hash ve kaynak adresi kayitli olmayan binary.

