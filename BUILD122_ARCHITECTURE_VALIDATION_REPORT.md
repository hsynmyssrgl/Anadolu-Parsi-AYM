# Build 122 Mimari Doğrulama Raporu

- Uygulama sürümü: `26.07.2026.122`
- Paket sürümü: `26.7.2026-122`
- Aşama: **Bronze RC2 Active Development**

## Doğrulanan sınırlar

- Electron main/preload çıktısı workspace TypeScript derleyicisiyle üretiliyor.
- Renderer yalnız tarayıcı-güvenli `@ppt/domain/renderer` alt yolunu kullanıyor.
- Kök TypeScript yapılandırması bu alt yolu doğrudan kaynağa eşliyor; temiz
  kaynak kontrolü eski `dist` çıktılarına bağlı değil.
- Kişisel veri görünürlüğü yalnız açık nesne izniyle genişletilebiliyor.
- AI onayının varsayılan başlangıç zamanı transaction saatinden geliyor.
- RC2 kapı sırası clean install → typecheck → test → build → smoke → Windows
  launch → installer biçiminde.
- Tanı amaçlı güvenlik istisnaları ayrı kanıt dosyası ve
  `DIAGNOSTIC_PASS/DIAGNOSTIC_FAIL` durumu kullanıyor.
- Windows paketleme hedefi yalnız NSIS; kullanılmayan Squirrel.Windows yolu
  fail-closed ve bağımlılık ağacından çıkarılmış durumda.
- Güvenli araç sürümleri ve yerel uyumluluk paketi ayrı bir kaynak
  sözleşmesiyle doğrulanıyor.
- Windows yaşam döngüsü betiği PowerShell 5.1 için güvenli argüman fallback’i
  ve BOM’suz UTF-8 kanıt çıktısı kullanıyor.
- Tanısal yaşam döngüsü resmî kanıttan ayrı dosyaya yazılıyor ve yalnız
  `DIAGNOSTIC_PASS/DIAGNOSTIC_FAIL` sonucu üretebiliyor.
- Test kurulumu mevcut kullanıcıya ve `.tmp` altındaki benzersiz dizine
  sabitleniyor; mevcut kullanıcı kurulumu varsa üzerine yazılmıyor.
- Ayrık çalışan kaldırıcı için 30 saniyelik sınırlı bekleme uygulanıyor ve
  dosya ile kayıt defteri kalıntısı ayrı ayrı denetleniyor.
- Electron `43.2.0` tam olarak sabitlenmiş durumda; runtime bootstrap hem eski
  hem yeni Electron cache değişkenini izinli doğrulama dizinine yönlendiriyor.
- Tek tıklamalı Final doğrulayıcısı tanısal sonuçları resmî kabul etmiyor; RC2,
  resmî Windows yaşam döngüsü ve iki npm audit kapısını zorunlu çalıştırıyor.
- Tek tıklamalı doğrulayıcının npm önbelleği kaynak paket içindeki izinli
  `artifacts/validation` alanına sabitleniyor.
- NSIS lisans ekranı, kod sayfasına bağlı olmayan ASCII RTF ve açık Unicode
  kaçışları kullanıyor; RTF içeriği kanonik UTF-8 lisans metniyle karşılaştırılıyor.

## Sonuçlar

- Build 122 mimari sözleşmesi: **PASS — 69 assertion**
- Build toolchain güvenlik sözleşmesi: **PASS — 64 assertion**
- Production ve build-toolchain audit: **PASS — 0/0 bulgu**
- Temiz kaynak tam tip kontrolü: **PASS**
- Temiz kaynak birim/entegrasyon: **PASS — 57/57**
- Temiz kaynak production build: **PASS**
- Bronze smoke: **PASS**

Windows native launch bu mimari PASS kapsamına dahil değildir ve ayrı kapıda
FAIL durumundadır.
