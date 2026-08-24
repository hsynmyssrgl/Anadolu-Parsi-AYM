# DEC-269 — Bronze, Silver ve Gold kurulum, veri ve kaynak yalıtımı

- Tarih: 23.08.2026
- Durum: SUPERSEDED_BY_DEC-271
- Tarihsel kural: PR-234 (PR-236 ile superseded)

## Karar

Bronze, Silver ve Gold ayrı ürün kanalları olarak kurulur ve çalışır. Teknik kurulum hedefleri sırasıyla C:\Program Files\PPT\ParsYuva\Bronze, C:\Program Files\PPT\ParsYuva\Silver ve C:\Program Files\PPT\ParsYuva\Gold olur. Ana program dosyası ParsYuva-<Kanal>.exe, masaüstü ve Başlat menüsü kısayolu ParsYuva <Kanal> biçimindedir. appId, productName, uninstall kapsamı ve kullanıcı veri kökü kanal kimliğini taşır.

Bir kanalın kurulumu, yükseltmesi, bakımı veya kaldırılması diğer kanalın program dosyalarını ya da kullanıcı verisini değiştiremez. Dağıtım dosyası ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe biçimini korur. Kullanıcıya görünen ana ürün adı ParsYuva Aile Yaşam Merkezi olarak kalır.

Kaynak çalışma alanları C:\PPT\AYM\06_KOD\kanallar\<Kanal> altında ayrı Git worktree ve ayrı branch olarak oluşturulur. Doğrudan klasör kopyası, kanal branch'ini paylaşma, build çıktısını veya kullanıcı veri kökünü kanallar arasında yeniden kullanma yasaktır. Worktree kurulumu yalnız temiz ve commitlenmiş otorite deposundan yapılabilir.

## Değiştirdiği karar

Bu karar DEC-262 ve PR-228'in ortak kurulum dosyası, ortak appId ve ortak kullanıcı veri dizini hükümlerini supersede eder. DEC-262 tarihsel kayıttır; dağıtım EXE adlandırma ve görünür uzun ürün adı hükümleri PR-234 içinde korunur.

## Doğrulama

- packages/domain/src/app-meta.ts kanal kimliği üreticileri
- apps/desktop/package.json ve apps/desktop/build/installer.nsh
- config/release-channel-worktrees.json
- scripts/setup-release-channel-worktrees.mjs
- scripts/verify-product-brand-identity.mjs
- apps/desktop/tests/product-brand-identity.test.ts
- apps/desktop/tests/release-channel-isolation.test.ts

Gerçek worktree oluşturma temiz çalışma ağacı ve final kaynak commit'i sonrasında çalıştırılır. Oluşturulmamış worktree mevcut sayılmaz.

## Supersession

Bu kararın `C:\Program Files\PPT\ParsYuva\<Kanal>` biçimindeki nested program kökü DEC-271 ve PR-236 ile superseded edilmiştir. appId, productName, kanal EXE/kısayol kimliği, `ParsYuva/<Kanal>` kullanıcı verisi ve ayrı Git worktree/branch yalıtımı DEC-271 içinde korunmuştur.
