import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunicationCallSessionView,
  CommunicationRealtimeCallingCenterView,
  CommunicationRoomView
} from '@ppt/domain';

const stateLabels:Record<CommunicationCallSessionView['state'],string>={
  planned:'Planlandı',preflight_ready:'Yerel ön kontrol hazır',waiting_local:'Yerel bekleme alanı',ended:'Sona erdi',cancelled:'İptal edildi'
};

export function CommunicationRealtimeCallingPanel(){
  const [center,setCenter]=useState<CommunicationRealtimeCallingCenterView>();
  const [rooms,setRooms]=useState<readonly CommunicationRoomView[]>([]);
  const [selectedRoomId,setSelectedRoomId]=useState('');
  const [mediaMode,setMediaMode]=useState<'audio'|'video'>('video');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const operations=useRef(new Map<string,string>());
  const operationId=(key:string)=>{const current=operations.current.get(key);if(current)return current;
    const next=crypto.randomUUID();operations.current.set(key,next);return next;};
  const refresh=async()=>{if(!window.pardus)return;setError('');try{
    const [calling,security]=await Promise.all([
      window.pardus.getCommunicationRealtimeCallingCenter(),window.pardus.getCommunicationSecurityCenter()
    ]);setCenter(calling);const active=security.rooms.filter(room=>room.status==='active');setRooms(active);
    setSelectedRoomId(current=>current&&active.some(room=>room.id===current)?current:active[0]?.id??'');
  }catch(caught){setError(caught instanceof Error?caught.message:'Çağrı çalışma alanı yüklenemedi.');}};
  useEffect(()=>{void refresh();},[]);
  const selectedRoom=useMemo(()=>rooms.find(room=>room.id===selectedRoomId),[rooms,selectedRoomId]);
  const invitedPersonIds=useMemo(()=>selectedRoom?.memberships.filter(row=>row.status==='active'
    &&row.memberPersonId!==center?.ownerPersonId).map(row=>row.memberPersonId)??[],[center?.ownerPersonId,selectedRoom]);
  const topology=selectedRoom?.roomType==='direct'?'direct_p2p' as const:'family_group_sfu' as const;
  const createAllowed=Boolean(selectedRoom)&&(topology==='direct_p2p'?invitedPersonIds.length===1:invitedPersonIds.length>=2)
    &&invitedPersonIds.length<=15;
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{
    await run(operationId(key));operations.current.delete(key);await refresh();
  }catch(caught){setError(caught instanceof Error?`${caught.message} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`
    :'Çağrı metadata değişikliği tamamlanamadı.');}finally{setBusy('');}};
  const createCall=()=>window.pardus&&selectedRoom&&createAllowed&&mutate(
    `create:${selectedRoom.id}:${topology}:${mediaMode}:${invitedPersonIds.join(',')}`,clientOperationId=>
      window.pardus!.createCommunicationCall({clientOperationId,expectedRevision:0,roomId:selectedRoom.id,topology,
        requestedMediaMode:mediaMode,invitedPersonIds,waitingRoomEnabled:true,automaticAudioFallbackEnabled:true}));
  const preflight=(session:CommunicationCallSessionView)=>window.pardus&&mutate(`preflight:${session.id}:${session.revision}`,
    clientOperationId=>window.pardus!.runCommunicationCallPreflight({clientOperationId,expectedRevision:session.revision,sessionId:session.id}));
  const control=(session:CommunicationCallSessionView,field:'audioOnly'|'meetingLocked'|'captionsRequested'|'realtimeTextRequested'|'screenShareRequested'|'localHandRaised')=>
    window.pardus&&mutate(`${field}:${session.id}:${session.revision}`,clientOperationId=>
      window.pardus!.updateCommunicationCallControls({clientOperationId,expectedRevision:session.revision,sessionId:session.id,
        [field]:!session[field]}));
  const pinParticipant=(session:CommunicationCallSessionView,personId:string,signLanguage:boolean)=>window.pardus&&mutate(
    `${signLanguage?'sign-pin':'pin'}:${session.id}:${session.revision}:${personId}`,clientOperationId=>
      window.pardus!.updateCommunicationCallControls({clientOperationId,expectedRevision:session.revision,sessionId:session.id,
        ...(signLanguage?{signLanguagePinnedPersonId:personId}:{pinnedPersonId:personId})}));
  const advance=(session:CommunicationCallSessionView,action:'enter_local_waiting_room'|'end'|'cancel')=>window.pardus&&mutate(
    `${action}:${session.id}:${session.revision}`,clientOperationId=>window.pardus!.advanceCommunicationCall({clientOperationId,
      expectedRevision:session.revision,sessionId:session.id,action,
      reason:action==='enter_local_waiting_room'?'Kullanıcı yalnız yerel bekleme alanını açtı.':
        action==='end'?'Kullanıcı yerel çağrı planını sonlandırdı.':'Kullanıcı yerel çağrı planını iptal etti.'}));
  const toggleSimpleMode=()=>window.pardus&&center&&mutate(`preferences:${center.preferences.revision}:simple`,clientOperationId=>
    window.pardus!.setCommunicationCallPreferences({clientOperationId,expectedRevision:center.preferences.revision,
      simpleMode:!center.preferences.simpleMode,...center.preferences.favoritePersonId?{favoritePersonId:center.preferences.favoritePersonId}:{},
      largePersonCards:true,captionScalePercent:center.preferences.simpleMode?125:150,screenReaderAnnouncements:true,
      keyboardShortcuts:true,automaticAudioFallbackEnabled:true,noiseReductionRequested:true,echoCancellationRequested:true,
      automaticGainControlRequested:true,backgroundEffect:'off'}));
  return <section className="communication-calling panel" aria-labelledby="communication-calling-title">
    <div className="panel-heading"><div><span className="eyebrow">34-C · Erişilebilir çağrı planı</span>
      <h2 id="communication-calling-title">Gerçek zamanlı çağrı hazırlığı</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>Yenile</button></div>
    <div className="communication-calling-truth" role="note"><strong>Bu sürüm gerçek çağrı başlatmaz ve ağ kullanmaz.</strong>
      <span>WebRTC, SFU, STUN/TURN, SFrame/MLS, ekran paylaşımı, canlı altyazı, RTT taşıması ve işletim sistemi çağrı bildirimleri production ortamında yapılandırılmadı.</span>
      <span>Ön kontrol yalnız güvenilir main-process sağlayıcısı bağlandığında kanıt üretir; şu an destek yoksa güvenli biçimde reddedilir.</span>
      <span>Bekleme alanı, el kaldırma, sabitleme, erişilebilirlik ve arka plan seçenekleri yalnız yerel planlama metadatasıdır.</span></div>
    {error&&<p className="status-message danger" role="alert">{error}</p>}
    {!center?<p>Çağrı çalışma alanı yükleniyor…</p>:<>
      <div className="communication-calling-summary"><span><strong>{center.sessions.length}</strong> çağrı planı</span>
        <span><strong>{center.qualityObservations.length}</strong> doğrulanmış kalite gözlemi</span>
        <span><strong>{center.preferences.simpleMode?'Açık':'Kapalı'}</strong> sade mod</span></div>
      <div className="communication-calling-compose">
        <label>Etkin iletişim odası<select value={selectedRoomId} onChange={event=>setSelectedRoomId(event.target.value)}>
          <option value="">Oda seçin</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label>
        <label>İstenen medya<select value={mediaMode} onChange={event=>setMediaMode(event.target.value as 'audio'|'video')}>
          <option value="video">Görüntülü</option><option value="audio">Yalnız ses</option></select></label>
        <span>{invitedPersonIds.length} davetli · {topology==='direct_p2p'?'bire bir plan':'aile grubu planı'}</span>
        <button type="button" disabled={Boolean(busy)||!createAllowed} onClick={()=>void createCall()}>Yerel çağrı planı oluştur</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void toggleSimpleMode()}>
          {center.preferences.simpleMode?'Standart görünüme dön':'Sade ve büyük görünümü aç'}</button>
      </div>
      <div className="communication-calling-list">{center.sessions.length===0?<p>Henüz yerel çağrı planı yok.</p>:
        center.sessions.map(session=><article key={session.id}>
          <header><strong>{stateLabels[session.state]}</strong><small>sürüm {session.revision} · {session.requestedMediaMode==='audio'?'ses':'görüntü'}</small></header>
          <p>{session.participants.length} katılımcı · ağ durumu: {session.networkState} · ön kontrol: mikrofon {session.preflight.microphone}, kamera {session.preflight.camera}, hoparlör {session.preflight.speaker}</p>
          <ul className="communication-calling-participants" aria-label="Yerel katılımcı planı">{session.participants.map(participant=><li key={participant.personId}>
            <span>{participant.role==='host'?'Yerel ev sahibi':'Davetli'} · {participant.state}</span>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)}
              onClick={()=>void pinParticipant(session,participant.personId,false)}>Yerel olarak sabitle</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)}
              onClick={()=>void pinParticipant(session,participant.personId,true)}>İşaret dili konuşmacısı olarak sabitle</button>
          </li>)}</ul>
          <div className="communication-calling-actions">
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void preflight(session)}>Yerel ön kontrolü çalıştır</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'audioOnly')}>{session.audioOnly?'Görüntü iste':'Yalnız sese geç'}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'captionsRequested')}>{session.captionsRequested?'Altyazı isteğini kapat':'Altyazı iste'}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'realtimeTextRequested')}>{session.realtimeTextRequested?'RTT isteğini kapat':'RTT iste'}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'screenShareRequested')}>{session.screenShareRequested?'Ekran paylaşımı isteğini kapat':'Ekran paylaşımı iste'}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'localHandRaised')}>{session.localHandRaised?'Elini indir':'El kaldır'}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'meetingLocked')}>{session.meetingLocked?'Yerel kilidi aç':'Yerel toplantı planını kilitle'}</button>
            <button type="button" disabled={Boolean(busy)||session.state!=='preflight_ready'} onClick={()=>void advance(session,'enter_local_waiting_room')}>Yerel bekleme alanına geç</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void advance(session,'end')}>Planı sonlandır</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void advance(session,'cancel')}>Planı iptal et</button>
          </div>
        </article>)}</div>
    </>}
  </section>;
}
