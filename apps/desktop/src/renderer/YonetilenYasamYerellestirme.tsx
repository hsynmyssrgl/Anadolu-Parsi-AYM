import { Children, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { SupportedUiLanguage } from '@ppt/domain';

const exactCopy: Readonly<Record<string, string>> = {
  'Abonelik':'Subscription','active':'Active','cancelled':'Canceled','completed':'Completed','expired':'Expired','planned':'Planned',
  'adet':'items','doz':'doses','litre':'liters','metre':'meters','Acil durum kayıt türü':'Emergency record type','Acil durum planı':'Emergency plan',
  'Acil durum merkezi':'Emergency center','açık':'enabled','açıldı':'enabled','kapalı':'disabled','kapatıldı':'disabled',
  '· Düzeltme kaydı':'· Correction record','· düzeltme kaydı':'· correction record','· henüz kontrol edilmedi':'· not checked yet',
  'Acil durum planı yok':'No emergency plan','Acil durum tatbikatı':'Emergency drill','Acil iletişim':'Emergency contact',
  'Acil kart dışa aktarılamadı.':'The emergency card could not be exported.','Acil kart irtibatı':'Emergency-card contact',
  'Acil kart taşınabilirlik doğruluk sınırı':'Emergency-card portability truth boundary','Acil sağlık kartı':'Emergency health card',
  'Acil sağlık kartı bilgisi':'Emergency health-card information','Acil sağlık ve iletişim kartı':'Emergency health and contact card',
  'Acil sağlık ve iletişim kartları':'Emergency health and contact cards','Açık':'Open','Adres etiketi':'Address label',
  'Adres girilmedi':'No address entered','Afet / tahliye planı':'Disaster / evacuation plan','Aile':'Family',
  'Aile için kısa, uygulanabilir adımlar':'Short, actionable steps for the family','Aile üyesi':'Family member',
  'Aile üyesi durumu':'Family-member status','Aktif':'Active','Alan':'Field','Alan / oda (isteğe bağlı)':'Area / room (optional)',
  'Alan adı':'Area name','Alan seçimi kaydedilemedi.':'The field selection could not be saved.','Alan türü':'Area type',
  'Alanı yapılandırmaya ekle':'Add field to configuration','Alerji':'Allergy','Alet / ekipman':'Tool / equipment',
  'Alınmadı':'Not obtained','Alternatif buluşma noktası':'Alternate meeting point','Araç':'Vehicle','Araç / gereç':'Tool / supply',
  'Araç kiti':'Vehicle kit','Araç ruhsatı':'Vehicle registration','Araç sigorta poliçesi':'Vehicle insurance policy',
  'Araç türü':'Vehicle type','Arsa':'Land','Aydınlatma / güç':'Lighting / power','Aylık':'Monthly','Azaldı':'Low',
  'Bahçe':'Garden','Bakım':'Maintenance','Banyo':'Bathroom','Başlangıç':'Start','Başlık':'Title',
  'Başvuru alındısı':'Application receipt','Belge / sertifika':'Document / certificate','Belge bağı':'Document link',
  'Belge bağını ekle':'Add document link','Belge bağı kaydedilemedi.':'The document link could not be saved.',
  'Belge hedefi':'Document target','Belge içeriği bu forma girmez.':'Document content is not entered into this form.',
  'Belge kopyası':'Document copy','Belge türü':'Document type','Belirtilmedi':'Not specified',
  'Beyaz eşya / cihaz':'Appliance / device','Bildirim zamanı':'Reminder time','Bilgi türü':'Information type','Bilinmiyor':'Unknown',
  'Bilişsel destek':'Cognitive support','Birim':'Unit','Birincil buluşma noktası':'Primary meeting point','Bitiş':'End',
  'Bir aile üyesi veya evcil hayvan için özel acil sağlık ve yardım profili oluşturabilirsiniz.':'You can create a private emergency health and assistance profile for a family member or pet.',
  'Bu çıktı için açık seçimler':'Explicit selections for this export','Bu düğme acil servis çağırmaz.':'This button does not call emergency services.',
  'Bu işlem özel sağlık ve iletişim verisinin yerel bir kopyasını oluşturabilir.':'This operation may create a local copy of private health and contact data.',
  'Bu işlemde dışa aktarılacak alanlar':'Fields to export in this operation','Bu kite henüz malzeme eklenmedi.':'No supplies have been added to this kit yet.',
  'Bu parola yalnız bu çağrıda kullanılır; saklanmaz, loglanmaz, denetime veya sonuca eklenmez.':'This passphrase is used only for this request; it is not stored, logged, audited, or added to the result.',
  'Bulunduğu alan (isteğe bağlı)':'Located area (optional)','Buluşma noktaları':'Meeting points','Buluşma noktası':'Meeting point',
  'Buluşma noktası etiketi':'Meeting-point label','Çalışma alanı doğruluk beyanı':'Workspace truth statement',
  'Çevrimdışı acil durum kaydı':'Offline emergency record','Çevrimdışı acil kart çıktısı':'Offline emergency-card export',
  'Çevrimdışı aile kaydıdır; acil yardım çağrısı değildir.':'This is an offline family record, not an emergency assistance call.',
  'Çevrimdışı kart yapılandırması kaydedildi.':'The offline card configuration was saved.','Çıktı biçimi':'Output format',
  'DASK poliçesi':'DASK earthquake insurance policy','DASK':'DASK','Değiştirilmeli':'Replace','Depo':'Storage','Deprem':'Earthquake',
  'Dışa aktarma kullanıcı tarafından iptal edildi.':'Export was canceled by the user.','Diğer':'Other','Diğer alan':'Other area',
  'Diğer belge':'Other document','diğer birim':'other unit','Diğer eşya':'Other belonging','Diğer kit':'Other kit',
  'Diğer özel yardım':'Other special assistance','Diğer sağlık bilgisi':'Other health information','Diğer sayaç':'Other meter',
  'Doğal gaz':'Natural gas','doğrulanmadı':'not verified','Döngü':'Cycle','Dönem':'Term',
  'Durum':'Status','Durum yalnız yerel plana yazılır.':'The status is written only to the local plan.',
  'Durumu bildirilen üye':'Member whose status is reported','Düz PDF':'Plain PDF','Eğitim':'Education',
  'Eklenmedi':'Not added','Eksik':'Missing','Elektrik':'Electricity','Elektrik kesintisi':'Power outage','Elektronik':'Electronics',
  'Enerji':'Energy','Eşya':'Belonging','Eşya adı':'Belonging name','Eşya türü':'Belonging type',
  'Etiket (isteğe bağlı)':'Label (optional)','Etkinlik':'Activity','Etkinlik ve hatırlatma':'Activity and reminder',
  'Etkinlik / gider':'Activity / expense','Ev':'Home','Ev 72 saat kiti':'Home 72-hour kit','Ev alanı / oda':'Home area / room',
  'Ev alanı ve envanter':'Home areas and inventory','Ev envanteri kayıt türü':'Home-inventory record type',
  'Ev envanteri olayı':'Home-inventory event','Ev geneli':'Whole home','Ev profili':'Home profile','Evcil hayvan':'Pet',
  'Evcil hayvan bakımı':'Pet care','Fatura':'Invoice','Garaj':'Garage','Garanti':'Warranty','Garanti belgesi':'Warranty document',
  'Genel acil durum':'General emergency','Gerçekleşme zamanı':'Occurrence time','Gıda':'Food','Gider':'Expense',
  'Giyim / barınma':'Clothing / shelter','Gizlilik':'Privacy','Görme desteği':'Vision assistance',
  'Güç kipi kaydedilemedi.':'The power mode could not be saved.','Güvenli çıktı hazırlanıyor…':'Preparing secure output…',
  'Ham belge veya dosya yolu değil':'Not a raw document or file path','Hareket desteği':'Mobility assistance','Hazır':'Ready',
  'Hatırlatma (isteğe bağlı)':'Reminder (optional)','Hatırlatma zamanı':'Reminder time','Hazırlık doğruluk sınırı':'Preparedness truth boundary','Hazırlık kiti':'Preparedness kit','Hazırlık kitleri':'Preparedness kits',
  'Hedef miktar':'Target quantity','Hedef türü':'Target type','Hedef miktar en fazla üç ondalıklı ve sıfırdan büyük olmalıdır.':'Target quantity must have at most three decimal places and be greater than zero.','Henüz acil irtibat yok.':'No emergency contacts yet.',
  'Henüz alan seçimi kaydedilmedi.':'No field selection has been saved yet.','Henüz belge bağı kaydedilmedi.':'No document link has been saved yet.',
  'Henüz buluşma noktası yok.':'No meeting points yet.','Henüz hazırlık kiti yok.':'No preparedness kits yet.',
  'Henüz kontrol maddesi yok.':'No checklist items yet.','Henüz manuel sağlık bilgisi yok.':'No manual health information yet.',
  'Henüz özel yardım talimatı yok.':'No special assistance instructions yet.','Henüz şehir dışı irtibat yok.':'No out-of-town contacts yet.',
  'Henüz tatbikat kaydı yok.':'No drill records yet.','Henüz üye durum bildirimi yok.':'No member status reports yet.',
  'Henüz pil-duyarlı kip olayı yok.':'No battery-aware mode event yet.','Hesap parolası':'Account password','Hibrit':'Hybrid',
  'Hijyen':'Hygiene','İddia edilmiyor':'Not claimed','İkinci faktör kodu (etkinse)':'Second-factor code (if enabled)',
  'İlaç':'Medication','İlaç desteği':'Medication assistance','İletişim':'Communication','İletişim desteği':'Communication assistance',
  'İlk hatırlatma':'Initial reminder','İlk yardım':'First aid','İptal':'Canceled','İptal edildi':'Canceled',
  'İrtibat adı':'Contact name','İstihdam':'Employment','İş yeri':'Workplace','İş yeri kiti':'Workplace kit',
  'İşitme desteği':'Hearing assistance','İşlem türü':'Operation type','İşveren':'Employer','İyiyim':'I am safe',
  'Kan grubu':'Blood type','Kapalı matristen seçilen alan kaydedildi.':'The field selected from the closed matrix was saved.','Kart':'Card',
  'Kapat':'Disable','Kart acil irtibatı':'Card emergency contact','Kart etiketi':'Card label','Kart konusu':'Card subject',
  'Kasko':'Comprehensive insurance','Kategori':'Category','Kayıt eklenemedi.':'The record could not be added.',
  'Kayıt güvenli yerel deftere eklendi.':'The record was added to the secure local ledger.','Kayıt sahibi':'Record owner',
  'Kayıtlı yapılandırma':'Saved configuration','Kaynak kayıt':'Source record','Kısmen tamamlandı':'Partially completed',
  'Kira':'Rent','Kira kaydı':'Rent record','Kira sözleşmesi':'Lease','Kiracı':'Tenant','Kiralık':'Rented','Kit etiketi':'Kit label',
  'Kit malzemesi':'Kit supply','Kit türü':'Kit type','Kilometre':'Odometer','Kontrol':'Inspection',
  'Kontrol durumu':'Check status','Kontrol listesi':'Checklist','Kontrol listesi durumu':'Checklist status',
  'Kontrol listesi maddesi':'Checklist item','Kontrol maddesi':'Checklist item','Kontrol zamanı':'Check time',
  'Konut':'Residence','Konut poliçesi':'Home insurance policy','Kronik durum':'Chronic condition','Kurulmadı':'Not established',
  'Kurulum':'Installation','Kullanım':'Tenure','Kurum':'Institution','Kurum / makam':'Authority / office',
  'Liste görünümünde maskelenir':'Masked in list view','Malzeme kontrolü':'Supply check','Malzeme etiketi':'Supply label',
  'Malzeme kategorisi':'Supply category','Manuel':'Manual','Manuel aç':'Enable manually','Manuel adres (isteğe bağlı)':'Manual address (optional)',
  'Manuel bilgi':'Manual information','Manuel tutar':'Manual amount','Mevcut miktar en fazla üç ondalıklı ve sıfır veya daha büyük olmalıdır.':'Current quantity must have at most three decimal places and be zero or greater.','mili-birim':'milli-unit','ml (m³ eşdeğeri)':'ml (m³ equivalent)',
  'Mobilya':'Furniture','Motosiklet':'Motorcycle','Muayene':'Inspection','Muayene raporu':'Inspection report',
  'Mutfak':'Kitchen','Mülk':'Owned','Mülk sahibi':'Owner','Normal okuma':'Normal reading','Not':'Note',
  'Not (isteğe bağlı)':'Note (optional)','Nokta türü':'Point type','Numara yalnız yetkili aile çalışma alanında tam gösterilir; sağlayıcıya, loga veya dışa aktarıma gönderilmez.':'The number is shown in full only in the authorized family workspace; it is not sent to a provider, log, or export.',
  'Numara yalnız yetkili özel kartta gösterilir; mesaj gönderilmez, aranmaz veya loglanmaz. Yerel çıktıya ancak ayrıca açıkça seçilip güçlü yeniden doğrulama yapılırsa eklenir.':'The number is shown only on the authorized private card; it is not messaged, called, or logged. It is added to local output only after explicit selection and strong reauthentication.',
  'Okuma değeri':'Reading value','Okuma türü':'Reading type','Okuma zamanı':'Reading time','okuma doğrulandı':'readback verified','Onarım':'Repair','Opak arşiv bağı:':'Opaque archive link:','Oluşturulmadı':'Not created',
  'Opak arşiv belge bağı kaydedildi; içerik bu aşamada okunmadı.':'The opaque archive-document link was saved; its content was not read at this stage.',
  'Opak arşiv öğesi kimliği':'Opaque archive-item ID','Opak evcil hayvan kimliği':'Opaque pet ID',
  'Opak finans gideri kimliği (isteğe bağlı)':'Opaque finance-expense ID (optional)','Otomobil':'Car','Oturma odası':'Living room',
  'Ödeme':'Payment','Ölçülmedi':'Not measured','Önceki aynı tür kaydı düzelt (isteğe bağlı)':'Correct a previous record of the same type (optional)',
  'Önceki kaydı düzelt (isteğe bağlı)':'Correct previous record (optional)','Örn. Antre 72 saat çantası':'E.g. entryway 72-hour bag',
  'Örn. Cüzdan acil kartı':'E.g. wallet emergency card','Örn. Evden çıkış acil kartı':'E.g. home-evacuation emergency card',
  'Örn. Gaz vanasını kapat':'E.g. close the gas valve','Örn. İçme suyu':'E.g. drinking water',
  'Örn. Mahalle parkı kuzey kapısı':'E.g. neighborhood park north gate','Örn. Salon':'E.g. living room','Örn. pet-yerel-01':'E.g. pet-local-01','Örn. archive-item-01':'E.g. archive-item-01',
  'özel mili-birim':'custom milli-unit','Özel':'Private','Özel · Yerel':'Private · Local',
  'Özel acil sağlık ve yardım doğruluk sınırı':'Private emergency health and assistance truth boundary',
  'Özel yardım planı':'Special assistance plan','Paket parolası (en az 12 karakter)':'Package passphrase (at least 12 characters)',
  'Para birimi':'Currency','PDF dosyasının':'PDF file','Pil-duyarlı görünüm':'Battery-aware view','Plaka (isteğe bağlı)':'License plate (optional)',
  'Plan adı':'Plan name','Plan ayrıntısı bu görünümde yetkili değil':'Plan details are not authorized in this view',
  'Plan aile görünürlüğüyle ve oturumunuza bağlı koordinatör kişiyle oluşturulur.':'The plan is created with family visibility and the coordinator person bound to your session.',
  'Plan başlığı':'Plan title','Plan türü':'Plan type','Planlandı':'Planned','Poliçe':'Policy','Pozisyon':'Position',
  'Profil':'Profile','Profil arşiv bağlantısı':'Profile archive link','Profil belgesi':'Profile document','Program':'Study program',
  'Resmî işlem':'Official operation','Resmî son tarih':'Official deadline','Sağlık':'Health','Sağlayıcı':'Provider',
  'Sağlayıcı (isteğe bağlı)':'Provider (optional)','Sağlayıcı belirtilmedi':'Provider not specified','Sağlık bilgisi':'Health information',
  'Satın alma zamanı (isteğe bağlı)':'Purchase time (optional)','Sayaç':'Meter','Sayaç belgesi':'Meter document',
  'Sayaç değişimi':'Meter replacement','Sayaç numarası değil, yerel etiket':'A local label, not the meter number',
  'Sayaç okuması':'Meter reading','Sayaç sıfırlama':'Meter reset','Sayaç etiketi':'Meter label','Sayaç türü':'Meter type',
  'Seçili üyeler':'Selected members','Seçin':'Select','Sel':'Flood','Seri':'Serial','Seri numarası (isteğe bağlı)':'Serial number (optional)',
  'Servis':'Service','Servis fişi':'Service receipt','Servis hedefi':'Service target','Servis türü':'Service type',
  'Sıfırlama / değişim açıklaması':'Reset / replacement explanation','Sigorta':'Insurance','Sigorta primi':'Insurance premium',
  'Sigorta türü':'Insurance type','Son aile üyesi durumları':'Latest family-member statuses',
  'Son kullanma tarihi (isteğe bağlı)':'Expiry date (optional)','Sonraki hatırlatma':'Next reminder','Sonuç':'Result',
  'Sorgulanmadı':'Not queried','Sorumlu aile üyesi':'Responsible family member','Sözleşme':'Contract',
  'Sözleşme sonu':'Contract end','Sıra':'Order','Su':'Water','Süre (saniye, isteğe bağlı)':'Duration (seconds, optional)',
  'Süre sonu':'Expiry','Süresi doldu':'Expired','Şarj':'Charging','Şarj fişi':'Charging receipt','Şarj miktarı':'Charge amount',
  'Şehir':'City','Şehir dışı irtibat':'Out-of-town contact','Şehir dışı irtibat adı':'Out-of-town contact name','İrtibat':'Contact',
  'Şifreli belge paketi':'Encrypted document package','Tahliye':'Evacuation','Tahliye desteği':'Evacuation assistance',
  'Tahliye talimatı':'Evacuation instructions','Tamamlandı':'Completed','tamamlandı':'completed','Tapu':'Deed','Taşınmaz türü':'Property type',
  'Tatbikat geçmişi':'Drill history','Tatbikat türü':'Drill type','Telefon':'Phone','Telefon:':'Phone:','Telefon (E.164)':'Phone (E.164)',
  'Tıbbi cihaz':'Medical device','Ticari':'Commercial','Tutar':'Amount','Ulaşım tarifi (isteğe bağlı)':'Directions (optional)',
  'Uygulanacak manuel talimat':'Manual instruction to apply','Uygulamaya özel konteyner':'Application-specific container',
  'Üç aylık':'Quarterly','Üst yaşam profili':'Parent life profile','Yakınlık':'Relationship','Yakınlık (isteğe bağlı)':'Relationship (optional)','Hedef:':'Target:','Bağlı plan:':'Linked plan:',
  'Yakıt':'Fuel','Yakıt fişi':'Fuel receipt','Yakıt miktarı':'Fuel amount','Yalnız kullanıcı yetkisiyle':'User-authorized only',
  'Yalnız manuel, yerel takip':'Manual local tracking only','Yalnız yerel':'Local only','Yalnız yerel veri':'Local data only',
  'Yangın':'Fire','Yapılandırma etiketi':'Configuration label','Yapılandırma kaydedilemedi.':'The configuration could not be saved.',
  'Yapılandırmayı kaydet':'Save configuration','Yapılmadı':'Not performed','Yardım':'Assistance','Yardım lazım':'I need help',
  'Yardım talimatı':'Assistance instruction','Yardım türü':'Assistance type','Yaşam kaydı türü':'Life-record type',
  'Yaşam Merkezi, ev envanteri ve acil durum':'Life Center, home inventory, and emergencies','Yaşam profili':'Life profile',
  'Yatak odası':'Bedroom','Yazdır':'Print','yazıcı çıktısının':'printer output','yazıcıya gönderim doğrulandı':'printer submission verified','Yeni kart her zaman özel oluşturulur. Plan bağlantısı kartı aileye açmaz; kişi veya sorumlu sahipliği merkezi PEP tarafından doğrulanır.':'A new card is always private. Linking a plan does not expose the card to the family; person or responsible-owner binding is verified by the central PEP.',
  'Yeni kayıt':'New record','Yenileme':'Renewal','Yerel · Aile':'Local · Family','Yerel deftere kaydet':'Save to local ledger',
  'Yetkili aile üyesi':'Authorized family member','Yetkili kartı seçin':'Select an authorized card',
  'Yetkili özel acil kart':'Authorized private emergency card','Yetkili özel acil kart yok':'No authorized private emergency card',
  'Yıllık':'Yearly','Yönetilen yaşam görünümü':'Managed life view','Yönetilen yaşam profili yok':'No managed-life profile',
  'Yüksek hassasiyetli opak arşiv kimliği':'Highly sensitive opaque archive ID','Zorunlu trafik':'Compulsory vehicle insurance',
  'Sigorta, abonelik, eğitim, istihdam, resmî işlem, ev veya araç profili ekleyin.':'Add an insurance, subscription, education, employment, official-operation, home, or vehicle profile.',
  '1. Yapılandırma':'1. Configuration','2. Kapalı alan ve belge seçimi':'2. Closed field and document selection',
  '3. Pil-duyarlı görünüm':'3. Battery-aware view','4. Güçlü doğrulama ve yerel çıktı':'4. Strong reauthentication and local output',
  'Acil durum doğruluk sınırı':'Emergency truth boundary','Acil sağlık kartı ve özel yardım planı özeldir. Plan bağlantısı erişim vermez; görünürlük yalnız merkezi yetki kararıyla açılır.':'The emergency health card and special assistance plan are private. Linking a plan does not grant access; visibility is opened only by a central authorization decision.',
  'Adres yalnız yerel aile planında tutulur; harita ve canlı konum sorgusu yapılmaz.':'The address is kept only in the local family plan; maps and live location are not queried.',
  'Ağ, bulut, mesaj veya acil servis teslimi yapılmaz. Pil kaynağı yalnız ana süreçte gözlenir; pil yüzdesi ölçülmez ve otomatik düşük pil iddiası kurulmaz.':'No network, cloud, messaging, or emergency-service delivery occurs. Power source is observed only in the main process; battery percentage is not measured and no automatic low-battery claim is made.',
  'Akıllı sayaç, sağlayıcı veya garanti sicili sorgulanmaz; OCR, servis rezervasyonu, ödeme ve ağ erişimi yapılmaz.':'Smart meters, providers, and warranty registries are not queried; OCR, service booking, payment, and network access are not performed.',
  'Arşiv belgesi içeriği düz metin PDF/yazıcı çıktısına eklenmez; yalnız bağımsız parolalı şifreli pakete alınır.':'Archive-document content is not added to plain-text PDF or printer output; it is included only in a separately password-protected encrypted package.',
  'Barkod aranmaz ve tarih dış sistemden doğrulanmaz; değerler manuel beyan edilir.':'No barcode lookup or external date verification is performed; values are declared manually.',
  'Belge içeriği okunmaz. Dosya yolu, ham belge, base64, kart numarası, CVV/CVC, PIN, parola, token ve gizli anahtar kabul edilmez.':'Document content is not read. File paths, raw documents, base64, card numbers, CVV/CVC, PINs, passwords, tokens, and secret keys are rejected.',
  'Bu bilgi klinik doğrulama veya tıbbi tavsiye değildir; sağlık sicili sorgulanmaz.':'This information is not clinically verified or medical advice; no health registry is queried.',
  'Çevrimdışı afet/tahliye planı oluşturarak buluşma, irtibat, kontrol ve üye durumunu aynı yerel çalışma alanında yönetin.':'Create an offline disaster or evacuation plan to manage meeting points, contacts, checklists, and member statuses in the same local workspace.',
  'Dosya yolu renderer tarafından verilmez veya geri dönmez. Seçilen arşiv belgeleri ayrı yetki kararıyla, en çok 10 MiB/dosya ve 25 MiB toplam olacak biçimde bellekte okunur; düz metin geçici dosya oluşturulmaz.':'The renderer neither supplies nor receives a file path. Selected archive documents are read in memory under a separate authorization decision, up to 10 MiB per file and 25 MiB total; no plaintext temporary file is created.',
  'Durum yalnız manuel kontroldür; sensör okuması, otomatik bildirim veya hazır olma garantisi değildir.':'Status is a manual check only; it is not a sensor reading, automatic notification, or readiness guarantee.',
  'Harita veya canlı konum sorgulanmaz; SMS, e-posta ya da mesaj gönderilmez ve acil servis aranmaz.':'Maps and live location are not queried; no SMS, email, or message is sent, and emergency services are not called.',
  'Hazırlık kiti ve tatbikatlar manuel tutulur; barkod, son kullanma doğrulaması, bildirim veya sensör entegrasyonu yapılmaz. Hazır olma garantisi verilmez.':'Preparedness kits and drills are maintained manually; no barcode lookup, expiry verification, notification, or sensor integration is performed. Readiness is not guaranteed.',
  'Kendi durumunuzu bildirebilirsiniz. Başkası adına bildirim yalnız merkezi yetki denetimi izin verirse kabul edilir ve gerçek bildiren kişi denetim izine bağlanır.':'You may report your own status. A report on behalf of someone else is accepted only when central authorization permits it, and the actual reporter is bound to the audit trail.',
  'Kit yalnız seçili aile planında ve cihazdaki yerel çalışma alanında tutulur.':'The kit is kept only in the selected family plan and this device’s local workspace.',
  'Kısa, uygulanabilir ve kişiye/evcil hayvana özel yardım adımları':'Short, actionable assistance steps tailored to the person or pet',
  'Plan bağlantısı erişim vermez; görünürlük yalnız merkezi yetki kararıyla açılır.':'Linking a plan does not grant access; visibility is opened only by a central authorization decision.',
  'Sağlık bilgisi manuel beyan edilir ve klinik olarak doğrulanmaz. Telefon veya sağlık içeriği otomatik paylaşılmaz; yalnız açık alan seçimi, güçlü yeniden doğrulama ve yerel dosya politikasıyla kullanıcıya verilebilir.':'Health information is declared manually and is not clinically verified. Phone or health content is not shared automatically; it may be provided to the user only through explicit field selection, strong reauthentication, and local-file policy.',
  'Talimat yalnız yerel özel profildir; mesaj, sağlık sağlayıcısı veya acil servis çağrısı üretmez.':'The instruction is only a local private profile; it does not generate a message, healthcare-provider contact, or emergency-service call.',
  'Tatbikat kaydı alarm, mesaj, acil servis teması veya müdahale garantisi üretmez.':'A drill record does not generate an alarm, message, emergency-service contact, or response guarantee.',
  'telefon veya sağlık içeriği loga, dış sağlayıcıya ya da kendiliğinden dışa aktarıma verilmez.':'Phone or health content is not sent to logs, external providers, or automatic exports.',
  'Yalnız merkezi yetkiyle görünen özel, manuel ve çevrimdışı kartlar.':'Private, manual, offline cards visible only through central authorization.',
  'Yalnız opak arşiv kimliği ilişkilendirilir; dosya seçilmez, yol, ad, hash veya ham içerik taşınmaz.':'Only an opaque archive ID is linked; no file is selected and no path, name, hash, or raw content is transferred.',
  'Yalnız opak arşiv kimliğiyle ilişki kurulur; dosya seçilmez, yol veya ham içerik taşınmaz.':'Only an opaque archive ID is linked; no file is selected and no path or raw content is transferred.',
  'Yalnız şifreli pakete eklenecek belgeler':'Documents included only in the encrypted package',
  'Yazdırma ve düz PDF şifreli değildir. Şifreli paket ayrı, en az 12 karakterli paket parolası kullanır; hesap parolası paket parolası olarak saklanmaz veya yeniden kullanılmaz.':'Print and plain PDF output are not encrypted. The encrypted package uses a separate passphrase of at least 12 characters; the account password is neither stored nor reused as the package passphrase.'
  ,'Kaynak:':'Source:','· Akıllı sayaç:':'· Smart meter:','· Sağlayıcı teması:':'· Provider contact:',
  'Garanti sicili:':'Warranty registry:','· OCR:':'· OCR:','· Ödeme:':'· Payment:',
  'Belge içeriği açığa çıkarma:':'Document-content exposure:','· Ağ gerçeği üretilmez':'· No network truth is produced',
  'Çevrimdışı kullanılabilirlik:':'Offline availability:','· Harita:':'· Map:','· Canlı konum:':'· Live location:',
  'Mesaj teslimi:':'Message delivery:','· Acil servis teması:':'· Emergency-service contact:','· Garanti:':'· Guarantee:','· Ağ çıkışı:':'· Network egress:',
  'Barkod araması:':'Barcode lookup:','· Son kullanma doğrulaması:':'· Expiry verification:','· Bildirim teslimi:':'· Notification delivery:',
  'Sensör entegrasyonu:':'Sensor integration:','· Hazır olma garantisi:':'· Readiness guarantee:','· Saklama:':'· Storage:',
  'Tıbbi doğrulama:':'Medical verification:','· Sağlık sicili:':'· Health registry:','· Dış teslim:':'· External delivery:','· Yerel çıktı:':'· Local export:',
  'İletişim teslimi:':'Communication delivery:','Bulut yükleme:':'Cloud upload:','· PDF şifreleme:':'· PDF encryption:','· Şifreli paket:':'· Encrypted package:',
  'Düz metin geçici dosya:':'Plaintext temporary file:','· Pil düzeyi:':'· Battery level:','· Otomatik düşük pil:':'· Automatic low-battery detection:',
  'Dışa paylaşım (exportSharing): yalnız yeni güçlü doğrulama, kapalı alan seçimi ve yerel çıktı onayıyla; varsayılan paylaşım yapılmaz.':'Export sharing requires fresh strong reauthentication, closed field selection, and local-output approval; no sharing occurs by default.',
  '“Yardım lazım” durumu yalnız bu cihazdaki yetkili aile çalışma alanına kaydedilir. Teslim veya acil servis müdahale garantisi verilmez.':'The “I need help” status is recorded only in the authorized family workspace on this device. Delivery or emergency-service response is not guaranteed.'
};

const patterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Pil-duyarlı görünüm açıldı; pil yüzdesi ölçülmedi\.$/u,'Battery-aware view enabled; battery percentage was not measured.'],
  [/^Pil-duyarlı görünüm kapatıldı; pil yüzdesi ölçülmedi\.$/u,'Battery-aware view disabled; battery percentage was not measured.'],
  [/^Son kip: açık · güç kaynağı (.+) · pil seviyesi ölçülmedi$/u,'Last mode: enabled · power source $1 · battery level not measured'],
  [/^Son kip: kapalı · güç kaynağı (.+) · pil seviyesi ölçülmedi$/u,'Last mode: disabled · power source $1 · battery level not measured'],
  [/^(.+) tamamlandı · (.+) bayt · okuma doğrulandı\.$/u,'$1 completed · $2 bytes · readback verified.'],
  [/^(.+) tamamlandı · (.+) bayt · yazıcıya gönderim doğrulandı\.$/u,'$1 completed · $2 bytes · printer submission verified.'],
  [/^(\d+) profil · (\d+) ev envanteri olayı · (\d+) acil durum planı · (\d+) hazırlık kiti · (\d+) tatbikat · (\d+) özel acil kart$/u,'$1 profiles · $2 home-inventory events · $3 emergency plans · $4 preparedness kits · $5 drills · $6 private emergency cards'],
  [/^Garanti · (.+)$/u,'Warranty · $1'],[/^Mülk · (.+)$/u,'Owned · $1'],[/^Kiralık · (.+)$/u,'Rented · $1'],
  [/^Sağlık · (.+)$/u,'Health · $1'],[/^İrtibat · (.+)$/u,'Contact · $1'],[/^Yardım · (.+)$/u,'Assistance · $1'],
  [/^(.+) · Düzeltme kaydı$/u,'$1 · Correction record'],[/^(.+) · düzeltme kaydı$/u,'$1 · correction record'],
  [/^Seri (.+)$/u,'Serial $1'],[/^Opak arşiv bağı: (.+)$/u,'Opaque archive link: $1'],
  [/^Sağlık · /u,'Health · '],[/^İrtibat · /u,'Contact · '],[/^Yardım · /u,'Assistance · '],
  [/^Bağlı plan: /u,'Linked plan: '],[/^Telefon: /u,'Phone: '],[/^Hedef: /u,'Target: '],
  [/ · mevcut: /u,' · current: '],[/ · SKT: /u,' · expiry: '],[/ \(manuel\)$/u,' (manual)'],
  [/^Manuel · yerel aile planı/u,'Manual · local family plan'],[/^Manuel · /u,'Manual · '],
  [/^Opak arşiv bağı · /u,'Opaque archive link · '],[/ · Bildiren: /u,' · Reported by: '],[/ · Sorumlu: /u,' · Responsible: '],
  [/ · Hazır · /u,' · Ready · '],[/ · Azaldı · /u,' · Low · '],[/ · Eksik · /u,' · Missing · '],
  [/ · Süresi doldu · /u,' · Expired · '],[/ · Değiştirilmeli · /u,' · Replace · '],
  [/^(.+) saniye$/u,'$1 seconds']
];

const preserveWhitespace = (source: string, translated: string): string => {
  const leading = /^\s*/u.exec(source)?.[0] ?? '';
  const trailing = /\s*$/u.exec(source)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
};

export const translateManagedLifeCopy = (source: string, language: SupportedUiLanguage): string => {
  if (language === 'tr') return source;
  const value = source.trim();
  const exact = exactCopy[value];
  if (exact) return preserveWhitespace(source, exact);
  let translated = value;
  let matched = false;
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(translated)) {
      translated = translated.replace(pattern, replacement);
      matched = true;
    }
  }
  return matched ? preserveWhitespace(source, translated) : source;
};

const translatableProps = new Set(['aria-label','aria-description','title','body','eyebrow','placeholder','alt']);

export const localizeManagedLifeNode = (node: ReactNode, language: SupportedUiLanguage): ReactNode => {
  if (language === 'tr' || node === null || node === undefined || typeof node === 'boolean' || typeof node === 'number') return node;
  if (typeof node === 'string') return translateManagedLifeCopy(node, language);
  if (Array.isArray(node)) return Children.map(node, (item) => localizeManagedLifeNode(item, language));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  const props: Record<string, unknown> = {};
  for (const key of translatableProps) {
    const value = element.props[key];
    if (typeof value === 'string') props[key] = translateManagedLifeCopy(value, language);
  }
  if ('children' in element.props) props.children = localizeManagedLifeNode(element.props.children as ReactNode, language);
  return cloneElement(element, props);
};
