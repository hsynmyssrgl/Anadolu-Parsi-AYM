import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CreateHouseholdOperationItemInput,
  FamilyMemberView,
  HouseholdOperationArea,
  HouseholdOperationItemView,
  HouseholdOperationKind,
  HouseholdOperationStatus,
  HouseholdOperationsCenterView
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';

const areaOptions: ReadonlyArray<{ readonly value: HouseholdOperationArea; readonly label: string }> = [
  { value:'shopping',label:'Alışveriş' },
  { value:'inventory',label:'Stok' },
  { value:'meals',label:'Öğün ve tarif' },
  { value:'chores',label:'Görev ve rutin' },
  { value:'expenses',label:'Giderler' },
  { value:'deliveries',label:'Teslimatlar' },
  { value:'guests',label:'Misafir erişimi' },
  { value:'pets',label:'Evcil hayvan' }
];

const kindsByArea: Readonly<Record<HouseholdOperationArea, ReadonlyArray<{ readonly value: HouseholdOperationKind; readonly label: string }>>> = {
  shopping: [{ value:'shopping_list',label:'Alışveriş listesi' },{ value:'shopping_item',label:'Liste öğesi' }],
  inventory: [{ value:'stock_item',label:'Stok öğesi' }],
  meals: [{ value:'recipe',label:'Tarif' },{ value:'meal_plan',label:'Öğün planı' }],
  chores: [{ value:'chore',label:'Ev görevi' },{ value:'routine',label:'Tekrarlanan rutin' }],
  expenses: [{ value:'bill',label:'Fatura' },{ value:'subscription',label:'Abonelik' },{ value:'shared_expense',label:'Paylaşılan gider' }],
  deliveries: [{ value:'delivery',label:'Teslimat takibi' }],
  guests: [{ value:'guest_access',label:'Misafir erişim planı' }],
  pets: [{ value:'pet_care',label:'Evcil hayvan bakımı' }]
};

const statusLabels: Readonly<Record<HouseholdOperationStatus,string>> = {
  planned:'Planlandı',active:'Etkin',low_stock:'Azaldı',due:'Bekliyor',completed:'Tamamlandı',
  cancelled:'İptal edildi',expired:'Süresi doldu',delivered:'Teslim edildi',revoked:'Geri alındı',deleted:'Silindi'
};

const splitText = (value:string):readonly string[] => [...new Set(value.split(',').map((part)=>part.normalize('NFKC').trim()).filter(Boolean))];
const isoOrUndefined = (value:string):string|undefined => {
  if(!value)return undefined;
  const parsed=new Date(value);
  return Number.isFinite(parsed.getTime())?parsed.toISOString():undefined;
};
const formatDate = (value:string|undefined):string => value
  ? new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
  : 'Tarih yok';

interface PendingCreate {
  readonly fingerprint:string;
  readonly clientOperationId:string;
  readonly itemId:string;
  readonly expectedCenterRevision:number;
}

export function HouseholdOperationsPanel({people}:{readonly people:readonly FamilyMemberView[]}){
  const [center,setCenter]=useState<HouseholdOperationsCenterView>();
  const [area,setArea]=useState<HouseholdOperationArea>('shopping');
  const [kind,setKind]=useState<HouseholdOperationKind>('shopping_list');
  const [title,setTitle]=useState('');
  const [status,setStatus]=useState<Exclude<HouseholdOperationStatus,'deleted'>>('planned');
  const [parentItemId,setParentItemId]=useState('');
  const [assignedPersonId,setAssignedPersonId]=useState('');
  const [stockCategory,setStockCategory]=useState<'food'|'cleaning'>('food');
  const [quantity,setQuantity]=useState('1');
  const [unit,setUnit]=useState('adet');
  const [scheduledAt,setScheduledAt]=useState('');
  const [dueAt,setDueAt]=useState('');
  const [expiresAt,setExpiresAt]=useState('');
  const [recurrence,setRecurrence]=useState('');
  const [amount,setAmount]=useState('');
  const [currency,setCurrency]=useState('TRY');
  const [shareBasisPoints,setShareBasisPoints]=useState(5000);
  const [ingredients,setIngredients]=useState('');
  const [allergens,setAllergens]=useState('');
  const [avoidedAllergens,setAvoidedAllergens]=useState('');
  const [providerLabel,setProviderLabel]=useState('');
  const [trackingLastFour,setTrackingLastFour]=useState('');
  const [guestLabel,setGuestLabel]=useState('');
  const [accessArea,setAccessArea]=useState('');
  const [petReference,setPetReference]=useState('');
  const [note,setNote]=useState('');
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [tone,setTone]=useState<'success'|'danger'|'info'>('info');
  const pendingCreate=useRef<PendingCreate|undefined>(undefined);
  const pendingMutations=useRef(new Map<string,{readonly fingerprint:string;readonly clientOperationId:string;readonly expectedCenterRevision:number;readonly expectedItemRevision:number}>());

  const reload=async()=>{
    if(!window.pardus)return;
    setLoading(true);
    try{setCenter(await window.pardus.getHouseholdOperationsCenter());setMessage('');}
    catch(error){setCenter(undefined);setTone('danger');setMessage(error instanceof Error?error.message:'Hane operasyonları yüklenemedi.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void reload();},[]);

  const areaItems=useMemo(()=>center?.items.filter((item)=>item.area===area&&item.status!=='deleted')??[],[area,center]);
  const parentOptions=useMemo(()=>center?.items.filter((item)=>
    item.status!=='deleted'&&((kind==='shopping_item'&&item.kind==='shopping_list')||(kind==='meal_plan'&&item.kind==='recipe'))
  )??[],[center,kind]);

  const changeArea=(next:HouseholdOperationArea)=>{
    setArea(next);setKind(kindsByArea[next][0]!.value);setParentItemId('');setMessage('');
  };
  const changeKind=(next:HouseholdOperationKind)=>{setKind(next);setParentItemId('');setMessage('');};

  const draftPayload=()=>{
    const common={kind,title:title.normalize('NFKC').trim(),status,...(note.trim()?{note:note.normalize('NFKC').trim()}: {})};
    if(kind==='shopping_item')return {...common,parentItemId};
    if(kind==='stock_item')return {...common,stockCategory,quantity:Number(quantity),unit:unit.normalize('NFKC').trim(),...(isoOrUndefined(expiresAt)?{expiresAt:isoOrUndefined(expiresAt)}:{})};
    if(kind==='recipe')return {...common,ingredientNames:splitText(ingredients),allergenCodes:splitText(allergens)};
    if(kind==='meal_plan')return {...common,parentItemId,avoidedAllergenCodes:splitText(avoidedAllergens),...(isoOrUndefined(scheduledAt)?{scheduledAt:isoOrUndefined(scheduledAt)}:{})};
    if(kind==='chore'||kind==='routine')return {...common,...(assignedPersonId?{assignedPersonId}:{}),...(isoOrUndefined(dueAt)?{dueAt:isoOrUndefined(dueAt)}:{}),...(kind==='routine'&&recurrence.trim()?{recurrence:recurrence.normalize('NFKC').trim()}:{})};
    if(kind==='bill'||kind==='subscription'||kind==='shared_expense')return {
      ...common,amountMinor:Math.round(Number(amount)*100),currency,
      ...(kind==='subscription'&&recurrence.trim()?{recurrence:recurrence.normalize('NFKC').trim()}:{}),
      ...(isoOrUndefined(dueAt)?{dueAt:isoOrUndefined(dueAt)}:{}),
      ...(kind==='shared_expense'&&people.length>=2?{splitShares:[
        {personId:people[0]!.id,basisPoints:shareBasisPoints},
        {personId:people[1]!.id,basisPoints:10_000-shareBasisPoints}
      ]}:{})
    };
    if(kind==='delivery')return {...common,providerLabel:providerLabel.normalize('NFKC').trim(),trackingLastFour};
    if(kind==='guest_access')return {...common,guestLabel:guestLabel.normalize('NFKC').trim(),accessArea:accessArea.normalize('NFKC').trim(),scheduledAt:isoOrUndefined(scheduledAt),dueAt:isoOrUndefined(dueAt)};
    if(kind==='pet_care')return {...common,opaquePetReference:petReference.normalize('NFKC').trim(),...(assignedPersonId?{assignedPersonId}:{}),...(isoOrUndefined(dueAt)?{dueAt:isoOrUndefined(dueAt)}:{})};
    return {...common,...(assignedPersonId?{assignedPersonId}:{}),...(isoOrUndefined(dueAt)?{dueAt:isoOrUndefined(dueAt)}:{})};
  };

  const createReady=title.trim().length>=2
    && (kind!=='shopping_item'||Boolean(parentItemId))
    && (kind!=='stock_item'||Number.isFinite(Number(quantity))&&Number(quantity)>=0&&unit.trim().length>0
      &&(stockCategory!=='food'||Boolean(isoOrUndefined(expiresAt))))
    && (kind!=='recipe'||splitText(ingredients).length>0)
    && (kind!=='meal_plan'||Boolean(parentItemId)&&Boolean(isoOrUndefined(scheduledAt)))
    && (!['chore','routine'].includes(kind)||Boolean(assignedPersonId))
    && (kind!=='routine'||recurrence.trim().length>0)
    && (!['bill','subscription','shared_expense'].includes(kind)||Number(amount)>=0&&amount.trim()!==''&&/^[A-Z]{3}$/u.test(currency))
    && (!['bill','subscription'].includes(kind)||Boolean(isoOrUndefined(dueAt)))
    && (kind!=='subscription'||recurrence.trim().length>0)
    && (kind!=='shared_expense'||people.length>=2)
    && (kind!=='delivery'||providerLabel.trim().length>0&&/^[A-Za-z0-9]{4}$/u.test(trackingLastFour))
    && (kind!=='guest_access'||guestLabel.trim().length>0&&accessArea.trim().length>0&&Boolean(isoOrUndefined(scheduledAt))&&Boolean(isoOrUndefined(dueAt)))
    && (kind!=='pet_care'||petReference.trim().length>0&&Boolean(isoOrUndefined(dueAt)));

  const create=async()=>{
    if(!window.pardus||!createReady||busy)return;
    const payload=draftPayload();const fingerprint=JSON.stringify(payload);
    if(!pendingCreate.current||pendingCreate.current.fingerprint!==fingerprint){
      pendingCreate.current={fingerprint,clientOperationId:`household-operation:${crypto.randomUUID()}`,itemId:`household-item:${crypto.randomUUID()}`,expectedCenterRevision:center?.revision??0};
    }
    const identity=pendingCreate.current;setBusy(true);setMessage('');
    try{
      await window.pardus.createHouseholdOperationItem({
        ...payload,expectedCenterRevision:identity.expectedCenterRevision,clientOperationId:identity.clientOperationId,itemId:identity.itemId
      } as CreateHouseholdOperationItemInput);
      pendingCreate.current=undefined;setTitle('');setNote('');await reload();setTone('success');setMessage('Yerel hane operasyonu kaydedildi.');
    }catch(error){setTone('danger');setMessage(`${error instanceof Error?error.message:'Kayıt oluşturulamadı.'} Değişiklik yapmazsanız aynı işlem kimliğiyle yeniden deneyebilirsiniz.`);}
    finally{setBusy(false);}
  };

  const mutationIdentity=(key:string,item:HouseholdOperationItemView,fingerprint:string)=>{
    const existing=pendingMutations.current.get(key);
    if(existing?.fingerprint===fingerprint)return existing;
    const next={fingerprint,clientOperationId:`household-operation:${crypto.randomUUID()}`,expectedCenterRevision:center?.revision??0,expectedItemRevision:item.revision};
    pendingMutations.current.set(key,next);return next;
  };
  const updateStatus=async(item:HouseholdOperationItemView,next:Exclude<HouseholdOperationStatus,'deleted'>)=>{
    if(!window.pardus||busy)return;
    const key=`update:${item.id}`;const identity=mutationIdentity(key,item,next);setBusy(true);setMessage('');
    try{await window.pardus.updateHouseholdOperationItem({...identity,itemId:item.id,status:next});pendingMutations.current.delete(key);await reload();setTone('success');setMessage('Durum yerel olarak güncellendi.');}
    catch(error){setTone('danger');setMessage(`${error instanceof Error?error.message:'Durum güncellenemedi.'} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`);}
    finally{setBusy(false);}
  };
  const remove=async(item:HouseholdOperationItemView)=>{
    if(!window.pardus||busy)return;
    const reason='Kullanıcı hane operasyonunu yerel görünümden kaldırdı.';const key=`delete:${item.id}`;
    const identity=mutationIdentity(key,item,reason);setBusy(true);setMessage('');
    try{await window.pardus.deleteHouseholdOperationItem({...identity,itemId:item.id,reason});pendingMutations.current.delete(key);await reload();setTone('success');setMessage('Kayıt yerel olarak silindi.');}
    catch(error){setTone('danger');setMessage(`${error instanceof Error?error.message:'Kayıt silinemedi.'} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`);}
    finally{setBusy(false);}
  };

  return <Surface className="household-operations-panel">
    <SectionHeader eyebrow="33-T · yerel hane koordinasyonu" title="Hane operasyonları merkezi"/>
    <div className="household-operations-truth" role="note">
      <strong>Bu merkez kayıt tutar; dış sipariş, ödeme, kargo senkronizasyonu veya uzaktan anahtar kontrolü yapmaz.</strong>
      <span>Tam takip numarası ve anahtar kodu saklanmaz. Tarif filtresi tıbbi tavsiye değildir; evcil hayvan bakımı dış hizmet teslimi oluşturmaz.</span>
    </div>
    <nav className="household-area-tabs" aria-label="Hane operasyonu alanları">
      {areaOptions.map((option)=><button key={option.value} type="button" className={area===option.value?'is-active':''} aria-pressed={area===option.value} onClick={()=>changeArea(option.value)}>
        <span>{option.label}</span><strong>{center?.countsByArea[option.value]??0}</strong>
      </button>)}
    </nav>
    <div className="household-operations-layout">
      <section className="household-operation-form" aria-label="Yeni hane operasyonu">
        <h3>Yeni kayıt</h3>
        <div className="form-grid">
          <label>Kayıt türü<select value={kind} onChange={(event)=>changeKind(event.target.value as HouseholdOperationKind)}>{kindsByArea[area].map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Başlık<input value={title} onChange={(event)=>setTitle(event.target.value)} maxLength={160}/></label>
          <label>Durum<select value={status} onChange={(event)=>setStatus(event.target.value as Exclude<HouseholdOperationStatus,'deleted'>)}><option value="planned">Planlandı</option><option value="active">Etkin</option><option value="due">Bekliyor</option><option value="low_stock">Azaldı</option></select></label>
          {(kind==='shopping_item'||kind==='meal_plan')&&<label>{kind==='shopping_item'?'Alışveriş listesi':'Bağlı tarif'}<select value={parentItemId} onChange={(event)=>setParentItemId(event.target.value)}><option value="">Seçin</option>{parentOptions.map((entry)=><option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>}
          {kind==='stock_item'&&<><label>Stok türü<select value={stockCategory} onChange={(event)=>setStockCategory(event.target.value as 'food'|'cleaning')}><option value="food">Gıda</option><option value="cleaning">Temizlik</option></select></label><label>Miktar<input type="number" min="0" step="0.01" value={quantity} onChange={(event)=>setQuantity(event.target.value)}/></label><label>Birim<input value={unit} onChange={(event)=>setUnit(event.target.value)} maxLength={32}/></label><label>Son kullanım<input type="datetime-local" value={expiresAt} onChange={(event)=>setExpiresAt(event.target.value)}/></label></>}
          {kind==='recipe'&&<><label className="span-2">Malzemeler (virgülle)<input value={ingredients} onChange={(event)=>setIngredients(event.target.value)} placeholder="mercimek, soğan, su"/></label><label className="span-2">Alerjen kodları (virgülle)<input value={allergens} onChange={(event)=>setAllergens(event.target.value)} placeholder="gluten, süt"/></label></>}
          {kind==='meal_plan'&&<><label>Öğün zamanı<input type="datetime-local" value={scheduledAt} onChange={(event)=>setScheduledAt(event.target.value)}/></label><label>Kaçınılan alerjenler<input value={avoidedAllergens} onChange={(event)=>setAvoidedAllergens(event.target.value)} placeholder="gluten, süt"/></label></>}
          {(kind==='chore'||kind==='routine'||kind==='pet_care'||kind==='shopping_list'||kind==='shopping_item')&&<label>Atanan kişi<select value={assignedPersonId} onChange={(event)=>setAssignedPersonId(event.target.value)}><option value="">Atama yok</option>{people.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>}
          {(kind==='chore'||kind==='routine'||kind==='pet_care'||kind==='shopping_list'||kind==='bill'||kind==='subscription')&&<label>Son tarih<input type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label>}
          {(kind==='routine'||kind==='subscription')&&<label>Tekrar bilgisi<input value={recurrence} onChange={(event)=>setRecurrence(event.target.value)} placeholder="Her pazartesi" maxLength={160}/></label>}
          {(kind==='bill'||kind==='subscription'||kind==='shared_expense')&&<><label>Tutar<input type="number" min="0" step="0.01" value={amount} onChange={(event)=>setAmount(event.target.value)}/></label><label>Para birimi<input value={currency} onChange={(event)=>setCurrency(event.target.value.toLocaleUpperCase('tr-TR'))} maxLength={3}/></label></>}
          {kind==='shared_expense'&&<label className="span-2">İlk iki aile üyesi arasında ilk kişinin payı: %{shareBasisPoints/100}<input type="range" min="1" max="9999" value={shareBasisPoints} onChange={(event)=>setShareBasisPoints(Number(event.target.value))}/><small>{people[0]?.displayName??'İlk kişi'} %{shareBasisPoints/100} · {people[1]?.displayName??'İkinci kişi'} %{(10_000-shareBasisPoints)/100}</small></label>}
          {kind==='delivery'&&<><label>Taşıyıcı etiketi<input value={providerLabel} onChange={(event)=>setProviderLabel(event.target.value)} maxLength={120}/></label><label>Takip son dört<input value={trackingLastFour} onChange={(event)=>setTrackingLastFour(event.target.value)} maxLength={4} pattern="[A-Za-z0-9]{4}"/></label></>}
          {kind==='guest_access'&&<><label>Misafir etiketi<input value={guestLabel} onChange={(event)=>setGuestLabel(event.target.value)} maxLength={120}/></label><label>Erişim alanı<input value={accessArea} onChange={(event)=>setAccessArea(event.target.value)} placeholder="Salon" maxLength={120}/></label><label>Başlangıç<input type="datetime-local" value={scheduledAt} onChange={(event)=>setScheduledAt(event.target.value)}/></label><label>Bitiş<input type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label></>}
          {kind==='pet_care'&&<label>Yerel evcil hayvan referansı<input value={petReference} onChange={(event)=>setPetReference(event.target.value)} placeholder="Kedi · Mavi" maxLength={128}/></label>}
          <label className="span-2">Not<input value={note} onChange={(event)=>setNote(event.target.value)} maxLength={2000}/></label>
        </div>
        <Button tone="primary" onClick={()=>void create()} disabled={!createReady||busy}>{busy?'Kaydediliyor…':'Yerel kayıt oluştur'}</Button>
        {kind==='shared_expense'&&people.length<2&&<StatusMessage tone="danger">Paylaşılan gider için en az iki etkin aile üyesi gerekir.</StatusMessage>}
      </section>
      <section className="household-operation-list" aria-live="polite">
        <div className="household-list-heading"><h3>{areaOptions.find((option)=>option.value===area)?.label}</h3><Button onClick={()=>void reload()} disabled={loading||busy}>{loading?'Yükleniyor…':'Yenile'}</Button></div>
        {message&&<StatusMessage tone={tone}>{message}</StatusMessage>}
        {!loading&&areaItems.length===0?<EmptyState title="Bu alanda kayıt yok" body="Soldaki formdan yerel ve aile kapsamlı bir operasyon ekleyin."/>:<div className="stack-list">{areaItems.map((entry)=><div className="household-operation-row" key={entry.id}>
          <div><strong>{entry.title}</strong><small>{statusLabels[entry.status]} · revizyon {entry.revision}{entry.assignedPersonId?` · ${people.find((person)=>person.id===entry.assignedPersonId)?.displayName??'Atanan kişi'}`:''}</small><small>{entry.quantity!==undefined?`${entry.quantity} ${entry.unit??''} · `:''}{entry.amountMinor!==undefined?`${(entry.amountMinor/100).toLocaleString('tr-TR',{minimumFractionDigits:2})} ${entry.currency} · `:''}{entry.trackingLastFour?`takip ••••${entry.trackingLastFour} · `:''}{entry.expiresAt?`son kullanım ${formatDate(entry.expiresAt)} · `:''}{entry.dueAt?formatDate(entry.dueAt):entry.scheduledAt?formatDate(entry.scheduledAt):entry.note??''}</small></div>
          <div className="household-row-actions"><Button onClick={()=>void updateStatus(entry,entry.kind==='delivery'?'delivered':entry.kind==='guest_access'?'revoked':'completed')} disabled={busy||['completed','delivered','revoked'].includes(entry.status)}>Tamamla</Button><Button tone="danger" onClick={()=>void remove(entry)} disabled={busy}>Sil</Button></div>
        </div>)}</div>}
      </section>
    </div>
  </Surface>;
}
