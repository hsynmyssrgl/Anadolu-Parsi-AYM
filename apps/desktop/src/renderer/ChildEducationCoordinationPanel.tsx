import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChildEducationArea,
  ChildEducationCenterView,
  ChildEducationItemView,
  ChildEducationKind,
  ChildEducationStatus,
  ChildEducationVisibility,
  CreateChildEducationItemInput,
  FamilyMemberView
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';
import { selectUiCopy, useLocalization } from './localization';

const isoOrUndefined=(value:string):string|undefined=>{
  if(!value)return undefined;
  const parsed=new Date(value);
  return Number.isFinite(parsed.getTime())?parsed.toISOString():undefined;
};
const ageAt=(birthDate:string):number=>{
  const birth=new Date(`${birthDate}T00:00:00.000Z`);const now=new Date();
  let age=now.getUTCFullYear()-birth.getUTCFullYear();
  if(now.getUTCMonth()<birth.getUTCMonth()||(now.getUTCMonth()===birth.getUTCMonth()&&now.getUTCDate()<birth.getUTCDate()))age-=1;
  return age;
};
type UiText=(turkish:string,english:string)=>string;
const itemSummary=(entry:ChildEducationItemView,text:UiText,locale:string):string=>[
  entry.institutionLabel,entry.classLabel,entry.subjectLabel,
  entry.scheduledAt?`${text('başlangıç','start')} ${new Date(entry.scheduledAt).toLocaleString(locale)}`:undefined,
  entry.dueAt?`${text('son tarih','due')} ${new Date(entry.dueAt).toLocaleString(locale)}`:undefined,
  entry.recurrence?`${text('tekrar','recurrence')} ${entry.recurrence}`:undefined,
  entry.amountMinor!==undefined?`${(entry.amountMinor/100).toLocaleString(locale,{minimumFractionDigits:2})} ${entry.currency}`:undefined,
  entry.progressBasisPoints!==undefined?`${text('ilerleme','progress')} %${entry.progressBasisPoints/100}`:undefined,
  entry.transportMode?`${text('ulaşım','transport')} ${entry.transportMode}`:undefined,
  entry.note
].filter((value):value is string=>Boolean(value)).join(' · ');
interface PendingCreate{readonly fingerprint:string;readonly clientOperationId:string;readonly itemId:string}

export function ChildEducationCoordinationPanel({people}:{readonly people:readonly FamilyMemberView[]}){
  const { language, locale }=useLocalization();const text:UiText=(turkish,english)=>selectUiCopy(language,turkish,english);
  const areaOptions:ReadonlyArray<{readonly value:ChildEducationArea;readonly label:string}>=[
    {value:'schoolwork',label:text('Okul ve dersler','School and classes')},{value:'events_access',label:text('Etkinlik ve ulaşım','Events and transport')},
    {value:'activities',label:text('Kurs ve gelişim','Courses and development')},{value:'money_goals',label:text('Harçlık ve hedefler','Allowance and goals')}
  ];
  const kindsByArea:Readonly<Record<ChildEducationArea,ReadonlyArray<{readonly value:ChildEducationKind;readonly label:string}>>>={
    schoolwork:[{value:'school',label:text('Okul','School')},{value:'class',label:text('Sınıf','Class')},{value:'timetable',label:text('Ders programı','Timetable')},{value:'homework',label:text('Ödev','Homework')},{value:'exam',label:text('Sınav','Exam')}],
    events_access:[{value:'school_event',label:text('Okul etkinliği','School event')},{value:'transport_plan',label:text('Ulaşım planı','Transport plan')},{value:'pickup_authority',label:text('Teslim alma yetkisi','Pickup authority')}],
    activities:[{value:'course',label:text('Kurs','Course')},{value:'sport',label:text('Spor','Sport')},{value:'certificate',label:text('Sertifika','Certificate')},{value:'book',label:text('Kitap','Book')}],
    money_goals:[{value:'allowance_budget',label:text('Harçlık bütçesi','Allowance budget')},{value:'education_goal',label:text('Eğitim hedefi','Education goal')}]
  };
  const statusLabels:Readonly<Record<ChildEducationStatus,string>>={
    planned:text('Planlandı','Planned'),active:text('Etkin','Active'),submitted:text('Teslim edildi','Submitted'),completed:text('Tamamlandı','Completed'),cancelled:text('İptal edildi','Canceled'),
    expired:text('Süresi doldu','Expired'),archived:text('Arşivlendi','Archived'),deleted:text('Silindi','Deleted')
  };
  const privacyLabels:Readonly<Record<ChildEducationVisibility,string>>={
    family_coordination:text('Aile koordinasyonu','Family coordination'),child_and_selected_guardians:text('Çocuk ve seçili vasiler','Child and selected guardians'),adolescent_private:text('Ergen özel alanı','Adolescent private area')
  };
  const minors=useMemo(()=>people.filter((person)=>person.status==='active'&&person.birthDate!==undefined&&ageAt(person.birthDate)>=0&&ageAt(person.birthDate)<18),[people]);
  const [childPersonId,setChildPersonId]=useState(minors[0]?.id??'');
  const [center,setCenter]=useState<ChildEducationCenterView>();
  const [area,setArea]=useState<ChildEducationArea>('schoolwork');
  const [kind,setKind]=useState<ChildEducationKind>('homework');
  const [title,setTitle]=useState('');
  const [visibility,setVisibility]=useState<ChildEducationVisibility>('family_coordination');
  const [status,setStatus]=useState<Exclude<ChildEducationStatus,'deleted'>>('planned');
  const [institutionLabel,setInstitutionLabel]=useState('');
  const [classLabel,setClassLabel]=useState('');
  const [subjectLabel,setSubjectLabel]=useState('');
  const [scheduledAt,setScheduledAt]=useState('');
  const [dueAt,setDueAt]=useState('');
  const [recurrence,setRecurrence]=useState('');
  const [transportMode,setTransportMode]=useState<NonNullable<ChildEducationItemView['transportMode']>>('school_service');
  const [authorityReferenceId,setAuthorityReferenceId]=useState('');
  const [amount,setAmount]=useState('');
  const [currency,setCurrency]=useState('TRY');
  const [progressBasisPoints,setProgressBasisPoints]=useState(0);
  const [note,setNote]=useState('');
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [tone,setTone]=useState<'success'|'danger'|'info'>('info');
  const pendingCreate=useRef<PendingCreate|undefined>(undefined);
  const pendingMutations=useRef(new Map<string,{readonly fingerprint:string;readonly clientOperationId:string;readonly expectedRevision:number}>());

  const reload=async(personId=childPersonId)=>{
    if(!window.pardus||!personId){setCenter(undefined);return;}
    setLoading(true);
    try{setCenter(await window.pardus.getChildEducationCenter({childPersonId:personId}));setMessage('');}
    catch(error){setCenter(undefined);setTone('danger');setMessage(error instanceof Error?error.message:text('Çocuk eğitim merkezi yüklenemedi.','Child education center could not be loaded.'));}
    finally{setLoading(false);}
  };
  useEffect(()=>{void reload();},[childPersonId]);

  const areaItems=useMemo(()=>center?.items.filter((item)=>item.area===area&&item.status!=='deleted')??[],[area,center]);
  const changeArea=(next:ChildEducationArea)=>{setArea(next);setKind(kindsByArea[next][0]!.value);setMessage('');pendingCreate.current=undefined;};
  const institutionRequired=['school','class','school_event','course','sport','certificate'].includes(kind);
  const subjectRequired=['timetable','homework','exam'].includes(kind);
  const scheduleRequired=['timetable','exam','school_event','transport_plan','pickup_authority','course','sport'].includes(kind);
  const dueRequired=['homework','pickup_authority'].includes(kind);
  const createReady=Boolean(childPersonId)&&title.trim().length>=2
    &&(!institutionRequired||institutionLabel.trim().length>0)&&(!subjectRequired||subjectLabel.trim().length>0)
    &&(kind!=='class'||classLabel.trim().length>0)
    &&(!scheduleRequired||Boolean(isoOrUndefined(scheduledAt)))
    &&(!dueRequired||Boolean(isoOrUndefined(dueAt)))
    &&(kind!=='pickup_authority'||authorityReferenceId.trim().length>0)
    &&(kind!=='allowance_budget'||amount.trim()!==''&&Number(amount)>=0&&/^[A-Z]{3}$/u.test(currency));

  const createPayload=()=>({
    childPersonId,kind,title:title.normalize('NFKC').trim(),visibility,status,
    ...(institutionRequired?{institutionLabel:institutionLabel.normalize('NFKC').trim()}:{}),
    ...(kind==='class'&&classLabel.trim()?{classLabel:classLabel.normalize('NFKC').trim()}:{}),
    ...(subjectRequired?{subjectLabel:subjectLabel.normalize('NFKC').trim()}:{}),
    ...(isoOrUndefined(scheduledAt)?{scheduledAt:isoOrUndefined(scheduledAt)}:{}),
    ...(isoOrUndefined(dueAt)?{dueAt:isoOrUndefined(dueAt)}:{}),
    ...(recurrence.trim()?{recurrence:recurrence.normalize('NFKC').trim()}:{}),
    ...(kind==='transport_plan'?{transportMode}:{}),
    ...(kind==='pickup_authority'?{authorityReferenceId:authorityReferenceId.normalize('NFKC').trim()}:{}),
    ...(kind==='allowance_budget'?{amountMinor:Math.round(Number(amount)*100),currency}:{}),
    ...(kind==='education_goal'?{progressBasisPoints}:{}),
    ...(note.trim()?{note:note.normalize('NFKC').trim()}: {})
  });
  const create=async()=>{
    if(!window.pardus||!createReady||busy)return;
    const payload=createPayload();const fingerprint=JSON.stringify(payload);
    if(!pendingCreate.current||pendingCreate.current.fingerprint!==fingerprint){
      pendingCreate.current={fingerprint,clientOperationId:`child-education:${crypto.randomUUID()}`,itemId:`child-education-item:${crypto.randomUUID()}`};
    }
    const identity=pendingCreate.current;setBusy(true);setMessage('');
    try{
      await window.pardus.createChildEducationItem({...payload,...identity} as CreateChildEducationItemInput);
      pendingCreate.current=undefined;setTitle('');setNote('');await reload();setTone('success');setMessage(text('Çocuk eğitim kaydı yalnız bu cihazda kaydedildi.','The child education record was saved on this device only.'));
    }catch(error){setTone('danger');setMessage(`${error instanceof Error?error.message:text('Kayıt oluşturulamadı.','The record could not be created.')} ${text('Değişiklik yapmazsanız aynı işlem kimliğiyle yeniden deneyebilirsiniz.','If you make no changes, you can retry with the same operation identifier.')}`);}
    finally{setBusy(false);}
  };
  const mutationIdentity=(key:string,item:ChildEducationItemView,fingerprint:string)=>{
    const existing=pendingMutations.current.get(key);if(existing?.fingerprint===fingerprint)return existing;
    const next={fingerprint,clientOperationId:`child-education:${crypto.randomUUID()}`,expectedRevision:item.revision};
    pendingMutations.current.set(key,next);return next;
  };
  const updateStatus=async(item:ChildEducationItemView,next:Exclude<ChildEducationStatus,'deleted'>)=>{
    if(!window.pardus||busy)return;const key=`update:${item.id}`;const identity=mutationIdentity(key,item,next);setBusy(true);setMessage('');
    try{await window.pardus.updateChildEducationItem({...identity,itemId:item.id,childPersonId:item.childPersonId,status:next});pendingMutations.current.delete(key);await reload();setTone('success');setMessage(text('Durum yerel olarak güncellendi.','The state was updated locally.'));}
    catch(error){setTone('danger');setMessage(`${error instanceof Error?error.message:text('Durum güncellenemedi.','The state could not be updated.')} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation identifier.')}`);}
    finally{setBusy(false);}
  };
  const remove=async(item:ChildEducationItemView)=>{
    if(!window.pardus||busy)return;const reason=text('Kullanıcı çocuk eğitim kaydını yerel görünümden kaldırdı.','The user removed the child education record from the local view.');const key=`delete:${item.id}`;
    const identity=mutationIdentity(key,item,reason);setBusy(true);setMessage('');
    try{await window.pardus.deleteChildEducationItem({...identity,itemId:item.id,childPersonId:item.childPersonId,reason});pendingMutations.current.delete(key);await reload();setTone('success');setMessage(text('Kayıt yerel olarak silindi.','The record was deleted locally.'));}
    catch(error){setTone('danger');setMessage(`${error instanceof Error?error.message:text('Kayıt silinemedi.','The record could not be deleted.')} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation identifier.')}`);}
    finally{setBusy(false);}
  };

  return <Surface className="child-education-panel">
    <SectionHeader eyebrow={text('33-U · yerel çocuk eğitim koordinasyonu','33-U · local child education coordination')} title={text('Çocuk eğitim merkezi','Child education center')}/>
    <div className="child-education-truth" role="note">
      <strong>{text('Bu ekran yalnız yerel koordinasyon içindir; okul portalına bağlanmaz, öğretmene mesaj göndermez ve servisi canlı izlemez.','This screen is for local coordination only; it does not connect to a school portal, message teachers or track transport live.')}</strong>
      <span>{text('Harçlık kaydı ödeme yapmaz. Sertifika doğrulanmış sayılmaz. Teslim yetkisi yalnız Kimlik Merkezi’ndeki ayrı, opak referansa bağlanır.','An allowance record does not make payments. A certificate is not treated as verified. Pickup authority is bound only to a separate opaque reference in the Identity Center.')}</span>
    </div>
    {minors.length===0?<EmptyState title={text('Çocuk profili bulunamadı','No child profile found')} body={text('Doğum tarihi doğrulanmış, etkin ve 18 yaş altı bir aile üyesi gerekir.','An active family member under 18 with a verified birth date is required.')}/>:<>
      <label className="child-education-person">{text('Çocuk profili','Child profile')}<select value={childPersonId} onChange={(event)=>{setChildPersonId(event.target.value);pendingCreate.current=undefined;setMessage('');}}>{minors.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
      <div className="child-education-privacy" aria-live="polite"><strong>{center?.ageBand==='teen'?text('Ergen görünümü','Adolescent view'):text('Rehberli çocuk görünümü','Guided child view')}</strong><span>{text('Gizlilik: aile koordinasyonu, seçili vasiler veya 13–17 yaş kayıt sahibinin özel alanı. AI işleme ve dışa paylaşım kapalıdır.','Privacy: family coordination, selected guardians or the private area of the 13–17-year-old record owner. AI processing and external sharing are disabled.')}</span></div>
      <nav className="child-education-tabs" aria-label={text('Çocuk eğitim alanları','Child education areas')}>{areaOptions.map((option)=><button key={option.value} type="button" aria-pressed={area===option.value} className={area===option.value?'is-active':''} onClick={()=>changeArea(option.value)}><span>{option.label}</span><strong>{center?.countsByArea[option.value]??0}</strong></button>)}</nav>
      <div className="child-education-layout">
        <section className="child-education-form" aria-label={text('Yeni çocuk eğitim kaydı','New child education record')}><h3>{text('Yeni kayıt','New record')}</h3><div className="form-grid">
          <label>{text('Kayıt türü','Record type')}<select value={kind} onChange={(event)=>{setKind(event.target.value as ChildEducationKind);pendingCreate.current=undefined;}}>{kindsByArea[area].map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>{text('Başlık','Title')}<input value={title} onChange={(event)=>setTitle(event.target.value)} maxLength={160}/></label>
          <label>{text('Görünürlük','Visibility')}<select value={visibility} onChange={(event)=>setVisibility(event.target.value as ChildEducationVisibility)}><option value="family_coordination">{text('Aile koordinasyonu','Family coordination')}</option><option value="child_and_selected_guardians">{text('Çocuk ve seçili vasiler','Child and selected guardians')}</option><option value="adolescent_private" disabled={center?.ageBand!=='teen'}>{text('Ergen özel alanı','Adolescent private area')}</option></select></label>
          <label>{text('Durum','State')}<select value={status} onChange={(event)=>setStatus(event.target.value as Exclude<ChildEducationStatus,'deleted'>)}><option value="planned">{text('Planlandı','Planned')}</option><option value="active">{text('Etkin','Active')}</option><option value="submitted">{text('Teslim edildi','Submitted')}</option><option value="completed">{text('Tamamlandı','Completed')}</option></select></label>
          {institutionRequired&&<label>{text('Kurum','Institution')}<input value={institutionLabel} onChange={(event)=>setInstitutionLabel(event.target.value)} maxLength={120}/></label>}
          {kind==='class'&&<label>{text('Sınıf','Class')}<input value={classLabel} onChange={(event)=>setClassLabel(event.target.value)} maxLength={80}/></label>}
          {subjectRequired&&<label>{text('Ders','Subject')}<input value={subjectLabel} onChange={(event)=>setSubjectLabel(event.target.value)} maxLength={80}/></label>}
          {kind==='transport_plan'&&<label>{text('Ulaşım biçimi','Transport mode')}<select value={transportMode} onChange={(event)=>setTransportMode(event.target.value as NonNullable<ChildEducationItemView['transportMode']>)}><option value="school_service">{text('Okul servisi','School service')}</option><option value="family_dropoff">{text('Aile bırakacak','Family drop-off')}</option><option value="public_transport">{text('Toplu taşıma','Public transport')}</option><option value="walking">{text('Yürüyüş','Walking')}</option><option value="other">{text('Diğer','Other')}</option></select></label>}
          {kind==='pickup_authority'&&<label>{text('Kimlik Merkezi referansı','Identity Center reference')}<input value={authorityReferenceId} onChange={(event)=>setAuthorityReferenceId(event.target.value)} maxLength={128}/></label>}
          {kind==='allowance_budget'&&<><label>{text('Bütçe tutarı','Budget amount')}<input type="number" min="0" step="0.01" value={amount} onChange={(event)=>setAmount(event.target.value)}/></label><label>{text('Para birimi','Currency')}<input value={currency} onChange={(event)=>setCurrency(event.target.value.toLocaleUpperCase(locale))} maxLength={3}/></label></>}
          {kind==='education_goal'&&<label className="span-2">{text('İlerleme','Progress')}: %{progressBasisPoints/100}<input type="range" min="0" max="10000" value={progressBasisPoints} onChange={(event)=>setProgressBasisPoints(Number(event.target.value))}/></label>}
          <label>{text('Başlangıç','Start')}<input type="datetime-local" value={scheduledAt} onChange={(event)=>setScheduledAt(event.target.value)}/></label><label>{text('Son tarih','Due date')}<input type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label>
          <label>{text('Tekrar bilgisi','Recurrence')}<input value={recurrence} onChange={(event)=>setRecurrence(event.target.value)} maxLength={160}/></label><label>{text('Not','Note')}<input value={note} onChange={(event)=>setNote(event.target.value)} maxLength={2000}/></label>
        </div><Button tone="primary" onClick={()=>void create()} disabled={!createReady||busy}>{busy?text('Kaydediliyor…','Saving…'):text('Yerel kayıt oluştur','Create local record')}</Button></section>
        <section className="child-education-list" aria-live="polite"><div className="child-education-list-heading"><h3>{areaOptions.find((option)=>option.value===area)?.label}</h3><Button onClick={()=>void reload()} disabled={loading||busy}>{loading?text('Yükleniyor…','Loading…'):text('Yenile','Refresh')}</Button></div>
          {message&&<StatusMessage tone={tone}>{message}</StatusMessage>}
          {!loading&&areaItems.length===0?<EmptyState title={text('Bu alanda kayıt yok','No records in this area')} body={text('Soldaki formdan yaşa uygun, yerel bir koordinasyon kaydı ekleyin.','Add an age-appropriate local coordination record with the form on the left.')}/>:<div className="stack-list">{areaItems.map((entry)=><div className="child-education-row" key={entry.id}><div><strong>{entry.title}</strong><small>{statusLabels[entry.status]} · {privacyLabels[entry.visibility]} · {text('revizyon','revision')} {entry.revision}</small><small>{itemSummary(entry,text,locale)||text('Yalnız yerel kayıt','Local record only')}</small></div><div className="child-education-actions"><Button onClick={()=>void updateStatus(entry,'completed')} disabled={busy||entry.status==='completed'}>{text('Tamamla','Complete')}</Button><Button tone="danger" onClick={()=>void remove(entry)} disabled={busy}>{text('Sil','Delete')}</Button></div></div>)}</div>}
        </section>
      </div>
    </>}
  </Surface>;
}
