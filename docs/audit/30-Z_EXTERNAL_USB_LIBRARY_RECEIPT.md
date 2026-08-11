# 30-Z harici USB Library makbuzu denetimi

## Yetki ayrımı

- Aktif düzenlenebilir kaynak: `C:\PPT\AYM\06_KOD\app`
- Dondurulmuş 30-Z paket kaynağı: `C:\PPT\AYM\09_ARSIV\KAYNAK_AGACI\checkpoints\30-Z_PPK-002_Location_Policy_Enforcement`
- Harici Library: `D:\AYM_LIBRARY\Panthera pardus tulliana\Anadolu Parsı Aile Yaşam Merkezi\Bronze 04.08.2026.29\checkpoints\30-Z_PPK-002_Location_Policy_Enforcement`
- Depolama ortamı: `EXTERNAL_USB_D_DRIVE`
- Google Drive `G:` yolu: yalnızca tarihsel makbuzlarda korunur; 30-Z için aranmaz ve kullanılmaz.

## Başarı ölçütü

Kapanış aracı 20 dondurulmuş paket dosyasını D’den geri okuyarak boyut ve SHA-256 eşitliğini doğrular. Ardından beş makbuz/geri-okuma envanteri ve bunların SHA-256 yan dosyalarıyla D üzerindeki nihai 30 dosyalık kümenin tamlığını doğrular.

Tek yükleme paketinin sabit SHA-256 değeri:

`1daa9c35949ba78c81c03736809d253940fa114706cfdfbd274d96717219eb54`

## İddia sınırı

Bu makbuz resmî ve dondurulmuş 30-Z checkpoint’ini kapatır. Güncel C kaynak ağacının daha sonraki değişikliklerini harici olarak korunmuş saymaz. PPK-002 `PARTIAL`, yeni Build `false`, Silver/Gold ve çalıştırılmamış kontroller PASS değildir.

Karar kaydı: `docs/decisions/DEC-158-30-z-external-usb-library-receipt.md`
