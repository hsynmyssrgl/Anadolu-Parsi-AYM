# ADR-021 — Veri saklama, geri alınabilir silme ve kalıcı imha

- Durum: Kabul edildi
- Tarih: 28.07.2026
- Build: 136
- Karar: DEC-050

## Bağlam

Finans, sağlık ve yaşam kayıtları için yalnız doğrudan silme kullanmak; yanlış
kullanıcı işlemi, yasal saklama gereksinimi, aile içi veri sahipliği ve yedeklerde
kalan kopyalar açısından kabul edilemez risk oluşturur. Öte yandan tüm kayıtları
süresiz tutmak da veri minimizasyonu ve kullanıcı kontrolü hedefleriyle çelişir.

## Karar

1. Desteklenen hassas kayıtlar `active`, `archived`, `purge_scheduled` ve
   `purged` yaşam döngüsü durumlarından birini taşır.
2. Varsayılan silme davranışı geri alınabilir arşivlemedir. Arşivlenen kayıtlar
   normal modül listelerinden gizlenir ancak yetkili kullanıcı tarafından geri
   alınabilir.
3. Saklama politikası kayıt türlerini, saklama gününü ve geri alma penceresini
   tanımlar. Süre dolmadan kalıcı imha talebi oluşturulamaz.
4. Kalıcı imha iki aşamalıdır. Talep aşamasında
   `KALICI İMHA <tür>/<kimlik>`, yürütme aşamasında
   `GERİ ALINAMAZ İMHA <tür>/<kimlik>` metni birebir girilir.
5. Talep ve yürütme güçlü yeniden doğrulama ister: parola ve hesapta TOTP açıksa
   geçerli TOTP kodu.
6. Hukuki/koruma bekletmesi etkin kayıtta imha talebi ve yürütme reddedilir.
7. Merkezi nesne yetkilendirmesi her aşamada uygulanır; aile yöneticisi özel
   yetişkin verisini yalnız rolü nedeniyle imha edemez.
8. İmha sırasında kaynak kayıt, nesne izinleri ve AI izinleri transaction içinde
   kaldırılır; finans değerlemeleri foreign-key cascade ile temizlenir.
9. İmha sonrası kimlik, sahiplik, mahremiyet, zaman ve politika bilgisini taşıyan
   içeriksiz tombstone korunur. `backupPropagationPending=true` ile eski yedek
   kopyalarının ayrıca yaşam döngüsü tamamlaması gerektiği açıkça belirtilir.
10. SQLite `secure_delete=ON` ve WAL checkpoint kullanılır; ancak SSD wear
    levelling, dosya sistemi snapshotları, bulut eşitlemesi ve yedekler nedeniyle
    fiziksel silme yalnız en iyi çaba olarak tanımlanır.

## Sonuçlar

Yanlış silme geri alınabilir, saklama süresi ve bekletme kuralları denetlenebilir,
kalıcı imha ise açık niyet ve güçlü kimlik doğrulaması olmadan çalışmaz. Gerçek
hukuki saklama süreleri Gold öncesi hukuk/gizlilik incelemesiyle kesinleştirilmeli;
mevcut politika motoru teknik uygulama sınırını sağlar, hukuki görüş yerine geçmez.
