# Gereksinim Izlenebilirlik Matrisi

| Gereksinim | Aciklama | Kural/karar | Mimari veya kod alani | Test/kanit | Is |
|---|---|---|---|---|---|
| TIC-REQ-001 | Tek aktif ticari belge girisi | PR-177, PR-214, DEC-259 | docs/ticari-urun-temeli | Ticari temel gate | IS-0001, IS-0004 |
| TIC-REQ-002 | Her karar aninda senkron kayit | DEC-251, DEC-259 | user-decision-ledger ve current docs | documentation sync gate | IS-0005 |
| TIC-REQ-003 | Kanal bazli Bronze/Silver/Gold tema | PR-141 | renderer theme tokenlari ve installer | screenshot/contrast | IS-0102 |
| TIC-REQ-004 | Sistem dili TR/EN, bilinmeyende English | PR-215, DEC-255 | main locale resolver, dictionaries, NSIS | localization gate | IS-0106 |
| TIC-REQ-005 | Marka adi yalniz ParsYuva AYM | PR-209, PR-217 | title, installer, shortcut, help | brand identity gate | IS-0101 |
| TIC-REQ-006 | Tek gercek installer ilerlemesi | PR-216, DEC-256 | installer.nsh | installer narration test | IS-0201 |
| TIC-REQ-007 | Kapanista hata yok, X tepsiye kucultur | Kullanici karari | Electron main/session lifecycle | kurulu binary UAT | IS-0204 |
| TIC-REQ-008 | Update mevcut veriyi korur | Kullanici karari | migrations, storage identity | N-1 upgrade/rollback | IS-0205 |
| TIC-REQ-009 | Uninstall yedekle veya tam sil secimi | Kullanici karari | uninstaller, backup, deletion propagation | destructive E2E | IS-0206 |
| TIC-REQ-010 | Fabrika ayari geri donussuz ve yedeksiz siler | Kullanici karari | privacy/data rights UoW | multi-target delete test | IS-0207, IS-0506 |
| TIC-REQ-011 | Otuz gun deneme ve Gold aktivasyon | Kullanici karari | license domain ve admin signer | clock/tamper/replay | IS-0301, IS-0302, IS-0303 |
| TIC-REQ-012 | Yerel AI varsayilan olarak dis aga cikmaz | PR-088, PR-180 | Ollama loopback adapter, policy | no-egress/consent E2E | IS-0401, IS-0402 |
| TIC-REQ-013 | Harita cevrimdisi ve lisansli veriyle calisir | Kullanici karari | MapLibre ve PMTiles | offline render/attribution | IS-0403 |
| TIC-REQ-014 | OCR yerel, sinirli ve malware kontrollu | DEC-228 | OCR worker/runtime/policy | worker, malware, policy suites | IS-0404, IS-0405, IS-0406, IS-0407 |
| TIC-REQ-015 | Yedekler sifreli ve birden fazla hedefe alinabilir | Kullanici karari | backup coordinator/adapters | upload/readback/restore | IS-0501-IS-0505 |
| TIC-REQ-016 | Silme tum yonetilen kopyalara yayilir | PR-019, PR-197 | lifecycle propagation | source-delete runtime | IS-0506 |
| TIC-REQ-017 | Kritik/yuksek guvenlik kusuru olmadan Gold | Proje anayasasi | security gates | SAST/dependency/secret | IS-0603 |
| TIC-REQ-018 | Ticari dis bilesen provenance ve lisansi bilinir | TK-005 | SBOM, license policy | license gate | IS-0602 |
| TIC-REQ-019 | Gercek cihaz/saglayici testi yapilmadan PASS yok | PR-203, TK-005 | UAT evidence | physical/provider UAT | IS-0304, IS-0606 |
| TIC-REQ-020 | Uretim binarysi imzali ve dogrulanabilir | PPK-025, TK-005 | release signing policy | Authenticode/provenance | IS-0305 |
| TIC-REQ-021 | Apple tarzi saydamlik erisilebilir fallback ile uygulanir | Kullanici karari | UI tokens/composition | reduced transparency/motion | IS-0103 |
| TIC-REQ-022 | Sesli yardim TR/EN ve klavye erisilebilir olur | DEC-253 | Help Center/TTS | screen reader/keyboard | IS-0107 |

## Drift kurali

Yeni gereksinim; kimlik, kural/karar, uygulama alani, test/kanit ve is baglantisi olmadan kabul edilmis sayilmaz. Kodda karsiligi olmayan satir acik kalir; menusu olmayan kod veya kodu olmayan menu TIC-REQ-005/IS-0105 parite kapisinda fail olur.
