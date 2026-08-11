# DEC-130 — B1-03 Bağlamsal Merkezi Yetkilendirme

## Durum

Kabul edildi ve 30-E kapsamında uygulanıyor.

## Karar

Nesne izinleri yalnız rol, kaynak ve eylemle değerlendirilemez. Merkezi yetkilendirme kararı aşağıdaki bağlamı birlikte değerlendirir:

- işlemin amacı (`purpose`),
- kaynağın aile dalı ve aktörün etkin aile dalı üyelikleri,
- hesap ve izin başlangıç/bitiş zamanları,
- izin veya açık ret etkisi,
- açık ret kaydında zorunlu, denetlenebilir ret gerekçesi.

Genel amaçlı izinler tüm amaçlara uygulanabilir; amaçla sınırlandırılmış izinler yalnız aynı amaçta eşleşir. Aile yöneticisi dışındaki bir aktör, üyesi olmadığı aile dalındaki kaynağa ancak aynı bağlama açıkça uyan bir izinle erişebilir. Aynı bağlamdaki açık ret, rol ve açık izinden önce değerlendirilir ve karar sonucunda ret gerekçesi korunur.

## Güvenlik ve bütünlük

- Etkinlik aralığı dışında kalan izinler karar girdisine alınmaz.
- `deny` kaydı 5–500 karakterlik açık gerekçe taşımak zorundadır.
- `allow` kaydı ret gerekçesi taşıyamaz.
- Aile dalı ile sınırlandırılan izin, hesabın bağlı kişisiyle aynı aileye ait bir dala işaret etmelidir.
- Eksik veya tutarsız bağlam fail-closed sonuç üretir.
- Tarihsel 29 ve tamamlanmış 30-A–30-D checkpointleri değiştirilmez.

## Teslim sınırı

30-E domain, şema, migration, repository, merkezi policy/use-case ve hedefli doğrulama temelini kapsar. IPC, kullanıcı arayüzü ve menü bağlantıları ayrı bir sonraki governed mikro-adımda tamamlanacaktır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
