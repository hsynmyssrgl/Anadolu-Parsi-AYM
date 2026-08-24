import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { UnifiedAuthorizedSearchView } from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

const modes = ['standard','easy_read','guest','child','senior','caregiver','kitchen_tablet'] as const;
const modeLabel:Record<(typeof modes)[number],string> = {
  standard:'Standart',easy_read:'Kolay okuma',guest:'Misafir',child:'Çocuk',senior:'İleri yaş',
  caregiver:'Bakım veren',kitchen_tablet:'Mutfak tableti'
};
const moduleLabel:Record<UnifiedAuthorizedSearchView['items'][number]['module'],string> = {
  family:'Aile',event:'Olay',archive:'Belge',finance:'Finans',health:'Sağlık',life:'Yaşam'
};
const homeCards = ['today','inbox','tasks','health'] as const;
type HomeCard = (typeof homeCards)[number];

export function UniversalUxConsolidationPanel() {
  const {language}=useLocalization();
  const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const [query,setQuery] = useState('');
  const [result,setResult] = useState<UnifiedAuthorizedSearchView>();
  const [searchError,setSearchError] = useState('');
  const [searching,setSearching] = useState(false);
  const [mode,setMode] = useState<(typeof modes)[number]>('standard');
  const [cards,setCards] = useState<HomeCard[]>([...homeCards]);
  const cardLabels:Record<HomeCard,string> = {
    today:text('Bugün','Today'),inbox:text('Gelenler','Inbox'),tasks:text('Görevler','Tasks'),health:text('Sağlık','Health')
  };
  const searchGeneration = useRef(0);
  useEffect(() => () => { searchGeneration.current += 1; }, []);

  const search = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.normalize('NFKC').trim();
    if (!window.pardus || normalized.length < 2) return;
    const generation = ++searchGeneration.current;
    setSearching(true);
    setSearchError('');
    try {
      const next = await window.pardus.searchUnifiedAuthorizedRecords({query:normalized,limit:25});
      if (generation === searchGeneration.current) setResult(next);
    } catch (caught) {
      if (generation === searchGeneration.current) {
        setResult(undefined);
        setSearchError(toUserFacingErrorMessage(caught,text('Yetkili evrensel arama tamamlanamadı.','Authorized universal search could not be completed.')));
      }
    } finally {
      if (generation === searchGeneration.current) setSearching(false);
    }
  };
  const move = (index:number,direction:-1|1) => setCards(current => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index],next[target]] = [next[target]!,next[index]!];
    return next;
  });

  return <section className="universal-ux panel" aria-labelledby="universal-ux-title">
    <div className="panel-heading"><div><span className="eyebrow">{text('Windows dayanıklılığı ve evrensel kullanım deneyimi','Windows resilience and universal UX')}</span>
      <h2 id="universal-ux-title">{text('Tek aile görünümü','Unified family view')}</h2></div></div>
    <div className="communication-recording-truth" role="note">
      <strong>{text('Bu yüzeydeki veri araması üretim kaynaklarının çağrı anındaki merkezi okuma yetkileriyle çalışır.','Search on this surface uses the centralized read permissions of production sources at call time.')}</strong>
      <span>{text('Aile, olay, belge, finans, sağlık ve yaşam kaynaklarından biri yetkilendirilemezse kısmi sonuç gösterilmez.','No partial result is shown if any family, event, document, finance, health or life source cannot be authorized.')}</span>
      <span>{text('Aramanız kaydedilmez ve bu bilgisayardan dışarı gönderilmez.','Your search is not saved or sent outside this computer.')}</span>
      <span>{text('Kurulum deneyimi uzun süreli kullanım doğrulaması tamamlanana kadar geliştirme aşamasındadır.','The installation experience remains in development until long-term usage verification is complete.')}</span>
      <span>{text('QR ve barkod okuma, kamera kırpma, sesle form doldurma, mini panel ve Apple araçları henüz kullanıma hazır değildir.','QR and barcode scanning, camera cropping, voice form entry, the mini panel, and Apple tools are not yet ready to use.')}</span>
      <span>{text('Güvenlik düzeyi kendiliğinden düşürülmez; böyle bir değişiklik yalnız açık kullanıcı kararı ve doğrulanmış geri dönüş planıyla yapılabilir.','The security level is never lowered automatically; such a change requires an explicit user decision and a verified rollback plan.')}</span>
    </div>
    <div className="workspace-grid"><section><h3>{text('Yetki filtreli evrensel arama','Permission-filtered universal search')}</h3>
      <form onSubmit={event => void search(event)}><label htmlFor="universal-ux-search">{text('Tüm modüllerde ara','Search all modules')}</label>
        <input id="universal-ux-search" value={query} maxLength={80}
          onChange={event => setQuery(event.target.value)} placeholder={text('En az iki karakter yazın','Enter at least two characters')}/>
        <button type="submit" disabled={searching || query.normalize('NFKC').trim().length < 2}>
          {searching ? text('Aranıyor…','Searching…') : text('Yetkili ara','Authorized search')}
        </button></form>
      {searchError ? <p role="alert">{searchError}</p> : null}
      {result ? <div className="universal-ux-authorized-results" aria-live="polite">
        <small>{result.items.length} {text('yetkili sonuç','authorized results')} · {result.searchedModules.length} {text('modül','modules')}
          {result.truncated ? text(' · ilk 25 gösteriliyor',' · showing the first 25') : ''}</small>
        {result.items.length ? <ul>{result.items.map(item => <li key={`${item.resourceType}:${item.resourceId}`}>
          <strong>{item.title}</strong><small> · {language==='tr'?moduleLabel[item.module]:({family:'Family',event:'Event',archive:'Document',finance:'Finance',health:'Health',life:'Life'} as const)[item.module]}</small>
        </li>)}</ul> : <p>{text('Yetkili sonuç bulunamadı.','No authorized results were found.')}</p>}
      </div> : null}
    </section><section><h3>{text('Kişisel görünüm modu','Personal view mode')}</h3><label>{text('Mod','Mode')}<select value={mode}
      onChange={event => setMode(event.target.value as (typeof modes)[number])}>{modes.map(item =>
        <option key={item} value={item}>{language==='tr'?modeLabel[item]:({standard:'Standard',easy_read:'Easy read',guest:'Guest',child:'Child',senior:'Senior',caregiver:'Caregiver',kitchen_tablet:'Kitchen tablet'} as const)[item]}</option>)}</select></label>
      <p>{text('Seçili mod:','Selected mode:')} <strong>{language==='tr'?modeLabel[mode]:({standard:'Standard',easy_read:'Easy read',guest:'Guest',child:'Child',senior:'Senior',caregiver:'Caregiver',kitchen_tablet:'Kitchen tablet'} as const)[mode]}</strong>. {text('Bu oturumdaki önizleme kalıcı tercih olarak kaydedilmez.','The preview in this session is not saved as a persistent preference.')}</p>
    </section></div>
    <section><h3>{text('Ana ekran kart sırası','Home card order')}</h3><ol>{cards.map((card,index) => <li key={card}><span>{cardLabels[card]}</span>{' '}
      <button type="button" onClick={() => move(index,-1)} disabled={index === 0} aria-label={`${cardLabels[card]} ${text('yukarı','up')}`}>↑</button>{' '}
      <button type="button" onClick={() => move(index,1)} disabled={index === cards.length - 1} aria-label={`${cardLabels[card]} ${text('aşağı','down')}`}>↓</button>
    </li>)}</ol><small>{text('Sürükle-bırak sözleşmesinin klavye erişilebilir sıralama eşdeğeri; kalıcılık/API bileşimi henüz kapalıdır.','Keyboard-accessible ordering equivalent for the drag-and-drop contract; persistence and API composition are not yet enabled.')}</small></section>
    <div className="communication-recording-truth"><span>{text('Çevrimdışı gösterge: yerel veri · son doğrulanmış eşitleme: yok','Offline indicator: local data · last verified synchronization: none')}</span>
      <span>{text('Haftalık özet ve sessiz saatler yalnız yerel ayarlara göre çalışır; bildirimler dış bir hizmet üzerinden gönderilmez.','Weekly summaries and quiet hours follow local settings only; notifications are not delivered through an external service.')}</span></div>
  </section>;
}
