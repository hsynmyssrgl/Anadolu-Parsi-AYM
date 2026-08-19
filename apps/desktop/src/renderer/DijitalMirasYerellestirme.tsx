import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { SupportedUiLanguage } from '@ppt/domain';

const exactCopy: Readonly<Record<string,string>> = {
  'Açık değil':'Not open','Aktarılacak yetkiler':'Permissions to transfer','Askıda':'Suspended','Başlatılmadı':'Not started',
  'Başlık':'Title','Bekleme (gün)':'Waiting period (days)','Bekleme süresi':'Waiting period','Birincil emanetçi':'Primary trustee',
  'Birincil emanetçi atanmış':'Primary trustee assigned','Dijital Miras Yönetimi':'Digital Legacy Management','Diğer':'Other',
  'En az bir yetki paketi tanımlanmış':'At least one permission package defined','Etkin':'Active','Geri alma (saat)':'Rollback period (hours)',
  'Geri alma penceresi':'Rollback window','Geri alma penceresi tanımlanmış':'Rollback window defined','Güvenlik kontrol listesi':'Security checklist',
  'Hesap bulunamadı':'Account not found','Henüz onay kaydı yok.':'No approval record yet.','İkincil emanetçi':'Secondary trustee',
  'İlk dijital miras planını oluşturun.':'Create the first digital legacy plan.','İptal edildi':'Revoked','İsteği geri al':'Withdraw request',
  'İşlem başarısız.':'The operation failed.','Kayıt kimliği veya *':'Record ID or *','Kaynak türü':'Resource type',
  'Kişi bulunamadı':'Person not found','Kritik güvenlik alanı':'Critical security area','Miras planları':'Legacy plans',
  'Onayladı':'Approved','Onaylayan yöneticiler':'Approving administrators','paket':'packages','Plan bulunamadı':'No plan found',
  'Plan etkin durumda':'Plan is active','Plan oluştur':'Create plan','Plan sahibi':'Plan owner',
  'Plan seçilmedi':'No plan selected','Planı kaydet':'Save plan','Reddetti':'Rejected','Süre dolduysa kesinleştir':'Finalize when the waiting period ends',
  'Süre tamamlandı':'Time completed','Talimatlar':'Instructions','Talimatlar yazılmış':'Instructions provided','Taslak':'Draft',
  'Vefat doğrulama notu (en az 10 karakter):':'Death verification note (at least 10 characters):',
  'Vefat sonrası erişim devrini çift yönetici onayı, zaman kilidi ve geri alma penceresiyle yönetin.':'Manage post-death access transfer with dual-administrator approval, a time lock, and a rollback window.',
  'Yeni plan':'New plan','Yetki devrini geri al':'Revoke transferred permissions','Yetki paketi ekle':'Add permission package',
  'Yetki paketi eklenemedi.':'The permission package could not be added.','Yok':'None','Yönetici olarak onayla':'Approve as administrator',
  'Yönetici onayı':'Administrator approval','Yürütme bekliyor':'Pending execution','Yürütme isteği başlat':'Start execution request',
  'Yürütüldü':'Executed','İptal':'Cancel','Kaydet':'Save','Aile ilişkisi ekle':'Add family relationship',
  'Ayrıntıları görmek için soldan bir plan seçin.':'Select a plan on the left to view its details.',
  'Bekleme süresi tanımlanmış':'Waiting period defined','gün bekleme':'days waiting','Birincil emanetçi:':'Primary trustee:'
};

export const translateDigitalLegacyCopy=(source:string,language:SupportedUiLanguage):string=>{
  if(language==='tr')return source;
  const value=source.trim();const translated=exactCopy[value];
  if(!translated)return source;
  const leading=/^\s*/u.exec(source)?.[0]??'';const trailing=/\s*$/u.exec(source)?.[0]??'';
  return `${leading}${translated}${trailing}`;
};

const translatableProps=new Set(['aria-label','aria-description','title','description','body','eyebrow','placeholder','alt','label']);

export const localizeDigitalLegacyNode=(node:ReactNode,language:SupportedUiLanguage):ReactNode=>{
  if(language==='tr'||node===null||node===undefined||typeof node==='boolean'||typeof node==='number')return node;
  if(typeof node==='string')return translateDigitalLegacyCopy(node,language);
  if(Array.isArray(node))return Children.map(node,item=>localizeDigitalLegacyNode(item,language));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>;
  if(element.props['data-localization-preserve']===true)return element;
  const props:Record<string,unknown>={};
  for(const key of translatableProps){const value=element.props[key];if(typeof value==='string')props[key]=translateDigitalLegacyCopy(value,language);}
  if('actions' in element.props)props.actions=localizeDigitalLegacyNode(element.props.actions as ReactNode,language);
  if('children' in element.props)props.children=localizeDigitalLegacyNode(element.props.children as ReactNode,language);
  return cloneElement(element,props);
};
