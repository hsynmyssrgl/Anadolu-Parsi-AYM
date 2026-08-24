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
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

const splitText = (value:string):readonly string[] => [...new Set(value.split(',').map((part)=>part.normalize('NFKC').trim()).filter(Boolean))];
const isoOrUndefined = (value:string):string|undefined => {
  if(!value)return undefined;
  const parsed=new Date(value);
  return Number.isFinite(parsed.getTime())?parsed.toISOString():undefined;
};
const formatDate = (value:string|undefined,locale:string,noDate:string):string => value
  ? new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))
  : noDate;

interface PendingCreate {
  readonly fingerprint:string;
  readonly clientOperationId:string;
  readonly itemId:string;
  readonly expectedCenterRevision:number;
}

export function HouseholdOperationsPanel({people}:{readonly people:readonly FamilyMemberView[]}){
  const { language, locale }=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const areaOptions: ReadonlyArray<{ readonly value: HouseholdOperationArea; readonly label: string }> = [
    { value:'shopping',label:text('Alışveriş','Shopping') },{ value:'inventory',label:text('Stok','Inventory') },
    { value:'meals',label:text('Öğün ve tarif','Meals and recipes') },{ value:'chores',label:text('Görev ve rutin','Chores and routines') },
    { value:'expenses',label:text('Giderler','Expenses') },{ value:'deliveries',label:text('Teslimatlar','Deliveries') },
    { value:'guests',label:text('Misafir erişimi','Guest access') },{ value:'pets',label:text('Evcil hayvan','Pets') }
  ];
  const kindsByArea: Readonly<Record<HouseholdOperationArea, ReadonlyArray<{ readonly value: HouseholdOperationKind; readonly label: string }>>> = {
    shopping: [{ value:'shopping_list',label:text('Alışveriş listesi','Shopping list') },{ value:'shopping_item',label:text('Liste öğesi','List item') }],
    inventory: [{ value:'stock_item',label:text('Stok öğesi','Stock item') }],meals: [{ value:'recipe',label:text('Tarif','Recipe') },{ value:'meal_plan',label:text('Öğün planı','Meal plan') }],
    chores: [{ value:'chore',label:text('Ev görevi','Chore') },{ value:'routine',label:text('Tekrarlanan rutin','Recurring routine') }],
    expenses: [{ value:'bill',label:text('Fatura','Bill') },{ value:'subscription',label:text('Abonelik','Subscription') },{ value:'shared_expense',label:text('Paylaşılan gider','Shared expense') }],
    deliveries: [{ value:'delivery',label:text('Teslimat takibi','Delivery tracking') }],guests: [{ value:'guest_access',label:text('Misafir erişim planı','Guest access plan') }],pets: [{ value:'pet_care',label:text('Evcil hayvan bakımı','Pet care') }]
  };
  const statusLabels: Readonly<Record<HouseholdOperationStatus,string>> = {
    planned:text('Planlandı','Planned'),active:text('Etkin','Active'),low_stock:text('Azaldı','Low stock'),due:text('Bekliyor','Due'),completed:text('Tamamlandı','Completed'),
    cancelled:text('İptal edildi','Canceled'),expired:text('Süresi doldu','Expired'),delivered:text('Teslim edildi','Delivered'),revoked:text('Geri alındı','Revoked'),deleted:text('Silindi','Deleted')
  };
  const [center,setCenter]=useState<HouseholdOperationsCenterView>();
  const [area,setArea]=useState<HouseholdOperationArea>('shopping');
  const [kind,setKind]=useState<HouseholdOperationKind>('shopping_list');
  const [title,setTitle]=useState('');
  const [status,setStatus]=useState<Exclude<HouseholdOperationStatus,'deleted'>>('planned');
  const [parentItemId,setParentItemId]=useState('');
  const [assignedPersonId,setAssignedPersonId]=useState('');
  const [stockCategory,setStockCategory]=useState<'food'|'cleaning'>('food');
  const [quantity,setQuantity]=useState('1');
  const [unit,setUnit]=useState(text('adet','items'));
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
    catch(error){setCenter(undefined);setTone('danger');setMessage(toUserFacingErrorMessage(error,text('Hane operasyonları yüklenemedi.','Household operations could not be loaded.')));}
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
      pendingCreate.current=undefined;setTitle('');setNote('');await reload();setTone('success');setMessage(text('Yerel hane operasyonu kaydedildi.','The local household operation was saved.'));
    }catch(error){setTone('danger');setMessage(`${toUserFacingErrorMessage(error,text('Kayıt oluşturulamadı.','The record could not be created.'))} ${text('Değişiklik yapmazsanız aynı işlem kimliğiyle yeniden deneyebilirsiniz.','If you make no changes, you can retry with the same operation identifier.')}`);}
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
    try{await window.pardus.updateHouseholdOperationItem({...identity,itemId:item.id,status:next});pendingMutations.current.delete(key);await reload();setTone('success');setMessage(text('Durum yerel olarak güncellendi.','The state was updated locally.'));}
    catch(error){setTone('danger');setMessage(`${toUserFacingErrorMessage(error,text('Durum güncellenemedi.','The state could not be updated.'))} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation identifier.')}`);}
    finally{setBusy(false);}
  };
  const remove=async(item:HouseholdOperationItemView)=>{
    if(!window.pardus||busy)return;
    const reason=text('Kullanıcı hane operasyonunu yerel görünümden kaldırdı.','The user removed the household operation from the local view.');const key=`delete:${item.id}`;
    const identity=mutationIdentity(key,item,reason);setBusy(true);setMessage('');
    try{await window.pardus.deleteHouseholdOperationItem({...identity,itemId:item.id,reason});pendingMutations.current.delete(key);await reload();setTone('success');setMessage(text('Kayıt yerel olarak silindi.','The record was deleted locally.'));}
    catch(error){setTone('danger');setMessage(`${toUserFacingErrorMessage(error,text('Kayıt silinemedi.','The record could not be deleted.'))} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation identifier.')}`);}
    finally{setBusy(false);}
  };

  return <Surface className="household-operations-panel">
    <SectionHeader eyebrow={text('Yerel hane koordinasyonu','Local household coordination')} title={text('Hane operasyonları merkezi','Household operations center')}/>
    <div className="household-operations-truth" role="note">
      <strong>{text('Bu merkez kayıt tutar; dış sipariş, ödeme, kargo senkronizasyonu veya uzaktan anahtar kontrolü yapmaz.','This center stores records; it does not place external orders, process payments, synchronize shipments, or control remote keys.')}</strong>
      <span>{text('Tam takip numarası ve anahtar kodu saklanmaz. Tarif filtresi tıbbi tavsiye değildir; evcil hayvan bakımı dış hizmet teslimi oluşturmaz.','Full tracking numbers and access codes are not stored. Recipe filtering is not medical advice, and pet-care records do not create an external service delivery.')}</span>
    </div>
    <nav className="household-area-tabs" aria-label={text('Hane operasyonu alanları','Household operation areas')}>
      {areaOptions.map((option)=><button key={option.value} type="button" className={area===option.value?'is-active':''} aria-pressed={area===option.value} onClick={()=>changeArea(option.value)}>
        <span>{option.label}</span><strong>{center?.countsByArea[option.value]??0}</strong>
      </button>)}
    </nav>
    <div className="household-operations-layout">
      <section className="household-operation-form" aria-label={text('Yeni hane operasyonu','New household operation')}>
        <h3>{text('Yeni kayıt','New record')}</h3>
        <div className="form-grid">
          <label>{text('Kayıt türü','Record type')}<select value={kind} onChange={(event)=>changeKind(event.target.value as HouseholdOperationKind)}>{kindsByArea[area].map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>{text('Başlık','Title')}<input value={title} onChange={(event)=>setTitle(event.target.value)} maxLength={160}/></label>
          <label>{text('Durum','State')}<select value={status} onChange={(event)=>setStatus(event.target.value as Exclude<HouseholdOperationStatus,'deleted'>)}><option value="planned">{text('Planlandı','Planned')}</option><option value="active">{text('Etkin','Active')}</option><option value="due">{text('Bekliyor','Due')}</option><option value="low_stock">{text('Azaldı','Low stock')}</option></select></label>
          {(kind==='shopping_item'||kind==='meal_plan')&&<label>{kind==='shopping_item'?text('Alışveriş listesi','Shopping list'):text('Bağlı tarif','Linked recipe')}<select value={parentItemId} onChange={(event)=>setParentItemId(event.target.value)}><option value="">{text('Seçin','Select')}</option>{parentOptions.map((entry)=><option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>}
          {kind==='stock_item'&&<><label>{text('Stok türü','Stock type')}<select value={stockCategory} onChange={(event)=>setStockCategory(event.target.value as 'food'|'cleaning')}><option value="food">{text('Gıda','Food')}</option><option value="cleaning">{text('Temizlik','Cleaning')}</option></select></label><label>{text('Miktar','Quantity')}<input type="number" min="0" step="0.01" value={quantity} onChange={(event)=>setQuantity(event.target.value)}/></label><label>{text('Birim','Unit')}<input value={unit} onChange={(event)=>setUnit(event.target.value)} maxLength={32}/></label><label>{text('Son kullanım','Expiry')}<input type="datetime-local" value={expiresAt} onChange={(event)=>setExpiresAt(event.target.value)}/></label></>}
          {kind==='recipe'&&<><label className="span-2">{text('Malzemeler (virgülle)','Ingredients (comma separated)')}<input value={ingredients} onChange={(event)=>setIngredients(event.target.value)} placeholder={text('mercimek, soğan, su','lentils, onion, water')}/></label><label className="span-2">{text('Alerjen kodları (virgülle)','Allergen codes (comma separated)')}<input value={allergens} onChange={(event)=>setAllergens(event.target.value)} placeholder={text('gluten, süt','gluten, milk')}/></label></>}
          {kind==='meal_plan'&&<><label>{text('Öğün zamanı','Meal time')}<input type="datetime-local" value={scheduledAt} onChange={(event)=>setScheduledAt(event.target.value)}/></label><label>{text('Kaçınılan alerjenler','Avoided allergens')}<input value={avoidedAllergens} onChange={(event)=>setAvoidedAllergens(event.target.value)} placeholder={text('gluten, süt','gluten, milk')}/></label></>}
          {(kind==='chore'||kind==='routine'||kind==='pet_care'||kind==='shopping_list'||kind==='shopping_item')&&<label>{text('Atanan kişi','Assigned person')}<select value={assignedPersonId} onChange={(event)=>setAssignedPersonId(event.target.value)}><option value="">{text('Atama yok','Not assigned')}</option>{people.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>}
          {(kind==='chore'||kind==='routine'||kind==='pet_care'||kind==='shopping_list'||kind==='bill'||kind==='subscription')&&<label>{text('Son tarih','Due date')}<input type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label>}
          {(kind==='routine'||kind==='subscription')&&<label>{text('Tekrar bilgisi','Recurrence')}<input value={recurrence} onChange={(event)=>setRecurrence(event.target.value)} placeholder={text('Her pazartesi','Every Monday')} maxLength={160}/></label>}
          {(kind==='bill'||kind==='subscription'||kind==='shared_expense')&&<><label>{text('Tutar','Amount')}<input type="number" min="0" step="0.01" value={amount} onChange={(event)=>setAmount(event.target.value)}/></label><label>{text('Para birimi','Currency')}<input value={currency} onChange={(event)=>setCurrency(event.target.value.toLocaleUpperCase(locale))} maxLength={3}/></label></>}
          {kind==='shared_expense'&&<label className="span-2">{text('İlk iki aile üyesi arasında ilk kişinin payı','First person share among the first two family members')}: %{shareBasisPoints/100}<input type="range" min="1" max="9999" value={shareBasisPoints} onChange={(event)=>setShareBasisPoints(Number(event.target.value))}/><small>{people[0]?.displayName??text('İlk kişi','First person')} %{shareBasisPoints/100} · {people[1]?.displayName??text('İkinci kişi','Second person')} %{(10_000-shareBasisPoints)/100}</small></label>}
          {kind==='delivery'&&<><label>{text('Taşıyıcı etiketi','Carrier label')}<input value={providerLabel} onChange={(event)=>setProviderLabel(event.target.value)} maxLength={120}/></label><label>{text('Takip son dört','Last four tracking characters')}<input value={trackingLastFour} onChange={(event)=>setTrackingLastFour(event.target.value)} maxLength={4} pattern="[A-Za-z0-9]{4}"/></label></>}
          {kind==='guest_access'&&<><label>{text('Misafir etiketi','Guest label')}<input value={guestLabel} onChange={(event)=>setGuestLabel(event.target.value)} maxLength={120}/></label><label>{text('Erişim alanı','Access area')}<input value={accessArea} onChange={(event)=>setAccessArea(event.target.value)} placeholder={text('Salon','Living room')} maxLength={120}/></label><label>{text('Başlangıç','Start')}<input type="datetime-local" value={scheduledAt} onChange={(event)=>setScheduledAt(event.target.value)}/></label><label>{text('Bitiş','End')}<input type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label></>}
          {kind==='pet_care'&&<label>{text('Yerel evcil hayvan referansı','Local pet reference')}<input value={petReference} onChange={(event)=>setPetReference(event.target.value)} placeholder={text('Kedi · Mavi','Cat · Blue')} maxLength={128}/></label>}
          <label className="span-2">{text('Not','Note')}<input value={note} onChange={(event)=>setNote(event.target.value)} maxLength={2000}/></label>
        </div>
        <Button tone="primary" onClick={()=>void create()} disabled={!createReady||busy}>{busy?text('Kaydediliyor…','Saving…'):text('Yerel kayıt oluştur','Create local record')}</Button>
        {kind==='shared_expense'&&people.length<2&&<StatusMessage tone="danger">{text('Paylaşılan gider için en az iki etkin aile üyesi gerekir.','A shared expense requires at least two active family members.')}</StatusMessage>}
      </section>
      <section className="household-operation-list" aria-live="polite">
        <div className="household-list-heading"><h3>{areaOptions.find((option)=>option.value===area)?.label}</h3><Button onClick={()=>void reload()} disabled={loading||busy}>{loading?text('Yükleniyor…','Loading…'):text('Yenile','Refresh')}</Button></div>
        {message&&<StatusMessage tone={tone}>{message}</StatusMessage>}
        {!loading&&areaItems.length===0?<EmptyState title={text('Bu alanda kayıt yok','No records in this area')} body={text('Soldaki formdan yerel ve aile kapsamlı bir operasyon ekleyin.','Use the form on the left to add a local, family-scoped operation.')}/>:<div className="stack-list">{areaItems.map((entry)=><div className="household-operation-row" key={entry.id}>
          <div><strong>{entry.title}</strong><small>{statusLabels[entry.status]} · {text('revizyon','revision')} {entry.revision}{entry.assignedPersonId?` · ${people.find((person)=>person.id===entry.assignedPersonId)?.displayName??text('Atanan kişi','Assigned person')}`:''}</small><small>{entry.quantity!==undefined?`${entry.quantity} ${entry.unit??''} · `:''}{entry.amountMinor!==undefined?`${(entry.amountMinor/100).toLocaleString(locale,{minimumFractionDigits:2})} ${entry.currency} · `:''}{entry.trackingLastFour?`${text('takip','tracking')} ••••${entry.trackingLastFour} · `:''}{entry.expiresAt?`${text('son kullanım','expiry')} ${formatDate(entry.expiresAt,locale,text('Tarih yok','No date'))} · `:''}{entry.dueAt?formatDate(entry.dueAt,locale,text('Tarih yok','No date')):entry.scheduledAt?formatDate(entry.scheduledAt,locale,text('Tarih yok','No date')):entry.note??''}</small></div>
          <div className="household-row-actions"><Button onClick={()=>void updateStatus(entry,entry.kind==='delivery'?'delivered':entry.kind==='guest_access'?'revoked':'completed')} disabled={busy||['completed','delivered','revoked'].includes(entry.status)}>{text('Tamamla','Complete')}</Button><Button tone="danger" onClick={()=>void remove(entry)} disabled={busy}>{text('Sil','Delete')}</Button></div>
        </div>)}</div>}
      </section>
    </div>
  </Surface>;
}
