import { useMemo,useState } from 'react';
const commands=[{id:'life-center',title:'Yaşam merkezini aç',keywords:'bugün aile toplantı görev'},
  {id:'archive',title:'Arşiv ve belgeleri aç',keywords:'dosya belge ara'},
  {id:'system',title:'Sistem ve operasyon merkezini aç',keywords:'yedek sağlık bakım'},
  {id:'privacy',title:'Gizlilik merkezini aç',keywords:'izin rıza güvenlik'}] as const;
const modes=['standard','easy_read','guest','child','senior','caregiver','kitchen_tablet'] as const;
const modeLabel:Record<(typeof modes)[number],string>={standard:'Standart',easy_read:'Kolay okuma',guest:'Misafir',child:'Çocuk',
  senior:'İleri yaş',caregiver:'Bakım veren',kitchen_tablet:'Mutfak tableti'};
export function UniversalUxConsolidationPanel(){const [query,setQuery]=useState('');const [mode,setMode]=useState<(typeof modes)[number]>('standard');
  const [cards,setCards]=useState(['today','inbox','tasks','health']);const results=useMemo(()=>{const normalized=query.trim().toLocaleLowerCase('tr-TR');
    return normalized?commands.filter(item=>`${item.title} ${item.keywords}`.toLocaleLowerCase('tr-TR').includes(normalized)):[];},[query]);
  const move=(index:number,direction:-1|1)=>setCards(current=>{const target=index+direction;if(target<0||target>=current.length)return current;
    const next=[...current];[next[index],next[target]]=[next[target]!,next[index]!];return next;});
  return <section className="universal-ux panel" aria-labelledby="universal-ux-title"><div className="panel-heading"><div>
    <span className="eyebrow">34-K · Windows dayanıklılık ve evrensel UX</span><h2 id="universal-ux-title">Tek aile görünümü</h2></div></div>
    <div className="communication-recording-truth" role="note"><strong>Bu yüzey yerel UX konsolidasyonudur; gerçek Windows installer yaşam döngüsü ve 7 günlük soak kanıtı yoktur.</strong>
      <span>Evrensel arama yalnız yetkili kaynak sonuçlarını göstermeyi amaçlar; bu yerel panel üretim indeksine bağlı değildir.</span>
      <span>QR/barkod, kamera kırpma, sesle form, Windows mini paneli ve Apple widget sağlayıcıları yapılandırılmamıştır.</span>
      <span>Politika zayıflatma otomatik etkinleşmez; açık kullanıcı kararı, yeni sürüm, risk analizi ve rollback kanıtı gerekir.</span></div>
    <div className="workspace-grid"><section><h3>Komut paleti ve arama</h3><label>Yetkili komutlarda ara<input value={query}
      onChange={event=>setQuery(event.target.value)} placeholder="Arşiv, yaşam merkezi, gizlilik…"/></label>
      <ul>{results.map(item=><li key={item.id}><strong>{item.title}</strong><small> · rota {item.id}</small></li>)}</ul>
      {query&&results.length===0?<p>Yetkili yerel eşleşme yok.</p>:null}</section><section><h3>Kişisel görünüm modu</h3><label>Mod<select value={mode}
        onChange={event=>setMode(event.target.value as (typeof modes)[number])}>{modes.map(item=><option key={item} value={item}>{modeLabel[item]}</option>)}</select></label>
      <p>Seçili mod: <strong>{modeLabel[mode]}</strong>. Bu oturumdaki önizleme kalıcı tercih olarak kaydedilmez.</p></section></div>
    <section><h3>Ana ekran kart sırası</h3><ol>{cards.map((card,index)=><li key={card}><span>{card}</span>{' '}
      <button type="button" onClick={()=>move(index,-1)} disabled={index===0} aria-label={`${card} yukarı`}>↑</button>{' '}
      <button type="button" onClick={()=>move(index,1)} disabled={index===cards.length-1} aria-label={`${card} aşağı`}>↓</button></li>)}</ol>
      <small>Sürükle-bırak sözleşmesinin klavye erişilebilir sıralama eşdeğeri; kalıcılık/API bileşimi henüz kapalıdır.</small></section>
    <div className="communication-recording-truth"><span>Çevrimdışı gösterge: yerel veri · son doğrulanmış senkronizasyon: yok</span>
      <span>Haftalık özet ve sessiz saatler 34-G yerel politika modeline bağlıdır; gerçek bildirim teslimi yapılmaz.</span></div>
  </section>;}
