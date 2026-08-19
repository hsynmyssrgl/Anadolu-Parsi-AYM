# Kullanici Akislari

## A. Ilk kurulum

1. Installer sistem dilini ve etkin surum kanalini belirler.
2. Gercek dosya ilerlemesi tek ilerleme cubugunda gosterilir.
3. Uygulama beyaz/acik temel zemin ve kanal rengiyle acilir.
4. Sesli tanitim veya gorunur anlatim metni sunulur.
5. Aile adi, yonetici adi ve yerel parola alinır.
6. Parola goster/gizle ve kural kontrolleri erisilebilirdir.
7. MFA/kurtarma kurulumu tamamlanir.
8. Aile alani atomik olarak olusturulur; hata varsa alan bazli mesaj gosterilir.

Kabul: Kurulum simulasyon ilerlemesi kullanmaz; aile olusturma ya tam tamamlanir ya veri birakmadan geri alinir.

## B. Gunluk kullanim

1. Kullanici yerel profilini secer ve oturum acar.
2. Dashboard yetkili aile ozeti gosterir.
3. Sol menu ve arama aktif modullere erisim verir.
4. Hassas moduller ek izin/riza durumunu gosterir.
5. Kapatma carpisi uygulamayi tepsiye alir.
6. `Tamamen kapat` secenegi kontrollu kapanis ve gecici dosya temizligi yapar.

## C. Kayit olusturma ve duzeltme

1. Kullanici formu acar; alanlar ve izin sinirlari gorunur.
2. Istek benzersiz islem kimligi ve beklenen revision tasir.
3. Yetki merkezi policy katmaninda dogrulanir.
4. Veri, audit ve outbox ayni transactionda yazilir.
5. Hata durumunda yeniden deneme ayni kimlikle guvenli ve idempotenttir.

## D. Yedekleme ve geri yukleme

1. Kullanici bir veya birden fazla yerel/senkron klasor hedefi secer.
2. Dis servis hedefi icin kullanici oturumu ve OAuth izni gerekir.
3. Sifreli yedek yazilir, geri okunur, boyut ve SHA-256 dogrulanir.
4. Geri yukleme oncesi mevcut veri icin guvenlik kopyasi ve migration plani uretilir.
5. Basarisizlikta mevcut calisir veri korunur.

## E. Fabrika ayarina donus

1. Ayarlar ekraninda acik tehlike metni ve Evet/Hayir secimi gosterilir.
2. Yeniden kimlik dogrulama gerekir.
3. Kullanici verisi, yonetilen yerel kopyalar ve kayitli yonetilen yedek hedefleri envanterlenir.
4. Silme kaniti olmayan hedef `pending` kalir; gercek disi tam silme iddiasi verilmez.
5. Islem sonunda uygulama ilk kurulum durumuna doner.

## F. Guncelleme

1. Paket kimligi ve imza dogrulanir.
2. Mevcut veri formati tespit edilir.
3. Migration oncesi geri donus kopyasi alinir.
4. Migration atomik uygulanir ve sema parmak izi dogrulanir.
5. Yeni uygulama ayni aile verisiyle acilir.
6. Sorunda onceki veri ve calisabilir surume geri donus plani kullanilir.

## G. Kaldirma

1. Kullaniciya verileri koru/yedekle veya tamamen sil secimi sunulur.
2. Yedek seceneginde secili hedeflere dogrulanmis sifreli kopya yazilir.
3. Tam silmede acik onay ve yonetilen hedef siniri anlatilir.
4. Uygulama dosyalari kaldirilir; secilen veri karari receipt ile kaydedilir.

