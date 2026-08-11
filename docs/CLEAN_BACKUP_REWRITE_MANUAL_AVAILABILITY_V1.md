# Manuel Temiz-Yedek Kullanılabilirliği V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Otomatik temiz-yedek planlaması kapalıyken aile yöneticisinin açık “Şimdi çalıştır” eylemini güvenli biçimde kullanabilmesini sağlamak.

## Bağlayıcı kurallar

1. `enabled=false` yalnız otomatik çevrimi kapatır; manuel çalışma yetkisini kaldırmaz.
2. Otomatik çevrim `enabled=false` iken sahiplenme yapamaz ve çalışma defteri oluşturamaz.
3. Manuel çalışma; geri çekilme zamanı, tek `running` sahipliği, saklama kesimi, hedef ve kronoloji doğrulamalarını atlayamaz.
4. Manuel çalışma boyunca ve terminal durumda politika `enabled=false` değerini korur.
5. SQLite üzerinde `enabled=0` ve `state='running'` birleşimi yalnız `last_trigger='manual'` olduğunda geçerlidir.
6. Doğrudan SQL ile devre dışı otomatik çalışma oluşturma girişimi fail-closed reddedilir.

## Kullanıcı yüzeyi

“Otomatik politika etkin” seçeneği zamanlanmış çevrimi kontrol eder. “Şimdi çalıştır” eylemi ayrı bir manuel komuttur; otomatik planlama kapalı olsa da aile yöneticisi tarafından kullanılabilir. Mevcut geri çekilme zamanı varsa manuel komut da bu süreye uyar.
