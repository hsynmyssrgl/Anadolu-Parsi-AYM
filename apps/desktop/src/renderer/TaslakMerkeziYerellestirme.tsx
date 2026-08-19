import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { SupportedUiLanguage } from '@ppt/domain';

const exactCopy: Readonly<Record<string,string>> = {
  'Ağ bağlantısı yok; yerel kayıt isteği yine merkezi PEP/UoW ve offline lease kararına gider. Ağ üzerinden teslim garantisi verilmez.':'There is no network connection; the local save request still goes through the central PEP/UoW and offline-lease decision. Network delivery is not guaranteed.',
  'Alan hataları düzeltilene kadar kayıt bekliyor.':'Saving waits until field errors are corrected.',
  'Başlık ve not yazdığınızda geçerli içerik 700 ms sonra kişisel alana otomatik kaydedilir.':'When you enter a title and note, valid content is automatically saved to the personal area after 700 ms.',
  'Çalışma başlığı':'Workspace title','Çalışma notu':'Workspace note','Çevrimdışı çalışma':'Offline work','Değişiklik geçmişi':'Change history',
  'Değişiklik geçmişi yenilenemedi':'Change history could not be refreshed','Değişiklikler otomatik kayıt için bekliyor.':'Changes are waiting for autosave.',
  'Ekrandaki veri korunuyor; aynı geri alma işlemi güvenli biçimde yeniden denenebilir.':'The on-screen data is preserved; the same undo operation can be retried safely.',
  'Geçmiş henüz boş':'History is empty','Geri alındı':'Undone','Geri alınıyor…':'Undoing…','Geri alma tamamlanamadı':'Undo could not be completed',
  'Girdi ekranda korunuyor; aynı işlem kimliği ve özgün revizyonla güvenli biçimde yeniden denenebilir.':'The input remains on screen; it can be retried safely with the same operation ID and original revision.',
  'Hassas taslak içeriği localStorage/sessionStorage içine yazılmaz; merkezi kişisel PEP/UoW ve değişmez revizyon geçmişi kullanılır.':'Sensitive draft content is not written to localStorage/sessionStorage; the central personal PEP/UoW and immutable revision history are used.',
  'Henüz kayıtlı taslak yok':'No saved draft yet','Her başarılı otomatik kayıt ve geri alma değişmez bir sürüm olarak burada görünür.':'Every successful autosave and undo appears here as an immutable revision.',
  'Kaydedildi':'Saved','Kaydediliyor…':'Saving…','Kayıt işlemi tamamlandı; yalnızca geçmiş görünümü güncellenemedi.':'The save completed; only the history view could not be refreshed.',
  'Kişisel taslak alanına güvenli erişim kurulamadı.':'Secure access to the personal draft area could not be established.',
  'Kişisel, sürümlü taslak ve değişiklik geçmişi hazırlanıyor.':'Preparing the personal versioned draft and change history.',
  'Otomatik kayıt tamamlanamadı':'Autosave could not be completed','Son değişikliği geri al':'Undo last change','Şimdi kaydet':'Save now',
  'Taslak başlığı 120 karakteri aşamaz.':'The draft title cannot exceed 120 characters.','Taslak başlığı zorunludur.':'The draft title is required.',
  'Taslak merkezi yüklenemedi':'Draft center could not be loaded','Taslak merkezi yükleniyor':'Loading draft center',
  'Taslak notu 5.000 karakteri aşamaz.':'The draft note cannot exceed 5,000 characters.','Taslak, otomatik kayıt ve geri alma merkezi':'Draft, autosave, and undo center'
};

export const translateDraftCenterCopy=(source:string,language:SupportedUiLanguage):string=>{
  if(language==='tr')return source;
  const value=source.trim();const translated=exactCopy[value];if(!translated)return source;
  const leading=/^\s*/u.exec(source)?.[0]??'';const trailing=/\s*$/u.exec(source)?.[0]??'';
  return `${leading}${translated}${trailing}`;
};

const propsToTranslate=new Set(['aria-label','aria-description','title','description','body','message','eyebrow','placeholder','alt','label']);
export const localizeDraftCenterNode=(node:ReactNode,language:SupportedUiLanguage):ReactNode=>{
  if(language==='tr'||node===null||node===undefined||typeof node==='boolean'||typeof node==='number')return node;
  if(typeof node==='string')return translateDraftCenterCopy(node,language);
  if(Array.isArray(node))return Children.map(node,item=>localizeDraftCenterNode(item,language));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>;const props:Record<string,unknown>={};
  for(const key of propsToTranslate){const value=element.props[key];if(typeof value==='string')props[key]=translateDraftCenterCopy(value,language);}
  if('actions' in element.props)props.actions=localizeDraftCenterNode(element.props.actions as ReactNode,language);
  if('children' in element.props)props.children=localizeDraftCenterNode(element.props.children as ReactNode,language);
  return cloneElement(element,props);
};
