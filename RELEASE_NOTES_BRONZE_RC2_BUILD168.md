# Bronze RC2 Build 168 Sürüm Notları

## Yeni

- Adaptif IPC bakım işlemleri için merkezi ve varsayılan reddeden yetki politikası.
- Yalnız etkin oturumlu `family_admin` rolü için bakım yetkisi.
- Bakım yetkisini geçerli ve güvenilir cihaz kimliğine bağlama.
- Renderer için neden kodu, gerekli rol ve güvenilir cihaz gereksinimini içeren salt okunur yetki görünümü.
- Yetkisiz durumda bakım oturumu açma ve bakım eylemlerini arayüzde kapatma.
- Yetki reddi için kişisel veri taşımayan ayrı denetim olayı.

## Korunan davranış

- Build 167'nin tek kullanımlık, işlem türüne bağlı ve 90 saniyelik bakım oturumları korunur.
- Aşama Bronze RC2 Active Development olarak kalır.
- Bağlı 117 tarball yanıtı dönmeden geniş RC2 kapıları çalıştırılmış sayılmaz.
