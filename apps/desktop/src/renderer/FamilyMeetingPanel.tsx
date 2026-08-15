import { useEffect, useMemo, useRef, useState } from 'react';
import { AsyncStatePanel } from './form-ux';
import { Button, EmptyState, StatusMessage } from './ui';

type Bridge = NonNullable<Window['pardus']>;
type Center = Awaited<ReturnType<Bridge['getFamilyMeetingCenter']>>;
type Meeting = Center['meetings'][number];
type Minutes = Awaited<ReturnType<Bridge['getFamilyMeetingMinutes']>>;
type Role = Meeting['participants'][number]['roles'][number];
type Attendance = Meeting['participants'][number]['attendance'];
type TaskState = Meeting['tasks'][number]['state'];

export interface FamilyMeetingPersonOption {
  readonly id: string;
  readonly displayName: string;
}

export interface FamilyMeetingPanelProps {
  readonly people: readonly FamilyMeetingPersonOption[];
}

interface PendingOperation {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestFingerprint: string;
}

const roleLabels:Readonly<Record<Role,string>>={host:'Ev sahibi',facilitator:'Kolaylaştırıcı',note_taker:'Not tutucu',
  translator:'Çevirmen',caregiver:'Bakım veren',attendee:'Katılımcı'};
const attendanceLabels:Readonly<Record<Attendance,string>>={invited:'Davetli',accepted:'Katılacak',tentative:'Belirsiz',
  declined:'Katılmayacak',attended:'Katıldı',absent:'Katılmadı'};
const stateLabels:Readonly<Record<Meeting['state'],string>>={scheduled:'Planlandı',in_progress:'Sürüyor',completed:'Tamamlandı',cancelled:'İptal edildi'};
const taskStateLabels:Readonly<Record<TaskState,string>>={open:'Açık',in_progress:'Sürüyor',completed:'Tamamlandı',cancelled:'İptal edildi'};
const recurrenceLabels:Readonly<Record<Meeting['recurrenceKind'],string>>={once:'Tek sefer',daily:'Günlük',weekly:'Haftalık',monthly:'Aylık'};

const newOperationId=():string=>`meeting-${globalThis.crypto.randomUUID()}`;
const errorText=(caught:unknown,fallback:string):string=>caught instanceof Error?caught.message:fallback;
const toLocal=(value:string):string=>value.slice(0,16);
const toIso=(value:string):string=>new Date(value).toISOString();
const initialDate=(hours:number):string=>{
  const date=new Date(Date.now()+hours*60*60*1000);date.setSeconds(0,0);return date.toISOString().slice(0,16);
};
const lines=(value:string):readonly string[]=>[...new Set(value.split('\n').map((item)=>item.normalize('NFKC').trim()).filter(Boolean))];
const commaIds=(value:string):readonly string[]=>[...new Set(value.split(',').map((item)=>item.trim()).filter(Boolean))];
const fingerprint=async(value:unknown):Promise<string>=>{
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  bytes.fill(0);
  return [...new Uint8Array(digest)].map((item)=>item.toString(16).padStart(2,'0')).join('');
};

export function FamilyMeetingPanel({people}:FamilyMeetingPanelProps){
  const [center,setCenter]=useState<Center>();
  const [selectedId,setSelectedId]=useState('');
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [operationError,setOperationError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState('');
  const [minutes,setMinutes]=useState<Minutes>();
  const pending=useRef(new Map<string,PendingOperation>());

  const [createTitle,setCreateTitle]=useState('Haftalık aile toplantısı');
  const [createRecurrence,setCreateRecurrence]=useState<Meeting['recurrenceKind']>('weekly');
  const [createStart,setCreateStart]=useState(()=>initialDate(24));
  const [createEnd,setCreateEnd]=useState(()=>initialDate(25));
  const [createParticipants,setCreateParticipants]=useState<readonly string[]>([]);

  const [planTitle,setPlanTitle]=useState('');
  const [planRecurrence,setPlanRecurrence]=useState<Meeting['recurrenceKind']>('once');
  const [planInterval,setPlanInterval]=useState(1);
  const [planStart,setPlanStart]=useState('');
  const [planEnd,setPlanEnd]=useState('');
  const [planReminder,setPlanReminder]=useState(30);

  const [participantId,setParticipantId]=useState('');
  const [participantRole,setParticipantRole]=useState<Role>('attendee');
  const [participantAttendance,setParticipantAttendance]=useState<Attendance>('accepted');
  const [agendaTitle,setAgendaTitle]=useState('');
  const [agendaNote,setAgendaNote]=useState('');
  const [agendaCarry,setAgendaCarry]=useState(false);
  const [preReadType,setPreReadType]=useState<'archive_item'|'communication_message'|'memory_studio_record'>('archive_item');
  const [preReadId,setPreReadId]=useState('');
  const [pollQuestion,setPollQuestion]=useState('');
  const [pollOptions,setPollOptions]=useState('');
  const [decisionStatement,setDecisionStatement]=useState('');
  const [decisionResponsible,setDecisionResponsible]=useState('');
  const [taskTitle,setTaskTitle]=useState('');
  const [taskResponsible,setTaskResponsible]=useState('');
  const [taskDue,setTaskDue]=useState(()=>initialDate(48));
  const [taskState,setTaskState]=useState<TaskState>('open');
  const [taskCarry,setTaskCarry]=useState(false);
  const [collaborationKind,setCollaborationKind]=useState<'whiteboard'|'photo_album'|'document_annotation'>('whiteboard');
  const [collaborationResourceId,setCollaborationResourceId]=useState('');
  const [collaborationAnnotation,setCollaborationAnnotation]=useState('');
  const [recordingRequestId,setRecordingRequestId]=useState('');
  const [minutesSummary,setMinutesSummary]=useState('');
  const [minutesDecisions,setMinutesDecisions]=useState('');
  const [minutesTasks,setMinutesTasks]=useState('');
  const [minutesSegments,setMinutesSegments]=useState('');
  const [humanApproval,setHumanApproval]=useState(false);

  const refresh=async(showLoading=true):Promise<void>=>{
    const bridge=window.pardus;if(!bridge){setLoadError('Aile toplantısı masaüstü köprüsü kullanılamıyor.');setLoading(false);return;}
    if(showLoading)setLoading(true);setLoadError('');
    try{const next=await bridge.getFamilyMeetingCenter();setCenter(next);setSelectedId((current)=>
      current&&next.meetings.some((meeting)=>meeting.id===current)?current:next.meetings[0]?.id??'');}
    catch(caught){setLoadError(errorText(caught,'Aile toplantıları yüklenemedi.'));}
    finally{if(showLoading)setLoading(false);}
  };
  useEffect(()=>{void refresh();},[]);
  const selected=useMemo(()=>center?.meetings.find((meeting)=>meeting.id===selectedId),[center,selectedId]);
  useEffect(()=>{
    if(!selected)return;
    setPlanTitle(selected.title);setPlanRecurrence(selected.recurrenceKind);setPlanInterval(selected.recurrenceInterval);
    setPlanStart(toLocal(selected.startsAt));setPlanEnd(toLocal(selected.endsAt));setPlanReminder(selected.reminderMinutes);
    setParticipantId((current)=>current||selected.participants[0]?.personId||people[0]?.id||'');
    setDecisionResponsible((current)=>current||selected.participants[0]?.personId||'');
    setTaskResponsible((current)=>current||selected.participants[0]?.personId||'');
    setMinutes(undefined);setHumanApproval(false);
  },[selected?.id,selected?.revision]);

  const mutate=async(key:string,expectedRevision:number,payload:unknown,run:(operation:{clientOperationId:string;expectedRevision:number})=>Promise<unknown>,success:string)=>{
    if(busy)return;
    const requestFingerprint=await fingerprint(payload);
    const existing=pending.current.get(key);
    const operation=existing&&existing.expectedRevision===expectedRevision&&existing.requestFingerprint===requestFingerprint
      ?existing:{clientOperationId:newOperationId(),expectedRevision,requestFingerprint};
    pending.current.set(key,operation);setBusy(key);setOperationError('');setNotice('');let committed=false;
    try{await run(operation);pending.current.delete(key);committed=true;setNotice(success);}
    catch(caught){setOperationError(`${errorText(caught,'Toplantı işlemi tamamlanamadı.')} Aynı işlem kimliği ve özgün revizyonla yeniden deneyebilirsiniz.`);}
    finally{setBusy('');}
    if(committed)await refresh(false);
  };

  const create=async()=>{const bridge=window.pardus;if(!bridge)return;const payload={title:createTitle,recurrenceKind:createRecurrence,
    recurrenceInterval:1,startsAt:toIso(createStart),endsAt:toIso(createEnd),reminderMinutes:30,participantPersonIds:createParticipants};
    await mutate('create',0,payload,(operation)=>bridge.createFamilyMeeting({clientOperationId:operation.clientOperationId,
      expectedRevision:0,...payload}),'Toplantı planı oluşturuldu.');};
  const updatePlan=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const payload={meetingId:selected.id,title:planTitle,
    recurrenceKind:planRecurrence,recurrenceInterval:planInterval,startsAt:toIso(planStart),endsAt:toIso(planEnd),reminderMinutes:planReminder};
    await mutate(`plan:${selected.id}`,selected.revision,payload,(operation)=>bridge.updateFamilyMeetingPlan({...operation,...payload}),'Toplantı planı güncellendi.');};
  const setState=async(state:'in_progress'|'completed'|'cancelled')=>{const bridge=window.pardus;if(!bridge||!selected)return;
    const payload={meetingId:selected.id,state,reason:state==='in_progress'?'Toplantı kullanıcı tarafından başlatıldı.':state==='completed'?'Toplantı kullanıcı tarafından tamamlandı.':'Toplantı kullanıcı tarafından iptal edildi.'};
    await mutate(`state:${selected.id}:${state}`,selected.revision,payload,(operation)=>bridge.setFamilyMeetingState({...operation,...payload}),
      state==='in_progress'?'Toplantı başlatıldı.':state==='completed'?'Toplantı tamamlandı.':'Toplantı iptal edildi.');};
  const saveParticipant=async()=>{const bridge=window.pardus;if(!bridge||!selected||!participantId)return;
    const roles:readonly Role[]=participantRole==='attendee'?['attendee']:[participantRole,'attendee'];
    const payload={meetingId:selected.id,participantPersonId:participantId,roles,attendance:participantAttendance,reminderEnabled:true};
    await mutate(`participant:${selected.id}:${participantId}`,selected.revision,payload,(operation)=>bridge.upsertFamilyMeetingParticipant({...operation,...payload}),'Katılımcı rolü ve devam durumu kaydedildi.');};
  const saveAgenda=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const preRead=preReadId.trim()
    ?[{resourceType:preReadType,resourceId:preReadId.trim()}]:[];const payload={meetingId:selected.id,title:agendaTitle,
      ...(agendaNote.trim()?{note:agendaNote.trim()}:{}),order:selected.agenda.length+1,preRead,carryForwardToNextMeeting:agendaCarry};
    await mutate(`agenda:${selected.id}`,selected.revision,payload,(operation)=>bridge.upsertFamilyMeetingAgendaItem({...operation,...payload}),
      'Gündem maddesi kaydedildi.');setAgendaTitle('');setAgendaNote('');setPreReadId('');};
  const createPoll=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const options=commaIds(pollOptions);
    const payload={meetingId:selected.id,question:pollQuestion,options};await mutate(`poll:${selected.id}`,selected.revision,payload,
      (operation)=>bridge.createFamilyMeetingPoll({...operation,...payload}),'Anket açıldı.');setPollQuestion('');setPollOptions('');};
  const castVote=async(pollId:string,optionId?:string)=>{const bridge=window.pardus;if(!bridge||!selected)return;
    const opinionNote=globalThis.prompt('İsteğe bağlı görüş notu:','')?.trim();const payload={meetingId:selected.id,pollId,
      ...(optionId?{optionId}:{}),abstain:optionId===undefined,...(opinionNote?{opinionNote}:{})};
    await mutate(`vote:${selected.id}:${pollId}`,selected.revision,payload,(operation)=>bridge.castFamilyMeetingVote({...operation,...payload}),
      optionId?'Oy kaydedildi.':'Çekimser oy kaydedildi.');};
  const recordDecision=async()=>{const bridge=window.pardus;if(!bridge||!selected||!decisionResponsible)return;
    const payload={meetingId:selected.id,statement:decisionStatement,responsiblePersonIds:[decisionResponsible]};
    await mutate(`decision:${selected.id}`,selected.revision,payload,(operation)=>bridge.recordFamilyMeetingDecision({...operation,...payload}),
      'Karar append-only deftere kaydedildi.');setDecisionStatement('');};
  const saveTask=async()=>{const bridge=window.pardus;if(!bridge||!selected||!taskResponsible)return;const payload={meetingId:selected.id,
    title:taskTitle,responsiblePersonId:taskResponsible,dueAt:toIso(taskDue),state:taskState,carryForwardToNextMeeting:taskCarry};
    await mutate(`task:${selected.id}`,selected.revision,payload,(operation)=>bridge.upsertFamilyMeetingTask({...operation,...payload}),
      'Toplantı görevi kaydedildi.');setTaskTitle('');};
  const addCollaboration=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;
    const resourceType:'album'|'archive_item'|'whiteboard'=collaborationKind==='photo_album'?'album':collaborationKind==='document_annotation'?'archive_item':'whiteboard';
    const payload={meetingId:selected.id,kind:collaborationKind,resourceType,resourceId:collaborationResourceId.trim(),
      ...(collaborationAnnotation.trim()?{annotation:collaborationAnnotation.trim()}: {})};
    await mutate(`collaboration:${selected.id}`,selected.revision,payload,(operation)=>bridge.addFamilyMeetingCollaboration({...operation,...payload}),
      'Ortak çalışma referansı eklendi.');setCollaborationResourceId('');setCollaborationAnnotation('');};
  const prepareAi=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const payload={meetingId:selected.id,
    recordingRequestId:recordingRequestId.trim()};await mutate(`ai:${selected.id}`,selected.revision,payload,
      (operation)=>bridge.prepareFamilyMeetingAiMinutes({...operation,...payload}),'Rızalı transkript kanıtı işlendi; sağlayıcı sonucu yenilendi.');};
  const finalize=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const payload={meetingId:selected.id,
    summary:minutesSummary,decisions:lines(minutesDecisions),tasks:lines(minutesTasks),
    participantAccessPersonIds:selected.participants.filter((item)=>item.attendance!=='declined').map((item)=>item.personId),
    selectedRecordingSegmentIds:commaIds(minutesSegments),explicitHumanApproval:true as const,
    machineGeneratedSource:selected.minutes.aiSuggestionGenerated};
    await mutate(`minutes:${selected.id}`,selected.revision,payload,(operation)=>bridge.finalizeFamilyMeetingMinutes({...operation,...payload}),
      'İnsan onaylı tutanak ayrı yerel kasada şifrelenerek mühürlendi.');setHumanApproval(false);setMinutesSummary('');};
  const readMinutes=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;setBusy(`read:${selected.id}`);setOperationError('');
    try{setMinutes(await bridge.getFamilyMeetingMinutes({meetingId:selected.id}));}catch(caught){setOperationError(errorText(caught,'Tutanak açılamadı.'));}
    finally{setBusy('');}};

  if(loading&&!center)return <AsyncStatePanel state="loading" title="Aile toplantıları yükleniyor" message="Planlar, kararlar ve görevler okunuyor."/>;
  if(loadError&&!center)return <AsyncStatePanel state="error" title="Aile toplantıları yüklenemedi" message={loadError} onRetry={async()=>refresh()}/>;
  if(!center)return <AsyncStatePanel state="empty" title="Aile toplantıları kullanılamıyor" message="Masaüstü yetki sınırı hazır değil."/>;

  return <section className="family-meeting panel" aria-labelledby="family-meeting-title" aria-busy={Boolean(busy)}>
    <div className="panel-heading"><div><span className="eyebrow">34-F · Karar ve tutanak merkezi</span><h2 id="family-meeting-title">Aile toplantıları</h2>
      <p>Plan, gündem, katılım, oy, karar, görev ve insan onaylı tutanak tek yerel yetki sınırında yönetilir.</p></div>
      <Button onClick={()=>void refresh(false)} disabled={Boolean(busy)}>Yenile</Button></div>
    <div className="family-meeting-truth" role="note"><strong>Tutanak yalnız katılımcılara açık ayrı bir yerel kasada şifrelenir.</strong>
      <span>AI önerisi ancak tüm açık kayıt rızaları doğrulanırsa hazırlanabilir; üretim AI sağlayıcısı yapılandırılmadığından varsayılan yol fail-closed kalır.</span>
      <span>Takvim daveti, harici hatırlatma, uzaktan ortak çalışma, ağ veya bulut aktarımı yapılmaz. Ekrandaki çevrimdışı durum yalnız sunum bilgisidir.</span></div>
    {loadError&&<StatusMessage tone="warning">İşlem kaydedilmiş olabilir ancak görünüm yenilenemedi: {loadError}</StatusMessage>}
    {operationError&&<StatusMessage tone="warning">{operationError}</StatusMessage>}{notice&&<StatusMessage tone="success">{notice}</StatusMessage>}

    <form className="family-meeting-grid" onSubmit={(event)=>{event.preventDefault();void create();}}><h3>Yeni toplantı</h3>
      <label>Başlık<input value={createTitle} minLength={2} maxLength={200} onChange={(event)=>setCreateTitle(event.target.value)}/></label>
      <label>Tekrar<select value={createRecurrence} onChange={(event)=>setCreateRecurrence(event.target.value as Meeting['recurrenceKind'])}>{Object.entries(recurrenceLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      <label>Başlangıç<input type="datetime-local" value={createStart} onChange={(event)=>setCreateStart(event.target.value)}/></label>
      <label>Bitiş<input type="datetime-local" value={createEnd} onChange={(event)=>setCreateEnd(event.target.value)}/></label>
      <fieldset className="span-2"><legend>Davet edilecek kişiler</legend>{people.map((person)=><label key={person.id}><input type="checkbox" checked={createParticipants.includes(person.id)} onChange={(event)=>setCreateParticipants((current)=>event.target.checked?[...current,person.id]:current.filter((id)=>id!==person.id))}/>{person.displayName}</label>)}</fieldset>
      <Button type="submit" tone="primary" disabled={Boolean(busy)||createTitle.trim().length<2||!createStart||!createEnd}>Toplantı oluştur</Button>
    </form>

    {center.meetings.length===0?<EmptyState title="Toplantı yok" body="İlk tek seferlik veya tekrarlanan aile toplantısını oluşturun."/>:<>
      <label className="family-meeting-selector">Toplantı<select value={selectedId} onChange={(event)=>setSelectedId(event.target.value)}>{center.meetings.map((meeting)=><option key={meeting.id} value={meeting.id}>{meeting.title} · {stateLabels[meeting.state]}</option>)}</select></label>
      {selected&&<div className="family-meeting-workspace">
        <article><header><div><strong>{selected.title}</strong><span>{recurrenceLabels[selected.recurrenceKind]} · sürüm {selected.revision}</span></div><b>{stateLabels[selected.state]}</b></header>
          <div className="family-meeting-actions"><Button disabled={Boolean(busy)||selected.state!=='scheduled'} onClick={()=>void setState('in_progress')}>Toplantıyı başlat</Button>
            <Button disabled={Boolean(busy)||selected.state!=='in_progress'} onClick={()=>void setState('completed')}>Toplantıyı tamamla</Button>
            <Button disabled={Boolean(busy)||selected.state==='completed'||selected.state==='cancelled'} onClick={()=>void setState('cancelled')}>İptal et</Button></div></article>

        <form className="family-meeting-grid" onSubmit={(event)=>{event.preventDefault();void updatePlan();}}><h3>Plan ve hatırlatma</h3>
          <label>Başlık<input value={planTitle} onChange={(event)=>setPlanTitle(event.target.value)}/></label><label>Tekrar<select value={planRecurrence} onChange={(event)=>setPlanRecurrence(event.target.value as Meeting['recurrenceKind'])}>{Object.entries(recurrenceLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          <label>Aralık<input type="number" min={1} max={52} value={planInterval} onChange={(event)=>setPlanInterval(Number(event.target.value))}/></label><label>Hatırlatma (dk)<input type="number" min={0} max={10080} value={planReminder} onChange={(event)=>setPlanReminder(Number(event.target.value))}/></label>
          <label>Başlangıç<input type="datetime-local" value={planStart} onChange={(event)=>setPlanStart(event.target.value)}/></label><label>Bitiş<input type="datetime-local" value={planEnd} onChange={(event)=>setPlanEnd(event.target.value)}/></label>
          <Button type="submit" disabled={Boolean(busy)||selected.state!=='scheduled'}>Planı güncelle</Button><small>Hatırlatma yalnız yerel metadata olarak planlanır; harici teslimat yapılmaz.</small></form>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void saveParticipant();}}><h3>Roller ve katılım</h3>
          <label>Kişi<select value={participantId} onChange={(event)=>setParticipantId(event.target.value)}>{people.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
          <label>Rol<select value={participantRole} onChange={(event)=>setParticipantRole(event.target.value as Role)}>{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>Katılım<select value={participantAttendance} onChange={(event)=>setParticipantAttendance(event.target.value as Attendance)}>{Object.entries(attendanceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <Button type="submit" disabled={Boolean(busy)||!participantId}>Katılımcıyı kaydet</Button></form>
          <section><h3>Katılımcılar</h3>{selected.participants.map((person)=><div className="family-meeting-row" key={person.personId}><strong>{people.find((item)=>item.id===person.personId)?.displayName??person.personId}</strong><span>{person.roles.map((role)=>roleLabels[role]).join(', ')} · {attendanceLabels[person.attendance]}</span></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void saveAgenda();}}><h3>Gündem ve ön okuma</h3>
          <label>Başlık<input value={agendaTitle} onChange={(event)=>setAgendaTitle(event.target.value)} maxLength={500}/></label><label>Not<textarea value={agendaNote} onChange={(event)=>setAgendaNote(event.target.value)} maxLength={4000}/></label>
          <label>Ön okuma türü<select value={preReadType} onChange={(event)=>setPreReadType(event.target.value as typeof preReadType)}><option value="archive_item">Arşiv belgesi</option><option value="communication_message">Mesaj</option><option value="memory_studio_record">Anı kaydı</option></select></label><label>Ön okuma kimliği<input value={preReadId} onChange={(event)=>setPreReadId(event.target.value)}/></label>
          <label><input type="checkbox" checked={agendaCarry} onChange={(event)=>setAgendaCarry(event.target.checked)}/>Sonraki toplantıya taşı</label><Button type="submit" disabled={Boolean(busy)||agendaTitle.trim().length<2}>Gündeme ekle</Button></form>
          <section><h3>Gündem</h3>{selected.agenda.length?selected.agenda.map((item)=><div className="family-meeting-row" key={item.id}><strong>{item.order}. {item.title}</strong><span>{item.note??'Not yok'} · {item.preRead.length} ön okuma{item.carryForwardToNextMeeting?' · taşınacak':''}</span></div>):<p>Gündem maddesi yok.</p>}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void createPoll();}}><h3>Anket ve oy</h3><label>Soru<input value={pollQuestion} onChange={(event)=>setPollQuestion(event.target.value)} maxLength={1000}/></label><label>Seçenekler (virgülle)<input value={pollOptions} onChange={(event)=>setPollOptions(event.target.value)} placeholder="Cumartesi, Pazar"/></label><Button type="submit" disabled={Boolean(busy)||pollQuestion.trim().length<2||commaIds(pollOptions).length<2}>Anket aç</Button></form>
          <section><h3>Açık anketler</h3>{selected.polls.map((poll)=><div className="family-meeting-poll" key={poll.id}><strong>{poll.question}</strong><div>{poll.options.map((option)=><Button key={option.id} disabled={Boolean(busy)||poll.state!=='open'} onClick={()=>void castVote(poll.id,option.id)}>{option.label}</Button>)}<Button disabled={Boolean(busy)||poll.state!=='open'} onClick={()=>void castVote(poll.id)}>Çekimser</Button></div><small>{poll.votes.length} oy · görüş notları karar öncesi görünür</small></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void recordDecision();}}><h3>Append-only karar</h3><label>Karar<textarea value={decisionStatement} onChange={(event)=>setDecisionStatement(event.target.value)} maxLength={4000}/></label><label>Sorumlu<select value={decisionResponsible} onChange={(event)=>setDecisionResponsible(event.target.value)}>{selected.participants.map((person)=><option key={person.personId} value={person.personId}>{people.find((item)=>item.id===person.personId)?.displayName??person.personId}</option>)}</select></label><Button type="submit" disabled={Boolean(busy)||decisionStatement.trim().length<2||!decisionResponsible}>Kararı kaydet</Button></form>
          <section><h3>Karar defteri</h3>{selected.decisions.map((decision)=><div className="family-meeting-row" key={decision.id}><strong>{decision.statement}</strong><span>{decision.responsiblePersonIds.length} sorumlu · {new Date(decision.recordedAt).toLocaleString('tr-TR')}</span></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void saveTask();}}><h3>Görev ve takip</h3><label>Görev<input value={taskTitle} onChange={(event)=>setTaskTitle(event.target.value)} maxLength={1000}/></label><label>Sorumlu<select value={taskResponsible} onChange={(event)=>setTaskResponsible(event.target.value)}>{selected.participants.map((person)=><option key={person.personId} value={person.personId}>{people.find((item)=>item.id===person.personId)?.displayName??person.personId}</option>)}</select></label><label>Vade<input type="datetime-local" value={taskDue} onChange={(event)=>setTaskDue(event.target.value)}/></label><label>Durum<select value={taskState} onChange={(event)=>setTaskState(event.target.value as TaskState)}>{Object.entries(taskStateLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><input type="checkbox" checked={taskCarry} onChange={(event)=>setTaskCarry(event.target.checked)}/>Sonraki toplantıya taşı</label><Button type="submit" disabled={Boolean(busy)||taskTitle.trim().length<2||!taskResponsible}>Görevi kaydet</Button></form>
          <section><h3>Takip listesi</h3>{selected.tasks.map((task)=><div className="family-meeting-row" key={task.id}><strong>{task.title}</strong><span>{taskStateLabels[task.state]} · {new Date(task.dueAt).toLocaleString('tr-TR')}{task.carryForwardToNextMeeting?' · taşınacak':''}</span></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void addCollaboration();}}><h3>Ortak çalışma referansı</h3><label>Tür<select value={collaborationKind} onChange={(event)=>setCollaborationKind(event.target.value as typeof collaborationKind)}><option value="whiteboard">Beyaz tahta</option><option value="photo_album">Fotoğraf albümü</option><option value="document_annotation">Belge açıklaması</option></select></label><label>Kaynak kimliği<input value={collaborationResourceId} onChange={(event)=>setCollaborationResourceId(event.target.value)}/></label><label>Açıklama<textarea value={collaborationAnnotation} onChange={(event)=>setCollaborationAnnotation(event.target.value)} maxLength={4000}/></label><Button type="submit" disabled={Boolean(busy)||collaborationResourceId.trim().length<2}>Referans ekle</Button></form>
          <section><h3>Paylaşılan kaynaklar</h3>{selected.collaboration.map((item)=><div className="family-meeting-row" key={item.id}><strong>{item.kind} · {item.resourceId}</strong><span>{item.annotation??'Açıklama yok'} · uzaktan aktarım yapılmadı</span></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void prepareAi();}}><h3>Rızalı AI tutanak önerisi</h3><label>Kayıt rıza planı kimliği<input value={recordingRequestId} onChange={(event)=>setRecordingRequestId(event.target.value)}/></label><Button type="submit" disabled={Boolean(busy)||recordingRequestId.trim().length<2}>Rızayı doğrula ve öneri iste</Button><small>Üretim sağlayıcısı kapalıdır; işlem rıza kanıtı yoksa veya sağlayıcı yapılandırılmadıysa fail-closed sonuç verir. Transkript renderer’a alınmaz.</small></form>
          <section><h3>Tutanak durumu</h3><div className="family-meeting-row"><strong>{selected.minutes.state}</strong><span>Rıza {selected.minutes.transcriptConsentVerified?'doğrulandı':'doğrulanmadı'} · AI önerisi {selected.minutes.aiSuggestionGenerated?'var':'yok'} · insan onayı {selected.minutes.humanApprovalRecorded?'var':'yok'}</span></div></section></div>

        <form className="family-meeting-minutes" onSubmit={(event)=>{event.preventDefault();void finalize();}}><h3>İnsan onaylı şifreli tutanak</h3><label>Özet<textarea value={minutesSummary} onChange={(event)=>setMinutesSummary(event.target.value)} maxLength={32768} rows={5}/></label><label>Kararlar (satır başına bir karar)<textarea value={minutesDecisions} onChange={(event)=>setMinutesDecisions(event.target.value)} maxLength={32768}/></label><label>Görevler (satır başına bir görev)<textarea value={minutesTasks} onChange={(event)=>setMinutesTasks(event.target.value)} maxLength={32768}/></label><label>Seçili kayıt bölümü kimlikleri (virgülle)<input value={minutesSegments} onChange={(event)=>setMinutesSegments(event.target.value)}/></label><label><input type="checkbox" checked={humanApproval} onChange={(event)=>setHumanApproval(event.target.checked)}/>Tutanağı okudum; insan onayıyla mühürlemeyi açıkça kabul ediyorum.</label><div className="family-meeting-actions"><Button type="submit" tone="primary" disabled={Boolean(busy)||selected.state!=='completed'||minutesSummary.trim().length<2||!humanApproval||selected.minutes.encryptedPackageAvailable}>Şifrele ve mühürle</Button><Button type="button" disabled={Boolean(busy)||!selected.minutes.encryptedPackageAvailable} onClick={()=>void readMinutes()}>Yetkili tutanağı aç</Button></div></form>
        {minutes&&<article className="family-meeting-open-minutes"><header><strong>Yerel şifreli tutanak · sürüm {minutes.minutesRevision}</strong><span>İnsan onayı: var · ağ: yok · bulut: yok</span></header><p>{minutes.summary}</p><h4>Kararlar</h4><ul>{minutes.decisions.map((item)=><li key={item}>{item}</li>)}</ul><h4>Görevler</h4><ul>{minutes.tasks.map((item)=><li key={item}>{item}</li>)}</ul></article>}
      </div>}
    </>}
  </section>;
}
