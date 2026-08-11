# Build 152 Mimari Doğrulama Raporu

## Kapsam

Build 152'nin tek ana konusu, bağlantılı bir makinede üretilen npm cache aktarım
paketinin çevrimdışı geliştirme ortamında güvenli biçimde kabul edilmesi,
karantinaya alınması ve atomik cache aktarımıdır. Uygulama işlevi veya kullanıcı
verisi kapsamı değiştirilmemiştir.

## Mimari kararlar

### 1. ZIP tek başına güvenilir kabul edilmez

Kabul komutu ZIP ile birlikte dosya adına bağlı `.sha256` yan dosyasını zorunlu
kılar. Dosyalar normal dosya olmalı; sembolik bağlantı, hatalı uzantı, aşırı boyut,
çok satırlı veya farklı dosya adını gösteren checksum reddedilir.

### 2. Aktif kaynak ağacına bağlı doğrulama

Paket aktif `package-lock.json` SHA-256 değeri ve `29.7.2026-152` paket sürümüyle
yeniden doğrulanır. Deterministik ZIP yapısı ve her tarballın lockfile SHA-512
değeri geçmeden kabul işlemi başlamaz.

### 3. Atomik kabul ve cache aktarımı

Başarılı ZIP önce içerik hash'iyle adlandırılan kabul alanına atomik yazılır.
Ardından yeni ve boş npm cache staging alanına aktarılır; `0/N` veya kısmi cache
kabul edilmez. Mevcut cache varsayılan olarak üzerine yazılmaz.

### 4. Makbuz ve tekrar çalıştırma güvenliği

Kabul makbuzu lockfile hash'i ve ZIP hash'iyle adlandırılır, ayrı SHA-256 dosyası
üretilir ve `current-accepted.json` işaretçisi atomik güncellenir. Aynı sağlam
paket tekrar sunulursa cache yeniden yazılmaz; makbuz ve cache bütünlüğü tekrar
kontrol edilerek `ALREADY_ACCEPTED` sonucu döner.

### 5. Karantina

Checksum, sürüm, lockfile, ZIP veya tarball bütünlüğü geçmeyen paket kabul alanına
giremez. ZIP, mevcut checksum ve red makbuzu ayrı karantina alanına taşınır.

## Hedefli fixture sonucu

İki yerel npm paketiyle gerçek deterministik transfer ZIP'i üretildi. Sağlam kabul,
atomik cache import, gerçek çevrimdışı `npm ci`, idempotent tekrar, checksum
bozma, checksum biçimi/dosya adı, ZIP bozma, sürüm uyuşmazlığı, uzantı, mevcut
cache ve makbuz kurcalama senaryoları birlikte **PASS — 26/26** verdi.
