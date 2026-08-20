import type { ProductScreenId } from '@ppt/domain/renderer';
import { startSilverHelpNarration, type SilverHelpNarrationStatus } from './NarratedHelpCenter';

export const MENU_FIRST_VISIT_NARRATION_VERSION = 'v1' as const;

export interface MenuNarrationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const MENU_CAPABILITIES: Readonly<Record<ProductScreenId, Readonly<{ tr: string; en: string }>>> = Object.freeze({
  dashboard:{tr:'Ailenizin yaklaşan günlerini, son kayıtlarını, sağlık ve sistem özetlerini görebilirsiniz.',en:'Review upcoming family dates, recent records, health information and system summaries.'},
  family:{tr:'Aile bireylerini ekleyebilir, temel bilgilerini düzenleyebilir ve güvenli aile alanını yönetebilirsiniz.',en:'Add family members, update their basic information and manage the secure family space.'},
  households:{tr:'Haneleri, aile dallarını ve üyelik bağlarını oluşturup yönetebilirsiniz.',en:'Create and manage households, family branches and membership links.'},
  'people-lifecycle':{tr:'Kişi profillerini, yaşam durumlarını ve aile içindeki sorumluluklarını yönetebilirsiniz.',en:'Manage person profiles, life states and responsibilities within the family.'},
  tree:{tr:'Akrabalık bağlarını ekleyebilir ve soy ağacını görsel olarak inceleyebilirsiniz.',en:'Add relationships and explore the family tree visually.'},
  timeline:{tr:'Aile olaylarını tarih sırasıyla izleyebilir ve yaşam kayıtlarını ilişkilendirebilirsiniz.',en:'Review family events chronologically and connect related life records.'},
  'important-days':{tr:'Doğum günlerini, yıl dönümlerini ve hatırlatmaları ekleyip takip edebilirsiniz.',en:'Add and track birthdays, anniversaries and reminders.'},
  archive:{tr:'Belgeleri yerel arşive alabilir, sınıflandırabilir, arayabilir ve yetkili kayıtlarla ilişkilendirebilirsiniz.',en:'Import, classify and search local documents, then link them to authorized records.'},
  finance:{tr:'Gelir, gider, hesap, kart, kredi, planlama ve uzun vadeli finans kayıtlarını yönetebilirsiniz.',en:'Manage income, expenses, accounts, cards, loans, planning and long-term financial records.'},
  health:{tr:'Sağlık kayıtlarını, ilaç planlarını, aile sağlık geçmişini ve bakım koordinasyonunu yönetebilirsiniz.',en:'Manage health records, medication plans, family health history and care coordination.'},
  'life-center':{tr:'Günlük yaşam, ev işleri, eğitim, toplantı, seyahat, varlık ve evcil hayvan kayıtlarını yönetebilirsiniz.',en:'Manage daily life, household tasks, education, meetings, travel, assets and pet records.'},
  automation:{tr:'Yerel bildirimler ve güvenli otomasyon kuralları oluşturup etkinliklerini yönetebilirsiniz.',en:'Create local notifications and safe automation rules, then manage whether they are active.'},
  reports:{tr:'Aile alanındaki kayıtların özetlerini ve izin verilen raporlarını inceleyebilirsiniz.',en:'Review summaries and authorized reports for records in the family space.'},
  location:{tr:'Aile için önemli yerleri kaydedebilir ve harita üzerinde inceleyebilirsiniz.',en:'Save important family places and review them on the map.'},
  invitations:{tr:'Aile alanına gönderilen davetleri güvenli biçimde inceleyip yönetebilirsiniz.',en:'Safely review and manage invitations to the family space.'},
  'data-repair':{tr:'Veri bütünlüğü sorunlarını görebilir ve doğrulanmış onarım adımlarını uygulayabilirsiniz.',en:'Review data integrity issues and apply verified repair actions.'},
  permissions:{tr:'Kimin hangi aile verisine, hangi amaçla erişebileceğini inceleyip yönetebilirsiniz.',en:'Review and manage who may access family data and for what purpose.'},
  ai:{tr:'Yerel yapay zekâ izinlerini, hafıza kayıtlarını ve işleme sınırlarını yönetebilirsiniz.',en:'Manage local AI permissions, memory records and processing boundaries.'},
  legacy:{tr:'Dijital miras planlarını, yetkileri ve onayları güvenli biçimde yönetebilirsiniz.',en:'Safely manage digital legacy plans, grants and approvals.'},
  'windows-hello':{tr:'Bu cihazda Windows Hello ile güvenli giriş ve geçiş anahtarı seçeneklerini yönetebilirsiniz.',en:'Manage Windows Hello sign-in and passkey options on this device.'},
  security:{tr:'Gizlilik, veri sahipliği, parola, iki aşamalı doğrulama, olay kontrolü ve yedekleme ayarlarını yönetebilirsiniz.',en:'Manage privacy, data ownership, passwords, two-factor authentication, incident controls and backups.'},
  settings:{tr:'Dil, görünüm, erişilebilirlik, bakım, tanılama ve yerel sistem tercihlerini yönetebilirsiniz.',en:'Manage language, appearance, accessibility, maintenance, diagnostics and local system preferences.'}
});

export const menuFirstVisitNarrationStorageKey = (language: string, screen: ProductScreenId): string =>
  `ppt-menu-narration-${MENU_FIRST_VISIT_NARRATION_VERSION}:${language}:${screen}`;

export const menuFirstVisitNarrationText = (
  screen: ProductScreenId,
  label: string,
  language: 'tr' | 'en'
): string => language === 'tr'
  ? `${label} bölümündesiniz. ${MENU_CAPABILITIES[screen].tr} Bu anlatımı Durdur düğmesiyle istediğiniz anda durdurabilir, daha sonra F1 Sesli Yardım Merkezinden yeniden dinleyebilirsiniz.`
  : `You are in the ${label} section. ${MENU_CAPABILITIES[screen].en} You can stop this narration at any time with the Stop button and play it again later from the F1 Narrated Help Center.`;

export const shouldNarrateMenuFirstVisit = (
  storage: MenuNarrationStorage | undefined,
  language: string,
  screen: ProductScreenId
): boolean => {
  try { return storage?.getItem(menuFirstVisitNarrationStorageKey(language,screen)) !== '1'; }
  catch { return false; }
};

export const markMenuFirstVisitNarrated = (
  storage: MenuNarrationStorage | undefined,
  language: string,
  screen: ProductScreenId
): boolean => {
  try {
    if (!storage) return false;
    storage.setItem(menuFirstVisitNarrationStorageKey(language,screen),'1');
    return true;
  } catch { return false; }
};

export const startMenuFirstVisitNarration = <TUtterance extends { lang:string; rate:number; pitch:number }>(input:{
  text:string;
  language:'tr'|'en';
  synthesis:{cancel():void;speak(utterance:TUtterance):void}|undefined;
  createUtterance:((text:string)=>TUtterance)|undefined;
  onStatus:(status:SilverHelpNarrationStatus)=>void;
}):SilverHelpNarrationStatus => startSilverHelpNarration({...input,rate:'normal'});
