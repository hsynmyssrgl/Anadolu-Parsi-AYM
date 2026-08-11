# ADR-050 — Ayrı Güvenlik Merkezi Menüsü ve Renderer Bileşen Sınırı

- Durum: Kabul edildi
- Tarih: 30.07.2026
- Build: 177

## Bağlam

Build 176 ile güvenlik dönemine bağlı oturum, bakım kurtarması sonrası cihaz yeniden yetkilendirme ve Ed25519 imzalı güvenlik olayı makbuzu gerçek IPC ve renderer akışına bağlandı. Ancak bu kontroller Sistem ve Bakım sayfasının içine gömülüydü. Kullanıcı açısından görünür bir menü hedefi olmaması, güvenlik işlemlerinin bulunabilirliğini ve menüden use-case'e izlenebilirliği zayıflatıyordu.

Ayrıca erişilebilirlik durumu `SettingsSecurity` içeriğinde kullanıldığı halde bileşenin prop sözleşmesinde açıkça tanımlanmamıştı. Kontrollü ana süreç tip denetimi bu renderer kapsam hatasını kapsamadığından, ayrı renderer sözleşmesi gerekliydi.

## Karar

1. `security` kimlikli ayrı bir **Güvenlik Merkezi** menü hedefi oluşturulacaktır.
2. Güvenlik Merkezi; sol menü, profil menüsü, komut paleti ve aktif ekran yönlendirmesi üzerinden aynı route'a bağlanacaktır.
3. Sistem ve Bakım ekranı, Güvenlik Merkezi bileşenini iç içe çağırmayacaktır.
4. Parola, 2FA, güvenilir cihaz, imzalı güvenlik makbuzu, denetim zinciri, yedekleme ve veri yaşam döngüsü işlemleri Güvenlik Merkezi altında görünür kalacaktır.
5. Hesap ve oturum güvenlik dönemi uyuşmazlığı veya açık yeniden yetkilendirme gereksinimi, menüde dikkat işareti oluşturacaktır.
6. Cihaz yeniden yetkilendirme düğmesi parola, 2FA kodu ve tam onay ifadesi hazır olmadan IPC çağrısı yapmayacaktır.
7. Route, etiket, onay ifadesi, dikkat ve hazır olma politikaları saf bir renderer yardımcı modülünde merkezileştirilecektir.
8. `SettingsSecurity` erişilebilirlik durumu ve değişiklik callback'ini açık prop olarak alacaktır.

## Sonuçlar

- Güvenlik özellikleri yalnız arka plan kodu olarak kalmaz; menüden bulunabilir ve kullanılabilir olur.
- Profil menüsü ile komut paleti doğrudan güvenlik ekranına gider.
- Sistem operasyonları ile hesap/veri güvenliği görsel olarak ayrılır.
- Renderer kapsam ve yönlendirme sözleşmeleri bağımsız test edilebilir.
- Mevcut main/preload/IPC güvenlik sınırı değiştirilmez ve zayıflatılmaz.

## Sınırlamalar

Bu karar renderer kaynak bağlantısını ve saf yönlendirme davranışını doğrular. Temiz bağımlılık kurulumu, tam React/Electron production derlemesi ve gerçek Windows kullanıcı akışı ayrıca çalıştırılmalıdır.
