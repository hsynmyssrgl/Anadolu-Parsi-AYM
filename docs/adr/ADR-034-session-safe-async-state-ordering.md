# ADR-034 — Oturum güvenli asenkron state ve monoton mutasyon sıralaması

## Durum

Kabul edildi — Build 158, Bronze RC2 Active Development.

## Bağlam

Sayfalı kataloglar ve tembel yükleme renderer'a birden fazla eşzamanlı IPC isteği
getirdi. Sorgu, ekran veya oturum değiştikten sonra tamamlanan eski yanıtlar yeni
state'i geri alabilirdi. Mutasyon sonuçları da ağ/işlem zamanlaması nedeniyle
oluşturulma sırasından farklı tamamlanabilirdi.

## Karar

Renderer kapsam+oturum çağı+sıra numarasından oluşan asenkron yazma bileti
kullanır. Yalnız güncel bilet state yazabilir. Oturum değişimi bütün biletleri
geçersiz kılar.

Mutasyonlar kimlik tekrarı ve anahtar bazlı monoton revizyon filigranından geçer.
Eski sonuç reddedilir; bağımsız revizyon ilerlemeleri hedefli olarak kabul edilir.
Graph/timeline mutasyonu ilgili devam eden snapshot isteğini geçersiz kılar ve
gerekirse aktif ekran yükünü yeniden başlatır.

## Sonuçlar

- Gecikmiş katalog ve sayfa yanıtları yeni sorguyu ezemez.
- Çıkış veya profil değişiminden önce başlayan yanıt yeni oturuma yazamaz.
- Eski mutasyon aynı nesnenin daha yeni sürümünü geri alamaz.
- Eski promise yeni tek-uçuş kaydını `finally` içinde silemez.
- Ek renderer koordinasyon kodu ve hedefli runtime sözleşmesi gerekir.
