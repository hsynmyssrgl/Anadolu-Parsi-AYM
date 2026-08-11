# DEC-132 — B1-04 davet IPC, kullanıcı arayüzü ve menü kararı

## Durum

Kabul edildi — 2026-08-05

## Karar

B1-04 davet yaşam döngüsü masaüstünde iki ayrı güven sınırıyla sunulur. Oturum açmamış alıcı yalnız opak davet kodunu inceleyebilir ve güvenli sonuç koduna göre kabul formuna geçebilir; e-posta, rol veya kişi kimliği anonim incelemede açıklanmaz. Aile yöneticisi ise ayrı **Davetler** menüsünden başlangıç/bitiş tarihli davet oluşturur, tek kullanımlık kodu yalnız üretildiği anda görür, yaşam döngüsü durumlarını inceler, bekleyen daveti iptal eder veya önceki kodu atomik olarak geçersiz kılan yeni kod üretir.

`invitations:inspect` ve `invitations:resend` kanalları mevcut korelasyonlu ve güvenilir-gönderici denetimli IPC kayıt yolundan geçer. `invitations:accept` oturum sınırı olarak kalır. Renderer, doğrulanan kod değiştirildiğinde eski inceleme sonucunu siler; sunucu `canAccept` sonucu olmadan kimlik ve parola kabulü açılmaz. Parola değerlendirmesi ortak domain politikasını kullanır.

## Sonuçlar

- Davet kabulü normal oturum açma ekranından erişilebilir; teknik komut gerekmez.
- Yönetici davetleri bağlamsal izinlerden ayrı, görünür bir menüde yönetir.
- Kullanılmış, süresi dolmuş, iptal edilmiş, henüz başlamamış ve geçersiz kodlar anlaşılır fakat kimlik sızdırmayan mesajlara dönüşür.
- Yeniden gönderme predecessor/successor bağını ve denetim kanıtını korur.
- B1-04 ancak IPC, renderer, menü, gerçek çalışma zamanı ve kalıcı Library receipt zinciri PASS olduktan sonra COMPLETE olabilir.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
