# ADR-060 — Yeniden Başlatmaya Dayanıklı Temiz Yedek Kurtarma Kronolojisi

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Build: 187
- Politika: `PPT-LIFECYCLE-STRICT-V1`
- Karar: `DEC-077`

## Bağlam

Build 186, başarı ve kısmi sonuçların bağlı propagation kronolojisini korudu.
Ancak kesilmiş bir çalışma yeniden başlatılırken yalnız yeni duvar saati
kullanılıyordu. Saat kalıcı çalışma başlangıcının gerisine alınmışsa SQLite
kronoloji tetikleyicisi kurtarmayı reddediyor ve politika `running` durumunda
kilitli kalabiliyordu.

## Karar

Kesinti kurtarma zamanı repository içinde kalıcı çalışma başlangıcıyla
karşılaştırılır ve büyük olan zaman kullanılır. 360 dakikalık otomatik geri
çekilme bu güvenli zamandan türetilir. Çalışma defteri başlangıcı, politika
başlangıcına göre önceliklidir. Sahiplenme sırasında eski `next_attempt_at`
temizlenir. Politika ve çalışma defteri durum/geri çekilme tutarlılığı SQLite
insert/update tetikleyicileriyle fail-closed korunur.

## Sonuçlar

- Saat geri alma, kesilmiş çalışmayı kalıcı `running` kilidine dönüştürmez.
- Kurtarma kaydı hiçbir zaman çalışma başlangıcından önce tamamlanmış görünmez.
- Geri çekilme aralığı gerçek güvenli tamamlanma tabanından başlar.
- Bozuk tarih veya durum kombinasyonu sessizce düzeltilmez; atomik işlem
  reddedilir ve tanı üretilebilir.
