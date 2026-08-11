# Aktif Kapsam ve Değişiklik Yönetimi — Build 188

**Aktif sürüm:** 02.08.2026.228

**Ürün:** Anadolu Parsı Aile Yaşam Merkezi  
**Marka kimliği:** Panthera pardus tulliana  
**Aşama:** Bronze RC2 Active Development

## Bağlayıcı kapsam

Ürün, kullanıcı tarafından oluşturulan ailelere temas eden ve yetkilendirilen kişilerin aile
ilişkilerini, yaşam olaylarını, belgelerini, anılarını, görevlerini, sağlık ve
finans kayıtlarını ve ortak aile hafızasını yerel-öncelikli biçimde yöneten
dijital yaşam merkezidir.

Kök varlık Aile’dir. Kişi, kullanıcı hesabı, hane, aile dalı ve üyelik ayrı
varlıklardır. Her yetişkin kendi özel verisinin sahibidir; aile yöneticisi özel
sağlık, finans, konum veya belge kayıtlarını otomatik göremez.

## Aktif modül kapsamı

- Gösterge Paneli
- Aile
- Soy Ağacı
- Zaman Tüneli
- Önemli Günler
- Arşiv
- Finans
- Sağlık
- Yaşam Merkezi
- Bildirim ve Otomasyon
- Raporlama
- Konum
- Yetkiler
- Yapay Zekâ
- Dijital Miras
- Ayarlar

Ayrıntılı modül sınırları `docs/12_PRODUCT_SCOPE_AND_MODULE_CATALOG.md`
belgesindedir.

## Platform kapsamı

- İlk gerçek platform Windows masaüstüdür.
- Mimari macOS ve gelecekte Apple companion istemcilerine genişletilebilir.
- Mobil istemciler ilk aşamada masaüstünden veri alan, okuma ağırlıklı
  istemcilerdir; bağımsız işlem/veri motoru değildir.
- Bulut hesabı temel kullanım için zorunlu değildir.

## Kapsam dışı

- Bağımsız yatırım ve otomatik alım-satım uygulaması
- Broker, Matriks, İş Yatırım, Deniz Yatırım veya piyasa veri entegrasyonları
- Kullanıcı onayı olmadan AI tarafından kesin kayıt üretimi
- Açık rıza olmadan canlı konum
- Bronze aşamasında gerçek mağaza yayını, üretim imzası veya gerçek aile verisi

## Değişiklik yönetimi

Geri döndürülebilir teknik iyileştirmeler ve kabul edilmiş öneriler ayrıca onay
beklemeden ilerleyebilir. Aşağıdakiler ürün sahibi onayı gerektirir:

- kapsam değişikliği
- geri döndürülemez veri işlemi veya gerçek veri silme
- veri sahipliği değişikliği
- güvenlik kontrolü zayıflatma
- hukuki veya finansal taahhüt
- üretim release’i

Her önemli karar `docs/10_MASTER_DECISION_REGISTER.md` içinde `DEC-xxx` kimliğiyle
kaydedilir ve etkilenen belge/kod/kanıtla eşleştirilir.

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 aktif kapsamı

Saklama süresi dolmuş kalıcı imha tombstone kayıtları için otomatik temiz tam yedek yeniden yazımı, eski yönetilen kopyanın karantinaya alınması, kalıcı durum/geri çekilme ve kullanıcıya görünür tanı kapsam içindedir. Yönetilmeyen haricî kopyalar otomatik kapsam dışındadır ve ayrı envanter yönetişiminde kalır. Karar DEC-073 ve ADR-056 ile bağlayıcıdır.

## Build 184 aktif kapsamı

Build 184, Build 183 temiz yedek akışının atomik SQLite sonuçlandırmasını ve kalıcı çalışma defterini Bronze ürün kapsamına ekler. Sahiplik ile `running` defter kaydı birlikte doğrulanmadan politika sonuçlandırılamaz; her deneme kullanıcıya görünür geçmiş üretir. Karar DEC-074 ve ADR-057 ile bağlayıcıdır.

## Build 185 aktif kapsamı

Yönetilen yedek yayılımının karantina, tombstone tamamlama ve çalışma tamamlanma
zamanları gerçek işlem sırasına göre monotonik geçen süreden üretilir. İşlem
başında önceden oluşturulmuş `completedAt` kapsam dışıdır ve yasaktır. Karar
DEC-075 ve ADR-058 ile bağlayıcıdır.

## Build 186 aktif kapsamı

Bağlı temiz-yedek çalışma ve propagation kronolojisi Bronze ürün kapsamıdır.
Başarı/kısmi sonuç propagation kimliği ve doğrulanmış tamamlanma zamanıyla
birlikte saklanır.

## Build 187 aktif kapsamı

Kesilmiş otomatik temiz-yedek yeniden yazımının güvenli zaman tabanıyla
kurtarılması Bronze ürün kapsamıdır. Sistem saati geri alınsa bile kalıcı
`running` sahipliği bırakılır; yeni ürün geliştirmesi Silver'a ertelenmez.

## Build 188 aktif kapsamı

Yeni otomatik temiz-yedek çalışma sahiplenmesi, sistem saati geriye alınsa bile kalıcı politika güncellemesi, son deneme ve son başarı kronolojisinin güvenli üst sınırında başlatılır. Durum ve saklama kesimi bu zamanda yeniden hesaplanır; gelecekteki geri çekilme zamanı erkenden aşılmaz. DEC-078 ve ADR-061 bağlayıcıdır.

## Build 189 aktif kapsamı

Aktif temiz-yedek çalışması sırasında politika ayarları değiştirilemez. Kesinti kurtarma zamanı politika ve çalışma defterinin en ileri kalıcı zamanına bağlanır; terminal politika ve çalışma durumları çelişemez. DEC-079 ve ADR-062 bağlayıcıdır.


## Build 190 aktif kapsamı

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 aktif kapsamı

Manuel ve otomatik temiz-yedek terminal/kesinti geri çekilmesinin çalışma tetikleyicisine bağlanması aktif Bronze kapsamıdır.

## Build 192 aktif kapsamı

Otomatik temiz-yedek politikası kapalıyken yetkili manuel çalıştırmanın kullanılabilir olması Bronze ürün kapsamıdır. Manuel çalışma geri çekilme, tek sahiplik, saklama kesimi ve kronoloji sınırlarını atlayamaz. DEC-082 ve ADR-065 bağlayıcıdır.



## Build 193 aktif kapsamı

Çalışan temiz-yedek defteri sahip kimliği bütünlüğü Bronze kapsamındadır. Yetim veya sahte `running` kayıtların reddi, geçerli claim ve terminal akışın korunması bağlayıcıdır. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 aktif kapsamı

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 aktif kapsamı

Aktif temiz-yedek politika parametrelerinin terminal geçişe kadar dondurulması Bronze kapsamındadır.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 — Proje Anayasası V3 kapsam sınırı

Projenin tek geçerli kaynak başlangıcı 20.07.2026’dır. Önceki sohbet/projeler kapsam kaynağı değildir. Üst marka `Panthera pardus tulliana`, uygulama adı `Anadolu Parsı Aile Yaşam Merkezi`dir. Production başlangıcı kişisel/demo veri içermez. Banka ve diğer kurum entegrasyonları P2’dir ve kararlı üretimden yaklaşık 5-6 ay sonra değerlendirilir.
