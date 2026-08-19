import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { SupportedUiLanguage } from '@ppt/domain';

const exactCopy: Readonly<Record<string,string>> = {
  '2FA / kurtarma kodu':'2FA / recovery code',
  'Başka işlem kullanıyor':'In use by another operation',
  'Bu bilgisayar':'This computer',
  'Cihaz adı':'Device name',
  'Cihaz bağı':'Device binding',
  'Cihaz bağlı kimlik':'Device-bound identity',
  'Değişti':'Changed',
  'Donanım bulunamadı':'Hardware not found',
  'Doğrulanıyor…':'Verifying…',
  'Durumu yenile':'Refresh status',
  'Eşleşiyor':'Matches',
  'Etkin':'Active',
  'etkin değil':'not enabled',
  'gerekli':'required',
  'Güçlü yerel parola ile yedek doğrulama tamamlandı.':'Fallback verification with the strong local password was completed.',
  'Güvenlik dönemi':'Security epoch',
  'Hello olmazsa parola ile devam et':'Continue with password if Hello is unavailable',
  'Kasa bağı':'Vault binding',
  'Kayıt':'Enrollment',
  'Kayıt için mevcut yerel parola ve hesabınızda etkinse 2FA kodu doğrulanır. Ardından Windows Hello penceresi yalnız bu düğmeye bastığınızda açılır.':'Your current local password and, when enabled for the account, 2FA code are verified for enrollment. The Windows Hello prompt then opens only when you press this button.',
  'Kayıtlı değil':'Not enrolled',
  'Kaydı güvenli biçimde yenile':'Securely renew enrollment',
  'Kontrol ediliyor…':'Checking…',
  'Kritik işlem doğrulaması':'Critical-operation verification',
  'Kullanılabilir':'Available',
  'Kullanılamıyor':'Unavailable',
  'Mevcut yerel parola':'Current local password',
  'Parola yedeği':'Password fallback',
  'Platform desteklemiyor':'Platform not supported',
  'Sistem politikasıyla kapalı':'Disabled by system policy',
  'Tanılama':'Diagnostics',
  'Uygunluk belirlenemedi':'Availability could not be determined',
  'Uygunluk ve kayıt':'Availability and enrollment',
  'Windows Hello bekleniyor…':'Waiting for Windows Hello…',
  'Windows Hello doğrulamasını bu cihazdaki şifreli veri kasasına bağlayın; güçlü yerel parola her zaman yedek erişim yöntemi olarak kalır.':'Bind Windows Hello verification to the encrypted data vault on this device; the strong local password always remains available as a fallback access method.',
  'Windows Hello durumu okunamadı.':'Windows Hello status could not be read.',
  'Windows Hello iptal edilirse parola otomatik gönderilmez. Yedek doğrulama yalnız aşağıdaki ayrı düğmeyle ve açıkça yazdığınız bilgilerle çalışır.':'If Windows Hello is cancelled, the password is not submitted automatically. Fallback verification runs only through the separate button below and with the information you explicitly enter.',
  'Windows Hello kaydını yenile':'Renew Windows Hello enrollment',
  'Windows Hello kaydı tamamlanamadı.':'Windows Hello enrollment could not be completed.',
  'Windows Hello kullanıma hazır değil.':'Windows Hello is not ready for use.',
  'Windows Hello yapılandırılmamış':'Windows Hello is not configured',
  'Windows Hello ile yeniden doğrula':'Reauthenticate with Windows Hello',
  'Windows Hello’yu etkinleştir':'Enable Windows Hello',
  'Windows Hello’yu kaydet':'Enroll Windows Hello',
  'Windows kullanıcısı':'Windows user',
  'Yeniden doğrula':'Reauthenticate',
  'Yeniden doğrulama tamamlanamadı.':'Reauthentication could not be completed.',
  'Yerel parola':'Local password'
};

export const translateWindowsHelloCopy=(source:string,language:SupportedUiLanguage):string=>{
  if(language==='tr')return source;
  const value=source.trim();const translated=exactCopy[value];if(!translated)return source;
  const leading=/^\s*/u.exec(source)?.[0]??'';const trailing=/\s*$/u.exec(source)?.[0]??'';
  return `${leading}${translated}${trailing}`;
};

const propsToTranslate=new Set(['aria-label','aria-description','title','description','body','message','eyebrow','placeholder','alt','label']);
export const localizeWindowsHelloNode=(node:ReactNode,language:SupportedUiLanguage):ReactNode=>{
  if(language==='tr'||node===null||node===undefined||typeof node==='boolean'||typeof node==='number')return node;
  if(typeof node==='string')return translateWindowsHelloCopy(node,language);
  if(Array.isArray(node))return Children.map(node,item=>localizeWindowsHelloNode(item,language));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>;const props:Record<string,unknown>={};
  for(const key of propsToTranslate){const value=element.props[key];if(typeof value==='string')props[key]=translateWindowsHelloCopy(value,language);}
  if('actions' in element.props)props.actions=localizeWindowsHelloNode(element.props.actions as ReactNode,language);
  if('children' in element.props)props.children=localizeWindowsHelloNode(element.props.children as ReactNode,language);
  return cloneElement(element,props);
};
