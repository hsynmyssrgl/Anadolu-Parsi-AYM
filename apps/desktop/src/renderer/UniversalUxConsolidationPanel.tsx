import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { UnifiedAuthorizedSearchView } from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';

const modes = ['standard','easy_read','guest','child','senior','caregiver','kitchen_tablet'] as const;
const modeLabel:Record<(typeof modes)[number],string> = {
  standard:'Standart',easy_read:'Kolay okuma',guest:'Misafir',child:'Çocuk',senior:'İleri yaş',
  caregiver:'Bakım veren',kitchen_tablet:'Mutfak tableti'
};
const moduleLabel:Record<UnifiedAuthorizedSearchView['items'][number]['module'],string> = {
  family:'Aile',event:'Olay',archive:'Belge',finance:'Finans',health:'Sağlık',life:'Yaşam'
};

export function UniversalUxConsolidationPanel() {
  const {language}=useLocalization();
  const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const [query,setQuery] = useState('');
  const [result,setResult] = useState<UnifiedAuthorizedSearchView>();
  const [searchError,setSearchError] = useState('');
  const [searching,setSearching] = useState(false);
  const [mode,setMode] = useState<(typeof modes)[number]>('standard');
  const [cards,setCards] = useState(['today','inbox','tasks','health']);
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
        setSearchError(caught instanceof Error ? caught.message : text('Yetkili evrensel arama tamamlanamadı.','Authorized universal search could not be completed.'));
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
      <span>{text('Arama sorgusu IPC yanıtında yankılanmaz ve kalıcı arama geçmişine yazılmaz; ağ kullanılmaz.','The search query is not echoed in the IPC response or written to persistent history; the network is not used.')}</span>
      <span>{text('Gerçek Windows installer yaşam döngüsü ve 7 günlük soak kanıtı henüz yoktur.','Real Windows installer lifecycle and seven-day soak evidence are not yet available.')}</span>
      <span>{text('QR/barkod, kamera kırpma, sesle form, Windows mini paneli ve Apple widget sağlayıcıları yapılandırılmamıştır.','QR/barcode, camera cropping, voice form, Windows mini-panel and Apple widget providers are not configured.')}</span>
      <span>{text('Politika zayıflatma otomatik etkinleşmez; açık kullanıcı kararı, yeni sürüm, risk analizi ve rollback kanıtı gerekir.','Policy weakening is never enabled automatically; it requires an explicit user decision, a new release, risk analysis and rollback evidence.')}</span>
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
    <section><h3>{text('Ana ekran kart sırası','Home card order')}</h3><ol>{cards.map((card,index) => <li key={card}><span>{card}</span>{' '}
      <button type="button" onClick={() => move(index,-1)} disabled={index === 0} aria-label={`${card} ${text('yukarı','up')}`}>↑</button>{' '}
      <button type="button" onClick={() => move(index,1)} disabled={index === cards.length - 1} aria-label={`${card} ${text('aşağı','down')}`}>↓</button>
    </li>)}</ol><small>{text('Sürükle-bırak sözleşmesinin klavye erişilebilir sıralama eşdeğeri; kalıcılık/API bileşimi henüz kapalıdır.','Keyboard-accessible ordering equivalent for the drag-and-drop contract; persistence and API composition are not yet enabled.')}</small></section>
    <div className="communication-recording-truth"><span>{text('Çevrimdışı gösterge: yerel veri · son doğrulanmış senkronizasyon: yok','Offline indicator: local data · last verified synchronization: none')}</span>
      <span>{text('Haftalık özet ve sessiz saatler 34-G yerel politika modeline bağlıdır; gerçek bildirim teslimi yapılmaz.','Weekly summaries and quiet hours are governed by the 34-G local policy model; no real notification delivery is performed.')}</span></div>
  </section>;
}
