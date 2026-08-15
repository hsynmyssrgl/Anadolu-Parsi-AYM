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

const areaOptions:ReadonlyArray<{readonly value:ChildEducationArea;readonly label:string}>=[
  {value:'schoolwork',label:'Okul ve dersler'},
  {value:'events_access',label:'Etkinlik ve ulaşım'},
  {value:'activities',label:'Kurs ve gelişim'},
  {value:'money_goals',label:'Harçlık ve hedefler'}
];
const kindsByArea:Readonly<Record<ChildEducationArea,ReadonlyArray<{readonly value:ChildEducationKind;readonly label:string}>>>={
  schoolwork:[
    {value:'school',label:'Okul'},{value:'class',label:'Sınıf'},{value:'timetable',label:'Ders programı'},
    {value:'homework',label:'Ödev'},{value:'exam',label:'Sınav'}
  ],
  events_access:[
    {value:'school_event',label:'Okul etkinliği'},{value:'transport_plan',label:'Ulaşım planı'},
    {value:'pickup_authority',label:'Teslim alma yetkisi'}
  ],
  activities:[
    {value:'course',label:'Kurs'},{value:'sport',label:'Spor'},{value:'certificate',label:'Sertifika'},
    {value:'book',label:'Kitap'}
  ],
  money_goals:[{value:'allowance_budget',label:'Harçlık bütçesi'},{value:'education_goal',label:'Eğitim hedefi'}]
};
const statusLabels:Readonly<Record<ChildEducationStatus,string>>={
  planned:'Planlandı',active:'Etkin',submitted:'Teslim edildi',completed:'Tamamlandı',cancelled:'İptal edildi',
  expired:'Süresi doldu',archived:'Arşivlendi',deleted:'Silindi'
};
const privacyLabels:Readonly<Record<ChildEducationVisibility,string>>={
  family_coordination:'Aile koordinasyonu',
  child_and_selected_guardians:'Çocuk ve seçili vasiler',
  adolescent_private:'Ergen özel alanı'
};
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
interface PendingCreate{readonly fingerprint:string;readonly clientOperationId:string;readonly itemId:string}

export function ChildEducationCoordinationPanel({people}:{readonly people:readonly FamilyMemberView[]}){
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
    catch(error){setCenter(undefined);setTone('danger');setMessage(error instanceof Error?error.message:'Çocuk eğitim merkezi yüklenemedi.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void reload();},[childPersonId]);

  const areaItems=useMemo(()=>center?.items.filter((item)=>item.area===area&&item.status!=='deleted')??[],[area,center]);
  const changeArea=(next:ChildEducationArea)=>{setArea(next);setKind(kindsByArea[next][0]!.value);setMessage('');pendingCreate.current=undefined;};
  const institutionRequired=['school','class','course','sport','certificate'].includes(kind);
  const subjectRequired=['timetable','homework','exam'].includes(kind);
  const createReady=Boolean(childPersonId)&&title.trim().length>=2
    &&(!institutionRequired||institutionLabel.trim().length>0)&&(!subjectRequired||subjectLabel.trim().length>0)
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
      pendingCreate.current=undefined;setTitle('');setNote('');await reload();setTone('success');setMessage('Çocuk eğitim kaydı yalnız bu cihazda kaydedildi.');
    }catch(error){setTone('danger');setMessage(`${error instanceof Error?error.message:'Kayıt oluşturulamadı.'} Değişiklik yapmazsanız aynı işlem kimliğiyle yeniden deneyebilirsiniz.`);}
    finally{setBusy(false);}
  };
  const mutationIdentity=(key:string,item:ChildEducationItemView,fingerprint:string)=>{
    const existing=pendingMutations.current.get(key);if(existing?.fingerprint===fingerprint)return existing;
    const next={fingerprint,clientOperationId:`child-education:${crypto.randomUUID()}`,expectedRevision:item.revision};
    pendingMutations.current.set(key,next);return next;
  };
  const updateStatus=async(item:ChildEducationItemView,next:Exclude<ChildEducationStatus,'deleted'>)=>{
    if(!window.pardus||busy)return;const key=`update:${item.id}`;const identity=mutationIdentity(key,item,next);setBusy(true);setMessage('');
    try{await window.pardus.updateChildEducationItem({...identity,itemId:item.id,childPersonId:item.childPersonId,status:next});pendingMutations.current.delete(key);await reload();setTone('success');setMessage('Durum yerel olarak güncellendi.');}
    catch(error){setTone('danger');setMessage(`${error instanceof Error?error.message:'Durum güncellenemedi.'} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`);}
    finally{setBusy(false);}
  };
  const remove=async(item:ChildEducationItemView)=>{
    if(!window.pardus||busy)return;const reason='Kullanıcı çocuk eğitim kaydını yerel görünümden kaldırdı.';const key=`delete:${item.id}`;
    const identity=mutationIdentity(key,item,reason);setBusy(true);setMessage('');
    try{await window.pardus.deleteChildEducationItem({...identity,itemId:item.id,childPersonId:item.childPersonId,reason});pendingMutations.current.delete(key);await reload();setTone('success');setMessage('Kayıt yerel olarak silindi.');}
    catch(error){setTone('danger');setMessage(`${error instanceof Error?error.message:'Kayıt silinemedi.'} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`);}
    finally{setBusy(false);}
  };

  return <Surface className="child-education-panel">
    <SectionHeader eyebrow="33-U · yerel çocuk eğitim koordinasyonu" title="Çocuk eğitim merkezi"/>
    <div className="child-education-truth" role="note">
      <strong>Bu ekran yalnız yerel koordinasyon içindir; okul portalına bağlanmaz, öğretmene mesaj göndermez ve servisi canlı izlemez.</strong>
      <span>Harçlık kaydı ödeme yapmaz. Sertifika doğrulanmış sayılmaz. Teslim yetkisi yalnız Kimlik Merkezi’ndeki ayrı, opak referansa bağlanır.</span>
    </div>
    {minors.length===0?<EmptyState title="Çocuk profili bulunamadı" body="Doğum tarihi doğrulanmış, etkin ve 18 yaş altı bir aile üyesi gerekir."/>:<>
      <label className="child-education-person">Çocuk profili<select value={childPersonId} onChange={(event)=>{setChildPersonId(event.target.value);pendingCreate.current=undefined;setMessage('');}}>{minors.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
      <div className="child-education-privacy" aria-live="polite"><strong>{center?.ageBand==='teen'?'Ergen görünümü':'Rehberli çocuk görünümü'}</strong><span>Gizlilik: aile koordinasyonu, seçili vasiler veya 13–17 yaş kayıt sahibinin özel alanı. AI işleme ve dışa paylaşım kapalıdır.</span></div>
      <nav className="child-education-tabs" aria-label="Çocuk eğitim alanları">{areaOptions.map((option)=><button key={option.value} type="button" aria-pressed={area===option.value} className={area===option.value?'is-active':''} onClick={()=>changeArea(option.value)}><span>{option.label}</span><strong>{center?.countsByArea[option.value]??0}</strong></button>)}</nav>
      <div className="child-education-layout">
        <section className="child-education-form" aria-label="Yeni çocuk eğitim kaydı"><h3>Yeni kayıt</h3><div className="form-grid">
          <label>Kayıt türü<select value={kind} onChange={(event)=>{setKind(event.target.value as ChildEducationKind);pendingCreate.current=undefined;}}>{kindsByArea[area].map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Başlık<input value={title} onChange={(event)=>setTitle(event.target.value)} maxLength={160}/></label>
          <label>Görünürlük<select value={visibility} onChange={(event)=>setVisibility(event.target.value as ChildEducationVisibility)}><option value="family_coordination">Aile koordinasyonu</option><option value="child_and_selected_guardians">Çocuk ve seçili vasiler</option><option value="adolescent_private" disabled={center?.ageBand!=='teen'}>Ergen özel alanı</option></select></label>
          <label>Durum<select value={status} onChange={(event)=>setStatus(event.target.value as Exclude<ChildEducationStatus,'deleted'>)}><option value="planned">Planlandı</option><option value="active">Etkin</option><option value="submitted">Teslim edildi</option><option value="completed">Tamamlandı</option></select></label>
          {institutionRequired&&<label>Kurum<input value={institutionLabel} onChange={(event)=>setInstitutionLabel(event.target.value)} maxLength={120}/></label>}
          {kind==='class'&&<label>Sınıf<input value={classLabel} onChange={(event)=>setClassLabel(event.target.value)} maxLength={80}/></label>}
          {subjectRequired&&<label>Ders<input value={subjectLabel} onChange={(event)=>setSubjectLabel(event.target.value)} maxLength={80}/></label>}
          {kind==='transport_plan'&&<label>Ulaşım biçimi<select value={transportMode} onChange={(event)=>setTransportMode(event.target.value as NonNullable<ChildEducationItemView['transportMode']>)}><option value="school_service">Okul servisi</option><option value="family_dropoff">Aile bırakacak</option><option value="public_transport">Toplu taşıma</option><option value="walking">Yürüyüş</option><option value="other">Diğer</option></select></label>}
          {kind==='pickup_authority'&&<label>Kimlik Merkezi referansı<input value={authorityReferenceId} onChange={(event)=>setAuthorityReferenceId(event.target.value)} maxLength={128}/></label>}
          {kind==='allowance_budget'&&<><label>Bütçe tutarı<input type="number" min="0" step="0.01" value={amount} onChange={(event)=>setAmount(event.target.value)}/></label><label>Para birimi<input value={currency} onChange={(event)=>setCurrency(event.target.value.toLocaleUpperCase('tr-TR'))} maxLength={3}/></label></>}
          {kind==='education_goal'&&<label className="span-2">İlerleme: %{progressBasisPoints/100}<input type="range" min="0" max="10000" value={progressBasisPoints} onChange={(event)=>setProgressBasisPoints(Number(event.target.value))}/></label>}
          <label>Başlangıç<input type="datetime-local" value={scheduledAt} onChange={(event)=>setScheduledAt(event.target.value)}/></label><label>Son tarih<input type="datetime-local" value={dueAt} onChange={(event)=>setDueAt(event.target.value)}/></label>
          <label>Tekrar bilgisi<input value={recurrence} onChange={(event)=>setRecurrence(event.target.value)} maxLength={160}/></label><label>Not<input value={note} onChange={(event)=>setNote(event.target.value)} maxLength={2000}/></label>
        </div><Button tone="primary" onClick={()=>void create()} disabled={!createReady||busy}>{busy?'Kaydediliyor…':'Yerel kayıt oluştur'}</Button></section>
        <section className="child-education-list" aria-live="polite"><div className="child-education-list-heading"><h3>{areaOptions.find((option)=>option.value===area)?.label}</h3><Button onClick={()=>void reload()} disabled={loading||busy}>{loading?'Yükleniyor…':'Yenile'}</Button></div>
          {message&&<StatusMessage tone={tone}>{message}</StatusMessage>}
          {!loading&&areaItems.length===0?<EmptyState title="Bu alanda kayıt yok" body="Soldaki formdan yaşa uygun, yerel bir koordinasyon kaydı ekleyin."/>:<div className="stack-list">{areaItems.map((entry)=><div className="child-education-row" key={entry.id}><div><strong>{entry.title}</strong><small>{statusLabels[entry.status]} · {privacyLabels[entry.visibility]} · revizyon {entry.revision}</small><small>{entry.institutionLabel??entry.subjectLabel??entry.note??'Yalnız yerel kayıt'}</small></div><div className="child-education-actions"><Button onClick={()=>void updateStatus(entry,'completed')} disabled={busy||entry.status==='completed'}>Tamamla</Button><Button tone="danger" onClick={()=>void remove(entry)} disabled={busy}>Sil</Button></div></div>)}</div>}
        </section>
      </div>
    </>}
  </Surface>;
}
