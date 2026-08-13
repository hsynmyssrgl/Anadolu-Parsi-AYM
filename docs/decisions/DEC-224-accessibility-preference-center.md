# DEC-224 — Erişilebilirlik tercih merkezi

- Tarih: 2026-08-13
- Durum: ACTIVE / IMPLEMENTATION IN PROGRESS
- İş adımı: 33-M
- Gereksinimler: B7-01…B7-13

## Karar

B7-01…B7-13, tek bir erişilebilirlik tercih merkezi ve ortak görsel sözleşme içinde birlikte yürütülür. Tercihler yalnız uygulamanın yerel görünüm ve etkileşim davranışını değiştirir; işletim sistemi ayarlarını değiştirme yetkisi yoktur.

Oturum açıldıktan sonraki yetkili tercih kaynağı, kişisel hassasiyet sınıfında hesap/aile/kişi kapsamına bağlanan migration 90 kaydıdır. Okuma ve yazma mevcut merkezi PEP ile aynı SQLite UoW içinde yürür; optimistic revizyon, istemci işlem kimliği, istek parmak izi, immutable mutation geçmişi, audit ve outbox tek işlem sınırında korunur. Giriş öncesi `localStorage` kopyası yalnız güvenli görünüm başlangıcıdır ve yetkili profil okumasının yerini alamaz.

Bağlayıcı sözleşme şunları kapsar:

1. Görünür metin ölçeğinde 16 px alt sınırı ve yüzde 100–225 arası doğrulanmış uygulama ölçeği.
2. Yüzde 100–400 DPI, 1280×720–4K ve küçük pencere için bilgi kaybetmeyen reflow.
3. Klavye erişimi, deterministik tab/roving sırası, görünür odak, Escape ile kapanış ve odağın çağırana dönmesi.
4. Ad/rol/değer/durum, canlı bölge ve hata duyurusu sözleşmeleri.
5. Yüksek kontrast, `forced-colors`, renk dışı durum işaretleri ve açık/teal/gold görsel kimliğin okunabilir uygulanması.
6. Windows Magnifier için odağın görünür kalmasını destekleyen reflow; en az 44 px etkileşim hedefi.
7. Hareket azaltma, ses kapatma, altyazı, yeniden oynatma ve görsel alternatif tercihleri.
8. Kolay Okuma, sade dil, açıklamalı yönlendirme; genç, standart, ileri yaş, düşük görme ve bakım veren profilleri.
9. Rahat/standart/kompakt yoğunluk; kompakt kipte bilgi saklamama ve progressive disclosure.

## Doğrulama sınırı

Kaynak sözleşmeleri ve otomatik runtime testleri, kabul koşullarını deterministik olarak sınar. Bunlar Windows Narrator veya Magnifier sertifikası, gerçek cihaz laboratuvar sonucu ya da insan UAT sonucu değildir. Böyle bir iddia ancak kullanılan Windows sürümü, donanım, yardımcı teknoloji sürümü, test senaryosu, uygulayıcı ve sonuçları ayrı kanıtla kaydedildiğinde yapılabilir.

## Kapanış koşulu

On üç gereksinimin karar→domain→schema→migration→use-case→repository→policy→IPC→UI→menü→hedefli test→dokümantasyon→kanıt halkaları eksiksiz olmadan; boundary/contract/runtime, tam test/build, güvenlik denetimi, kalıcı receipt, kaynak koruması ve Git eşitliği PASS olmadan `COMPLETE` yazılamaz.
