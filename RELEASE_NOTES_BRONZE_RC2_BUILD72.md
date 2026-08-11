# Panthera pardus tulliana — Bronze RC2 Aktif Geliştirme Build 72

**Kullanıcı sürümü:** 24.07.2026.72  
**Paket sürümü:** 24.7.2026-72  
**Kanal:** Bronze RC2 Aktif Geliştirme  
**Kod dondurma:** Aktif değil

## Bu sürümde yapılanlar

- Arşiv kategorilerini listeleme ve oluşturma işlemleri application/repository mimarisine taşındı.
- Arşiv sınıflandırmalarını listeleme işlemi merkezi yetkilendirme filtresiyle repository sorgusuna taşındı.
- Kategori, hassasiyet, AI işleme izni ve etiket güncellemesi tek transaction içinde çalışan use-case hattına taşındı.
- Etiket adları kırpılıyor, boş değerler kaldırılıyor, Türkçe yerel ayarlara göre büyük/küçük harf duyarsız tekilleştiriliyor ve 20 etiketle sınırlandırılıyor.
- Kategori ve sınıflandırma değişiklikleri zincirli denetim kaydıyla birlikte yazılıyor.
- DataStore içindeki ilgili doğrudan SQL ve manuel BEGIN/COMMIT/ROLLBACK bloğu kaldırıldı.

## Doğrulama

- Build 72 sınıflandırma hedef testi: 10/10 başarılı.
- Mevcut arşiv regresyon testi: 16/16 başarılı.
- Foundation, repositories ve application TypeScript derlemeleri: başarılı.
- DataStore TypeScript smoke derlemesi: başarılı.
- ZIP bütünlük doğrulaması: başarılı.

## Durum

Bu paket kaynak kod teslimidir. RC2 Final, Code Freeze, Silver veya Gold paketi değildir.
