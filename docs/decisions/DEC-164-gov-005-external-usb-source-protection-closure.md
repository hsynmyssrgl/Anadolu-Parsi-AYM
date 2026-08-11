# DEC-164 — GOV-005 haricî USB ana kaynak koruması kapanışı

## Durum

ACTIVE — kullanıcı D: haricî disk işlemleri için açık onay verdi.

## Karar

`C:\PPT\AYM\06_KOD\app` tek yetkili ve düzenlenebilir kaynak ağacıdır. Ana kaynak koruması, eski Google Drive `G:` yolu aranmadan veya kullanılmadan, yalnız aşağıdaki D: USB Library kökünde oluşturulur:

`D:\AYM_LIBRARY\Panthera pardus tulliana\Anadolu Parsı Aile Yaşam Merkezi\Bronze 04.08.2026.29\authoritative-source`

Yerel deterministik ZIP, kaynak envanteri ve SHA-256 makbuzu üretildikten sonra aynı byte’lar D: hedefine kopyalanır. Dosya sayısı, boyut ve SHA-256 geri-okuması PASS olmadan `GOV-005` kapanmış sayılmaz.

## Tarihsel sınır

Eski `G:\Drive'ım` makbuzları tarihsel ve değişmez kanıttır. Aktif kaynak, hedef veya fallback değildir; yeniden yazılmaz.

## Sonuç

Haricî makbuz `05_TEST/30Z_EXTERNAL_RECEIPT/LATEST.json` ile bağlanır. `GOV-005` yalnız bu makbuz `PASS`, storage backend `EXTERNAL_USB_D_DRIVE` ve resmî tamamlanma iddiası doğru olduğunda `COMPLETE` kabul edilir. Bu karar yeni Build vermez.
