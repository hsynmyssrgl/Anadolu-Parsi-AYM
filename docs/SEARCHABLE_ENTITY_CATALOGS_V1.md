# Arama Destekli Kişi ve Olay Katalogları — v1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Büyük ailelerde kişi ve olay seçim alanlarının tam `people` veya `events`
koleksiyonuna bağımlı olmasını kaldırmak; aile ekranı, ilişki/olay modalları ve
ortak filtreleri arama destekli, sınırlı ve kararlı sayfalarla çalıştırmak.

## Katalog sözleşmesi

Main process üç API sunar:

- `catalog:listPeople`: etkin kişileri ad + kimlik keyset sırasıyla döndürür.
- `catalog:listEvents`: olayları tarih + kimlik keyset sırasıyla döndürür.
- `catalog:lookup`: yalnız seçili kimliklerin sınırlı çözümlemesini yapar.

Varsayılan sayfa 40, kabul edilen sayfa aralığı 10–100 kayıttır. Arama metni en
fazla 120, imleç en fazla 512 karakterdir. Tek lookup çağrısı kişi ve olay başına
en fazla 100 kimlik kabul eder.

## İmleç ve izin sınırı

İmleç; sürüm, katalog türü, son sıralama anahtarı ve SHA-256 kapsam özeti taşır.
Kapsam özeti kullanıcı hesabı ile etkin arama/filtreleri bağlar. Başka kullanıcı,
arama, kişi filtresi, olay türü veya arşiv modunda tekrar kullanılan imleç
fail-closed reddedilir.

İmleç yetkilendirme kanıtı değildir. Olay satırları ve lookup sonuçları
`canReadEvent` nesne izninden geçmeden renderer'a dönmez.

## Renderer kullanım alanları

- Aile ekranı: 30 kişilik sayfalar, ad araması ve seçili kişi için en fazla 10 olay.
- İlişki oluşturma: iki bağımsız kişi kataloğu.
- Olay oluşturma/düzenleme: aramalı çoklu kişi seçimi ve seçili etiketler.
- Zaman tüneli: kişi filtresi katalogdan seçilir.
- Arşiv: bağlı olay filtresi katalogdan seçilir.
- Yetkiler/profil: bağlı kişi seçimi katalogdan yapılır.

Seçili kimlik arama sonucunda görünmese bile `catalog:lookup` ile sınırlı olarak
çözümlenir; tam koleksiyon yüklenmez.

## Veritabanı ve sıralama

Kişi katalog sırası:

```text
display_name COLLATE NOCASE ASC, id ASC
```

Olay katalog sırası:

```text
start_at DESC, id DESC
```

Migration 26 etkin kişi katalog sırasını destekleyen
`idx_people_entity_catalog` indeksini ekler. Olay kataloğu mevcut olay sıralama
indekslerini kullanır.

## Sınırlar

Bu kaynak değişikliği gerçek Windows render süresini, tam Electron production
build'ini veya installer yaşam döngüsünü kanıtlamaz. Bunlar doğrulanmış 117
tarball bağımlılık yanıt paketi döndükten sonra geniş RC2 kapılarında çalıştırılır.
