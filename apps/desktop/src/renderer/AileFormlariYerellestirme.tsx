import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { SupportedUiLanguage } from '@ppt/domain';

const exactCopy:Readonly<Record<string,string>>={
  'Yeni aile üyesi':'New family member','Hazır yakınlık kataloğundan seçim yapın; referans kişiye göre karşılıklı soy ağacı bağlantıları otomatik kurulsun.':'Choose from the relationship catalog so reciprocal family-tree links are created automatically relative to the reference person.',
  'Ad soyad':'Full name','Ad ve soyad':'Full name','Doğum tarihi':'Date of birth','Yakınlık türü':'Relationship type','Özel yakınlık adı':'Custom relationship name','Örn. Aile büyüğü':'For example, family elder','Kime göre?':'Relative to whom?','Nesil':'Generation','Aile dalı':'Family branch','Ana Dal':'Main Branch','Otomatik bağlantı':'Automatic link','İptal':'Cancel','Kaydediliyor…':'Saving…','Üyeyi ve bağları kaydet':'Save member and links',
  'Önemli gün oluştur':'Create important day','Katılımcılar tüm aile listesini yüklemeden arama destekli katalogdan seçilir.':'Participants are selected from the searchable catalog without loading the entire family list.','Başlık':'Title','Örn. Aile buluşması':'For example, family gathering','Tarih':'Date','Saat':'Time','Harita kaydı':'Map record','Kayıt seçilmedi':'No record selected','Serbest konum':'Free-form location','Mekân, şehir veya adres':'Venue, city, or address','Açıklama':'Description','Etkinliğin kısa açıklaması':'Short event description','Davetiye metni':'Invitation text','Dijital davetiyede yer alacak metin':'Text to include in the digital invitation','Tekrar':'Repeat','Tek sefer':'Once','Her yıl':'Every year','Hatırlat':'Remind','Aynı gün':'Same day','gün önce':'days before','Notlar ve anılar':'Notes and memories','Planlama notları, hediyeler veya anılar':'Planning notes, gifts, or memories','Bu kaydın izinli yapay zekâ aramalarında kullanılmasına izin ver':'Allow this record to be used in authorized AI searches','Önemli günü kaydet':'Save important day',
  'Olayı düzenle':'Edit event','Tarih, konum, gizlilik, katılımcı, davetiye ve hatırlatmaların tamamı güncellenir.':'Date, location, privacy, participants, invitation, and reminders are all updated.','Tarih ve saat':'Date and time','Harita kaydı kullanılıyor':'A map record is in use','Gizlilik':'Privacy','Tüm aile':'Entire family','Seçili üyeler':'Selected members','Kişisel':'Personal','Hatırlatmalar':'Reminders','Tüm değişiklikleri kaydet':'Save all changes',
  'Yeni konum':'New location','Etkinlikler ve aile coğrafi hafızası için harita kaydı oluşturun.':'Create a map record for events and the family geographic memory.','Konum adı':'Location name','Örn. Sakarya Aile Evi':'For example, Sakarya Family Home','Adres':'Address','Adres veya açıklama':'Address or description','Enlem':'Latitude','Boylam':'Longitude','Tür':'Type','Etkinlik yeri':'Event venue','İkamet':'Residence','Anı yeri':'Memory place','Diğer':'Other','Konumu kaydet':'Save location',
  'Aile coğrafi hafızası':'Family geographic memory','Konum ve harita':'Locations and map','Etkinlik yerlerini, ikametleri ve aile anı noktalarını yalnız bu cihazda görüntüleyin.':'View event venues, residences, and family memory places only on this device.','＋ Konum ekle':'＋ Add location','konum':'locations','Kayıtlı yerler':'Saved places','Kayıtlı konum yok':'No saved locations','Haritada göstermek için ilk aile konumunu ekleyin.':'Add the first family location to show it on the map.','bekleyen hatırlatma':'pending reminders','Bildirim merkezi':'Notification center','Okundu işaretle':'Mark as read','Hatırlatma yok':'No reminders','Yaklaşan veya okunmamış önemli gün bildirimi bulunmuyor.':'There are no upcoming or unread important-day notifications.',
  'Çekirdek aile':'Immediate family','Üst soy':'Ancestors','Alt soy':'Descendants','Kardeşler':'Siblings','Geniş aile':'Extended family','Evlilik yoluyla aile':'Family by marriage','Vasi ve bakım':'Guardians and care',
  'Anne':'Mother','Baba':'Father','Ebeveyn':'Parent','Üvey anne':'Stepmother','Üvey baba':'Stepfather','Koruyucu ebeveyn':'Foster parent','Eş':'Spouse','Eski eş':'Former spouse','Nişanlı':'Fiancé','Kız':'Daughter','Oğul':'Son','Çocuk':'Child','Üvey çocuk':'Stepchild','Evlatlık':'Adopted child','Kız kardeş':'Sister','Erkek kardeş':'Brother','Kardeş':'Sibling','Üvey kardeş':'Stepsibling','Büyükanne':'Grandmother','Büyükbaba':'Grandfather','Büyük ebeveyn':'Grandparent','Kız torun':'Granddaughter','Erkek torun':'Grandson','Torun':'Grandchild','Büyük büyükanne':'Great-grandmother','Büyük büyükbaba':'Great-grandfather','Torunun çocuğu':'Great-grandchild','Hala':'Paternal aunt','Amca':'Paternal uncle','Teyze':'Maternal aunt','Dayı':'Maternal uncle','Kız yeğen':'Niece','Erkek yeğen':'Nephew','Kuzen':'Cousin','Gelin':'Daughter-in-law','Damat':'Son-in-law','Enişte':'Brother-in-law','Yenge':'Sister-in-law','Kayınbirader':'Brother-in-law','Baldız':'Sister-in-law','Görümce':'Sister-in-law','Kayınvalide':'Mother-in-law','Kayınpeder':'Father-in-law','Elti':'Co-sister-in-law','Bacanak':'Co-brother-in-law','Vasi':'Guardian','Bakıcı':'Caregiver','Aile dostu':'Family friend',
  'Bu yakınlık için kime göre olduğu seçilmelidir.':'A reference person must be selected for this relationship.','Kayıt oluşturulamadı.':'The record could not be created.','Etkinlik oluşturulamadı.':'The event could not be created.','Olay güncellenemedi.':'The event could not be updated.','Konum kaydedilemedi.':'The location could not be saved.'
};

const fragments=Object.entries(exactCopy).sort(([left],[right])=>right.length-left.length);
export const translateFamilyFormsCopy=(source:string,language:SupportedUiLanguage):string=>{
  if(language==='tr')return source;
  const value=source.trim();const translated=exactCopy[value];
  if(translated){const leading=/^\s*/u.exec(source)?.[0]??'';const trailing=/\s*$/u.exec(source)?.[0]??'';return `${leading}${translated}${trailing}`;}
  let localized=source;
  for(const [turkish,english] of fragments){if(turkish.length>=4&&localized.includes(turkish))localized=localized.split(turkish).join(english);}
  return localized;
};

const propsToTranslate=new Set(['aria-label','aria-description','title','subtitle','description','body','message','eyebrow','placeholder','alt','label']);
export const localizeFamilyFormsNode=(node:ReactNode,language:SupportedUiLanguage):ReactNode=>{
  if(language==='tr'||node===null||node===undefined||typeof node==='boolean'||typeof node==='number')return node;
  if(typeof node==='string')return translateFamilyFormsCopy(node,language);
  if(Array.isArray(node))return Children.map(node,item=>localizeFamilyFormsNode(item,language));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>;const props:Record<string,unknown>={};
  if(element.props['data-localization-preserve']===true)return element;
  for(const key of propsToTranslate){const value=element.props[key];if(typeof value==='string')props[key]=translateFamilyFormsCopy(value,language);}
  if('actions' in element.props)props.actions=localizeFamilyFormsNode(element.props.actions as ReactNode,language);
  if('children' in element.props)props.children=localizeFamilyFormsNode(element.props.children as ReactNode,language);
  return cloneElement(element,props);
};
