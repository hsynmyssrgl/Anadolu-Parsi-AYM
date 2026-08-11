# Build 151 Mimari Doğrulama Raporu

## Kapsam

Build 151'in tek ana konusu, Build 150'de kalan dış bağımlılık engelini kalıcı
bir taşınabilir edinme akışıyla çözmektir. Uygulama işlevi veya kullanıcı verisi
kapsamı değiştirilmemiştir.

## Mimari kararlar

### 1. Edinme planı kilit dosyasına bağlıdır

`npm-dependency-acquisition-plan.json`, aktif `package-lock.json` SHA-256 değeri,
paket sürümü, resmî tarball URL'leri, SHA-512 bütünlükleri ve içerik adresli arşiv
yollarını taşır. Değiştirilmiş plan veya farklı kaynak ağacı fail-closed reddedilir.

### 2. Yalnız resmî npm HTTPS kaynağı kabul edilir

Üretim edinme yolu yalnız `https://registry.npmjs.org/` origin'ine izin verir.
HTTP, başka origin ve başka origin'e yönlendirme reddedilir.

### 3. İndirme güvenle sürdürülebilir

Daha önce indirilmiş tarball ancak normal dosya olması ve SHA-512 değerinin kilit
dosyasıyla tekrar eşleşmesi hâlinde kullanılır. Bozuk dosya silinir ve yeniden
alınır. Yarım dosya atomik yeniden adlandırma tamamlanmadan geçerli sayılmaz.

### 4. Çıktı mevcut cache formatıyla uyumludur

İndirilen paketler deterministik `PPT_NPM_CACHE_TRANSFER_BUNDLE` ZIP'ine çevrilir.
Bu ZIP mevcut doğrulayıcı, cache içe aktarıcı ve `npm ci --offline --ignore-scripts`
yoluyla kullanılabilir.

### 5. Bağlantılı makine yardımcıları

- `scripts/fetch-npm-dependencies-connected-machine.ps1`
- `scripts/fetch-npm-dependencies-connected-machine.sh`
- `tools/npm-dependency-acquisition/README_TR.md`

## Hedefli fixture sonucu

Üç yerel npm paketi resmî URL sözleşmesini taklit eden kilit dosyasıyla paketlendi.
Plan doğrulama, güvenli yeniden kullanım, bozuk dosyanın yeniden alınması, geçici
`EAI_AGAIN` hatasında retry, deterministik bundle, cache içe aktarma ve gerçek
çevrimdışı `npm ci` birlikte **PASS — 35/35** verdi.

## Gerçek ortam sınırı

Mevcut çalışma ortamında genel DNS erişimi kapalıdır. Gerçek 117 tarball için
edinme denemesi ilk resmî npm isteğinde `EAI_AGAIN` ile durmuştur. Bu nedenle
bağımlılık bundle'ı bu ortamda üretilememiş ve geniş kapılar PASS olmamıştır.
