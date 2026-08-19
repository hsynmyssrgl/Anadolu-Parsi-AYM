import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { SupportedUiLanguage } from '@ppt/domain';

const exactCopy:Readonly<Record<string,string>>={
  'Gizlilik ve sahiplik merkezi yükleniyor':'Loading privacy and ownership center',
  'Sahibine bağlı yerel envanter ve denetim görünümü hazırlanıyor.':'Preparing the owner-bound local inventory and audit view.',
  'Gizlilik merkezi yüklenemedi':'Privacy center could not be loaded',
  'Yetkili yerel görünüm kurulamadı.':'The authorized local view could not be established.',
  'Gizlilik merkezi boş':'Privacy center is empty',
  'Bu sahip için yerel gözlem veya yönetilebilir kayıt bulunamadı.':'No locally observed or manageable record was found for this owner.',
  'Yerel gözlem ve sahiplik':'Local observation and ownership',
  'Gizlilik, Sahiplik ve Olay Kontrol Merkezi':'Privacy, Ownership, and Incident Control Center',
  'Bu görünüm yalnız yerel gözlem ve yerel yetkiyi gösterir. Uzaktan silme, MDM, ağ teslimi, uzak durum veya hukuk/gizlilik sertifikasyonu iddiası yoktur.':'This view shows only local observation and local authority. It makes no claim of remote deletion, MDM, network delivery, remote status, or legal/privacy certification.',
  'Tutulan veri':'Stored data','kategori':'categories','toplam':'total','yerel kayıt':'local records','Kayıt yok':'No records',
  'Yerel envanterde gösterilecek veri bulunmuyor.':'There is no data to show in the local inventory.','kayıt':'records','türetilmiş':'derived',
  'Özeti göster':'Show summary','Tüm':'Show all','kategoriyi göster':'categories',
  'AI hafıza denetimi':'AI memory control','revizyon':'revision','Başlık':'Title','Düzeltme':'Correction','Saklama sonu':'Retention end',
  'Düzelt':'Correct','Yalnız sahibine sınırla':'Restrict to owner only','Süre koy':'Set expiry','Yerel silme iste':'Request local deletion',
  'AI hafıza kaydı yok':'No AI memory record','Yalnız yerel olarak gözlenen AI hafıza kayıtları burada gösterilir.':'Only locally observed AI memory records are shown here.',
  'Erişim geçmişi':'Access history','Cihaz ve yerel işleme gözlemi':'Device and local-processing observation',
  'Güvenilir cihaz, açık oturum anlamına gelmez. Apple eşzamanlama ile AI/OCR/çeviri yalnız yerelde gözlendiyse gösterilir.':'A trusted device does not imply an active session. Apple synchronization and AI/OCR/translation are shown only when observed locally.',
  'oturum':'session','ağ teslimi gözlenmedi':'no network delivery observed',
  'Veri hakları, saklama ve şifreli dışa aktarım':'Data rights, retention, and encrypted export',
  'Saklama talebi':'Retention request','Yerel silme talebi':'Local deletion request','Kendi verim için şifreli talep':'Encrypted request for my data','Dijital miras için şifreli talep':'Encrypted request for digital legacy',
  'Şifreli paket; sahip kapsamındaki yapılandırılmış kayıtları ve gizlilik merkezi verisini içerir. Arşiv ikili dosyaları, sahipliği kesin bağlanamayan aile etkinlikleri ve açıkça seçilmemiş form taslakları dahil edilmez.':'The encrypted package contains owner-scoped structured records and privacy-center data. Archive binary files, family events without exact ownership binding, and form drafts that were not explicitly selected are excluded.',
  'dış kopya silme garantisi yok':'external-copy deletion is not guaranteed','İncelemeye al':'Start review','Yerel incelemeyi tamamla':'Complete local review','Yerel talebi iptal et':'Cancel local request',
  'Şifreli dışa aktarım talebi':'Encrypted export request','Aktif şifreli talep yok':'No active encrypted request','Şifreli dosya parolası':'Encrypted-file passphrase','Yerel şifreli dosya oluştur':'Create local encrypted file',
  'Türetilmiş veri zinciri':'Derived-data lineage','İçerik gösterilmez; yalnız kaynak bağı, tür ve yerel silme yayılım durumu görünür.':'Content is not shown; only source binding, type, and local deletion-propagation status are visible.','derinlik':'depth',
  'Olay ve yerel containment':'Incident and local containment','Yerel inceleme olayı aç':'Open local review incident','remote wipe/MDM/ağ teslimi yapılmadı':'remote wipe, MDM, and network delivery were not performed',
  'Yerel containment’a al':'Contain locally','Yerel çözümü kaydet':'Save local resolution','Yerel olayı iptal et':'Cancel local incident',
  'Karşı taraf izin simülasyonu':'Counterparty permission simulation','Salt okunurdur; yetki oluşturmaz, erişim yapmaz ve erişim denetim kaydı üretmez.':'Read-only; it creates no authority, performs no access, and produces no access-audit record.',
  'Karşı taraf hesap kimliği':'Counterparty account ID','Görünürlüğü simüle et':'Simulate visibility','Görünür':'Visible','Görünmez':'Not visible',
  'İşlem sürüyor; aynı kayıt için ikinci gönderim kilitli.':'Operation in progress; a second submission for the same record is locked.',
  'Aynı işlem kimliği ve özgün revizyonla yeniden deneyebilirsiniz.':'You can retry with the same operation ID and original revision.',
  'İşlem tamamlanamadı; yeniden deneme kimliği korundu.':'The operation could not be completed; the retry identity was preserved.',
  'AI hafıza kaydı yerel olarak düzeltildi.':'The AI memory record was corrected locally.','AI hafıza kaydı yalnız sahibine sınırlandı.':'The AI memory record was restricted to its owner.',
  'Yerel silme talebi kaydedildi; dış kopya silme garantisi verilmez.':'The local deletion request was recorded; deletion of external copies is not guaranteed.','Yerel saklama süresi güncellendi.':'The local retention period was updated.',
  'Veri hakkı talebi yerel incelemeye alındı.':'The data-rights request entered local review.','Yerel silme talebi incelemeye alındı; harici kopya fiziksel silme garantisi yoktur.':'The local deletion request entered review; physical deletion of external copies is not guaranteed.',
  'Şifreli dışa aktarım talebi hazır; kimlik otomatik seçildi.':'The encrypted-export request is ready; its ID was selected automatically.','Dışa aktarım talebi oluşturulamadı.':'The export request could not be created.',
  'Talep yerel incelemeye alındı.':'The request entered local review.','Talep yalnız yerel iş akışında iptal edildi.':'The request was cancelled only in the local workflow.','Talep yalnız yerel iş akışında tamamlandı; harici kopya veya ağ teslimi garantisi verilmez.':'The request was completed only in the local workflow; external copies and network delivery are not guaranteed.',
  'Olay yerel containment kaydı olarak açıldı.':'The incident was opened as a local containment record.','Olay yalnız yerel containment durumuna alındı.':'The incident was placed only in local containment.','Olay yalnız yerel kayıtta iptal edildi.':'The incident was cancelled only in the local record.','Yerel olay çözüm notuyla kapatıldı; remote wipe, MDM veya ağ teslimi yapılmadı.':'The local incident was closed with a resolution note; remote wipe, MDM, and network delivery were not performed.',
  'Simülasyon tamamlanamadı.':'The simulation could not be completed.','Şifreli dışa aktarım tamamlanamadı.':'The encrypted export could not be completed.','doğrulandı':'verified','bayt':'bytes','ağ teslimi yapılmadı.':'network delivery was not performed.'
};

const fragmentCopy=Object.entries(exactCopy).sort(([left],[right])=>right.length-left.length);

export const translatePrivacyOwnershipCopy=(source:string,language:SupportedUiLanguage):string=>{
  if(language==='tr')return source;
  const value=source.trim();const translated=exactCopy[value];
  if(translated){const leading=/^\s*/u.exec(source)?.[0]??'';const trailing=/\s*$/u.exec(source)?.[0]??'';return `${leading}${translated}${trailing}`;}
  let localized=source;
  for(const [turkish,english] of fragmentCopy){if(turkish.length>=4&&localized.includes(turkish))localized=localized.split(turkish).join(english);}
  return localized;
};

const propsToTranslate=new Set(['aria-label','aria-description','title','description','body','message','eyebrow','placeholder','alt','label']);
export const localizePrivacyOwnershipNode=(node:ReactNode,language:SupportedUiLanguage):ReactNode=>{
  if(language==='tr'||node===null||node===undefined||typeof node==='boolean'||typeof node==='number')return node;
  if(typeof node==='string')return translatePrivacyOwnershipCopy(node,language);
  if(Array.isArray(node))return Children.map(node,item=>localizePrivacyOwnershipNode(item,language));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>;const props:Record<string,unknown>={};
  if(element.props['data-localization-preserve']===true)return element;
  for(const key of propsToTranslate){const value=element.props[key];if(typeof value==='string')props[key]=translatePrivacyOwnershipCopy(value,language);}
  if('actions' in element.props)props.actions=localizePrivacyOwnershipNode(element.props.actions as ReactNode,language);
  if('children' in element.props)props.children=localizePrivacyOwnershipNode(element.props.children as ReactNode,language);
  return cloneElement(element,props);
};
