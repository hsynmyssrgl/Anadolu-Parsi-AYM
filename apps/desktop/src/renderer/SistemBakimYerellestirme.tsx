import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { SupportedUiLanguage } from '@ppt/domain';

const exactCopy: Readonly<Record<string,string>> = {
  '(etkinse)':'(when enabled)','(zorunlu)':'(required)','1 yıl':'1 year','2FA / kurtarma kodu':'2FA / recovery code',
  '24 saat':'24 hours','30 günden eskiyi arşivle':'Archive items older than 30 days','7 gün':'7 days','30 gün':'30 days','90 gün':'90 days',
  'Aç ve doğrula':'Open and verify','Açık':'Available','Adaptif kaynak bütçesi':'Adaptive resource budget','Ağ çıkış sınırı doğrulanamadı':'Network-egress boundary could not be verified',
  'Akıllı bakım önerileri':'Smart maintenance recommendations','Allowlist, TLS/mTLS ve sertifika rotasyonu':'Allowlist, TLS/mTLS, and certificate rotation',
  'Anahtar parmak izi gizlidir':'Key fingerprint is private','Anomali bulunmadı':'No anomaly found','Ara…':'Search…','Arka plan görevleri':'Background tasks',
  'Arşiv':'Archive','Arşivde ara…':'Search archive…','AST gate durumu doğrulanamadı':'AST-gate status could not be verified',
  'Ayrıcalıklı kod yüzeylerinde exact default-deny ratchet':'Exact default-deny ratchet for privileged code surfaces',
  'Bakım görev sonuç geçmişi':'Maintenance task result history','Bakım işlemleri':'Maintenance operations','Bakım kilidini kurtar':'Recover maintenance lock',
  'Bakım parolası':'Maintenance password','Bakım yetkisi':'Maintenance authority','Bakımı şimdi çalıştır':'Run maintenance now',
  'Bağlantı yok':'No connection','Başarılı':'Successful','Başarısız':'Failed','Beş dakikalık otomatik örnekleme geçmişi.':'Five-minute automatic sampling history.',
  'Belge, rota, menü, ekran ve API envanteri tek sözleşmede':'Document, route, menu, screen, and API inventory in one contract',
  'Bilgi':'Info','Bilinmiyor':'Unknown','Bütünlük kontrolü':'Integrity check','Bütünlük sorunu':'Integrity issue','Bulut klasörü':'Cloud folder',
  'Bütçeyi sıfırla':'Reset budget','Capability manifest durumu doğrulanamadı':'Capability-manifest status could not be verified',
  'Core Service':'Core Service','Çalışma aralığı (saat)':'Run interval (hours)','Çalıştır':'Run','çalışıyor':'running','Çözümlenmemiş API':'Unresolved API',
  'Değişim':'Change','Değişen bölümler:':'Changed sections:','Destekleniyor':'Supported','Dikkat':'Attention','Doğrula':'Verify','Doğrulandı':'Verified','Doğrulanamadı':'Not verified',
  'Donanım, veritabanı, yedekleme, performans, bildirim ve görev kuyruğunu tek JSON raporunda dışa aktarır.':'Exports hardware, database, backup, performance, notification, and task-queue status in one JSON report.',
  'Dışa aktarım geçmişi':'Export history','Dışa aktarım yok':'No exports','Dosya kayıp veya değiştirilmiş.':'The file is missing or has been modified.',
  'Düşük':'Low','Erişim güvenli biçimde durduruldu':'Access safely stopped','Eşleme uygunluk sertifikası veya runtime yetkisi değildir · profile-only hedefler native doğrulanmış sayılmaz · istemciye kaynak yolu ya da tehdit modeli hash’i verilmez':'Mapping is not a compliance certificate or runtime authority · profile-only targets are not considered natively verified · source paths and threat-model hashes are not exposed to the client',
  'Etkin':'Active','Fail-closed egress politikası etkin':'Fail-closed egress policy active','Fail-closed hassas log politikası etkin':'Fail-closed sensitive-log policy active',
  'Fail-closed masaüstü güvenlik sözleşmesi etkin':'Fail-closed desktop security contract active','Fail-closed politika mirası etkin':'Fail-closed policy inheritance active',
  'Fail-closed silme yayılımı doğrulandı':'Fail-closed deletion propagation verified','Filtrele':'Filter','Filtreye uyan kayıt bulunamadı.':'No record matches the filter.',
  'Genel durum':'Overall status','Geçersiz':'Invalid','Gezinme, yeni pencere ve izinler varsayılan reddedilir':'Navigation, new windows, and permissions are denied by default',
  'Görev kaydı yok':'No task record','Görev öncelik kuyruğu':'Task-priority queue','Göreve dönüştür':'Convert to task','Günlük':'Daily','Güvenli mod':'Safe mode',
  'Güçlü doğrulama':'Strong verification','Güçlü doğrulama geçici olarak kilitli.':'Strong verification is temporarily locked.',
  'Hafıza':'Memory','Harici disk':'External disk','Hassas log sınırı doğrulanamadı':'Sensitive-log boundary could not be verified','Hata':'Error','Hayır, vazgeç':'No, cancel',
  'Hedef adı':'Target name','Her hedef bağımsız çalışır ve SHA-256 ile doğrulanır.':'Each target runs independently and is verified with SHA-256.',
  'IPC darboğazı bulunmadı':'No IPC bottleneck found','IPC performans telemetrisi':'IPC performance telemetry','İçeriksiz log ve tanı sınırı':'Content-free logging and diagnostics boundary',
  'İçeriği aç':'Open contents','İkinci rapor':'Second report','İlk kurulum anına dön':'Return to initial setup','İlk rapor':'First report',
  'İmza doğrulanamadı':'Signature not verified','İyi':'Good','JSON raporu dışa aktar':'Export JSON report','Kalıcı imha':'Permanent destruction','Kapalı':'Disabled',
  'Karar audit zinciri doğrulanamadı':'Decision-audit chain could not be verified','Kaynak politika mirası ve değişmez soy zinciri':'Source-policy inheritance and immutable lineage',
  'Klasör yolu':'Folder path','Korumalı karar zinciri doğrulandı':'Protected decision chain verified','Kritik':'Critical','Kritik görevler adaptif kapasiteye göre önce çalıştırılır.':'Critical tasks run first according to adaptive capacity.',
  'Kullanılamıyor':'Unavailable','Kurtarma':'Recovery','Kurtarma denemesi':'Recovery attempt','Kurtarma onayı':'Recovery confirmation','Kuyruk':'Queue','Kuyruk boş':'Queue is empty',
  'Kuyruğu çalıştır':'Run queue','Masaüstü güvenlik durumu doğrulanamadı':'Desktop security status could not be verified','Mükemmel':'Excellent','Normal':'Normal','Normal deneme':'Normal attempt',
  'Olay arşivleri':'Event archives','Okuma ve yazma açık':'Read and write available','Onayla':'Acknowledge','Onaylandı':'Acknowledged','Ortalama':'Average',
  'Otomatik bakım etkin':'Automatic maintenance enabled','Otomatik bakım politikası':'Automatic maintenance policy','Oturum açılınca çalışır':'Runs after sign-in',
  'Oturum kilidi ve Electron sertleştirmesi':'Session lock and Electron hardening','Ölçüm al':'Capture measurement','Performans anomalileri':'Performance anomalies',
  'Performans eğilimi':'Performance trend','Performans saklama (gün)':'Performance retention (days)','Politika conformance durumu doğrulanamadı':'Policy-conformance status could not be verified',
  'Politikayı kaydet':'Save policy','Politika servisi çalışma modu':'Policy-service operating mode','Policy karar audit zinciri':'Policy-decision audit chain',
  'Rapor kişisel kayıt içeriğini değil, sistem ve işletim sağlığı özetlerini içerir.':'The report contains system and operational-health summaries, not personal-record content.',
  'Raporu açın, doğrulayın ve iki sürümü karşılaştırın.':'Open and verify a report, then compare two versions.','Sağlık puanı değişimi:':'Health-score change:',
  'Sağlık puanı eğilimi':'Health-score trend','Sağlığı değerlendir':'Evaluate health','Sağlıklı':'Healthy','Salt okunur — değişiklikler kapalı':'Read-only — changes disabled',
  'Saklanacak yedek':'Backups to retain','Saatlik':'Hourly','Silme yayılımı doğrulanamadı':'Deletion propagation could not be verified','Silme hazırlanıyor…':'Preparing deletion…',
  'Sistem sağlık puanı':'System health score','Sistem sağlığı bildirimleri':'System-health notifications','Sistem yönetimi':'System administration','Sistem, bakım ve operasyon':'System, maintenance, and operations',
  'Son 24 saatlik ölçümler normal aralıkta.':'Measurements from the last 24 hours are within the normal range.','Son yedek çalışmaları':'Recent backup runs',
  'Şimdi örnek al':'Sample now','Tanı paketini dışa aktar':'Export diagnostics package','Tanılama günlüğü':'Diagnostics log','Tanılama kaydı yok':'No diagnostics record',
  'Tanılama rapor merkezi':'Diagnostics report center','Tanılama raporu':'Diagnostics report','Tanılama saklama (gün)':'Diagnostics retention (days)',
  'tepe CPU':'peak CPU','tepe RAM':'peak RAM','Tüm kişisel veriler, yönetilen yerel yedekler ve oturumlar silinir. İşlem yeni yedek oluşturmaz; Gold etkinleştirmesi ve deneme başlangıcı sıfırlanmaz.':'All personal data, managed local backups, and sessions are deleted. The operation does not create a new backup; Gold activation and the trial start are not reset.',
  'Tüm seviyeler':'All levels','Tümünü çalıştır':'Run all','Tür':'Type','Uyarı':'Warning','Uygulama güvenlik profil kapısı doğrulanamadı':'Application-security profile gate could not be verified',
  'Uygulama güvenlik profili':'Application security profile','VACUUM':'VACUUM','Veri büyümesi':'Data growth','Verileri yenile':'Refresh data',
  'WAL temizle':'Clean WAL','Yalnız kayıtlı iptal-listesi, OIDC token ve JWKS uç noktaları':'Only registered revocation-list, OIDC token, and JWKS endpoints',
  'Yanıt süresi, kuyruk beklemesi ve süre aşımı oranları normal sınırda.':'Response time, queue wait, and timeout rates are within normal bounds.',
  'Yazılabilir':'Writable','Yedek başarısız.':'Backup failed.','Yedek doğrulandı.':'Backup verified.','Yedek hedefi tanımlanmadı':'No backup target configured',
  'Yedek hedefleri':'Backup targets','Yedekleme politikası':'Backup policy','Yedekleme ve bakım görevleri burada izlenecek.':'Backup and maintenance tasks are tracked here.',
  'Yedek hedeflerini, performansı, bakım görevlerini ve tanılama işlemlerini yönetin.':'Manage backup targets, performance, maintenance tasks, and diagnostics.',
  'Yeniden deneme':'Retry','Yenile':'Refresh','Yerel':'Local','Yerel, harici veya bulut hedefi ekleyin.':'Add a local, external, or cloud target.',
  'Yeni rapor':'New report','Yeni uyarıları üretin ve incelenen kayıtları onaylayın.':'Generate new alerts and acknowledge reviewed records.',
  'Yok':'None','Yüksek':'High','Zamanlama':'Schedule','Zamanlanmış bakım, performans ve yedek görevleri burada görünür.':'Scheduled maintenance, performance, and backup tasks appear here.',
  'Zamanlayıcı':'Scheduler','Zorunlu':'Required',
  'Geri alınamaz yerel işlem':'Irreversible local operation',
  'B2-03 / B2-04 · masaüstü güvenlik kapanışı':'B2-03 / B2-04 · desktop security closure',
  'Boşta kilit':'Idle lock','dakika · erişilebilir uyarı':'minutes · accessible warning','saniye · açık form durumu kilitte korunur':'seconds · open form state is preserved while locked',
  '· sandbox/context isolation etkin · gezinme, yeni pencere ve izinler varsayılan reddedilir':'· sandbox/context isolation enabled · navigation, new windows, and permissions are denied by default',
  'Fuse doğrulaması zorunlu · RunAsNode/Node seçenekleri kapalı · ASAR bütünlüğü ve yalnız ASAR yükleme açık':'Fuse verification required · RunAsNode/Node options disabled · ASAR integrity and ASAR-only loading enabled',
  'B0-03 / B0-04 · ürün yüzeyi gerçeklik kapısı':'B0-03 / B0-04 · product-surface reality gate',
  'Ürün yüzeyi zinciri doğrulanamadı':'Product-surface chain could not be verified','ürün modülü +':'product modules +','yönetişim yüzeyi =':'governance surfaces =','kanonik rota':'canonical routes',
  'Menü':'Menu','ekran':'screens','sınıflandırılmış kullanılmayan renderer API':'classified unused renderer APIs','eksik zincir build kapanışını fail-closed durdurur · veritabanı göçü gerekmez':'an incomplete chain stops build closure fail-closed · no database migration is required',
  'PPK-015 · ağ çıkış güvenliği':'PPK-015 · network-egress security','TLS doğrulanamadı':'TLS not verified','SPKI çift-pin rotasyonu':'SPKI dual-pin rotation',
  'doğrulanamadı · yönlendirme':'not verified · redirects','bilinmiyor · özel/yerel adresler':'unknown · private/local addresses','yetkili adaptör ·':'authorized adapters ·','doğrudan ağ istisnası':'direct network exceptions',
  'PPK-016 · türetilmiş veri güvenliği':'PPK-016 · derived-data security','Türetilmiş veri sınırı doğrulanamadı':'Derived-data boundary could not be verified','En çok':'At most','kaynak ·':'sources ·','soy derinliği · kaynak erişim politikalarının zorunlu kesişimi':'lineage depth · mandatory intersection of source-access policies',
  'Hassasiyet düşürme':'Sensitivity downgrade','erişim genişletme':'access broadening','doğrudan erişim istisnası · içerik/yol':'direct-access exceptions · content/path',
  'PPK-017 · hassas log güvenliği':'PPK-017 · sensitive-log security','OCR metni ve payload':'OCR text and payload','keyfi mesaj/stack':'arbitrary message/stack','Tanı kaynak metni':'Diagnostic source text','masaüstü sink':'desktop sink',
  'İzinli metadata: kimlik · hash · sonuç · correlation · sayaç · zaman · sürüm':'Allowed metadata: identity · hash · result · correlation · counter · time · version',
  'PPK-018 · değişmez karar denetimi':'PPK-018 · immutable decision audit','İzin ve ret kararları':'Allow and deny decisions','ret nedeni':'denial reason','Policy sürümü ve yükümlülükler':'Policy version and obligations','zincir':'chain',
  'yeni audit kaydı ·':'new audit entries ·','tarihsel receipt · istemciye payload verilmez':'historical receipts · no payload is exposed to the client',
  'PPK-019 · silme ve retention yayılımı':'PPK-019 · deletion and retention propagation','Kaynakla birlikte türev, cache, replica ve yedek yaşam döngüsü':'Lifecycle of derived data, cache, replicas, and backups with the source',
  'OCR · indeks · thumbnail · AI hafızası üretim sahibi':'OCR · index · thumbnail · AI-memory production owner','plaintext replica':'plaintext replica',
  'Runtime cache silme öncesi temizlenir · yönetilen yedek doğrulanmış yeniden yazım ve karantina tamamlanana kadar tombstone bekler':'Runtime cache is cleared before deletion · the tombstone remains until verified rewrite and quarantine of managed backups complete',
  'Yönetilmeyen ve harici kopyalar ayrı dikkat/kanıt ister · karantina fiziksel imha sayılmaz · istemciye payload verilmez':'Unmanaged and external copies require separate attention/evidence · quarantine is not physical destruction · no payload is exposed to the client',
  'PPK-020 · ortak policy conformance':'PPK-020 · common policy conformance','Windows, Apple profilleri ve servisler için tek doğrulama matrisi':'One verification matrix for Windows, Apple profiles, and services',
  'hedef ·':'targets ·','aynı vaka ·':'identical cases ·','çekirdek değerlendirmesi':'core evaluations','Aktif runtime hedefi':'Active runtime targets','profile-only/not-deployed hedef':'profile-only/not-deployed targets',
  'Native Apple çalıştırması tamamlandı iddiası yoktur; ilgili uygulama yayımlanmadan önce native doğrulama zorunludur · istemciye test payloadı verilmez':'No claim is made that native Apple execution is complete; native verification is required before the relevant application is released · no test payload is exposed to the client',
  'PPK-021 · AST güvenlik kapısı':'PPK-021 · AST security gate','kural ·':'rules ·','üretim bölgesi ·':'production zones ·','exact yüzey':'exact surfaces',
  'Yeni veya eski izin: fail-closed · wildcard:':'New or legacy permission: fail-closed · wildcard:','doğrudan rol yetkilendirmesi:':'direct role authorization:',
  'Alias, dynamic import, require ve hesaplanmış property AST üzerinde incelenir; AST gate runtime politikasının yerine geçmez · istemciye kaynak yolu veya allowlist hash’i verilmez':'Aliases, dynamic imports, require, and computed properties are inspected in the AST; the AST gate does not replace runtime policy · source paths and allowlist hashes are not exposed to the client',
  'PPK-022 · capability manifest kapısı':'PPK-022 · capability-manifest gate','Kamera, mikrofon, dosya, OCR, AI, konum ve ağ için çift katmanlı ret':'Dual-layer denial for camera, microphone, files, OCR, AI, location, and network',
  'kaynak ailesi ·':'resource families ·','uygulama ·':'applications ·','exact AST yüzeyi':'exact AST surfaces','Eksik veya beklenmeyen capability: fail-closed · imzalı manifest hash bağı ve authenticated Core Service runtime doğrulaması zorunlu':'Missing or unexpected capability: fail-closed · signed-manifest hash binding and authenticated Core Service runtime verification are required',
  'Build manifesti tek başına runtime yetkisi vermez · istemciye kaynak yolu veya manifest hash’i verilmez · mevcut Desktop vault sahipliği korunur':'The build manifest alone grants no runtime authority · source paths and manifest hashes are not exposed to the client · existing Desktop vault ownership is preserved',
  'PPK-023 · uygulama güvenlik profili':'PPK-023 · application-security profile','ASVS, MASVS, SSDF eşlemesi ve uygulama başına tehdit modeli':'ASVS, MASVS, and SSDF mapping with a per-application threat model',
  'tehdit modeli ·':'threat models ·','mobil MASVS profili':'mobile MASVS profiles','yeni veya eksik profil build aşamasında reddedilir':'new or missing profiles are rejected during the build',
  'Manuel':'Manual','Haftalık':'Weekly','Aylık':'Monthly',
  'Aktif sağlık bildirimi yok':'No active health notification','Sistem sağlığı değerlendirmesi yeni kayıt üretebilir.':'A system-health evaluation may generate new records.',
  'Son':'Last','dakika · yalnız toplu teknik ölçümler':'minutes · aggregate technical measurements only','örnek':'samples','Bakım yetkisi: DENETLENIYOR':'Maintenance authority: CHECKING',
  'Bakım oturumu açılmadan önce güçlü yeniden doğrulama yapılır; parola ve 2FA kodu kaydedilmez, günlüklenmez ve tanı paketine eklenmez; tek kullanımlık kurtarma kodu da aynı gizlilik sınırındadır. Başarısız denemeler sınırlıdır ve işletim sistemi korumasıyla şifrelenerek uygulama yeniden başlatmalarında korunur. Başarılı kurtarma hesap güvenlik dönemini ilerletir, tüm eski güvenilir cihaz bağlarını iptal eder ve yeniden yetkilendirme ister.':'Strong reauthentication occurs before a maintenance session opens; the password and 2FA code are not saved, logged, or included in the diagnostics package, and a one-time recovery code has the same privacy boundary. Failed attempts are limited and encrypted with operating-system protection across application restarts. Successful recovery advances the account security epoch, revokes all old trusted-device bindings, and requires reauthorization.',
  'Denetleniyor':'Checking','nesil':'generation','kalıcılık':'persistence','genel':'global','eşik':'threshold','istek':'requests',
  'JSON, CSV ve PDF çıktılarının bütünlük kaydı.':'Integrity record for JSON, CSV, and PDF exports.','Oluşturulan rapor ve arşiv çıktıları burada listelenecek.':'Generated report and archive exports are listed here.',
  'Metin, kod ve önem seviyesine göre filtreleyin.':'Filter by text, code, and severity.','günlük görünüm ·':'day view ·','ölçüm':'measurements','En düşük':'Minimum',
  'Karşılaştır':'Compare','Eski tanılama kayıtları sıkıştırılmış ve hash doğrulamalı saklanır.':'Old diagnostics records are stored compressed and hash-verified.',
  'doğrulanamadı':'not verified','· ekran':'· screens','· sınıflandırılmış kullanılmayan renderer API':'· classified unused renderer APIs',
  '· eksik zincir build kapanışını fail-closed durdurur · veritabanı göçü gerekmez':'· an incomplete chain stops build closure fail-closed · no database migration is required',
  'Yalnız kayıtlı iptal-listesi, OIDC token ve JWKS uç noktaları ·':'Only registered revocation-list, OIDC token, and JWKS endpoints ·',
  '· SPKI çift-pin rotasyonu':'· SPKI dual-pin rotation','mTLS':'mTLS','· yönlendirme':'· redirects','· özel/yerel adresler':'· private/local addresses',
  'Policy conformance durumu doğrulanamadı':'Policy-conformance status could not be verified','· profile-only/not-deployed hedef':'· profile-only/not-deployed targets',
  'Yeni veya eski izin: fail-closed · wildcard: doğrulanamadı · doğrudan rol yetkilendirmesi: doğrulanamadı':'New or legacy permission: fail-closed · wildcard: not verified · direct role authorization: not verified',
  'Alias, dynamic import, require ve hesaplanmış property AST üzerinde incelenir; AST gate runtime politikasının yerine geçmez · istemciye kaynak yolu veya allowlist hash\'i verilmez':'Aliases, dynamic imports, require, and computed properties are inspected in the AST; the AST gate does not replace runtime policy · source paths and allowlist hashes are not exposed to the client',
  'Build manifesti tek başına runtime yetkisi vermez · istemciye kaynak yolu veya manifest hash\'i verilmez · mevcut Desktop vault sahipliği korunur':'The build manifest alone grants no runtime authority · source paths and manifest hashes are not exposed to the client · existing Desktop vault ownership is preserved',
  'Uygulama güvenlik profili doğrulanamadı':'Application-security profile could not be verified',
  'ASVS — · MASVS — · SSDF — · yeni veya eksik profil build aşamasında reddedilir':'ASVS — · MASVS — · SSDF — · new or missing profiles are rejected during the build',
  'Eşleme uygunluk sertifikası veya runtime yetkisi değildir · profile-only hedefler native doğrulanmış sayılmaz · istemciye kaynak yolu ya da tehdit modeli hash\'i verilmez':'Mapping is not a compliance certificate or runtime authority · profile-only targets are not considered natively verified · source paths and threat-model hashes are not exposed to the client',
  '· nesil':'· generation','· kalıcılık':'· persistence',
  '· erişim genişletme':'· access broadening','· masaüstü sink':'· desktop sink','· doğrudan rol yetkilendirmesi:':'· direct role authorization:',
  '· yeni veya eksik profil build aşamasında reddedilir':'· new or missing profiles are rejected during the build',
  'bilinmiyor':'unknown'
};

const fragmentCopy=Object.entries(exactCopy).sort(([left],[right])=>right.length-left.length);

export const translateSystemMaintenanceCopy=(source:string,language:SupportedUiLanguage):string=>{
  if(language==='tr')return source;
  const value=source.trim();const translated=exactCopy[value];
  if(!translated){
    let localized=source;
    for(const [turkish,english] of fragmentCopy){
      if(turkish.length>=4&&localized.includes(turkish))localized=localized.split(turkish).join(english);
    }
    return localized;
  }
  const leading=/^\s*/u.exec(source)?.[0]??'';const trailing=/\s*$/u.exec(source)?.[0]??'';
  return `${leading}${translated}${trailing}`;
};

const propsToTranslate=new Set(['aria-label','aria-description','title','description','body','message','eyebrow','placeholder','alt','label']);
export const localizeSystemMaintenanceNode=(node:ReactNode,language:SupportedUiLanguage):ReactNode=>{
  if(language==='tr'||node===null||node===undefined||typeof node==='boolean'||typeof node==='number')return node;
  if(typeof node==='string')return translateSystemMaintenanceCopy(node,language);
  if(Array.isArray(node))return Children.map(node,item=>localizeSystemMaintenanceNode(item,language));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>;const props:Record<string,unknown>={};
  if(element.props['data-localization-preserve']===true)return element;
  for(const key of propsToTranslate){const value=element.props[key];if(typeof value==='string')props[key]=translateSystemMaintenanceCopy(value,language);}
  if('actions' in element.props)props.actions=localizeSystemMaintenanceNode(element.props.actions as ReactNode,language);
  if('children' in element.props)props.children=localizeSystemMaintenanceNode(element.props.children as ReactNode,language);
  return cloneElement(element,props);
};
