import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { SupportedUiLanguage } from '@ppt/domain';

const exactCopy: Readonly<Record<string,string>> = {
  '(isteğe bağlı)':'(optional)','＋ Dosya ekle':'＋ Add file','Aç':'Open','Açıklama':'Description','Açıklama yok':'No description','Aile ilişkisi':'Family relationship',
  'kayıt yüklendi':'records loaded','Toplu sınıflandır (':'Bulk classify (','yüklü kayıt':'loaded records',
  'Ara':'Search','Arşiv etiketi':'Archive tag','Arşiv hassasiyet seviyesi':'Archive sensitivity level','Arşiv kategorileri':'Archive categories',
  'Arşiv kategorisi':'Archive category','Arşiv MIME türü':'Archive MIME type','Arşiv sayfası yüklenemedi.':'The archive page could not be loaded.',
  'Arşiv sürümleri yüklenemedi.':'Archive versions could not be loaded.','Arşivde başlık, dosya adı veya etiket ara':'Search archive title, file name, or tag',
  'Aynı':'Same','Ayrıntıları görmek için listeden bir belge seçin.':'Choose a document in the list to view its details.',
  'Bağlı önemli gün':'Linked important date','Başlık, dosya adı veya etiket ara':'Search title, file name, or tag','Belge ayrıntısı':'Document details','Bütünlük bilgisi hazır':'Integrity information is ready','Bütünlük kaydı hazır':'Integrity record is ready',
  'Belge bulunamadı':'No document found','Belge seçilmedi':'No document selected','Belge, aile ilişkisi, tarih ve güven düzeyi birlikte kaydedilir.':'The document, family relationship, date, and confidence level are recorded together.',
  'Belgeler':'Documents','Boyut':'Size','Boyut farkı':'Size difference','Bu belge güvenli biçimde imha edilecek. Devam edilsin mi?':'This document will be securely destroyed. Continue?',
  'Bu belgeyi kendi adınıza üstlenin':'Claim this document in your own name','Bu kanıt etkin görünümden kaldırılacak; değişmez geçmiş kaydı korunacak. Devam edilsin mi?':'This evidence will be removed from the active view; its immutable history will be preserved. Continue?',
  'Bu kategorinin kullanım amacı':'Purpose of this category','Bu kayıt eski sürümden geldiği için kişi sahibi mühürlü değildir. İşlem yalnız oturumdaki aile yöneticisinin kendi kişi profiline bağlanır; başka bir kişi seçilemez ve sonradan sahip değiştirilemez.':'Because this record came from an older version, its person owner is not sealed. The operation binds only to the signed-in family administrator’s own person profile; another person cannot be selected and ownership cannot later be changed.',
  'Bu sürümde ne değişti?':'What changed in this version?','Büyük arşivlerde yalnız ihtiyaç duyduğunuz kayıtlar aşamalı olarak yüklenir; filtreler aradığınız belgeyi hızlıca bulmanıza yardımcı olur.':'Large archives load only the records you need in stages, and filters help you find the right document quickly.',
  'Değişti':'Changed','Doküman Merkezi':'Document Center','Dosya':'File','Dosya adı':'File name','Dosya eklenemedi.':'The file could not be added.',
  'Dosya seçimi güvenli uygulama alanında yapılır. Sonuç belirsizse aynı dosyayla yeniden deneyin; onaylanmamış bir işlemin yeniden başlatma sonrasında tamamlandığı varsayılmaz.':'File selection takes place in the secure application area. If the result is uncertain, retry with the same file; an unconfirmed action is not assumed to have completed after a restart.',
  'Düşük':'Low','Düzenleme':'Editing','Doğrulanıyor…':'Verifying…','Eklendi':'Added','Eklenme':'Added at','Eski arşiv sahipliği yeniden doğrulanamadı.':'Legacy archive ownership could not be reverified.',
  'Eski arşiv sahipliğini yeniden doğrulama':'Reverify legacy archive ownership','Eski kayıt · Sahiplik doğrulanmamış':'Legacy record · Ownership unverified',
  'Etiket':'Tag','etiket yok':'no tags','Etiketler (virgülle):':'Tags (comma-separated):','Etkin bağdan kaldır':'Remove active link',
  'Etkin ilişki kanıtı yok':'No active relationship evidence','Etkinlik bağlantısı yok':'No event link','Farklı':'Different',
  'Filtreleri değiştirin veya yeni belge ekleyin.':'Change the filters or add a new document.','Geçmişi kapat':'Close history',
  'Gelişmiş belge yaşam döngüsü':'Advanced document lifecycle','Gün':'Days','Güçlü doğrulamayla sahipliği üstlen':'Claim ownership with strong authentication',
  'güvenli imha':'secure destruction','Güven düzeyi':'Confidence level','Güvenli imha':'Secure destruction','Hassasiyet: standard / personal / high':'Sensitivity: standard / personal / high',
  'Henüz değişmez kanıt geçmişi yok.':'No immutable evidence history yet.','İçerik özeti':'Content summary','İki aşamalı doğrulama kodu (varsa)':'Two-factor authentication code (if any)',
  'İlişki kanıtı':'Relationship evidence','İlişki kanıtı eklenemedi.':'Relationship evidence could not be added.','İlişki kanıtı kaldırılamadı.':'Relationship evidence could not be removed.',
  'İlişki kanıtları yüklenemedi.':'Relationship evidence could not be loaded.','İlişki seçin':'Select a relationship','İmha işlemi başarısız.':'Destruction failed.',
  'İmha kuyruğu':'Destruction queue','İmhaya hazır':'Ready for destruction','Kaldırıldı':'Removed','Kaldırma işlemi önceki kopyaları kendiliğinden yok etmez. Hesap, sahip ve dosya konumu gibi özel bilgiler bu ekrana aktarılmaz.':'Removing an item does not automatically erase earlier copies. Private details such as the account, owner, and file location are not shown on this screen.',
  'Kanıt olarak bağla':'Link as evidence','Kanıt tarihi':'Evidence date','Kategori adı':'Category name','Kategori kimliği (boş = mevcut kategori):':'Category ID (empty = current category):',
  'Kategori oluştur':'Create category','Kategorisiz':'Uncategorized','Kişisel':'Personal','Koruma altında':'Protected','Kuyruk boş':'Queue is empty',
  'MIME türü':'MIME type','Onay metni:':'Confirmation text:','Onay metnini birebir yazın':'Enter the exact confirmation text','Orta':'Medium','Örn. Tapular':'Example: Deeds',
  'Parola':'Password','Politika adı':'Policy name','Politika oluştur':'Create policy','Politika yok':'No policy','Politika yönetimi':'Policy management',
  'Saklama politikaları':'Retention policies','Saklama politikası':'Retention policy','Saklama politikası atanamadı.':'The retention policy could not be assigned.',
  'Seçili belgeyi mevcut bir aile ilişkisine kanıt olarak bağlayabilirsiniz.':'You can link the selected document as evidence for an existing family relationship.',
  'Sonraki 80 belgeyi yükle':'Load the next 80 documents','standart silme':'standard deletion','Standart':'Standard','Sürüm geçmişi':'Version history',
  'Sürüm karşılaştırması':'Version comparison','Sürüm notu':'Version note','Temizle':'Clear','Toplu sınıflandırma başarısız.':'Bulk classification failed.',
  'Tüm hassasiyetler':'All sensitivity levels','Tüm kategoriler':'All categories','Tür':'Type','Yeni belge başlığı':'New document title',
  'Yeni belge sürümü eklenemedi.':'A new document version could not be added.','Yeni sürüm dosyası seç':'Select new version file',
  'Yüklenen sayfada saklama süresi dolmuş belge yok.':'No document on the loaded page has reached the end of its retention period.',
  'Yükleniyor…':'Loading…','Yüksek':'High',' · güven ':' · confidence ',' · değişiklik no ':' · change no. ',
  'Aynı işlem kimliğiyle yeniden deneyebilirsiniz.':'You can retry with the same operation ID.',
  'Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.':'You can retry with the same operation ID and revision.',
  'Belirsiz sonuçta aynı dosya ve işlem kimliğiyle yeniden deneyin.':'If the result is uncertain, retry with the same file and operation ID.'
};

const patterns: ReadonlyArray<readonly [RegExp,string]> = [
  [/^(\d+) kayıt yüklendi/u,'$1 records loaded'],[/^Toplu sınıflandır \((\d+)\)$/u,'Bulk classify ($1)'],
  [/^Geçmiş \((\d+)\)$/u,'History ($1)'],[/^(\d+) yüklü kayıt$/u,'$1 loaded records'],
  [/^(\d+) gün$/u,'$1 days'],[/^güven (.+) · revizyon (\d+)$/u,'confidence $1 · revision $2'],
  [/^Saklama bitişi: (.+)$/u,'Retention ends: $1'],[/^Onay metni: (.+)$/u,'Confirmation text: $1']
];

const preserveWhitespace=(source:string,translated:string):string=>{
  const leading=/^\s*/u.exec(source)?.[0]??'';const trailing=/\s*$/u.exec(source)?.[0]??'';
  return `${leading}${translated}${trailing}`;
};

export const translateArchiveCenterCopy=(source:string,language:SupportedUiLanguage):string=>{
  if(language==='tr')return source;
  const value=source.trim();const exact=exactCopy[value];if(exact)return preserveWhitespace(source,exact);
  let translated=value;let matched=false;
  for(const [pattern,replacement] of patterns)if(pattern.test(translated)){translated=translated.replace(pattern,replacement);matched=true;}
  return matched?preserveWhitespace(source,translated):source;
};

const translatableProps=new Set(['aria-label','aria-description','title','description','body','eyebrow','placeholder','alt','label']);

export const localizeArchiveCenterNode=(node:ReactNode,language:SupportedUiLanguage):ReactNode=>{
  if(language==='tr'||node===null||node===undefined||typeof node==='boolean'||typeof node==='number')return node;
  if(typeof node==='string')return translateArchiveCenterCopy(node,language);
  if(Array.isArray(node))return Children.map(node,item=>localizeArchiveCenterNode(item,language));
  if(!isValidElement(node))return node;
  const element=node as ReactElement<Record<string,unknown>>;
  if(element.props['data-localization-preserve']===true)return element;
  const props:Record<string,unknown>={};
  for(const key of translatableProps){const value=element.props[key];if(typeof value==='string')props[key]=translateArchiveCenterCopy(value,language);}
  if('actions' in element.props)props.actions=localizeArchiveCenterNode(element.props.actions as ReactNode,language);
  if('children' in element.props)props.children=localizeArchiveCenterNode(element.props.children as ReactNode,language);
  return cloneElement(element,props);
};
