# Clean Backup Rewrite Finalization Ledger V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Build 183 temiz yedek akışının her denemesini atomik, yeniden başlatmaya dayanıklı
ve kullanıcıya görünür bir çalışma kaydıyla sonuçlandırmak; gerçek SQLite bağlayıcı
ve alan sırası hatalarını kaynak kapısında yakalamaktır.

## Kalıcı model

`backup_clean_rewrite_runs` tablosu şu alanları tutar: çalışma kimliği, tetikleyici,
durum, saklama kesimi, süresi dolmuş kayıt sayısı, etkin hedef sayısı, bağlı
propagation çalışma kimliği, sonraki deneme, hata, başlangıç, tamamlanma ve güncelleme
zamanı. Durumlar: `running`, `success`, `partial`, `failed`, `attention`, `deferred`
ve `interrupted`.

## Atomik sonuçlandırma sözleşmesi

1. Politika satırı `state=running` ve `in_progress_run_id=<runId>` olmalıdır.
2. Aynı kimlikli çalışma defteri satırı `status=running` olmalıdır.
3. Politika ve defter güncellemelerinin ikisi de tam bir satır değiştirmelidir.
4. Herhangi biri değişmezse işlem hata verir ve repository unit-of-work rollback
   uygular.
5. Başarı `consecutive_failures=0`, `last_success_at=completedAt` ve boş backoff
   üretir.
6. `failed` veya `partial` hata sayısını artırır ve backoff/hata bilgisini saklar.
7. Kesilen sahiplik `interrupted` çalışma kaydı ve otomatik 360 dakika geri çekilme
   ile uzlaştırılır.

## Görünürlük

Güvenlik Merkezi, son temiz yedek denemelerini durum, tetikleyici, kayıt/hedef
sayısı, zaman, hata ve sonraki denemeyle listeler. Ham kullanıcı içeriği, parola,
TOTP veya yedek sırrı bu deftere yazılmaz.

## Doğrulama

Bronze kaynak kapısı sözleşme, bellek içi servis davranışı, gerçek SQLite
regresyonu ve kontrollü TypeScript'i çalıştırır. Temiz kurulum, tam test paketi,
production build, gerçek disk kesintisi, kullanılabilirlik ve Windows/installer
kanıtı Silver'da `NOT_RUN` durumundan çıkarılır.
