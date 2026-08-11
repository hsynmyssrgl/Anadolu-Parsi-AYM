# ADR-061 — Geri Alma Güvenli Temiz Yedek Çalışma Sahiplenmesi

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Build: 188
- Politika: `PPT-LIFECYCLE-STRICT-V1`
- Karar: `DEC-078`

## Bağlam

Build 187 kesilmiş çalışmanın yeniden başlatma kurtarmasını kayıtlı başlangıç
zamanına bağladı. Ancak yeni bir çalışma sahiplenilirken doğrudan gözlenen duvar
saati kullanılıyordu. Saat son başarı veya politika güncellemesinin gerisine
alınırsa politika ve çalışma defteri kronolojisi geriye gidebiliyor, saklama
kesimi eski bir zamana göre hesaplanabiliyordu.

## Karar

Uygulama yeni sahiplenme için gözlenen zamanı kalıcı politika `updatedAt`, son
deneme, son başarı ve varsa devam eden çalışma başlangıcıyla karşılaştırır;
büyük olan zaman güvenli başlangıçtır. Durum ve saklama kesimi bu zamanda yeniden
hesaplanır. Gelecekteki `nextAttemptAt` bu tabana katılmaz ve geri çekilme erkenden
atlanamaz.

Repository güvenli başlangıcı ve saklama kesimini yeniden doğrular. Migrasyon 33
politika ve çalışma defteri zaman gerilemesini, sahiplenme zamanı uyuşmazlığını,
çalışma başlangıcı/saklama kesimi değişikliğini ve ikinci eşzamanlı `running`
kaydı fail-closed reddeder.

## Sonuçlar

- Sistem saati geriye alınsa da yeni çalışma geçmiş kayıtlardan önce başlamış
  görünmez.
- Geri çekilme süresi saat düzeltmesiyle aşılmaz.
- Saklama süresi dolmuş kayıt sayısı güvenli zamanda tekrar hesaplanır.
- Doğrudan veya bozuk repository çağrısı SQLite bütünlüğünü aşamaz.
- Saat düzeltmesi kullanıcıya gizlilik güvenli tanı olarak görünür.
