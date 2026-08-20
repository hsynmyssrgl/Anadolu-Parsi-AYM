# Kalan İş Sınıflandırması

> Kaynaklar: `config/accepted-scope-registry.json` ve `config/remaining-scope-package-roadmap.json`. Bu belge otomatik üretilir.

- Aktif sürüm: **Bronze 20.08.2026.37**
- Tarihsel kapsam taban sürümü: **Bronze 04.08.2026.29**

## Sonuç

- Toplam gereksinim: **358**
- Katı zincirle kapanmış: **109**
- Katı kapanışta kalan: **249**
- Yerel kodu tamamlanmış, yalnız dış/manüel kabul bekleyen: **24**
- Yerel bileşenleri kurulmuş, üretim entegrasyonu ile dış kabulü açık: **169**
- Yerel teknik iş ile dış kabulü birlikte açık: **53**
- Son kapanış otomasyonu bekleyen: **3**
- Kayıt uyumsuzluğu: **0**
- Eşleşmeyen açık gereksinim: **0**

Bu sayılar yeni hata sayısı değildir. Bir gereksinim yerel olarak kodlanmış olsa bile gerçek cihaz, sağlayıcı, uzun süreli saha denemesi, imza veya bağımsız inceleme kanıtı yoksa katı kapanışta açık kalır.

## Paketler

| Paket | Sınıf | Katı kapalı / toplam | Açık | Neden |
|---|---|---:|---:|---|
| 33-M | KATI_KAPALI | 13/13 | 0 | Kapalı |
| 33-N | KATI_KAPALI | 3/3 | 0 | Kapalı |
| 33-O | KATI_KAPALI | 9/9 | 0 | Kapalı |
| 33-P | YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR | 0/8 | 8 | Gerçek passkey/authenticator, canlı ve güvenilen federated kimlik sağlayıcısı, cross-device doğrulama, insan UAT ile gizlilik/kimlik incelemeleri tamamlanmadı. |
| 33-Q | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/22 | 22 | Varsayılan gerçek malware/PDF sağlayıcısı, doğrulanmış düşük-yetkili worker ve işletim sistemi ağ izolasyonu, gerçek Windows/Apple cihaz kabulü, denetlenmiş offline fallback ile haricî ve insan UAT kanıtları tamamlanmadı. Yerel eşzamanlı iptal, kaynak silme crash auto-resume, retention purge ve owner-bound zamanlanmış orphan sweep testleri PASS durumundadır. |
| 33-R | YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR | 0/3 | 3 | Gerçek büyük arşiv, medya yaşam döngüsü, arama doğruluğu/performansı ve kullanıcı UAT kanıtları tamamlanmadı. |
| 33-S | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/10 | 10 | Gerçek sağlık/bakım sağlayıcıları, cihaz akışları, klinik doğruluk ve hukuk-gizlilik incelemesi tamamlanmadı. |
| 33-T | YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR | 0/8 | 8 | Gerçek hane verisi, uzun süreli görev/teslimat akışı ve farklı kullanıcı profilleriyle UAT tamamlanmadı. |
| 33-U | YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR | 0/5 | 5 | Çocuk/veli mahremiyeti, okul/servis sağlayıcısı, yaşa uygun açıklama ve hukuk-gizlilik/UAT kanıtı tamamlanmadı. |
| 33-V | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/9 | 9 | Gerçek harita, seyahat, araç/evcil hayvan sağlayıcıları, çevrimdışı saha akışı ve UAT tamamlanmadı. |
| 33-W | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/9 | 9 | Gerçek AI sağlayıcısı, model/veri sözleşmesi, maliyet-mahremiyet sınırı, güvenlik değerlendirmesi ve insan UAT tamamlanmadı. |
| 33-X | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/8 | 8 | Gerçek ses/transkript, yüz gruplama, basılı çıktı, zaman kapsülü rıza akışı ve insan UAT tamamlanmadı. |
| 33-Y | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/6 | 6 | Gerçek Matter/enerji cihazları, üretici adaptörleri, güvenlik/safety değerlendirmesi ve saha UAT tamamlanmadı. |
| 33-Z | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/9 | 9 | Üretim kod imzalama sertifikası, gerçek eklenti sağlayıcıları, dağıtım/rollback ve güven zinciri kanıtı tamamlanmadı. |
| 34-A | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/12 | 12 | Gerçek MLS sağlayıcısı, çoklu istemci birlikte çalışabilirliği, cihaz kimliği ve haricî güvenlik incelemesi tamamlanmadı. |
| 34-B | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/14 | 14 | Gerçek çoklu istemci mesaj teslimi, presence, çevrimdışı/replay ve uzun süreli yaşam döngüsü UAT tamamlanmadı. |
| 34-C | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/19 | 19 | Gerçek WebRTC/SFU/TURN, kamera-mikrofon cihazları, ağ bozulması ve erişilebilir çağrı UAT tamamlanmadı. |
| 34-D | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/12 | 12 | Kayıt için gerçek katılımcı rızası, medya saklama/imha, hukuk-gizlilik incelemesi ve cihaz UAT tamamlanmadı. |
| 34-E | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/11 | 11 | Gerçek çeviri/altyazı sağlayıcısı, dil kalite ölçümü, cihaz performansı ve insan UAT tamamlanmadı. |
| 34-F | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/10 | 10 | Gerçek aile toplantısı, karar/rıza uyuşmazlığı, tutanak UAT ve hukuk-gizlilik incelemesi tamamlanmadı. |
| 34-G | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/14 | 14 | Gerçek çoklu cihaz E2EE dosya aktarımı, büyük dosya/kesinti, sağlayıcı ve kullanıcı UAT tamamlanmadı. |
| 34-H | YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK | 0/4 | 4 | Gerçek uzun süreli iletişim audit/arşiv bütünlüğü, saklama/imha ve bağımsız inceleme tamamlanmadı. |
| 34-I | YEREL_VE_DIS_IS_BIRLIKTE_ACIK | 0/22 | 22 | Gerçek çoklu node quorum/witness/failover, mTLS kimliği, ağ bölünmesi ve uzun süreli soak tamamlanmadı. |
| 34-J | YEREL_VE_DIS_IS_BIRLIKTE_ACIK | 0/18 | 18 | Gerçek dağıtık istemciler, Apple companion, operasyon/felaket kurtarma ve saha provası tamamlanmadı. |
| 34-K | YEREL_VE_DIS_IS_BIRLIKTE_ACIK | 0/13 | 13 | Animasyonlu kurulum, sesli Yardım Merkezi, DPAPI korumalı Core Service companion ve gerçek repository-backed anlık evrensel arama yerel kaynakta oluşturulup hedef testlerle doğrulandı. Production Authenticode sertifikası sağlanmadı; temiz işletim sistemi, signed installer, upgrade/repair/yeni uninstall-veri koruma, yeniden başlatma/güç kesintisi, 168 saat soak, üretim politika-zayıflatma doğrulayıcısı ve erişilebilirlik UAT tamamlanmadı. |
| 34-L | SON_KAPANIS_OTOMASYONU_BEKLIYOR | 0/3 | 3 | Bütün roadmap paketleri kabul edilmedi; gerçek Windows/dağıtık/Apple/uzak sağlayıcı/soak/sertifikasyon ve dış incelemeler NOT_RUN kaldı. |

## Aşılamaz yorumlama kuralı

- `COMPLETE` yalnız tam gereksinim zinciri ve kabul kanıtıyla kullanılır.
- Yerel otomatik test başarısı, gerçek cihaz/sağlayıcı/insan kabulünün yerine geçmez.
- Bilinçli fail-closed davranış veya kurulmamış dış sağlayıcı yeni kod hatası sayılmaz.
- Açık iş sayısı raporlanırken bu sınıflar bir daha tek “eksik” toplamında karıştırılmaz.
