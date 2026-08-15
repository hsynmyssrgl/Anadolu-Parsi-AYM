import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommunicationCallSessionView, CommunicationRecordingRequestView } from '@ppt/domain';

const stateLabel:Record<CommunicationRecordingRequestView['state'],string>={
  consent_pending:'Rızalar bekleniyor',ready_not_recording:'Rızalar hazır · kayıt başlamadı',
  paused_for_joiner:'Geç katılan kişi için duraklatıldı',off_record:'Off-record',stopped:'Durduruldu',
  cancelled:'İptal edildi',deletion_requested:'Silme istendi'
};

export function CommunicationRecordingRetentionPanel(){
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
  }catch(caught){setError(caught instanceof Error?caught.message:'Kayıt ve rıza merkezi yüklenemedi.');}};
  useEffect(()=>{void refresh();},[]);
  const selectedCall=useMemo(()=>calls.find(item=>item.id===selectedCallId),[calls,selectedCallId]);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{
    await run(operationId(key));operations.current.delete(key);await refresh();
  }catch(caught){setError(caught instanceof Error?`${caught.message} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`:
    'Kayıt ve rıza metadata değişikliği tamamlanamadı.');}finally{setBusy('');}};
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
      reason:mode==='off_record'?'Katılımcılar off-record bölümüne geçti.':'Tüm açık rızalar sonrası on-record bölümü istendi; sağlayıcı yok.'}));
  const retention=(request:CommunicationRecordingRequestView)=>window.pardus&&mutate(`retention:${request.id}:${request.revision}`,
    clientOperationId=>window.pardus!.updateCommunicationRecordingRetention({clientOperationId,expectedRevision:request.revision,
      requestId:request.id,audioDays:request.retention.audioDays,videoDays:request.retention.videoDays,
      transcriptDays:request.retention.transcriptDays,translationDays:request.retention.translationDays,
      persistTranscript:false,persistTranslation:false,secureDeletionRequested:true}));
  const requestDeletion=(request:CommunicationRecordingRequestView)=>window.pardus&&mutate(`delete:${request.id}:${request.revision}`,
    clientOperationId=>window.pardus!.requestCommunicationRecordingDeletion({clientOperationId,expectedRevision:request.revision,
      requestId:request.id,reason:'Yerel kayıt metadata saklama ihtiyacı sona erdi.'}));
  return <section className="communication-recording panel" aria-labelledby="communication-recording-title">
    <div className="panel-heading"><div><span className="eyebrow">34-D · Açık rıza ve saklama</span>
      <h2 id="communication-recording-title">Görüşme kaydı rıza planı</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>Yenile</button></div>
    <div className="communication-recording-truth" role="note"><strong>Varsayılan kapalıdır; bu sürüm gerçek ses, video, transkript veya çeviri kaydı oluşturmaz.</strong>
      <span>Her katılımcının ayrı açık rızası, geri çekme, geç katılan kişide otomatik duraklatma ve on/off-record bölümleri yalnız kalıcı metadata olarak modellenir.</span>
      <span>Kırmızı kayıt göstergesi ve sesli başlat/durdur duyurusu ancak gerçek capture kanıtı varsa gösterilecektir; şu an kayıt başlamadı.</span>
      <span>E2EE kayıt rolü, şifreli medya kasası, hash/imza, fiziksel güvenli silme ve çocuk/veli hukuk politikası yapılandırılmadı; bu yollar fail-closed kalır.</span></div>
    {error&&<p className="status-message danger" role="alert">{error}</p>}
    <div className="communication-recording-compose"><label>Yerel çağrı planı<select value={selectedCallId}
      onChange={event=>setSelectedCallId(event.target.value)}><option value="">Çağrı seçin</option>
      {calls.map(call=><option key={call.id} value={call.id}>{call.id} · {call.participants.length} katılımcı</option>)}</select></label>
      <button type="button" disabled={Boolean(busy)||!selectedCall||selectedCall.participants.length<2} onClick={()=>void create()}>
        Rıza planı oluştur</button></div>
    <div className="communication-recording-list">{requests.length===0?<p>Henüz kayıt rıza planı yok.</p>:requests.map(request=><article key={request.id}>
      <header><strong>{stateLabel[request.state]}</strong><span className="recording-indicator recording-indicator--inactive">Kayıt kapalı</span>
        <small>sürüm {request.revision}</small></header>
      <p>{request.participants.length} katılımcı · aydınlatma {request.noticeVersion} · gerçek capture: hayır</p>
      <ul aria-label="Katılımcı kayıt rızaları">{request.participants.map(item=><li key={item.personId}>
        <span>{item.personId} · {item.state} · {item.ageCategory==='adult'?'yetişkin':'çocuk/yaş doğrulanmadı'}</span>
      </li>)}</ul>
      <p>Ses {request.retention.audioDays} gün · video {request.retention.videoDays} gün · transkript {request.retention.transcriptDays} gün · çeviri {request.retention.translationDays} gün</p>
      <div className="communication-recording-actions">
        <button type="button" disabled={Boolean(busy)} onClick={()=>void consent(request,'grant')}>Kendi açık rızamı ver</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void consent(request,'decline')}>Kaydı reddet, görüşmeye off-record devam et</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void withdraw(request)}>Gelecekteki kayıt rızamı geri çek</button>
        <button type="button" disabled={Boolean(busy)||request.state!=='ready_not_recording'} onClick={()=>void segment(request,'on_record_requested')}>On-record bölümü iste</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void segment(request,'off_record')}>Off-record bölümüne geç</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void retention(request)}>Ayrı saklama politikasını doğrula</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void requestDeletion(request)}>Mantıksal silme iste</button>
      </div>
      <div className="communication-recording-late"><label>Geç katılan kişi kimliği<input value={lateJoiner}
        onChange={event=>setLateJoiner(event.target.value)} maxLength={256}/></label>
        <button type="button" disabled={Boolean(busy)||lateJoiner.trim().length<2} onClick={()=>void addLate(request)}>Kaydı duraklat ve rıza iste</button></div>
    </article>)}</div>
  </section>;
}
