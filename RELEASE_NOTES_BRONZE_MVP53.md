# Panthera pardus tulliana — Bronze MVP-53 Release Notları

**Sürüm:** `23.07.2026.53`  
**Milestone:** `B060-M13 Membership Collaboration & Notifications`

## Eklenenler

- `SqliteInvitationRepository`
- `SqliteNotificationStateRepository`
- Aile daveti listeleme, oluşturma, iptal ve kabul use-case’leri
- Önemli gün katılımcı/görünürlük güncelleme use-case’i
- Önemli gün davetiye metni güncelleme use-case’i
- Önemli gün notları güncelleme use-case’i
- Timeline bildirimi okundu işaretleme use-case’i
- `RepositoryBackedMembershipUnitOfWork` ve query adapter’ları
- Migration 8: `membership_collaboration_notifications`
- Membership/collaboration otomatik doğrulama paketi
- Önemli gün düzenleme arayüzü ve bildirim okundu eylemi

## Davet yaşam döngüsü

1. E-posta adresi dil bağımsız normalize edilir.
2. Aynı aile ve e-posta için ikinci bekleyen davet reddedilir.
3. Davet, aile içindeki kişi kaydıyla ilişkilendirilebilir.
4. Zayıf parola veya geçersiz token hiçbir kısmi hesap kaydı bırakmaz.
5. Başarılı kabul, bağlı hesabı ve üyelik dönemini oluşturur.
6. Kabul edilmiş token ikinci kez kullanılamaz.

## Etkinlik iş birliği

- Katılımcı listesi tekrar eden kimliklerden arındırılır.
- Görünürlük `family`, `selected_members` veya `personal` olarak güncellenir.
- Davetiye ve not alanları bağımsız olarak değiştirilebilir veya temizlenebilir.
- Her değişiklik audit ve outbox kaydıyla aynı transaction içinde yürür.
- Bilinmeyen katılımcıda bütün transaction geri alınır.

## Bildirim durumu

- Timeline hatırlatmaları occurrence key ile kararlı kimlik kazanır.
- Okundu durumu hesap bazında saklanır.
- Aynı bildirimi yeniden onaylamak idempotenttir.
- Okundu durumu uygulama yeniden başlatıldığında korunur.

## Değiştirilenler

- Timeline görünürlük kontrolündeki iç içe transaction riski kaldırıldı.
- IPC sayısı `128`den `132`ye yükseldi.
- Migration sayısı `7`den `8`e yükseldi.
- Uygulama/güvenlik tablosu sayısı `41`den `42`ye yükseldi.
- Son şema fingerprint’i `1792e245001eed0a8e6d293390b9d565adccf2e84f312c82a70280d1ec6ec0c9` olarak sabitlendi.
