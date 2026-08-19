import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { SupportedUiLanguage } from '@ppt/domain';

const exactCopy: Readonly<Record<string,string>> = {
  '* tüm izinli kayıtlar':'* all authorized records','1 saat':'1 hour','24 saat':'24 hours','7 gün':'7 days','30 gün':'30 days',
  'açıkça engellenmiş kapsam':'explicitly blocked scope','Açık onay ve varsayılan ret':'Explicit consent and default denial',
  'Aile üyeleri':'Family members','AI:':'AI:','Aktarım kapalı':'Transfer disabled','Amaç':'Purpose','Arşiv belgeleri':'Archive documents',
  'Ayrı dışa gönderim onayı etkin':'Separate export consent active','B2-05 hassasiyet profili':'B2-05 sensitivity profile',
  'B6-03 güvenli dışa gönderim':'B6-03 secure export','Derhal iptal et':'Revoke immediately','Doğal dil arama':'Natural-language search',
  'Dışa gönderim':'External export','Dışa gönderim güvenlik özeti':'Export security summary','Dışa gönderim:':'Export:',
  'Dört korumalı kategori':'Four protected categories','Etkin onay':'Active consent','Erişim önizlemesi':'Access preview',
  'Ev operasyon kayıtları':'Household operation records','Finans':'Finance','Finans kayıtları':'Finance records','Göndermeden önce önizle':'Preview before sending',
  'Görünür paylaşım durumu':'Visible sharing status','Hedef:':'Destination:','Hedef açıklaması':'Destination description',
  'İptal edildi':'Revoked','İş amacı':'Business purpose','İşlem tamamlanamadı.':'The operation could not be completed.',
  'İzin merkezi yüklenemedi.':'The consent center could not be loaded.','Kayıt alanı':'record fields','Kayıt kimliği':'Record ID',
  'Kayıt onayı tanımla':'Define record consent','Kategori':'Category','Konum':'Location','Kullanıcının seçtiği dış hedef':'External destination selected by the user',
  'Kullanım amacı':'Purpose of use','Onay geçmişi':'Consent history','Onay süresi':'Consent duration','Onay ver':'Grant consent',
  'Onay yok — engellendi':'No consent — blocked','Onayı geri çek':'Revoke consent','Onaylar tamam':'Consents complete','Öneri':'Recommendation',
  'Önizleme bekleniyor':'Waiting for preview','Özetleme':'Summarization','Planlandı':'Scheduled','Sağlık':'Health','Sağlık kayıtları':'Health records',
  'Seçilen kategori, amaç ve süre için açık rıza veriyorum.':'I give explicit consent for the selected category, purpose, and duration.',
  'Sınıflandırma':'Classification','Standart AI kapsamı':'Standard AI scope','Süreli onay ver':'Grant time-limited consent',
  'Süreli ve açık rıza':'Time-limited explicit consent','Süresi doldu':'Expired','Uygulama dışına veri aktarımı yapılmadı':'No data was transferred outside the application',
  'Varsayılan ret':'Default denial','Veri göndermeden önizleme oluştur':'Create preview before sending data','Yaşam kayıtları':'Life records',
  'Yapay zekâ ile işleme':'AI processing','Yapay zekâ izin merkezi':'AI consent center',
  'Yapay zekâ işleme izinlerini ve çocuk, sağlık, finans, konum verilerinin dışa gönderim onaylarını birbirinden bağımsız yönetin.':'Manage AI-processing permissions and export consents for child, health, finance, and location data independently.',
  'Yer ve seyahat kayıtları':'Place and travel records','Yerel OCR işleri':'Local OCR jobs','Zaman tüneli olayları':'Timeline events',
  'Çocuk':'Child','erişilebilir kayıt':'accessible records',
  'Aile yöneticisinin açıkça belirttiği paylaşım amacı':'Sharing purpose explicitly specified by the family administrator',
  'Yapıldı':'Performed','Yapılmadı':'Not performed','Bu önizlemede dışa veri aktarımı:':'Outbound data transfer in this preview:'
};

export const translateAiGovernanceCopy=(source:string,language:SupportedUiLanguage):string=>{
  if(language==='tr')return source;
  const value=source.trim();const translated=exactCopy[value];
  if(!translated)return source;
  const leading=/^\s*/u.exec(source)?.[0]??'';const trailing=/\s*$/u.exec(source)?.[0]??'';
  return `${leading}${translated}${trailing}`;
};

const translatableProps=new Set(['aria-label','aria-description','title','description','body','eyebrow','placeholder','alt','label']);

export const localizeAiGovernanceNode=(node:ReactNode,language:SupportedUiLanguage):ReactNode=>{
  if(language==='tr'||node===null||node===undefined||typeof node==='boolean'||typeof node==='number')return node;
  if(typeof node==='string')return translateAiGovernanceCopy(node,language);
  if(Array.isArray(node))return Children.map(node,item=>localizeAiGovernanceNode(item,language));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>;
  if(element.props['data-localization-preserve']===true)return element;
  const props:Record<string,unknown>={};
  for(const key of translatableProps){const value=element.props[key];if(typeof value==='string')props[key]=translateAiGovernanceCopy(value,language);}
  if('actions' in element.props)props.actions=localizeAiGovernanceNode(element.props.actions as ReactNode,language);
  if('children' in element.props)props.children=localizeAiGovernanceNode(element.props.children as ReactNode,language);
  return cloneElement(element,props);
};
