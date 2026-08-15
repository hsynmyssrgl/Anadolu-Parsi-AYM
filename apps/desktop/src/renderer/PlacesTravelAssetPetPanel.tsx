import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CreatePlacesTravelItemInput,
  FamilyMemberView,
  PlacesTravelArea,
  PlacesTravelCenterView,
  PlacesTravelItemView,
  PlacesTravelKind,
  PlacesTravelVisibility
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';

const areas:ReadonlyArray<{readonly value:PlacesTravelArea;readonly label:string}>=[
  {value:'places',label:'Yerler'},{value:'moving',label:'Taşınma'},{value:'pet_care',label:'Evcil hayvan'},{value:'travel',label:'Seyahat'}
];
const kinds:Readonly<Record<PlacesTravelArea,ReadonlyArray<{readonly value:PlacesTravelKind;readonly label:string}>>>={
  places:[{value:'stored_place',label:'Kayıtlı yer'}],
  moving:[{value:'moving_inventory',label:'Taşınma envanteri'}],
  pet_care:[{value:'pet_care_record',label:'Evcil hayvan kaydı'}],
  travel:[
    {value:'travel_plan',label:'Seyahat planı'},{value:'reservation',label:'Rezervasyon kaydı'},
    {value:'travel_document',label:'Pasaport / vize / sigorta'},{value:'travel_budget',label:'Seyahat bütçesi'},
    {value:'shared_expense',label:'Ortak gider'},{value:'packing_item',label:'Valiz öğesi'},
    {value:'travel_requirement',label:'Sağlık / çocuk / hayvan gereksinimi'},
    {value:'offline_travel_pack',label:'Çevrimdışı seyahat paketi'},{value:'language_pack',label:'Yerel dil paketi'},
    {value:'travel_album',label:'Seyahat albümü'},{value:'expense_settlement',label:'Gider kapatma'}
  ]
};
const kindLabel=new Map(Object.values(kinds).flat().map((entry)=>[entry.value,entry.label]));
const iso=(value:string):string|undefined=>value?new Date(value).toISOString():undefined;
interface PendingCreate{readonly fingerprint:string;readonly clientOperationId:string;readonly itemId:string}

export function PlacesTravelAssetPetPanel({people}:{readonly people:readonly FamilyMemberView[]}){
  const activePeople=useMemo(()=>people.filter((person)=>person.status==='active'),[people]);
  const [ownerPersonId,setOwnerPersonId]=useState(activePeople[0]?.id??'');
  const [center,setCenter]=useState<PlacesTravelCenterView>();const [area,setArea]=useState<PlacesTravelArea>('places');
  const [kind,setKind]=useState<PlacesTravelKind>('stored_place');const [title,setTitle]=useState('');
  const [visibility,setVisibility]=useState<PlacesTravelVisibility>('private');const [address,setAddress]=useState('');
  const [fallback,setFallback]=useState('');const [latitude,setLatitude]=useState('');const [longitude,setLongitude]=useState('');
  const [participants,setParticipants]=useState<readonly string[]>(ownerPersonId?[ownerPersonId]:[]);
  const [startsAt,setStartsAt]=useState('');const [endsAt,setEndsAt]=useState('');const [provider,setProvider]=useState('');
  const [reference,setReference]=useState('');const [archiveItemId,setArchiveItemId]=useState('');const [expiresOn,setExpiresOn]=useState('');
  const [documentKind,setDocumentKind]=useState<NonNullable<PlacesTravelItemView['documentKind']>>('passport');
  const [amount,setAmount]=useState('');const [currency,setCurrency]=useState('TRY');const [checklist,setChecklist]=useState('');
  const [petReference,setPetReference]=useState('');const [petWorkflow,setPetWorkflow]=useState<NonNullable<PlacesTravelItemView['petWorkflow']>>('vaccination');
  const [requirementKind,setRequirementKind]=useState<NonNullable<PlacesTravelItemView['requirementKind']>>('health');
  const [requirementReference,setRequirementReference]=useState('');const [languageCode,setLanguageCode]=useState('tr');
  const [ocrJobId,setOcrJobId]=useState('');const [note,setNote]=useState('');const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [tone,setTone]=useState<'success'|'danger'|'info'>('info');
  const pendingCreate=useRef<PendingCreate|undefined>(undefined);
  const pendingMutations=useRef(new Map<string,{readonly fingerprint:string;readonly clientOperationId:string;readonly expectedRevision:number}>());

  const reload=async(personId=ownerPersonId)=>{if(!window.pardus||!personId){setCenter(undefined);return;}setLoading(true);
    try{setCenter(await window.pardus.getPlacesTravelCenter({ownerPersonId:personId}));setMessage('');}
    catch(error){setCenter(undefined);setTone('danger');setMessage(error instanceof Error?error.message:'Yer ve seyahat merkezi yüklenemedi.');}
    finally{setLoading(false);}};
  useEffect(()=>{setParticipants((current)=>current.includes(ownerPersonId)?current:[ownerPersonId]);void reload();},[ownerPersonId]);
  const items=useMemo(()=>center?.items.filter((item)=>item.area===area&&item.status!=='deleted')??[],[area,center]);
  const selectArea=(next:PlacesTravelArea)=>{setArea(next);setKind(kinds[next][0]!.value);pendingCreate.current=undefined;setMessage('');};
  const participantRequired=['travel_plan','shared_expense','expense_settlement'].includes(kind);
  const ready=title.trim().length>=2&&Boolean(ownerPersonId)
    &&(kind!=='stored_place'||address.trim().length>0||latitude!==''&&longitude!=='')
    &&(!['moving_inventory','travel_document','offline_travel_pack','language_pack','travel_album'].includes(kind)||archiveItemId.trim().length>0)
    &&(kind!=='pet_care_record'||petReference.trim().length>0)
    &&(!['travel_plan','reservation'].includes(kind)||Boolean(iso(startsAt))&&Boolean(iso(endsAt)))
    &&(kind!=='reservation'||provider.trim().length>0&&reference.trim().length>0)
    &&(kind!=='travel_document'||expiresOn.length===10)
    &&(!['travel_budget','shared_expense','expense_settlement'].includes(kind)||amount!==''&&Number(amount)>=0)
    &&(kind!=='packing_item'||checklist.trim().length>0)
    &&(kind!=='travel_requirement'||requirementReference.trim().length>0)
    &&(!participantRequired||participants.includes(ownerPersonId)&&participants.length>=(kind==='travel_plan'?1:2));
  const payload=()=>({ownerPersonId,kind,title:title.normalize('NFKC').trim(),visibility,
    ...(kind==='stored_place'&&address.trim()?{addressLabel:address.normalize('NFKC').trim()}:{}),
    ...(kind==='stored_place'&&latitude!==''&&longitude!==''?{latitudeE6:Math.round(Number(latitude)*1_000_000),longitudeE6:Math.round(Number(longitude)*1_000_000)}:{}),
    ...(kind==='stored_place'&&fallback.trim()||kind==='travel_plan'&&fallback.trim()?{offlineFallbackLabel:fallback.normalize('NFKC').trim()}:{}),
    ...(participantRequired||kind==='reservation'?{participantPersonIds:participants}:{}),
    ...(['travel_plan','reservation','travel_budget'].includes(kind)&&iso(startsAt)?{startsAt:iso(startsAt)}:{}),
    ...(['travel_plan','reservation','travel_budget'].includes(kind)&&iso(endsAt)?{endsAt:iso(endsAt)}:{}),
    ...(kind==='reservation'?{providerLabel:provider.normalize('NFKC').trim(),opaqueReference:reference.normalize('NFKC').trim()}:{}),
    ...(['moving_inventory','travel_document','offline_travel_pack','language_pack','travel_album'].includes(kind)||kind==='pet_care_record'&&archiveItemId.trim()?{archiveItemId:archiveItemId.normalize('NFKC').trim()}:{}),
    ...(kind==='travel_document'?{expiresOn,documentKind}:{}),
    ...(['travel_budget','shared_expense','expense_settlement'].includes(kind)?{amountMinor:Math.round(Number(amount)*100),currency}:{}),
    ...(kind==='packing_item'?{checklistLabel:checklist.normalize('NFKC').trim(),checklistCompleted:false}:{}),
    ...(kind==='pet_care_record'?{petReferenceId:petReference.normalize('NFKC').trim(),petWorkflow}:{}),
    ...(kind==='travel_requirement'?{requirementKind,opaqueRequirementReference:requirementReference.normalize('NFKC').trim()}:{}),
    ...(kind==='language_pack'?{languageCode}:{}),...(kind==='moving_inventory'&&ocrJobId.trim()?{ocrJobId:ocrJobId.normalize('NFKC').trim()}:{}),
    ...(note.trim()?{note:note.normalize('NFKC').trim()}:{})});
  const create=async()=>{if(!window.pardus||!ready||busy)return;const command=payload();const fingerprint=JSON.stringify(command);
    if(!pendingCreate.current||pendingCreate.current.fingerprint!==fingerprint)pendingCreate.current={fingerprint,
      clientOperationId:'places-travel:'+crypto.randomUUID(),itemId:'places-travel-item:'+crypto.randomUUID()};
    setBusy(true);setMessage('');try{await window.pardus.createPlacesTravelItem({...command,...pendingCreate.current} as CreatePlacesTravelItemInput);
      pendingCreate.current=undefined;setTitle('');setNote('');await reload();setTone('success');setMessage('Kayıt yalnız bu cihazda oluşturuldu.');}
    catch(error){setTone('danger');setMessage((error instanceof Error?error.message:'Kayıt oluşturulamadı.')+' Değişiklik yapmazsanız aynı işlem kimliğiyle yeniden deneyebilirsiniz.');}
    finally{setBusy(false);}};
  const identity=(key:string,item:PlacesTravelItemView,fingerprint:string)=>{const current=pendingMutations.current.get(key);
    if(current?.fingerprint===fingerprint)return current;const next={fingerprint,clientOperationId:'places-travel:'+crypto.randomUUID(),expectedRevision:item.revision};
    pendingMutations.current.set(key,next);return next;};
  const complete=async(item:PlacesTravelItemView)=>{if(!window.pardus||busy)return;const key='update:'+item.id;const op=identity(key,item,'completed');setBusy(true);
    try{await window.pardus.updatePlacesTravelItem({...op,itemId:item.id,ownerPersonId:item.ownerPersonId,status:'completed'});pendingMutations.current.delete(key);await reload();setTone('success');setMessage('Durum yerel olarak güncellendi.');}
    catch(error){setTone('danger');setMessage((error instanceof Error?error.message:'Güncellenemedi.')+' Aynı işlem kimliğiyle yeniden deneyebilirsiniz.');}finally{setBusy(false);}};
  const remove=async(item:PlacesTravelItemView)=>{if(!window.pardus||busy)return;const reason='Kullanıcı yer/seyahat kaydını yerel merkezden kaldırdı.';const key='delete:'+item.id;const op=identity(key,item,reason);setBusy(true);
    try{await window.pardus.deletePlacesTravelItem({...op,itemId:item.id,ownerPersonId:item.ownerPersonId,reason});pendingMutations.current.delete(key);await reload();setTone('success');setMessage('Kayıt yerel olarak silindi.');}
    catch(error){setTone('danger');setMessage((error instanceof Error?error.message:'Silinemedi.')+' Aynı işlem kimliğiyle yeniden deneyebilirsiniz.');}finally{setBusy(false);}};

  return <Surface className="child-education-panel places-travel-panel"><SectionHeader eyebrow="33-V · yerel yer, varlık, evcil hayvan ve seyahat" title="Yer ve seyahat merkezi"/>
    <div className="child-education-truth" role="note"><strong>Harita, rezervasyon, ödeme, belge doğrulama, canlı takip veya dış paylaşım yapılmaz.</strong>
      <span>Koordinat/adres geri dönüşü ve paketler yalnız yereldir. OCR kimliği sadece öneri referansıdır; sonuç otomatik kabul edilmez. Evcil hayvan kaydı sağlık tavsiyesi değildir.</span></div>
    {activePeople.length===0?<EmptyState title="Etkin kişi bulunamadı" body="Yerel kayıt sahibi için etkin aile kişisi gerekir."/>:<>
      <label className="child-education-person">Kayıt sahibi<select value={ownerPersonId} onChange={(event)=>setOwnerPersonId(event.target.value)}>{activePeople.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
      <nav className="child-education-tabs" aria-label="Yer ve seyahat alanları">{areas.map((entry)=><button key={entry.value} type="button" aria-pressed={area===entry.value} className={area===entry.value?'is-active':''} onClick={()=>selectArea(entry.value)}><span>{entry.label}</span><strong>{center?.countsByArea[entry.value]??0}</strong></button>)}</nav>
      <div className="child-education-layout"><section className="child-education-form"><h3>Yeni yerel kayıt</h3><div className="form-grid">
        <label>Tür<select value={kind} onChange={(event)=>setKind(event.target.value as PlacesTravelKind)}>{kinds[area].map((entry)=><option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
        <label>Başlık<input value={title} onChange={(event)=>setTitle(event.target.value)} maxLength={160}/></label>
        <label>Görünürlük<select value={visibility} onChange={(event)=>setVisibility(event.target.value as PlacesTravelVisibility)}><option value="private">Özel</option><option value="selected_members">Seçili üyeler</option><option value="family_coordination">Aile koordinasyonu</option></select></label>
        {(kind==='stored_place'||kind==='travel_plan')&&<><label>Adres / yer etiketi<input value={address} onChange={(event)=>setAddress(event.target.value)} maxLength={300}/></label><label>Çevrimdışı etiket<input value={fallback} onChange={(event)=>setFallback(event.target.value)} maxLength={300}/></label></>}
        {kind==='stored_place'&&<><label>Enlem<input type="number" min="-90" max="90" step="0.000001" value={latitude} onChange={(event)=>setLatitude(event.target.value)}/></label><label>Boylam<input type="number" min="-180" max="180" step="0.000001" value={longitude} onChange={(event)=>setLongitude(event.target.value)}/></label></>}
        {(participantRequired||kind==='reservation')&&<label className="span-2">Katılımcılar<select multiple value={[...participants]} onChange={(event)=>setParticipants(Array.from(event.currentTarget.selectedOptions,(option)=>option.value))}>{activePeople.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>}
        {['travel_plan','reservation','travel_budget'].includes(kind)&&<><label>Başlangıç<input type="datetime-local" value={startsAt} onChange={(event)=>setStartsAt(event.target.value)}/></label><label>Bitiş<input type="datetime-local" value={endsAt} onChange={(event)=>setEndsAt(event.target.value)}/></label></>}
        {kind==='reservation'&&<><label>Sağlayıcı etiketi<input value={provider} onChange={(event)=>setProvider(event.target.value)} maxLength={160}/></label><label>Opak rezervasyon referansı<input value={reference} onChange={(event)=>setReference(event.target.value)} maxLength={160}/></label></>}
        {(['moving_inventory','travel_document','offline_travel_pack','language_pack','travel_album','pet_care_record'].includes(kind))&&<label>Opak arşiv öğesi<input value={archiveItemId} onChange={(event)=>setArchiveItemId(event.target.value)} maxLength={160}/></label>}
        {kind==='moving_inventory'&&<label>Yerel OCR iş kimliği (opsiyonel)<input value={ocrJobId} onChange={(event)=>setOcrJobId(event.target.value)} maxLength={160}/></label>}
        {kind==='pet_care_record'&&<><label>Opak hayvan referansı<input value={petReference} onChange={(event)=>setPetReference(event.target.value)} maxLength={160}/></label><label>İş akışı<select value={petWorkflow} onChange={(event)=>setPetWorkflow(event.target.value as typeof petWorkflow)}><option value="vaccination">Aşı</option><option value="veterinary">Veteriner</option><option value="microchip">Mikroçip</option><option value="food">Mama</option><option value="insurance">Sigorta</option><option value="travel_document">Seyahat belgesi</option></select></label></>}
        {kind==='travel_document'&&<><label>Belge türü<select value={documentKind} onChange={(event)=>setDocumentKind(event.target.value as typeof documentKind)}><option value="passport">Pasaport</option><option value="visa">Vize</option><option value="insurance">Sigorta</option><option value="reservation_document">Rezervasyon belgesi</option><option value="other">Diğer</option></select></label><label>Geçerlilik tarihi<input type="date" value={expiresOn} onChange={(event)=>setExpiresOn(event.target.value)}/></label></>}
        {['travel_budget','shared_expense','expense_settlement'].includes(kind)&&<><label>Tutar<input type="number" min="0" step="0.01" value={amount} onChange={(event)=>setAmount(event.target.value)}/></label><label>Para birimi<input value={currency} onChange={(event)=>setCurrency(event.target.value.toUpperCase())} maxLength={3}/></label></>}
        {kind==='packing_item'&&<label>Valiz öğesi<input value={checklist} onChange={(event)=>setChecklist(event.target.value)} maxLength={240}/></label>}
        {kind==='travel_requirement'&&<><label>Gereksinim<select value={requirementKind} onChange={(event)=>setRequirementKind(event.target.value as typeof requirementKind)}><option value="health">Sağlık</option><option value="medication">İlaç</option><option value="child">Çocuk</option><option value="pet">Evcil hayvan</option></select></label><label>Opak gereksinim referansı<input value={requirementReference} onChange={(event)=>setRequirementReference(event.target.value)} maxLength={160}/></label></>}
        {kind==='language_pack'&&<label>Dil kodu<input value={languageCode} onChange={(event)=>setLanguageCode(event.target.value)} maxLength={35}/></label>}
        <label className="span-2">Not<input value={note} onChange={(event)=>setNote(event.target.value)} maxLength={1000}/></label>
      </div><Button tone="primary" onClick={()=>void create()} disabled={!ready||busy}>{busy?'Kaydediliyor…':'Yerel kayıt oluştur'}</Button></section>
      <section className="child-education-list" aria-live="polite"><div className="child-education-list-heading"><h3>{areas.find((entry)=>entry.value===area)?.label}</h3><Button onClick={()=>void reload()} disabled={loading||busy}>{loading?'Yükleniyor…':'Yenile'}</Button></div>
        {message&&<StatusMessage tone={tone}>{message}</StatusMessage>}{!loading&&items.length===0?<EmptyState title="Bu alanda kayıt yok" body="Soldaki formdan yalnız yerel bir kayıt ekleyin."/>:<div className="stack-list">{items.map((item)=><div className="child-education-row" key={item.id}><div><strong>{item.title}</strong><small>{kindLabel.get(item.kind)} · {item.status} · revizyon {item.revision}</small><small>{item.offlineFallbackLabel??item.addressLabel??item.providerLabel??item.note??'Yerel opak kayıt'}</small></div><div className="child-education-actions"><Button onClick={()=>void complete(item)} disabled={busy||item.status==='completed'}>Tamamla</Button><Button tone="danger" onClick={()=>void remove(item)} disabled={busy}>Sil</Button></div></div>)}</div>}
      </section></div></>}
  </Surface>;
}
