import { useEffect, useMemo, useRef, useState } from 'react';
import { AsyncStatePanel } from './form-ux';
import { Button, EmptyState, StatusMessage } from './ui';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

type Bridge = NonNullable<Window['pardus']>;
type Center = Awaited<ReturnType<Bridge['getFamilyMeetingCenter']>>;
type Meeting = Center['meetings'][number];
type Minutes = Awaited<ReturnType<Bridge['getFamilyMeetingMinutes']>>;
type Role = Meeting['participants'][number]['roles'][number];
type Attendance = Meeting['participants'][number]['attendance'];
type TaskState = Meeting['tasks'][number]['state'];
type CollaborationKind = Meeting['collaboration'][number]['kind'];
type MinutesState = Meeting['minutes']['state'];

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

const newOperationId=():string=>`meeting-${globalThis.crypto.randomUUID()}`;
const errorText=(caught:unknown,fallback:string):string=>toUserFacingErrorMessage(caught,fallback);
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
  const { language, locale }=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const roleLabels:Readonly<Record<Role,string>>={host:text('Ev sahibi','Host'),facilitator:text('Kolaylaştırıcı','Facilitator'),note_taker:text('Not tutucu','Note taker'),
    translator:text('Çevirmen','Translator'),caregiver:text('Bakım veren','Caregiver'),attendee:text('Katılımcı','Attendee')};
  const attendanceLabels:Readonly<Record<Attendance,string>>={invited:text('Davetli','Invited'),accepted:text('Katılacak','Accepted'),tentative:text('Belirsiz','Tentative'),
    declined:text('Katılmayacak','Declined'),attended:text('Katıldı','Attended'),absent:text('Katılmadı','Absent')};
  const stateLabels:Readonly<Record<Meeting['state'],string>>={scheduled:text('Planlandı','Scheduled'),in_progress:text('Sürüyor','In progress'),completed:text('Tamamlandı','Completed'),cancelled:text('İptal edildi','Canceled')};
  const taskStateLabels:Readonly<Record<TaskState,string>>={open:text('Açık','Open'),in_progress:text('Sürüyor','In progress'),completed:text('Tamamlandı','Completed'),cancelled:text('İptal edildi','Canceled')};
  const collaborationKindLabels:Readonly<Record<CollaborationKind,string>>={whiteboard:text('Beyaz tahta','Whiteboard'),photo_album:text('Fotoğraf albümü','Photo album'),document_annotation:text('Belge açıklaması','Document annotation')};
  const minutesStateLabels:Readonly<Record<MinutesState,string>>={
    not_prepared:text('Hazırlanmadı','Not prepared'),provider_unavailable:text('Sağlayıcı kullanılamıyor','Provider unavailable'),
    pending_human_review:text('İnsan incelemesi bekliyor','Awaiting human review'),dismissed:text('Reddedildi','Dismissed'),sealed_local:text('Yerel olarak mühürlendi','Sealed locally')
  };
  const recurrenceLabels:Readonly<Record<Meeting['recurrenceKind'],string>>={once:text('Tek sefer','Once'),daily:text('Günlük','Daily'),weekly:text('Haftalık','Weekly'),monthly:text('Aylık','Monthly')};
  const [center,setCenter]=useState<Center>();
  const [selectedId,setSelectedId]=useState('');
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [operationError,setOperationError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState('');
  const [minutes,setMinutes]=useState<Minutes>();
  const pending=useRef(new Map<string,PendingOperation>());

  const [createTitle,setCreateTitle]=useState(text('Haftalık aile toplantısı','Weekly family meeting'));
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
    const bridge=window.pardus;if(!bridge){setLoadError(text('Aile toplantısı masaüstü köprüsü kullanılamıyor.','The family meeting desktop bridge is unavailable.'));setLoading(false);return;}
    if(showLoading)setLoading(true);setLoadError('');
    try{const next=await bridge.getFamilyMeetingCenter();setCenter(next);setSelectedId((current)=>
      current&&next.meetings.some((meeting)=>meeting.id===current)?current:next.meetings[0]?.id??'');}
    catch(caught){setLoadError(errorText(caught,text('Aile toplantıları yüklenemedi.','Family meetings could not be loaded.')));}
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
    pending.current.set(key,operation);setBusy(key);setOperationError('');setNotice('');
    try{await run({clientOperationId:operation.clientOperationId,expectedRevision:operation.expectedRevision});pending.current.delete(key);setNotice(success);await refresh(false);}
    catch(caught){setOperationError(`${errorText(caught,text('Toplantı işlemi tamamlanamadı.','The meeting operation could not be completed.'))} ${text('Aynı işlem kimliği ve özgün revizyonla yeniden deneyebilirsiniz.','You can retry with the same operation identifier and original revision.')}`);}
    finally{setBusy('');}
  };

  const create=async()=>{const bridge=window.pardus;if(!bridge)return;const payload={title:createTitle,recurrenceKind:createRecurrence,
    recurrenceInterval:1,startsAt:toIso(createStart),endsAt:toIso(createEnd),reminderMinutes:30,participantPersonIds:createParticipants};
    await mutate('create',0,payload,(operation)=>bridge.createFamilyMeeting({clientOperationId:operation.clientOperationId,
       expectedRevision:0,...payload}),text('Toplantı planı oluşturuldu.','The meeting plan was created.'));};
  const updatePlan=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const payload={meetingId:selected.id,title:planTitle,
    recurrenceKind:planRecurrence,recurrenceInterval:planInterval,startsAt:toIso(planStart),endsAt:toIso(planEnd),reminderMinutes:planReminder};
    await mutate(`plan:${selected.id}`,selected.revision,payload,(operation)=>bridge.updateFamilyMeetingPlan({...operation,...payload}),text('Toplantı planı güncellendi.','The meeting plan was updated.'));};
  const setState=async(state:'in_progress'|'completed'|'cancelled')=>{const bridge=window.pardus;if(!bridge||!selected)return;
    const payload={meetingId:selected.id,state,reason:state==='in_progress'?text('Toplantı kullanıcı tarafından başlatıldı.','The meeting was started by the user.'):state==='completed'?text('Toplantı kullanıcı tarafından tamamlandı.','The meeting was completed by the user.'):text('Toplantı kullanıcı tarafından iptal edildi.','The meeting was canceled by the user.')};
    await mutate(`state:${selected.id}:${state}`,selected.revision,payload,(operation)=>bridge.setFamilyMeetingState({...operation,...payload}),
      state==='in_progress'?text('Toplantı başlatıldı.','The meeting was started.'):state==='completed'?text('Toplantı tamamlandı.','The meeting was completed.'):text('Toplantı iptal edildi.','The meeting was canceled.'));};
  const saveParticipant=async()=>{const bridge=window.pardus;if(!bridge||!selected||!participantId)return;
    const roles:readonly Role[]=participantRole==='attendee'?['attendee']:[participantRole,'attendee'];
    const payload={meetingId:selected.id,participantPersonId:participantId,roles,attendance:participantAttendance,reminderEnabled:true};
    await mutate(`participant:${selected.id}:${participantId}`,selected.revision,payload,(operation)=>bridge.upsertFamilyMeetingParticipant({...operation,...payload}),text('Katılımcı rolü ve devam durumu kaydedildi.','The participant role and attendance state were saved.'));};
  const saveAgenda=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const preRead=preReadId.trim()
    ?[{resourceType:preReadType,resourceId:preReadId.trim()}]:[];const payload={meetingId:selected.id,title:agendaTitle,
      ...(agendaNote.trim()?{note:agendaNote.trim()}:{}),order:selected.agenda.length+1,preRead,carryForwardToNextMeeting:agendaCarry};
    await mutate(`agenda:${selected.id}`,selected.revision,payload,(operation)=>bridge.upsertFamilyMeetingAgendaItem({...operation,...payload}),
      text('Gündem maddesi kaydedildi.','The agenda item was saved.'));setAgendaTitle('');setAgendaNote('');setPreReadId('');};
  const createPoll=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const options=commaIds(pollOptions);
    const payload={meetingId:selected.id,question:pollQuestion,options};await mutate(`poll:${selected.id}`,selected.revision,payload,
      (operation)=>bridge.createFamilyMeetingPoll({...operation,...payload}),text('Anket açıldı.','The poll was opened.'));setPollQuestion('');setPollOptions('');};
  const castVote=async(pollId:string,optionId?:string)=>{const bridge=window.pardus;if(!bridge||!selected)return;
    const opinionNote=globalThis.prompt(text('İsteğe bağlı görüş notu:','Optional opinion note:'),'')?.trim();const payload={meetingId:selected.id,pollId,
      ...(optionId?{optionId}:{}),abstain:optionId===undefined,...(opinionNote?{opinionNote}:{})};
    await mutate(`vote:${selected.id}:${pollId}`,selected.revision,payload,(operation)=>bridge.castFamilyMeetingVote({...operation,...payload}),
      optionId?text('Oy kaydedildi.','The vote was saved.'):text('Çekimser oy kaydedildi.','The abstention was saved.'));};
  const recordDecision=async()=>{const bridge=window.pardus;if(!bridge||!selected||!decisionResponsible)return;
    const payload={meetingId:selected.id,statement:decisionStatement,responsiblePersonIds:[decisionResponsible]};
    await mutate(`decision:${selected.id}`,selected.revision,payload,(operation)=>bridge.recordFamilyMeetingDecision({...operation,...payload}),
      text('Karar append-only deftere kaydedildi.','The decision was saved to the append-only ledger.'));setDecisionStatement('');};
  const saveTask=async()=>{const bridge=window.pardus;if(!bridge||!selected||!taskResponsible)return;const payload={meetingId:selected.id,
    title:taskTitle,responsiblePersonId:taskResponsible,dueAt:toIso(taskDue),state:taskState,carryForwardToNextMeeting:taskCarry};
    await mutate(`task:${selected.id}`,selected.revision,payload,(operation)=>bridge.upsertFamilyMeetingTask({...operation,...payload}),
      text('Toplantı görevi kaydedildi.','The meeting task was saved.'));setTaskTitle('');};
  const addCollaboration=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;
    const resourceType:'album'|'archive_item'|'whiteboard'=collaborationKind==='photo_album'?'album':collaborationKind==='document_annotation'?'archive_item':'whiteboard';
    const payload={meetingId:selected.id,kind:collaborationKind,resourceType,resourceId:collaborationResourceId.trim(),
      ...(collaborationAnnotation.trim()?{annotation:collaborationAnnotation.trim()}: {})};
    await mutate(`collaboration:${selected.id}`,selected.revision,payload,(operation)=>bridge.addFamilyMeetingCollaboration({...operation,...payload}),
      text('Ortak çalışma referansı eklendi.','The collaboration reference was added.'));setCollaborationResourceId('');setCollaborationAnnotation('');};
  const prepareAi=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const payload={meetingId:selected.id,
    recordingRequestId:recordingRequestId.trim()};await mutate(`ai:${selected.id}`,selected.revision,payload,
      (operation)=>bridge.prepareFamilyMeetingAiMinutes({...operation,...payload}),text('Kayıt onayı doğrulandı; öneri durumu yenilendi.','The recording approval was verified and the suggestion status was refreshed.'));};
  const finalize=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;const payload={meetingId:selected.id,
    summary:minutesSummary,decisions:lines(minutesDecisions),tasks:lines(minutesTasks),
    participantAccessPersonIds:selected.participants.filter((item)=>item.attendance!=='declined').map((item)=>item.personId),
    selectedRecordingSegmentIds:commaIds(minutesSegments),explicitHumanApproval:true as const,
    machineGeneratedSource:selected.minutes.aiSuggestionGenerated};
    await mutate(`minutes:${selected.id}`,selected.revision,payload,(operation)=>bridge.finalizeFamilyMeetingMinutes({...operation,...payload}),
      text('İnsan onaylı tutanak ayrı yerel kasada şifrelenerek mühürlendi.','The human-approved minutes were encrypted and sealed in a separate local vault.'));setHumanApproval(false);setMinutesSummary('');};
  const readMinutes=async()=>{const bridge=window.pardus;if(!bridge||!selected)return;setBusy(`read:${selected.id}`);setOperationError('');
    try{setMinutes(await bridge.getFamilyMeetingMinutes({meetingId:selected.id}));}catch(caught){setOperationError(errorText(caught,text('Tutanak açılamadı.','The minutes could not be opened.')));}
    finally{setBusy('');}};

  if(loading&&!center)return <AsyncStatePanel state="loading" title={text('Aile toplantıları yükleniyor','Loading family meetings')} message={text('Planlar, kararlar ve görevler okunuyor.','Reading plans, decisions, and tasks.')}/>;
  if(loadError&&!center)return <AsyncStatePanel state="error" title={text('Aile toplantıları yüklenemedi','Family meetings could not be loaded')} message={loadError} onRetry={async()=>refresh()}/>;
  if(!center)return <AsyncStatePanel state="empty" title={text('Aile toplantıları kullanılamıyor','Family meetings are unavailable')} message={text('Masaüstü yetki sınırı hazır değil.','The desktop authorization boundary is not ready.')}/>;

  return <section className="family-meeting panel" aria-labelledby="family-meeting-title" aria-busy={Boolean(busy)}>
    <div className="panel-heading"><div><span className="eyebrow">{text('Karar ve tutanak merkezi','Decisions and minutes center')}</span><h2 id="family-meeting-title">{text('Aile toplantıları','Family meetings')}</h2>
      <p>{text('Plan, gündem, katılım, oy, karar, görev ve insan onaylı tutanak tek yerel yetki sınırında yönetilir.','Plans, agendas, attendance, votes, decisions, tasks, and human-approved minutes are managed within one local authorization boundary.')}</p></div>
      <Button onClick={()=>void refresh(false)} disabled={Boolean(busy)}>{text('Yenile','Refresh')}</Button></div>
    <div className="family-meeting-truth" role="note"><strong>{text('Tutanak yalnız katılımcılara açık ayrı bir yerel kasada şifrelenir.','Minutes are encrypted in a separate local vault available only to participants.')}</strong>
      <span>{text('Yapay zekâ önerisi yalnız tüm açık kayıt onayları doğrulanırsa hazırlanabilir; canlı hizmet yapılandırılmadığında özellik güvenli biçimde kapalı kalır.','An AI suggestion can be prepared only after every explicit recording approval is verified; the feature stays safely disabled when no live service is configured.')}</span>
      <span>{text('Takvim daveti, harici hatırlatma, uzaktan ortak çalışma, ağ veya bulut aktarımı yapılmaz. Ekrandaki çevrimdışı durum yalnız sunum bilgisidir.','Calendar invitations, external reminders, remote collaboration, and network or cloud transfers are not performed. The offline state shown on screen is presentation-only information.')}</span></div>
    {loadError&&<StatusMessage tone="warning">{text('İşlem kaydedilmiş olabilir ancak görünüm yenilenemedi:','The operation may have been saved, but the view could not be refreshed:')} {loadError}</StatusMessage>}
    {operationError&&<StatusMessage tone="warning">{operationError}</StatusMessage>}{notice&&<StatusMessage tone="success">{notice}</StatusMessage>}

    <form className="family-meeting-grid" onSubmit={(event)=>{event.preventDefault();void create();}}><h3>{text('Yeni toplantı','New meeting')}</h3>
      <label>{text('Başlık','Title')}<input value={createTitle} minLength={2} maxLength={200} onChange={(event)=>setCreateTitle(event.target.value)}/></label>
      <label>{text('Tekrar','Recurrence')}<select value={createRecurrence} onChange={(event)=>setCreateRecurrence(event.target.value as Meeting['recurrenceKind'])}>{Object.entries(recurrenceLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      <label>{text('Başlangıç','Start')}<input type="datetime-local" value={createStart} onChange={(event)=>setCreateStart(event.target.value)}/></label>
      <label>{text('Bitiş','End')}<input type="datetime-local" value={createEnd} onChange={(event)=>setCreateEnd(event.target.value)}/></label>
      <fieldset className="span-2"><legend>{text('Davet edilecek kişiler','People to invite')}</legend>{people.map((person)=><label key={person.id}><input type="checkbox" checked={createParticipants.includes(person.id)} onChange={(event)=>setCreateParticipants((current)=>event.target.checked?[...current,person.id]:current.filter((id)=>id!==person.id))}/>{person.displayName}</label>)}</fieldset>
      <Button type="submit" tone="primary" disabled={Boolean(busy)||createTitle.trim().length<2||!createStart||!createEnd}>{text('Toplantı oluştur','Create meeting')}</Button>
    </form>

    {center.meetings.length===0?<EmptyState title={text('Toplantı yok','No meetings')} body={text('İlk tek seferlik veya tekrarlanan aile toplantısını oluşturun.','Create the first one-time or recurring family meeting.')}/>:<>
      <label className="family-meeting-selector">{text('Toplantı','Meeting')}<select value={selectedId} onChange={(event)=>setSelectedId(event.target.value)}>{center.meetings.map((meeting)=><option key={meeting.id} value={meeting.id}>{meeting.title} · {stateLabels[meeting.state]}</option>)}</select></label>
      {selected&&<div className="family-meeting-workspace">
        <article><header><div><strong>{selected.title}</strong><span>{recurrenceLabels[selected.recurrenceKind]} · {text('sürüm','version')} {selected.revision}</span></div><b>{stateLabels[selected.state]}</b></header>
          <div className="family-meeting-actions"><Button disabled={Boolean(busy)||selected.state!=='scheduled'} onClick={()=>void setState('in_progress')}>{text('Toplantıyı başlat','Start meeting')}</Button>
            <Button disabled={Boolean(busy)||selected.state!=='in_progress'} onClick={()=>void setState('completed')}>{text('Toplantıyı tamamla','Complete meeting')}</Button>
            <Button disabled={Boolean(busy)||selected.state==='completed'||selected.state==='cancelled'} onClick={()=>void setState('cancelled')}>{text('İptal et','Cancel')}</Button></div></article>

        <form className="family-meeting-grid" onSubmit={(event)=>{event.preventDefault();void updatePlan();}}><h3>{text('Plan ve hatırlatma','Plan and reminder')}</h3>
          <label>{text('Başlık','Title')}<input value={planTitle} onChange={(event)=>setPlanTitle(event.target.value)}/></label><label>{text('Tekrar','Recurrence')}<select value={planRecurrence} onChange={(event)=>setPlanRecurrence(event.target.value as Meeting['recurrenceKind'])}>{Object.entries(recurrenceLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          <label>{text('Aralık','Interval')}<input type="number" min={1} max={52} value={planInterval} onChange={(event)=>setPlanInterval(Number(event.target.value))}/></label><label>{text('Hatırlatma (dk)','Reminder (min)')}<input type="number" min={0} max={10080} value={planReminder} onChange={(event)=>setPlanReminder(Number(event.target.value))}/></label>
          <label>{text('Başlangıç','Start')}<input type="datetime-local" value={planStart} onChange={(event)=>setPlanStart(event.target.value)}/></label><label>{text('Bitiş','End')}<input type="datetime-local" value={planEnd} onChange={(event)=>setPlanEnd(event.target.value)}/></label>
          <Button type="submit" disabled={Boolean(busy)||selected.state!=='scheduled'}>{text('Planı güncelle','Update plan')}</Button><small>{text('Hatırlatma yalnız bu bilgisayardaki toplantı kaydında planlanır; haricî teslimat yapılmaz.','The reminder is planned only in the meeting record on this computer; no external delivery is performed.')}</small></form>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void saveParticipant();}}><h3>{text('Roller ve katılım','Roles and attendance')}</h3>
          <label>{text('Kişi','Person')}<select value={participantId} onChange={(event)=>setParticipantId(event.target.value)}>{people.map((person)=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
          <label>{text('Rol','Role')}<select value={participantRole} onChange={(event)=>setParticipantRole(event.target.value as Role)}>{Object.entries(roleLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>{text('Katılım','Attendance')}<select value={participantAttendance} onChange={(event)=>setParticipantAttendance(event.target.value as Attendance)}>{Object.entries(attendanceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <Button type="submit" disabled={Boolean(busy)||!participantId||selected.state==='completed'||selected.state==='cancelled'}>{text('Katılımcıyı kaydet','Save participant')}</Button></form>
          <section><h3>{text('Katılımcılar','Participants')}</h3>{selected.participants.map((person)=><div className="family-meeting-row" key={person.personId}><strong>{people.find((item)=>item.id===person.personId)?.displayName??person.personId}</strong><span>{person.roles.map((role)=>roleLabels[role]).join(', ')} · {attendanceLabels[person.attendance]}</span></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void saveAgenda();}}><h3>{text('Gündem ve ön okuma','Agenda and pre-reading')}</h3>
          <label>{text('Başlık','Title')}<input value={agendaTitle} onChange={(event)=>setAgendaTitle(event.target.value)} maxLength={500}/></label><label>{text('Not','Note')}<textarea value={agendaNote} onChange={(event)=>setAgendaNote(event.target.value)} maxLength={4000}/></label>
          <label>{text('Ön okuma türü','Pre-reading type')}<select value={preReadType} onChange={(event)=>setPreReadType(event.target.value as typeof preReadType)}><option value="archive_item">{text('Arşiv belgesi','Archive document')}</option><option value="communication_message">{text('Mesaj','Message')}</option><option value="memory_studio_record">{text('Anı kaydı','Memory record')}</option></select></label><label>{text('Ön okuma kimliği','Pre-reading identifier')}<input value={preReadId} onChange={(event)=>setPreReadId(event.target.value)}/></label>
          <label><input type="checkbox" checked={agendaCarry} onChange={(event)=>setAgendaCarry(event.target.checked)}/>{text('Sonraki toplantıya taşı','Carry to next meeting')}</label><Button type="submit" disabled={Boolean(busy)||agendaTitle.trim().length<2}>{text('Gündeme ekle','Add to agenda')}</Button></form>
          <section><h3>{text('Gündem','Agenda')}</h3>{selected.agenda.length?selected.agenda.map((item)=><div className="family-meeting-row" key={item.id}><strong>{item.order}. {item.title}</strong><span>{item.note??text('Not yok','No note')} · {item.preRead.length} {text('ön okuma','pre-read')}{item.carryForwardToNextMeeting?text(' · taşınacak',' · will be carried'):''}</span></div>):<p>{text('Gündem maddesi yok.','No agenda items.')}</p>}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void createPoll();}}><h3>{text('Anket ve oy','Polls and voting')}</h3><label>{text('Soru','Question')}<input value={pollQuestion} onChange={(event)=>setPollQuestion(event.target.value)} maxLength={1000}/></label><label>{text('Seçenekler (virgülle)','Options (comma separated)')}<input value={pollOptions} onChange={(event)=>setPollOptions(event.target.value)} placeholder={text('Cumartesi, Pazar','Saturday, Sunday')}/></label><Button type="submit" disabled={Boolean(busy)||pollQuestion.trim().length<2||commaIds(pollOptions).length<2}>{text('Anket aç','Open poll')}</Button></form>
          <section><h3>{text('Açık anketler','Open polls')}</h3>{selected.polls.map((poll)=><div className="family-meeting-poll" key={poll.id}><strong>{poll.question}</strong><div>{poll.options.map((option)=><Button key={option.id} disabled={Boolean(busy)||poll.state!=='open'} onClick={()=>void castVote(poll.id,option.id)}>{option.label}</Button>)}<Button disabled={Boolean(busy)||poll.state!=='open'} onClick={()=>void castVote(poll.id)}>{text('Çekimser','Abstain')}</Button></div><small>{poll.votes.length} {text('oy · görüş notları karar öncesi görünür','votes · opinion notes are visible before the decision')}</small></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void recordDecision();}}><h3>{text('Append-only karar','Append-only decision')}</h3><label>{text('Karar','Decision')}<textarea value={decisionStatement} onChange={(event)=>setDecisionStatement(event.target.value)} maxLength={4000}/></label><label>{text('Sorumlu','Responsible person')}<select value={decisionResponsible} onChange={(event)=>setDecisionResponsible(event.target.value)}>{selected.participants.map((person)=><option key={person.personId} value={person.personId}>{people.find((item)=>item.id===person.personId)?.displayName??person.personId}</option>)}</select></label><Button type="submit" disabled={Boolean(busy)||decisionStatement.trim().length<2||!decisionResponsible}>{text('Kararı kaydet','Save decision')}</Button></form>
          <section><h3>{text('Karar defteri','Decision ledger')}</h3>{selected.decisions.map((decision)=><div className="family-meeting-row" key={decision.id}><strong>{decision.statement}</strong><span>{decision.responsiblePersonIds.length} {text('sorumlu','responsible')} · {new Date(decision.recordedAt).toLocaleString(locale)}</span></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void saveTask();}}><h3>{text('Görev ve takip','Tasks and tracking')}</h3><label>{text('Görev','Task')}<input value={taskTitle} onChange={(event)=>setTaskTitle(event.target.value)} maxLength={1000}/></label><label>{text('Sorumlu','Responsible person')}<select value={taskResponsible} onChange={(event)=>setTaskResponsible(event.target.value)}>{selected.participants.map((person)=><option key={person.personId} value={person.personId}>{people.find((item)=>item.id===person.personId)?.displayName??person.personId}</option>)}</select></label><label>{text('Vade','Due date')}<input type="datetime-local" value={taskDue} onChange={(event)=>setTaskDue(event.target.value)}/></label><label>{text('Durum','State')}<select value={taskState} onChange={(event)=>setTaskState(event.target.value as TaskState)}>{Object.entries(taskStateLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><input type="checkbox" checked={taskCarry} onChange={(event)=>setTaskCarry(event.target.checked)}/>{text('Sonraki toplantıya taşı','Carry to next meeting')}</label><Button type="submit" disabled={Boolean(busy)||taskTitle.trim().length<2||!taskResponsible}>{text('Görevi kaydet','Save task')}</Button></form>
          <section><h3>{text('Takip listesi','Tracking list')}</h3>{selected.tasks.map((task)=><div className="family-meeting-row" key={task.id}><strong>{task.title}</strong><span>{taskStateLabels[task.state]} · {new Date(task.dueAt).toLocaleString(locale)}{task.carryForwardToNextMeeting?text(' · taşınacak',' · will be carried'):''}</span></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void addCollaboration();}}><h3>{text('Ortak çalışma referansı','Collaboration reference')}</h3><label>{text('Tür','Type')}<select value={collaborationKind} onChange={(event)=>setCollaborationKind(event.target.value as typeof collaborationKind)}><option value="whiteboard">{text('Beyaz tahta','Whiteboard')}</option><option value="photo_album">{text('Fotoğraf albümü','Photo album')}</option><option value="document_annotation">{text('Belge açıklaması','Document annotation')}</option></select></label><label>{text('Kaynak kimliği','Resource identifier')}<input value={collaborationResourceId} onChange={(event)=>setCollaborationResourceId(event.target.value)}/></label><label>{text('Açıklama','Annotation')}<textarea value={collaborationAnnotation} onChange={(event)=>setCollaborationAnnotation(event.target.value)} maxLength={4000}/></label><Button type="submit" disabled={Boolean(busy)||collaborationResourceId.trim().length<2}>{text('Referans ekle','Add reference')}</Button></form>
          <section><h3>{text('Paylaşılan kaynaklar','Shared resources')}</h3>{selected.collaboration.map((item)=><div className="family-meeting-row" key={item.id}><strong>{collaborationKindLabels[item.kind]}</strong><span>{item.annotation??text('Açıklama yok','No annotation')} · {text('uzaktan aktarım yapılmadı','no remote transfer was performed')}</span></div>)}</section></div>

        <div className="family-meeting-columns"><form onSubmit={(event)=>{event.preventDefault();void prepareAi();}}><h3>{text('Onaylı yapay zekâ tutanak önerisi','Approved AI minutes suggestion')}</h3><label>{text('Kayıt onay planı','Recording approval plan')}<input value={recordingRequestId} onChange={(event)=>setRecordingRequestId(event.target.value)}/></label><Button type="submit" disabled={Boolean(busy)||recordingRequestId.trim().length<2}>{text('Onayı doğrula ve öneri iste','Verify approval and request a suggestion')}</Button><small>{text('Canlı hizmet kapalıdır; kayıt onayı yoksa veya hizmet yapılandırılmadıysa öneri üretilmez. Konuşma dökümü ekrana aktarılmaz.','The live service is disabled; no suggestion is created without recording approval or a configured service. The transcript is not sent to the screen.')}</small></form>
          <section><h3>{text('Tutanak durumu','Minutes state')}</h3><div className="family-meeting-row"><strong>{minutesStateLabels[selected.minutes.state]}</strong><span>{text('Rıza','Consent')} {selected.minutes.transcriptConsentVerified?text('doğrulandı','verified'):text('doğrulanmadı','not verified')} · {text('AI önerisi','AI suggestion')} {selected.minutes.aiSuggestionGenerated?text('var','available'):text('yok','none')} · {text('insan onayı','human approval')} {selected.minutes.humanApprovalRecorded?text('var','recorded'):text('yok','none')}</span></div></section></div>

        <form className="family-meeting-minutes" onSubmit={(event)=>{event.preventDefault();void finalize();}}><h3>{text('İnsan onaylı şifreli tutanak','Human-approved encrypted minutes')}</h3><label>{text('Özet','Summary')}<textarea value={minutesSummary} onChange={(event)=>setMinutesSummary(event.target.value)} maxLength={32768} rows={5}/></label><label>{text('Kararlar (satır başına bir karar)','Decisions (one per line)')}<textarea value={minutesDecisions} onChange={(event)=>setMinutesDecisions(event.target.value)} maxLength={32768}/></label><label>{text('Görevler (satır başına bir görev)','Tasks (one per line)')}<textarea value={minutesTasks} onChange={(event)=>setMinutesTasks(event.target.value)} maxLength={32768}/></label><label>{text('Seçili kayıt bölümü kimlikleri (virgülle)','Selected recording segment identifiers (comma separated)')}<input value={minutesSegments} onChange={(event)=>setMinutesSegments(event.target.value)}/></label><label><input type="checkbox" checked={humanApproval} onChange={(event)=>setHumanApproval(event.target.checked)}/>{text('Tutanağı okudum; insan onayıyla mühürlemeyi açıkça kabul ediyorum.','I have read the minutes and explicitly approve sealing them with human approval.')}</label><div className="family-meeting-actions"><Button type="submit" tone="primary" disabled={Boolean(busy)||selected.state!=='completed'||minutesSummary.trim().length<2||!humanApproval||selected.minutes.encryptedPackageAvailable}>{text('Şifrele ve mühürle','Encrypt and seal')}</Button><Button type="button" disabled={Boolean(busy)||!selected.minutes.encryptedPackageAvailable} onClick={()=>void readMinutes()}>{text('Yetkili tutanağı aç','Open authorized minutes')}</Button></div></form>
        {minutes&&<article className="family-meeting-open-minutes"><header><strong>{text('Yerel şifreli tutanak','Local encrypted minutes')} · {text('sürüm','version')} {minutes.minutesRevision}</strong><span>{text('İnsan onayı: var · ağ: yok · bulut: yok','Human approval: recorded · network: none · cloud: none')}</span></header><p>{minutes.summary}</p><h4>{text('Kararlar','Decisions')}</h4><ul>{minutes.decisions.map((item)=><li key={item}>{item}</li>)}</ul><h4>{text('Görevler','Tasks')}</h4><ul>{minutes.tasks.map((item)=><li key={item}>{item}</li>)}</ul></article>}
      </div>}
    </>}
  </section>;
}
