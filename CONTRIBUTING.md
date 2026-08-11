# Katkı ve Değişiklik Kuralları

**Aktif sürüm:** 02.08.2026.228

1. Her değişiklik bir gereksinim, hata veya `DEC-xxx` kararıyla ilişkilendirilir.
2. En son kullanıcı kararı ve aktif kaynak sözleşmesi eski belgeden üstündür.
3. Güvenlik, veri sahipliği, nesne yetkisi ve AI izinleri atlanamaz.
4. Application/renderer katmanına ham SQL veya native SQLite yeteneği eklenemez.
5. Test verileri sentetik/anonim olmalıdır.
6. Yalnız gerçekten çalıştırılan doğrulama PASS/FAIL yazılır; diğerleri NOT_RUN kalır.
7. UI değişiklikleri merkezi tipografi ve erişilebilirlik standardına uyar.
8. Belge/şema/API etkisi ilgili aktif belgeye işlenir.
9. Geri döndürülemez veri göçü, gerçek veri silme, kapsam değişikliği, güvenlik
   zayıflatma, hukuki/finansal taahhüt ve üretim release’i ayrıca onaylanır.
10. Bronze/Silver/Gold kanal geçişi otomatik yapılmaz.
11. Kaynak manifesti, SHA-256 ve deterministik arşiv güncellenmeden teslim tamamlanmaz.

## Katı yaşam döngüsü politikası — Build 180

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 bağlayıcı katkı kuralı

DEC-073 ve ADR-056 kapsamındaki otomatik temiz yedek yeniden yazımı; kalıcı politika, kesinti kurtarma, doğrulanmış yeni yedek, eski kopya karantinası, 60/360 dakikalık geri çekilme, yüksek yük ertelemesi ve görünür tanı sınırları birlikte korunmadan değiştirilemez. Yeni ürün davranışı yalnız Bronze'da geliştirilir; Silver yalnız tam doğrulama ve iyileştirme içindir.

## Build 185 bağlayıcı katkı kuralı

Yönetilen yedek yayılımı use-case'ine işlem başında hesaplanmış `completedAt`
girdisi yeniden eklenemez. Yeni kronoloji değişiklikleri DEC-075/ADR-058,
sentetik monotonik saat ve gerçek SQLite kanıtlarını birlikte güncellemelidir.


## Build 186 bağlayıcı katkı kuralı

Başarı veya kısmi temiz-yedek çalışma sonucu propagation kimliği olmadan ya da
bağlı propagation tamamlanmasından önce kaydedilemez. DEC-076/ADR-059,
application davranış testi ve gerçek SQLite tetikleyici kanıtı birlikte
güncellenmeden bu sınır değiştirilemez.

## Build 184 bağlayıcı katkı kuralı

Atomik temiz-yedek sonuçlandırma, kalıcı çalışma defteri, gerçek SQLite bağlayıcı
regresyonu ve eski çalışma sahibinin reddi DEC-074/ADR-057 ile birlikte
korunmalıdır.

## Build 187 bağlayıcı katkı kuralı

Kesinti kurtarma çağrıları önceden hesaplanmış `recoveredAt` veya
`nextAttemptAt` kabul etmez. Repository yalnız gözlenen zamanı alır, güvenli
tabanı kalıcı çalışma kaydından üretir ve migrasyon 32 durum sözleşmesine uyar.
DEC-077/ADR-060 değişikliği bütün aktif belgeler ve kanıt sözleşmelerine birlikte
yansıtılmalıdır.

## Build 188 bağlayıcı katkı kuralı

Temiz-yedek claim akışında doğrudan `now()` değerini kalıcı başlangıç olarak kullanmak, `nextAttemptAt` değerini güvenli saat tabanına katıp backoff'u aşmak, saklama kesimini farklı bir zamanla üretmek veya migration 33 kronoloji korumasını atlamak kabul edilmez. DEC-078 ve ADR-061 değişiklik incelemesinde zorunludur.


## Build 189 bağlayıcı katkı kuralı

`PPT-LIFECYCLE-STRICT-V1` ve `DEC-079` bağlayıcıdır. Aktif çalışma politika kilidini, ledger-floor kurtarmayı veya terminal state/outcome/status eşlemesini gevşeten değişiklik kabul edilmez.


## Build 190 bağlayıcı katkı kuralı

Yayılımsız temiz-yedek terminal zamanı için duvar saatini yeniden okumak yasaktır. Güvenli claim zamanı + monotonik geçen süre ve fail-closed saat doğrulaması korunmalıdır. DEC-080/ADR-063 bağlayıcıdır.

## Build 191 bağlayıcı katkı kuralı

Manuel, otomatik ve ertelenmiş temiz-yedek geri çekilme süreleri çalışma tetikleyicisiyle uyumlu kalmalıdır. Manuel yollar 60 dakika, otomatik yollar 360 dakika, yüksek yük ertelemesi 30 dakika kullanır; kesinti kurtarması kalıcı `last_trigger` değerini esas alır. DEC-081/ADR-064 ve SQLite tetikleyici kanıtları birlikte korunmalıdır.

## Build 192 bağlayıcı katkı kuralı

`enabled=false` kontrolünü yeniden bütün tetikleyicilere uygulamak, manuel claim için backoff veya tek sahiplik kontrolünü kaldırmak ya da migrasyon 36 devre dışı otomatik sahiplenme korumasını gevşetmek kabul edilmez. DEC-082/ADR-065 bağlayıcıdır.


## Build 193 bağlayıcı katkı kuralı

`running` temiz-yedek defter satırı politika sahibiyle aynı kimlik, tetikleyici ve claim kronolojisini taşımak zorundadır. Bu korumayı zayıflatan doğrudan SQL, trigger kaldırma veya aktif defter silme değişikliği kabul edilmez. `DEC-083`, `ADR-066` ve `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 bağlayıcı katkı kuralı

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 katkı kuralı

Aktif temiz-yedek politika parametrelerini çalışma sırasında değiştiren doğrudan SQL veya repository yolu kabul edilmez.

## Ana Build Defteri — Build 205 sonrası kesin kural

12. Her yeni build başlamadan `scripts/set-workspace-version.mjs` çalıştırılır; bu işlem `config/master-build-ledger.json` içinde buildi `IN_PROGRESS` açar.
13. Build sonunda `npm run build-ledger:update -- complete --build <N> --summary "..." --status-message "..." --evidence "dosya1,dosya2"` çalıştırılır.
14. Tamamlanan ve yeni açılan işler `npm run build-ledger:update -- work-status --build <N> --id <OPEN-ID> --status <STATUS>` ile işaretlenir.
15. Kullanıcıya her buildden sonra yapılanlar, gerçek PASS/FAIL/NOT_RUN durumu ve sıradaki iş bildirilir; aynı bildirim ana deftere kaydedilir.
16. `npm run verify:build-ledger` PASS olmadan kaynak arşivi veya teslim tasdiki üretilemez.
17. Yeni sohbet veya geliştirme oturumunda ilk okunacak kaynak `docs/17_MASTER_BUILD_LEDGER.md` dosyasıdır; geçmiş sohbetlerden yeniden başlangıç araştırması normal akış değildir.


## Build 206 bağlayıcı proje anayasası kuralı

18. Her yeni sohbet, geliştirme oturumu ve build başlangıcında ilk kaynak
    `docs/17_MASTER_BUILD_LEDGER.md` dosyasıdır.
19. Ana Build Defteri içindeki güncel `PROJECT-RULES-*` kural seti okunmadan kod,
    plan veya kapsam değişikliği üretilemez.
20. Build başlangıcı güncel kural SHA-256 özeti `--rules-ack` ile kabul edilmeden
    açılamaz.
21. Kural seti yeni build ve açık kullanıcı kararı olmadan değiştirilemez.
