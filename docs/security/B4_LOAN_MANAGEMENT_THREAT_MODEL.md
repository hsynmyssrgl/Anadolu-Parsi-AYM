# B4-08/B4-09 kredi yönetimi tehdit modeli

## Korunan varlıklar

- Kredi, ödeme planı, erken kapama, gecikme, sigorta, teminat ve ödeme geçmişi.
- Tam PAN, CVV/CVC, PIN ve banka parolasının sisteme hiç alınmaması.
- Finance policy kararı, exact receipt kimliği, audit ve outbox içerik sınırı.

## Tehditler ve kontroller

1. **Bilinmeyen alan veya bankacılık sırrı girişi:** exact IPC anahtar denetimi,
   kanonik sır alanı reddi ve başlık/açıklama/referans/not alanlarında Luhn-geçerli
   PAN taraması uygulanır; application katmanı aynı denetimi işlemden önce tekrarlar.
2. **Tutarsız kredi profili:** oran/vade/para sınırları, açık-kapalı kalan anapara,
   gecikme üçlüsü, tarih sırası, sigorta ve teminat eşleşmeleri application ve SQLite
   constraint katmanlarında fail-closed doğrulanır.
3. **Hatalı ödeme planı:** 1–600 aylık plan UTC ay sonunu güvenli kısaltarak üretilir;
   schedule trigger'ı sıra, tarih, tutar ve parent vade eşleşmesini zorunlu kılar.
4. **Receipt'siz veya replay yazma:** create kredi ve update ödeme receipt'leri exact
   resource/action/capability ile doğrulanır; tüm finans tabloları arasında receipt
   yeniden kullanımı trigger'larla reddedilir.
5. **Geçmişin değiştirilmesi:** kredi profili ve ödeme planı snapshot olarak immutable,
   ödeme geçmişi append-only'dir; update/delete girişimleri SQLite'da reddedilir.
6. **Audit/outbox sızıntısı:** olaylar yalnız kimlik ve sınıflandırma metadata'sı taşır;
   tutar, sigorta/poliçe, teminat açıklaması ve ödeme notu taşımaz.
7. **Yetkisiz okuma/yazma:** merkezi finance read/write kararı, kişi sahipliği,
   gizlilik filtresi ve exact kalıcı receipt birlikte uygulanır.
8. **Banka işlemi yapıldığı iddiası:** UI, domain ve karar kaydı verinin manuel,
   doğrulanmamış ve ödeme icrasız olduğunu açıkça gösterir; network egress yoktur.

## Kalan riskler

Manuel değerler güncel ya da banka gerçeğiyle aynı olmayabilir. Yerel ödeme planı
resmi banka planının faiz, vergi, masraf veya değişken oran hesaplamasını yapmaz.
Ödeme geçmişi bakiyeyi otomatik uzlaştırmaz; banka senkronizasyonu, teklif alma,
para transferi ve kredi kapatma kapsam dışıdır.
