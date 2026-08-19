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
import { selectUiCopy, useLocalization } from './localization';

const iso=(value:string):string|undefined=>value?new Date(value).toISOString():undefined;
type UiText=(turkish:string,english:string)=>string;
const itemSummary=(item:PlacesTravelItemView,text:UiText):string=>{
  const details:string[]=[];
  if(item.offlineFallbackLabel||item.addressLabel)details.push(item.offlineFallbackLabel??item.addressLabel!);
  if(item.latitudeE6!==undefined&&item.longitudeE6!==undefined)details.push(text('Koordinat','Coordinates')+' '+(item.latitudeE6/1_000_000).toFixed(6)+', '+(item.longitudeE6/1_000_000).toFixed(6));
  if(item.startsAt&&item.endsAt)details.push(item.startsAt.slice(0,16).replace('T',' ')+' → '+item.endsAt.slice(0,16).replace('T',' '));
  if(item.expiresOn)details.push(text('Geçerlilik','Validity')+' '+item.expiresOn);
  if(item.participantPersonIds)details.push(String(item.participantPersonIds.length)+' '+text('katılımcı','participants'));
  if(item.amountMinor!==undefined&&item.currency)details.push((item.amountMinor/100).toFixed(2)+' '+item.currency);
  if(item.checklistLabel)details.push((item.checklistCompleted?text('Tamamlandı','Completed'):text('Bekliyor','Pending'))+' · '+item.checklistLabel);
  if(item.petWorkflow)details.push(text('Evcil hayvan akışı','Pet workflow')+': '+item.petWorkflow);
  if(item.requirementKind)details.push(text('Gereksinim','Requirement')+': '+item.requirementKind);
  if(item.languageCode)details.push(text('Dil','Language')+': '+item.languageCode);
  if(item.providerLabel)details.push(text('Sağlayıcı etiketi','Provider label')+': '+item.providerLabel);
  const summary=details.join(' · ');
  return summary.length>0?summary:(item.note??text('Yerel opak kayıt','Local opaque record'));
};
interface PendingCreate{readonly fingerprint:string;readonly clientOperationId:string;readonly itemId:string}

export function PlacesTravelAssetPetPanel({people}:{readonly people:readonly FamilyMemberView[]}){
  const { language }=useLocalization();const text:UiText=(turkish,english)=>selectUiCopy(language,turkish,english);
  const areas:ReadonlyArray<{readonly value:PlacesTravelArea;readonly label:string}>=[
    {value:'places',label:text('Yerler','Places')},{value:'moving',label:text('Taşınma','Moving')},
    {value:'pet_care',label:text('Evcil hayvan','Pet care')},{value:'travel',label:text('Seyahat','Travel')}
  ];
  const kinds:Readonly<Record<PlacesTravelArea,ReadonlyArray<{readonly value:PlacesTravelKind;readonly label:string}>>>={
    places:[{value:'stored_place',label:text('Kayıtlı yer','Stored place')}],
    moving:[{value:'moving_inventory',label:text('Taşınma envanteri','Moving inventory')}],
    pet_care:[{value:'pet_care_record',label:text('Evcil hayvan kaydı','Pet care record')}],
    travel:[
      {value:'travel_plan',label:text('Seyahat planı','Travel plan')},{value:'reservation',label:text('Rezervasyon kaydı','Reservation record')},
      {value:'travel_document',label:text('Pasaport / vize / sigorta','Passport / visa / insurance')},{value:'travel_budget',label:text('Seyahat bütçesi','Travel budget')},
      {value:'shared_expense',label:text('Ortak gider','Shared expense')},{value:'packing_item',label:text('Valiz öğesi','Packing item')},
      {value:'travel_requirement',label:text('Sağlık / çocuk / hayvan gereksinimi','Health / child / pet requirement')},
      {value:'offline_travel_pack',label:text('Çevrimdışı seyahat paketi','Offline travel pack')},{value:'language_pack',label:text('Yerel dil paketi','Local language pack')},
      {value:'travel_album',label:text('Seyahat albümü','Travel album')},{value:'expense_settlement',label:text('Gider kapatma','Expense settlement')}
    ]
  };
  const kindLabel=new Map(Object.values(kinds).flat().map((entry)=>[entry.value,entry.label]));
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
    catch(error){setCenter(undefined);setTone('danger');setMessage(error instanceof Error?error.message:text('Yer ve seyahat merkezi yüklenemedi.','Places and travel center could not be loaded.'));}
    finally{setLoading(false);}};
  useEffect(()=>{setParticipants((current)=>current.includes(ownerPersonId)?current:[ownerPersonId]);void reload();},[ownerPersonId]);
  const items=useMemo(()=>center?.items.filter((item)=>item.area===area&&item.status!=='deleted')??[],[area,center]);
  const selectArea=(next:PlacesTravelArea)=>{setArea(next);setKind(kinds[next][0]!.value);pendingCreate.current=undefined;setMessage('');};
  const participantRequired=['travel_plan','reservation','shared_expense','expense_settlement'].includes(kind);
  const ready=title.trim().length>=2&&Boolean(ownerPersonId)
    &&(kind!=='stored_place'||address.trim().length>0||latitude!==''&&longitude!=='')
    &&(kind!=='travel_plan'||address.trim().length>0||fallback.trim().length>0)
    &&(!['moving_inventory','travel_document','offline_travel_pack','language_pack','travel_album'].includes(kind)||archiveItemId.trim().length>0)
    &&(kind!=='pet_care_record'||petReference.trim().length>0)
    &&(!['travel_plan','reservation','travel_budget'].includes(kind)||Boolean(iso(startsAt))&&Boolean(iso(endsAt)))
    &&(kind!=='reservation'||provider.trim().length>0&&reference.trim().length>0)
    &&(!['shared_expense','expense_settlement'].includes(kind)||reference.trim().length>0)
    &&(kind!=='travel_document'||expiresOn.length===10)
    &&(!['travel_budget','shared_expense','expense_settlement'].includes(kind)||amount!==''&&Number(amount)>=0)
    &&(kind!=='packing_item'||checklist.trim().length>0)
    &&(kind!=='travel_requirement'||requirementReference.trim().length>0)
    &&(!participantRequired||participants.includes(ownerPersonId)&&participants.length>=(['shared_expense','expense_settlement'].includes(kind)?2:1));
  const payload=()=>({ownerPersonId,kind,title:title.normalize('NFKC').trim(),visibility,
    ...(kind==='stored_place'&&address.trim()?{addressLabel:address.normalize('NFKC').trim()}:{}),
    ...(kind==='stored_place'&&latitude!==''&&longitude!==''?{latitudeE6:Math.round(Number(latitude)*1_000_000),longitudeE6:Math.round(Number(longitude)*1_000_000)}:{}),
    ...(kind==='stored_place'&&fallback.trim()||kind==='travel_plan'&&fallback.trim()?{offlineFallbackLabel:fallback.normalize('NFKC').trim()}:{}),
    ...(participantRequired?{participantPersonIds:participants}:{}),
    ...(['travel_plan','reservation','travel_budget'].includes(kind)&&iso(startsAt)?{startsAt:iso(startsAt)}:{}),
    ...(['travel_plan','reservation','travel_budget'].includes(kind)&&iso(endsAt)?{endsAt:iso(endsAt)}:{}),
    ...(kind==='reservation'?{providerLabel:provider.normalize('NFKC').trim()}:{}),
    ...(['reservation','shared_expense','expense_settlement'].includes(kind)?{opaqueReference:reference.normalize('NFKC').trim()}:{}),
    ...(['moving_inventory','travel_document','offline_travel_pack','language_pack','travel_album'].includes(kind)||kind==='pet_care_record'&&archiveItemId.trim()?{archiveItemId:archiveItemId.normalize('NFKC').trim()}:{}),
    ...(kind==='travel_document'?{expiresOn,documentKind}:{}),
    ...(kind==='pet_care_record'&&expiresOn.length===10?{expiresOn}:{}),
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
      pendingCreate.current=undefined;setTitle('');setNote('');await reload();setTone('success');setMessage(text('Kayıt yalnız bu cihazda oluşturuldu.','The record was created on this device only.'));}
    catch(error){setTone('danger');setMessage((error instanceof Error?error.message:text('Kayıt oluşturulamadı.','The record could not be created.'))+' '+text('Değişiklik yapmazsanız aynı işlem kimliğiyle yeniden deneyebilirsiniz.','If you make no changes, you can retry with the same operation identifier.'));}
    finally{setBusy(false);}};
  const identity=(key:string,item:PlacesTravelItemView,fingerprint:string)=>{const current=pendingMutations.current.get(key);
    if(current?.fingerprint===fingerprint)return current;const next={fingerprint,clientOperationId:'places-travel:'+crypto.randomUUID(),expectedRevision:item.revision};
    pendingMutations.current.set(key,next);return next;};
  const complete=async(item:PlacesTravelItemView)=>{if(!window.pardus||busy)return;const key='update:'+item.id;const op=identity(key,item,'completed');setBusy(true);
    try{await window.pardus.updatePlacesTravelItem({...op,itemId:item.id,ownerPersonId:item.ownerPersonId,status:'completed'});pendingMutations.current.delete(key);await reload();setTone('success');setMessage(text('Durum yerel olarak güncellendi.','The state was updated locally.'));}
    catch(error){setTone('danger');setMessage((error instanceof Error?error.message:text('Güncellenemedi.','The record could not be updated.'))+' '+text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation identifier.'));}finally{setBusy(false);}};
  const remove=async(item:PlacesTravelItemView)=>{if(!window.pardus||busy)return;const reason=text('Kullanıcı yer/seyahat kaydını yerel merkezden kaldırdı.','The user removed the places/travel record from the local center.');const key='delete:'+item.id;const op=identity(key,item,reason);setBusy(true);
    try{await window.pardus.deletePlacesTravelItem({...op,itemId:item.id,ownerPersonId:item.ownerPersonId,reason});pendingMutations.current.delete(key);await reload();setTone('success');setMessage(text('Kayıt yerel olarak silindi.','The record was deleted locally.'));}
    catch(error){setTone('danger');setMessage((error instanceof Error?error.message:text('Silinemedi.','The record could not be deleted.'))+' '+text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation identifier.'));}finally{setBusy(false);}};

  return <Surface className="child-education-panel places-travel-panel"><SectionHeader eyebrow={text('33-V · yerel yer, varlık, evcil hayvan ve seyahat','33-V · local places, assets, pets and travel')} title={text('Yer ve seyahat merkezi','Places and travel center')}/>
    <div className="child-education-truth" role="note"><strong>{text('Harita, rezervasyon, ödeme, belge doğrulama, canlı takip veya dış paylaşım yapılmaz.','Maps, reservations, payments, document verification, live tracking and external sharing are not performed.')}</strong>
      <span>{text('Koordinat/adres geri dönüşü ve paketler yalnız yereldir. OCR kimliği sadece öneri referansıdır; sonuç otomatik kabul edilmez. Evcil hayvan kaydı sağlık tavsiyesi değildir.','Coordinate/address fallback and packs are local only. An OCR identifier is a suggestion reference only; results are never accepted automatically. A pet record is not health advice.')}</span></div>
    {activePeople.length===0?<EmptyState title={text('Etkin kişi bulunamadı','No active person found')} body={text('Yerel kayıt sahibi için etkin aile kişisi gerekir.','A local record owner requires an active family person.')}/>:<>
      <label className="child-education-person">{text('Kayıt sahibi','Record owner')}<select value={ownerPersonId} onChange={(event)=>setOwnerPersonId(event.target.value)}>{activePeople.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
      <nav className="child-education-tabs" aria-label={text('Yer ve seyahat alanları','Places and travel areas')}>{areas.map((entry)=><button key={entry.value} type="button" aria-pressed={area===entry.value} className={area===entry.value?'is-active':''} onClick={()=>selectArea(entry.value)}><span>{entry.label}</span><strong>{center?.countsByArea[entry.value]??0}</strong></button>)}</nav>
      <div className="child-education-layout"><section className="child-education-form"><h3>{text('Yeni yerel kayıt','New local record')}</h3><div className="form-grid">
        <label>{text('Tür','Type')}<select value={kind} onChange={(event)=>setKind(event.target.value as PlacesTravelKind)}>{kinds[area].map((entry)=><option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
        <label>{text('Başlık','Title')}<input value={title} onChange={(event)=>setTitle(event.target.value)} maxLength={160}/></label>
        <label>{text('Görünürlük','Visibility')}<select value={visibility} onChange={(event)=>setVisibility(event.target.value as PlacesTravelVisibility)}><option value="private">{text('Özel','Private')}</option><option value="selected_members">{text('Seçili üyeler','Selected members')}</option><option value="family_coordination">{text('Aile koordinasyonu','Family coordination')}</option></select></label>
        {(kind==='stored_place'||kind==='travel_plan')&&<><label>{text('Adres / yer etiketi','Address / place label')}<input value={address} onChange={(event)=>setAddress(event.target.value)} maxLength={300}/></label><label>{text('Çevrimdışı etiket','Offline label')}<input value={fallback} onChange={(event)=>setFallback(event.target.value)} maxLength={300}/></label></>}
        {kind==='stored_place'&&<><label>{text('Enlem','Latitude')}<input type="number" min="-90" max="90" step="0.000001" value={latitude} onChange={(event)=>setLatitude(event.target.value)}/></label><label>{text('Boylam','Longitude')}<input type="number" min="-180" max="180" step="0.000001" value={longitude} onChange={(event)=>setLongitude(event.target.value)}/></label></>}
        {(participantRequired||kind==='reservation')&&<label className="span-2">{text('Katılımcılar','Participants')}<select multiple value={[...participants]} onChange={(event)=>setParticipants(Array.from(event.currentTarget.selectedOptions,(option)=>option.value))}>{activePeople.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>}
        {['travel_plan','reservation','travel_budget'].includes(kind)&&<><label>{text('Başlangıç','Start')}<input type="datetime-local" value={startsAt} onChange={(event)=>setStartsAt(event.target.value)}/></label><label>{text('Bitiş','End')}<input type="datetime-local" value={endsAt} onChange={(event)=>setEndsAt(event.target.value)}/></label></>}
        {kind==='reservation'&&<label>{text('Sağlayıcı etiketi','Provider label')}<input value={provider} onChange={(event)=>setProvider(event.target.value)} maxLength={160}/></label>}
        {['reservation','shared_expense','expense_settlement'].includes(kind)&&<label>{text('Opak seyahat / gider referansı','Opaque travel / expense reference')}<input value={reference} onChange={(event)=>setReference(event.target.value)} maxLength={160}/></label>}
        {(['moving_inventory','travel_document','offline_travel_pack','language_pack','travel_album','pet_care_record'].includes(kind))&&<label>{text('Opak arşiv öğesi','Opaque archive item')}<input value={archiveItemId} onChange={(event)=>setArchiveItemId(event.target.value)} maxLength={160}/></label>}
        {kind==='moving_inventory'&&<label>{text('Yerel OCR iş kimliği (opsiyonel)','Local OCR job identifier (optional)')}<input value={ocrJobId} onChange={(event)=>setOcrJobId(event.target.value)} maxLength={160}/></label>}
        {kind==='pet_care_record'&&<><label>{text('Opak hayvan referansı','Opaque pet reference')}<input value={petReference} onChange={(event)=>setPetReference(event.target.value)} maxLength={160}/></label><label>{text('İş akışı','Workflow')}<select value={petWorkflow} onChange={(event)=>setPetWorkflow(event.target.value as typeof petWorkflow)}><option value="vaccination">{text('Aşı','Vaccination')}</option><option value="veterinary">{text('Veteriner','Veterinary')}</option><option value="microchip">{text('Mikroçip','Microchip')}</option><option value="food">{text('Mama','Food')}</option><option value="insurance">{text('Sigorta','Insurance')}</option><option value="travel_document">{text('Seyahat belgesi','Travel document')}</option></select></label><label>{text('Hatırlatma / belge bitiş tarihi (opsiyonel)','Reminder / document expiry date (optional)')}<input type="date" value={expiresOn} onChange={(event)=>setExpiresOn(event.target.value)}/></label></>}
        {kind==='travel_document'&&<><label>{text('Belge türü','Document type')}<select value={documentKind} onChange={(event)=>setDocumentKind(event.target.value as typeof documentKind)}><option value="passport">{text('Pasaport','Passport')}</option><option value="visa">{text('Vize','Visa')}</option><option value="insurance">{text('Sigorta','Insurance')}</option><option value="reservation_document">{text('Rezervasyon belgesi','Reservation document')}</option><option value="other">{text('Diğer','Other')}</option></select></label><label>{text('Geçerlilik tarihi','Expiry date')}<input type="date" value={expiresOn} onChange={(event)=>setExpiresOn(event.target.value)}/></label></>}
        {['travel_budget','shared_expense','expense_settlement'].includes(kind)&&<><label>{text('Tutar','Amount')}<input type="number" min="0" step="0.01" value={amount} onChange={(event)=>setAmount(event.target.value)}/></label><label>{text('Para birimi','Currency')}<input value={currency} onChange={(event)=>setCurrency(event.target.value.toUpperCase())} maxLength={3}/></label></>}
        {kind==='packing_item'&&<label>{text('Valiz öğesi','Packing item')}<input value={checklist} onChange={(event)=>setChecklist(event.target.value)} maxLength={240}/></label>}
        {kind==='travel_requirement'&&<><label>{text('Gereksinim','Requirement')}<select value={requirementKind} onChange={(event)=>setRequirementKind(event.target.value as typeof requirementKind)}><option value="health">{text('Sağlık','Health')}</option><option value="medication">{text('İlaç','Medication')}</option><option value="child">{text('Çocuk','Child')}</option><option value="pet">{text('Evcil hayvan','Pet')}</option></select></label><label>{text('Opak gereksinim referansı','Opaque requirement reference')}<input value={requirementReference} onChange={(event)=>setRequirementReference(event.target.value)} maxLength={160}/></label></>}
        {kind==='language_pack'&&<label>{text('Dil kodu','Language code')}<input value={languageCode} onChange={(event)=>setLanguageCode(event.target.value)} maxLength={35}/></label>}
        <label className="span-2">{text('Not','Note')}<input value={note} onChange={(event)=>setNote(event.target.value)} maxLength={1000}/></label>
      </div><Button tone="primary" onClick={()=>void create()} disabled={!ready||busy}>{busy?text('Kaydediliyor…','Saving…'):text('Yerel kayıt oluştur','Create local record')}</Button></section>
      <section className="child-education-list" aria-live="polite"><div className="child-education-list-heading"><h3>{areas.find((entry)=>entry.value===area)?.label}</h3><Button onClick={()=>void reload()} disabled={loading||busy}>{loading?text('Yükleniyor…','Loading…'):text('Yenile','Refresh')}</Button></div>
        {message&&<StatusMessage tone={tone}>{message}</StatusMessage>}{!loading&&items.length===0?<EmptyState title={text('Bu alanda kayıt yok','No records in this area')} body={text('Soldaki formdan yalnız yerel bir kayıt ekleyin.','Add a local-only record with the form on the left.')}/>:<div className="stack-list">{items.map((item)=><div className="child-education-row" key={item.id}><div><strong>{item.title}</strong><small>{kindLabel.get(item.kind)} · {item.status} · {text('revizyon','revision')} {item.revision}</small><small>{itemSummary(item,text)}</small></div><div className="child-education-actions"><Button onClick={()=>void complete(item)} disabled={busy||item.status==='completed'}>{text('Tamamla','Complete')}</Button><Button tone="danger" onClick={()=>void remove(item)} disabled={busy}>{text('Sil','Delete')}</Button></div></div>)}</div>}
      </section></div></>}
  </Surface>;
}
