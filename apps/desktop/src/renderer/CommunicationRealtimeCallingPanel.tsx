import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunicationCallSessionView,
  CommunicationRealtimeCallingCenterView,
  CommunicationRoomView
} from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';

const stateLabels:Record<CommunicationCallSessionView['state'],string>={
  planned:'Planlandı',preflight_ready:'Yerel ön kontrol hazır',waiting_local:'Yerel bekleme alanı',ended:'Sona erdi',cancelled:'İptal edildi'
};

export function CommunicationRealtimeCallingPanel(){
  const {language}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const stateText=(state:CommunicationCallSessionView['state'])=>language==='tr'?stateLabels[state]:({planned:'Planned',preflight_ready:'Local preflight ready',waiting_local:'Local waiting room',ended:'Ended',cancelled:'Cancelled'} as const)[state];
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
  }catch(caught){setError(caught instanceof Error?caught.message:text('Çağrı çalışma alanı yüklenemedi.','Call workspace could not be loaded.'));}};
  useEffect(()=>{void refresh();},[]);
  const selectedRoom=useMemo(()=>rooms.find(room=>room.id===selectedRoomId),[rooms,selectedRoomId]);
  const invitedPersonIds=useMemo(()=>selectedRoom?.memberships.filter(row=>row.status==='active'
    &&row.memberPersonId!==center?.ownerPersonId).map(row=>row.memberPersonId)??[],[center?.ownerPersonId,selectedRoom]);
  const topology=selectedRoom?.roomType==='direct'?'direct_p2p' as const:'family_group_sfu' as const;
  const createAllowed=Boolean(selectedRoom)&&(topology==='direct_p2p'?invitedPersonIds.length===1:invitedPersonIds.length>=2)
    &&invitedPersonIds.length<=15;
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{
    await run(operationId(key));operations.current.delete(key);await refresh();
  }catch(caught){setError(caught instanceof Error?`${caught.message} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation ID.')}`
    :text('Çağrı metadata değişikliği tamamlanamadı.','The call metadata change could not be completed.'));}finally{setBusy('');}};
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
    `${signLanguage?'sign-pin':'pin'}:${session.id}:${session.revision}:${personId}:${
      signLanguage?session.signLanguagePinnedPersonId===personId:session.pinnedPersonId===personId}`,clientOperationId=>
      window.pardus!.updateCommunicationCallControls({clientOperationId,expectedRevision:session.revision,sessionId:session.id,
        ...(signLanguage
          ?{signLanguagePinnedPersonId:session.signLanguagePinnedPersonId===personId?null:personId}
          :{pinnedPersonId:session.pinnedPersonId===personId?null:personId})}));
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
    <div className="panel-heading"><div><span className="eyebrow">{text('Erişilebilir çağrı planı','Accessible call plan')}</span>
      <h2 id="communication-calling-title">{text('Gerçek zamanlı çağrı hazırlığı','Real-time call preparation')}</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>{text('Yenile','Refresh')}</button></div>
    <div className="communication-calling-truth" role="note"><strong>{text('Bu sürüm gerçek çağrı başlatmaz ve ağ kullanmaz.','This release does not start real calls or use the network.')}</strong>
      <span>{text('WebRTC, SFU, STUN/TURN, SFrame/MLS, ekran paylaşımı, canlı altyazı, RTT taşıması ve işletim sistemi çağrı bildirimleri production ortamında yapılandırılmadı.','WebRTC, SFU, STUN/TURN, SFrame/MLS, screen sharing, live captions, RTT transport and operating-system call notifications are not configured in production.')}</span>
      <span>{text('Yerel cihaz ön kontrolü:','Local device preflight:')} {center?.truth.localMediaPreflightProviderConfigured?text('güvenilir main-process sağlayıcısı hazır','trusted main-process provider ready'):text('sağlayıcı yok; güvenli biçimde reddedilir','no provider; safely rejected')}.</span>
      <span>{text('Bu ön kontrol yalnız işletim sistemi erişimini, canlı track durumunu ve yerel ses çıkış yolunu sınar; fiziksel kamera, mikrofon veya duyulabilir hoparlör işlevini sertifikalandırmaz.','This preflight checks only operating-system access, live track state and the local audio output path; it does not certify physical camera, microphone or audible speaker operation.')}</span>
      <span>{text('Bekleme alanı, el kaldırma, sabitleme, erişilebilirlik ve arka plan seçenekleri yalnız yerel planlama metadatasıdır.','Waiting room, hand raising, pinning, accessibility and background options are local planning metadata only.')}</span></div>
    {error&&<p className="status-message danger" role="alert">{error}</p>}
    {!center?<p>{text('Çağrı çalışma alanı yükleniyor…','Loading call workspace…')}</p>:<>
      <div className="communication-calling-summary"><span><strong>{center.sessions.length}</strong> {text('çağrı planı','call plans')}</span>
        <span><strong>{center.qualityObservations.length}</strong> {text('doğrulanmış kalite gözlemi','verified quality observations')}</span>
        <span><strong>{center.preferences.simpleMode?text('Açık','On'):text('Kapalı','Off')}</strong> {text('sade mod','simple mode')}</span></div>
      <div className="communication-calling-compose">
        <label>{text('Etkin iletişim odası','Active communication room')}<select value={selectedRoomId} onChange={event=>setSelectedRoomId(event.target.value)}>
          <option value="">{text('Oda seçin','Select a room')}</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label>
        <label>{text('İstenen medya','Requested media')}<select value={mediaMode} onChange={event=>setMediaMode(event.target.value as 'audio'|'video')}>
          <option value="video">{text('Görüntülü','Video')}</option><option value="audio">{text('Yalnız ses','Audio only')}</option></select></label>
        <span>{invitedPersonIds.length} {text('davetli','invitees')} · {topology==='direct_p2p'?text('bire bir plan','one-to-one plan'):text('aile grubu planı','family group plan')}</span>
        <button type="button" disabled={Boolean(busy)||!createAllowed} onClick={()=>void createCall()}>{text('Yerel çağrı planı oluştur','Create local call plan')}</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void toggleSimpleMode()}>
          {center.preferences.simpleMode?text('Standart görünüme dön','Return to standard view'):text('Sade ve büyük görünümü aç','Enable simple large view')}</button>
      </div>
      <div className="communication-calling-list">{center.sessions.length===0?<p>{text('Henüz yerel çağrı planı yok.','There are no local call plans yet.')}</p>:
        center.sessions.map(session=><article key={session.id}>
          <header><strong>{stateText(session.state)}</strong><small>{text('sürüm','revision')} {session.revision} · {session.requestedMediaMode==='audio'?text('ses','audio'):text('görüntü','video')}</small></header>
          <p>{session.participants.length} {text('katılımcı · ağ durumu:','participants · network state:')} {session.networkState} · {text('ön kontrol: mikrofon','preflight: microphone')} {session.preflight.microphone}, {text('kamera','camera')} {session.preflight.camera}, {text('hoparlör','speaker')} {session.preflight.speaker}</p>
          <ul className="communication-calling-participants" aria-label={text('Yerel katılımcı planı','Local participant plan')}>{session.participants.map(participant=><li key={participant.personId}>
            <span>{participant.role==='host'?text('Yerel ev sahibi','Local host'):text('Davetli','Invitee')} · {participant.state}</span>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)}
              aria-pressed={session.pinnedPersonId===participant.personId}
              onClick={()=>void pinParticipant(session,participant.personId,false)}>{session.pinnedPersonId===participant.personId
                ?text('Yerel sabitlemeyi kaldır','Remove local pin'):text('Yerel olarak sabitle','Pin locally')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)}
              aria-pressed={session.signLanguagePinnedPersonId===participant.personId}
              onClick={()=>void pinParticipant(session,participant.personId,true)}>{session.signLanguagePinnedPersonId===participant.personId
                ?text('İşaret dili sabitlemesini kaldır','Remove sign-language pin'):text('İşaret dili konuşmacısı olarak sabitle','Pin as sign-language speaker')}</button>
          </li>)}</ul>
          <div className="communication-calling-actions">
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void preflight(session)}>{text('Yerel ön kontrolü çalıştır','Run local preflight')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)
              ||session.requestedMediaMode==='audio'} onClick={()=>void control(session,'audioOnly')}>{session.requestedMediaMode==='audio'
                ?text('Yalnız ses planı','Audio-only plan'):session.audioOnly?text('Görüntü iste','Request video'):text('Yalnız sese geç','Switch to audio only')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'captionsRequested')}>{session.captionsRequested?text('Altyazı isteğini kapat','Turn off caption request'):text('Altyazı iste','Request captions')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'realtimeTextRequested')}>{session.realtimeTextRequested?text('RTT isteğini kapat','Turn off RTT request'):text('RTT iste','Request RTT')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'screenShareRequested')}>{session.screenShareRequested?text('Ekran paylaşımı isteğini kapat','Turn off screen-sharing request'):text('Ekran paylaşımı iste','Request screen sharing')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'localHandRaised')}>{session.localHandRaised?text('Elini indir','Lower hand'):text('El kaldır','Raise hand')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'meetingLocked')}>{session.meetingLocked?text('Yerel kilidi aç','Unlock locally'):text('Yerel toplantı planını kilitle','Lock local meeting plan')}</button>
            <button type="button" disabled={Boolean(busy)||session.state!=='preflight_ready'} onClick={()=>void advance(session,'enter_local_waiting_room')}>{text('Yerel bekleme alanına geç','Enter local waiting room')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void advance(session,'end')}>{text('Planı sonlandır','End plan')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void advance(session,'cancel')}>{text('Planı iptal et','Cancel plan')}</button>
          </div>
        </article>)}</div>
    </>}
  </section>;
}
