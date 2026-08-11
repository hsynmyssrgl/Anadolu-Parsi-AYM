# Panthera pardus tulliana Aile — Bronze RC2 Build 91

## Sürüm
- Uygulama: `24.07.2026.91`
- Paket: `24.7.2026-91`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Tanılama raporlarının ve bakım geçmişi dışa aktarımlarının hedef dosyaya yazılması, dosya boyutu ile SHA-256 özetinin üretilmesi `FamilyDataStore` içinden çıkarıldı. Sıkıştırılmış tanılama arşivlerinin GZIP olarak yazılması ve doğrulanmış biçimde açılması da aynı application portu üzerinden masaüstü dosya sistemi adaptörüne taşındı.

Dışa aktarım kaydı, tanılama raporu geçmişi, tanılama arşivi geçmişi, audit ve arşivleme sonrası veritabanı temizleme sırası korunmuştur. Kayıp dosya doğrulamasının `exists=false`, bütünlük uyuşmazlığının `valid=false` üretme davranışı değişmemiştir.

## Doğrulama kapsamı
Hedef operasyonel artifact dosya sınırı, DataStore içindeki doğrudan tanılama GZIP ve rapor/dışa aktarım dosya işlemlerinin kaldırılması, sürüm sırası, workspace sürüm tutarlılığı, hedefli TypeScript sözdizimi aktarımı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, `npm typecheck`, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
