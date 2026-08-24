import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommunicationCallSessionView, CommunicationRecordingRequestView } from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

const stateLabel:Record<CommunicationRecordingRequestView['state'],string>={
  consent_pending:'Rızalar bekleniyor',ready_not_recording:'Rızalar hazır · kayıt başlamadı',
  paused_for_joiner:'Geç katılan kişi için duraklatıldı',off_record:'Kayıt dışı',stopped:'Durduruldu',
  cancelled:'İptal edildi',deletion_requested:'Silme istendi'
};

export function CommunicationRecordingRetentionPanel(){
  const {language}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const stateText=(state:CommunicationRecordingRequestView['state'])=>language==='tr'?stateLabel[state]:({
    consent_pending:'Waiting for consent',ready_not_recording:'Consent ready · recording not started',paused_for_joiner:'Paused for a late joiner',
    off_record:'Off-record',stopped:'Stopped',cancelled:'Cancelled',deletion_requested:'Deletion requested'
  } as const)[state];
  const participantStateLabels:Readonly<Record<CommunicationRecordingRequestView['participants'][number]['state'],string>>={
    pending:text('Bekliyor','Pending'),granted:text('Rıza verildi','Consent granted'),declined:text('Reddedildi','Declined'),withdrawn:text('Geri çekildi','Withdrawn')
  };
  const [requests,setRequests]=useState<readonly CommunicationRecordingRequestView[]>([]);
  const [calls,setCalls]=useState<readonly CommunicationCallSessionView[]>([]);
  const [selectedCallId,setSelectedCallId]=useState('');
  const [lateJoiner,setLateJoiner]=useState('');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const operations=useRef(new Map<string,string>());
  const operationId=(key:string)=>{const existing=operations.current.get(key);if(existing)return existing;
    const next=crypto.randomUUID();operations.current.set(key,next);return next;};
  const refresh=async()=>{if(!window.pardus)return;setError('');try{const [recording,calling]=await Promise.all([
    window.pardus.getCommunicationRecordingCenter(),window.pardus.getCommunicationRealtimeCallingCenter()]);
    setRequests(recording.requests);const active=calling.sessions.filter(item=>!['ended','cancelled'].includes(item.state));setCalls(active);
    setSelectedCallId(current=>current&&active.some(item=>item.id===current)?current:active[0]?.id??'');
  }catch(caught){setError(toUserFacingErrorMessage(caught,text('Kayıt ve rıza merkezi yüklenemedi.','Recording and consent center could not be loaded.')));}};
  useEffect(()=>{void refresh();},[]);
  const selectedCall=useMemo(()=>calls.find(item=>item.id===selectedCallId),[calls,selectedCallId]);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{
    await run(operationId(key));operations.current.delete(key);await refresh();
  }catch(caught){setError(`${toUserFacingErrorMessage(caught,text('Kayıt ve rıza bilgileri güncellenemedi.','The recording and consent details could not be updated.'))} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation ID.')}`);}finally{setBusy('');}};
  const create=()=>window.pardus&&selectedCall&&mutate(`create:${selectedCall.id}`,clientOperationId=>
    window.pardus!.createCommunicationRecordingRequest({clientOperationId,expectedRevision:0,callSessionId:selectedCall.id,
      participantPersonIds:selectedCall.participants.map(item=>item.personId),noticeVersion:'recording-notice-v1',
      audioDays:30,videoDays:14,transcriptDays:7,translationDays:3,persistTranscript:false,persistTranslation:false}));
  const consent=(request:CommunicationRecordingRequestView,decision:'grant'|'decline')=>window.pardus&&mutate(
    `consent:${request.id}:${request.revision}:${decision}`,clientOperationId=>window.pardus!.decideCommunicationRecordingConsent({
      clientOperationId,expectedRevision:request.revision,requestId:request.id,decision,explicitConsent:true,
      noticeVersion:request.noticeVersion,ageCategory:'adult',ageAppropriateNoticeAcknowledged:true}));
  const withdraw=(request:CommunicationRecordingRequestView)=>window.pardus&&mutate(`withdraw:${request.id}:${request.revision}`,
    clientOperationId=>window.pardus!.withdrawCommunicationRecordingConsent({clientOperationId,expectedRevision:request.revision,
      requestId:request.id,reason:'Gelecekteki kayıt rızamı geri çekiyorum.'}));
  const addLate=(request:CommunicationRecordingRequestView)=>window.pardus&&lateJoiner.trim()&&mutate(
    `late:${request.id}:${request.revision}:${lateJoiner.trim()}`,clientOperationId=>window.pardus!.addCommunicationRecordingLateJoiner({
      clientOperationId,expectedRevision:request.revision,requestId:request.id,participantPersonId:lateJoiner.trim()}));
  const segment=(request:CommunicationRecordingRequestView,mode:'on_record_requested'|'off_record')=>window.pardus&&mutate(
    `segment:${request.id}:${request.revision}:${mode}`,clientOperationId=>window.pardus!.setCommunicationRecordingSegment({
      clientOperationId,expectedRevision:request.revision,requestId:request.id,mode,
      reason:mode==='off_record'?'Katılımcılar kayıt dışı bölüme geçti.':'Tüm açık rızalar sonrası kayıtlı bölüm istendi; sağlayıcı yok.'}));
  const retention=(request:CommunicationRecordingRequestView)=>window.pardus&&mutate(`retention:${request.id}:${request.revision}`,
    clientOperationId=>window.pardus!.updateCommunicationRecordingRetention({clientOperationId,expectedRevision:request.revision,
      requestId:request.id,audioDays:request.retention.audioDays,videoDays:request.retention.videoDays,
      transcriptDays:request.retention.transcriptDays,translationDays:request.retention.translationDays,
      persistTranscript:false,persistTranslation:false,secureDeletionRequested:true}));
  const requestDeletion=(request:CommunicationRecordingRequestView)=>window.pardus&&mutate(`delete:${request.id}:${request.revision}`,
    clientOperationId=>window.pardus!.requestCommunicationRecordingDeletion({clientOperationId,expectedRevision:request.revision,
      requestId:request.id,reason:'Yerel kayıt bilgisini saklama ihtiyacı sona erdi.'}));
  return <section className="communication-recording panel" aria-labelledby="communication-recording-title">
    <div className="panel-heading"><div><span className="eyebrow">{text('Açık rıza ve saklama','Explicit consent and retention')}</span>
      <h2 id="communication-recording-title">{text('Görüşme kaydı rıza planı','Call recording consent plan')}</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>{text('Yenile','Refresh')}</button></div>
    <div className="communication-recording-truth" role="note"><strong>{text('Varsayılan kapalıdır; bu sürüm gerçek ses, video, konuşma dökümü veya çeviri kaydı oluşturmaz.','It is off by default; this release does not create real audio, video, conversation transcripts, or translation recordings.')}</strong>
      <span>{text('Her katılımcının ayrı açık rızası, geri çekme, geç katılan kişide otomatik duraklatma ve kayıtlı/kayıt dışı bölümler yalnız kalıcı plan bilgisi olarak saklanır.','Separate consent for every participant, withdrawal, automatic pause for a late joiner, and recorded or unrecorded sections are stored only as lasting plan details.')}</span>
      <span>{text('Kırmızı kayıt göstergesi ve sesli başlatma veya durdurma duyurusu yalnız gerçek kayıt başladığı doğrulanırsa gösterilir; şu an kayıt başlamadı.','The red recording indicator and audible start or stop announcement appear only after a real recording is confirmed to have started; recording has not started now.')}</span>
      <span>{text('Uçtan uca şifreli kayıt, korumalı medya saklama, bütünlük doğrulaması, fiziksel güvenli silme ve çocuk veya veli kuralları henüz hazır değildir; bu işlemler güvenle kapalı kalır.','End-to-end encrypted recording, protected media storage, integrity verification, physical secure erasure, and child or guardian rules are not ready yet; these actions remain safely disabled.')}</span></div>
    {error&&<p className="status-message danger" role="alert">{error}</p>}
    <div className="communication-recording-compose"><label>{text('Yerel çağrı planı','Local call plan')}<select value={selectedCallId}
      onChange={event=>setSelectedCallId(event.target.value)}><option value="">{text('Çağrı seçin','Select a call')}</option>
      {calls.map(call=><option key={call.id} value={call.id}>{call.id} · {call.participants.length} {text('katılımcı','participants')}</option>)}</select></label>
      <button type="button" disabled={Boolean(busy)||!selectedCall||selectedCall.participants.length<2} onClick={()=>void create()}>
        {text('Rıza planı oluştur','Create consent plan')}</button></div>
    <div className="communication-recording-list">{requests.length===0?<p>{text('Henüz kayıt rıza planı yok.','There are no recording consent plans yet.')}</p>:requests.map(request=><article key={request.id}>
      <header><strong>{stateText(request.state)}</strong><span className="recording-indicator recording-indicator--inactive">{text('Kayıt kapalı','Recording off')}</span>
        <small>{text('değişiklik no','change no.')} {request.revision}</small></header>
      <p>{request.participants.length} {text('katılımcı · aydınlatma bilgisi hazır · gerçek kayıt: hayır','participants · notice ready · real recording: no')}</p>
      <ul aria-label={text('Katılımcı kayıt rızaları','Participant recording consents')}>{request.participants.map(item=><li key={item.personId}>
        <span>{item.personId} · {participantStateLabels[item.state]} · {item.ageCategory==='adult'?text('yetişkin','adult'):text('çocuk/yaş doğrulanmadı','child/age not verified')}</span>
      </li>)}</ul>
      <p>{text('Ses','Audio')} {request.retention.audioDays} {text('gün','days')} · {text('video','video')} {request.retention.videoDays} {text('gün','days')} · {text('konuşma dökümü','transcript')} {request.retention.transcriptDays} {text('gün','days')} · {text('çeviri','translation')} {request.retention.translationDays} {text('gün','days')}</p>
      <div className="communication-recording-actions">
        <button type="button" disabled={Boolean(busy)} onClick={()=>void consent(request,'grant')}>{text('Kendi açık rızamı ver','Give my explicit consent')}</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void consent(request,'decline')}>{text('Kaydı reddet, görüşmeye kayıt dışı devam et','Decline recording and continue off-record')}</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void withdraw(request)}>{text('Gelecekteki kayıt rızamı geri çek','Withdraw my future recording consent')}</button>
        <button type="button" disabled={Boolean(busy)||request.state!=='ready_not_recording'} onClick={()=>void segment(request,'on_record_requested')}>{text('Kayıtlı bölüm iste','Request on-record section')}</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void segment(request,'off_record')}>{text('Kayıt dışı bölüme geç','Switch to off-record section')}</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void retention(request)}>{text('Ayrı saklama politikasını doğrula','Verify separate retention policy')}</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void requestDeletion(request)}>{text('Kayıt bilgisini kaldırmayı iste','Request removal of recording details')}</button>
      </div>
      <div className="communication-recording-late"><label>{text('Geç katılan kişi kimliği','Late joiner person ID')}<input value={lateJoiner}
        onChange={event=>setLateJoiner(event.target.value)} maxLength={256}/></label>
        <button type="button" disabled={Boolean(busy)||lateJoiner.trim().length<2} onClick={()=>void addLate(request)}>{text('Kaydı duraklat ve rıza iste','Pause recording and request consent')}</button></div>
    </article>)}</div>
  </section>;
}
