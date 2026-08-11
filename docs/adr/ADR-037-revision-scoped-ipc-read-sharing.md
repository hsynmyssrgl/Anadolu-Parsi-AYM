# ADR-037 — Revizyon kapsamlı IPC salt okuma paylaşımı

- Durum: Kabul edildi
- Tarih: 2026-07-29
- Aşama: Bronze RC2 Active Development
- Build: 162

## Bağlam

Build 159–161 istek bağlamı, iptal, süre aşımı ve geri basınç sınırlarını kurdu.
Buna rağmen aynı ekranın aynı argüman ve revizyonlarla art arda yaptığı salt
okumalar kısa aralıkta aynı handler ve SQLite sorgusunu yeniden çalıştırabiliyordu.

## Karar

Yalnız açıkça listelenmiş salt okuma kanalları paylaşılır. Paylaşım anahtarı
renderer oturumu, oturum çağı, kanal, bütün revizyon özeti ve kanonik argümanların
SHA-256 değeridir. Preload aynı anahtardaki eşzamanlı çağrıları tek yürütmede
birleştirir. Ana süreç göndericiye özel, kısa TTL'li, giriş ve byte sınırı olan
sonuç cache'i kullanır.

Her çağırana ayrı klon döndürülür. Mutasyonlar paylaşım dışıdır ve başlamadan önce
paylaşılabilir okumaları/cache'i geçersiz kılar. Ana süreç cache nesli, mutasyondan
önce başlayan okumanın daha sonra eski sonuç yazmasını engeller. Hata, büyük,
döngüsel veya desteklenmeyen sonuç cache'e alınmaz.

## Sonuçlar

- Aynı kapsamlı eşzamanlı okumalar tek IPC yürütmesine iner.
- Kısa süreli tekrarlar handler ve veritabanı yükünü azaltır.
- Oturum, revizyon, argüman veya sender sınırı aşılmaz.
- Mutasyonlar ve ağ senkronizasyonu gecikmiş cache sonucunu kullanmaz.
- Production performans etkisi geniş kapılarda ayrıca ölçülür.
