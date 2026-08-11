# ADR-057 — Atomik Temiz Yedek Sonuçlandırma ve Kalıcı Çalışma Defteri

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Tarih: 2026-07-30
- Build: 184
- Karar: DEC-074
- Politika: `PPT-LIFECYCLE-STRICT-V1`

## Bağlam

Build 183 temiz yedek yeniden yazımını, karantinayı ve kalıcı çalışma sahipliğini
kurdu. Gerçek SQLite sonuçlandırma sorgusunda on bağlayıcı bulunmasına rağmen dokuz
değer verilmesi; sahte repository kullanan davranış testlerinin yakalayamadığı bir
üretim yolu kusuruydu. Ayrıca politika sonucu ile tekil çalışma geçmişinin ayrı ve
denetlenebilir biçimde kalıcılaştırılması gerekiyordu.

## Karar

Her sahiplenilmiş temiz yedek yeniden yazım denemesi `backup_clean_rewrite_runs`
defterine başlangıç anında yazılır. Politika satırı ile çalışma defteri aynı
repository işlem sınırında sonuçlandırılır. Çalışma kimliği hem politika sahibi hem
`running` defter kaydıyla eşleşmiyorsa sonuçlandırma reddedilir. Başarı, kısmi,
başarısızlık, dikkat, erteleme ve kesinti durumları; saklama kesimi, kayıt/hedef
sayıları, propagation çalışma kimliği, hata ve sonraki deneme zamanıyla tutulur.

Gerçek SQLite regresyonu, sonuçlandırma SQL'inin bağlayıcı sayısını ve alan
anlamlarını doğrudan `node:sqlite` üzerinde çalıştırır. Sahte adaptör testi tek
başına bu kapı için yeterli değildir.

## Sonuçlar

- Başarı zamanı yanlış sütuna kayamaz; bağlayıcı sayısı değişirse kapı FAIL olur.
- Eski veya yabancı çalışma kimliği güncel politikayı sonuçlandıramaz.
- Kesinti ve kısmi sonuçlar kullanıcıya kalıcı geçmiş olarak gösterilir.
- Tanı yazımı başarısız olsa bile daha önce atomik sonuçlandırılmış iş sonucu
  geriye çevrilmez.
- Silver, yeni özellik eklemeden gerçek Windows, kesinti, performans ve installer
  testlerini tamamlar.
