# DEC-198 — PPK-017 hassas log ve content-free tanı sınırı

## Durum

32-M kapsamında kabul edildi. PPK-017 üst gereksinimi hedefli, tam regresyon, üretim build'i, bütünlük, sözleşme ve runtime kanıtlarıyla `COMPLETE` durumundadır.

## Karar

Üretim logları, erken başlangıç kanıtları ve operasyonel tanı kayıtları merkezi `SensitiveLogPolicy` üzerinden fail-closed değerlendirilir. Kabul edilen metadata sınıfları yalnız teknik kimlik, SHA-256, sonuç, correlation, sayaç, boolean, zaman ve sürümdür. Metadata düz olmalı, en fazla 48 alan taşımalı ve teknik stringler 160 karakteri aşmamalıdır.

Payload, OCR metni, transcript, body, serbest mesaj, ayrıntı, içerik, hata stack'i, sorgu/SQL, credential/secret/token, kalıcı dosya veya dizin yolu, kullanıcı başlığı, not ve açıklama loglanamaz. Hash veya fingerprint alanları tek yönlü teknik kanıt taşıyabilir; hash ham içeriğin yerine geri döndürülebilir bir kopya sayılmaz.

Desktop üretim log sink'i yalnız cihaz anahtarlı korumalı `.pplog` yan artefaktıdır. Plaintext `JsonLinesFileLogger` üretim bileşiminde kullanılamaz. Core Service ve erken Desktop başlangıcı dahil doğrudan `console.*` ve doğrudan process stream yazımı üretim kaynaklarında yasaktır; merkezi serializer politika kontrolünden geçmeyen olay dışarı yazılmaz.

Operasyonel tanı yazma yolu ham `message/details` değerini saklamaz. Koddan türetilen sabit teknik mesaj ve kaynak sinyalin SHA-256 hash'i kaydedilir. Repository aynı denetimi doğrudan çağrıda tekrar uygular; read-back sırasında politika dışı veya bozuk kalıcı satır fail-closed reddedilir. Tanı raporu ve arşivi kullanıcı hedef adları/yolları, queue payload'ları ve serbest hata metinleri yerine yalnız teknik skor, sayaç ve content-free kayıt taşır.

Tipli `system:getSensitiveLoggingBoundary` IPC/preload/domain sözleşmesi sıfır argümanlı ve no-cache'tir. Sistem ekranında yalnız politika duruşu gösterilir; payload, yol, secret veya receipt gösterilmez. Statik üretim kapısı bütün `apps/*/src` ve `packages/*/src` alanlarında console/stream, plaintext sink, serializer, diagnostic SQL ve ham metadata kaçışlarını sıfır istisnayla reddeder.

## Şema kararı

Yeni migration eklenmez; latest migration 77 kalır. Mevcut `diagnostic_entries` tablosunun sahipliği veya fiziksel şeması değiştirilmez. Yeni yazımlar content-free olur, mevcut politika dışı satırlar okunurken fail-closed reddedilir. Gerçek veri taşıma, historical backfill ve cutover yapılmaz.

## Gerçeklik sınırı

PPK-017 gerçek OCR motoru çalıştırmaz, OCR/payload üretmez veya taşımaz. Karar, policy sürümü, yükümlülükler ve reddetme nedeninin değişmez audit zinciri PPK-018'in ayrı kabul şartıdır; PPK-017 bunu tamamlamış sayılmaz. Desktop kasası ve aktif SQLite sahipliği korunur, Core Service family-data oturumu bağlanmaz ve DEC-171 cutover yasağı kaldırılmaz.

PPK-012 çevrimdışı capability lease ve hassas önbellek/no-cache çiti; PPK-013 doğrudan veri erişim yasağı; PPK-014 sürümlü Core API; PPK-015 ağ egress ve PPK-016 türetilmiş veri mirası gevşetilmez.

## Sonuç

PPK-017 `COMPLETE` olarak kapanmıştır. Yeni metadata sınıfı, yeni sink, farklı kalıcı tanı alanı veya kullanıcı semantiğini loglama ihtiyacı ayrı kapsam, açık karar ve güvenlik kanıtı gerektirir.
