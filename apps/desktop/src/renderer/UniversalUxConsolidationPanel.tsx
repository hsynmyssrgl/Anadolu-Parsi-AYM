import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { UnifiedAuthorizedSearchView } from '@ppt/domain';

const modes = ['standard','easy_read','guest','child','senior','caregiver','kitchen_tablet'] as const;
const modeLabel:Record<(typeof modes)[number],string> = {
  standard:'Standart',easy_read:'Kolay okuma',guest:'Misafir',child:'Çocuk',senior:'İleri yaş',
  caregiver:'Bakım veren',kitchen_tablet:'Mutfak tableti'
};
const moduleLabel:Record<UnifiedAuthorizedSearchView['items'][number]['module'],string> = {
  family:'Aile',event:'Olay',archive:'Belge',finance:'Finans',health:'Sağlık',life:'Yaşam'
};

export function UniversalUxConsolidationPanel() {
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
        setSearchError(caught instanceof Error ? caught.message : 'Yetkili evrensel arama tamamlanamadı.');
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
    <div className="panel-heading"><div><span className="eyebrow">34-K · Windows dayanıklılık ve evrensel UX</span>
      <h2 id="universal-ux-title">Tek aile görünümü</h2></div></div>
    <div className="communication-recording-truth" role="note">
      <strong>Bu yüzeydeki veri araması üretim kaynaklarının çağrı anındaki merkezi okuma yetkileriyle çalışır.</strong>
      <span>Aile, olay, belge, finans, sağlık ve yaşam kaynaklarından biri yetkilendirilemezse kısmi sonuç gösterilmez.</span>
      <span>Arama sorgusu IPC yanıtında yankılanmaz ve kalıcı arama geçmişine yazılmaz; ağ kullanılmaz.</span>
      <span>Gerçek Windows installer yaşam döngüsü ve 7 günlük soak kanıtı henüz yoktur.</span>
      <span>QR/barkod, kamera kırpma, sesle form, Windows mini paneli ve Apple widget sağlayıcıları yapılandırılmamıştır.</span>
      <span>Politika zayıflatma otomatik etkinleşmez; açık kullanıcı kararı, yeni sürüm, risk analizi ve rollback kanıtı gerekir.</span>
    </div>
    <div className="workspace-grid"><section><h3>Yetki filtreli evrensel arama</h3>
      <form onSubmit={event => void search(event)}><label htmlFor="universal-ux-search">Tüm modüllerde ara</label>
        <input id="universal-ux-search" value={query} maxLength={80}
          onChange={event => setQuery(event.target.value)} placeholder="En az iki karakter yazın"/>
        <button type="submit" disabled={searching || query.normalize('NFKC').trim().length < 2}>
          {searching ? 'Aranıyor…' : 'Yetkili ara'}
        </button></form>
      {searchError ? <p role="alert">{searchError}</p> : null}
      {result ? <div className="universal-ux-authorized-results" aria-live="polite">
        <small>{result.items.length} yetkili sonuç · {result.searchedModules.length} modül
          {result.truncated ? ' · ilk 25 gösteriliyor' : ''}</small>
        {result.items.length ? <ul>{result.items.map(item => <li key={`${item.resourceType}:${item.resourceId}`}>
          <strong>{item.title}</strong><small> · {moduleLabel[item.module]}</small>
        </li>)}</ul> : <p>Yetkili sonuç bulunamadı.</p>}
      </div> : null}
    </section><section><h3>Kişisel görünüm modu</h3><label>Mod<select value={mode}
      onChange={event => setMode(event.target.value as (typeof modes)[number])}>{modes.map(item =>
        <option key={item} value={item}>{modeLabel[item]}</option>)}</select></label>
      <p>Seçili mod: <strong>{modeLabel[mode]}</strong>. Bu oturumdaki önizleme kalıcı tercih olarak kaydedilmez.</p>
    </section></div>
    <section><h3>Ana ekran kart sırası</h3><ol>{cards.map((card,index) => <li key={card}><span>{card}</span>{' '}
      <button type="button" onClick={() => move(index,-1)} disabled={index === 0} aria-label={`${card} yukarı`}>↑</button>{' '}
      <button type="button" onClick={() => move(index,1)} disabled={index === cards.length - 1} aria-label={`${card} aşağı`}>↓</button>
    </li>)}</ol><small>Sürükle-bırak sözleşmesinin klavye erişilebilir sıralama eşdeğeri; kalıcılık/API bileşimi henüz kapalıdır.</small></section>
    <div className="communication-recording-truth"><span>Çevrimdışı gösterge: yerel veri · son doğrulanmış senkronizasyon: yok</span>
      <span>Haftalık özet ve sessiz saatler 34-G yerel politika modeline bağlıdır; gerçek bildirim teslimi yapılmaz.</span></div>
  </section>;
}
