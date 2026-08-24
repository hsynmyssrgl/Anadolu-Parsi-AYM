import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunicationCallSessionView,
  CommunicationRealtimeCallingCenterView,
  CommunicationRoomView
} from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

const stateLabels:Record<CommunicationCallSessionView['state'],string>={
  planned:'Planlandı',preflight_ready:'Yerel ön kontrol hazır',waiting_local:'Yerel bekleme alanı',ended:'Sona erdi',cancelled:'İptal edildi'
};
type CallParticipant=CommunicationCallSessionView['participants'][number];
type CallDeviceCheck=CommunicationCallSessionView['preflight']['microphone'];

export function CommunicationRealtimeCallingPanel(){
  const {language}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const stateText=(state:CommunicationCallSessionView['state'])=>language==='tr'?stateLabels[state]:({planned:'Planned',preflight_ready:'Local preflight ready',waiting_local:'Local waiting room',ended:'Ended',cancelled:'Cancelled'} as const)[state];
  const networkStateLabels:Readonly<Record<CommunicationCallSessionView['networkState'],string>>={
    not_started:text('Başlatılmadı','Not started'),local_waiting_only:text('Yalnız yerel bekleme','Local waiting only'),ended:text('Sona erdi','Ended')
  };
  const deviceCheckLabels:Readonly<Record<CallDeviceCheck,string>>={
    not_run:text('Çalıştırılmadı','Not run'),passed:text('Başarılı','Passed'),failed:text('Başarısız','Failed'),not_available:text('Kullanılamıyor','Unavailable')
  };
  const participantStateLabels:Readonly<Record<CallParticipant['state'],string>>={
    invited:text('Davet edildi','Invited'),local_ready:text('Yerel olarak hazır','Ready locally'),left:text('Ayrıldı','Left')
  };
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
  }catch(caught){setError(toUserFacingErrorMessage(caught,text('Çağrı çalışma alanı yüklenemedi.','Call workspace could not be loaded.')));}};
  useEffect(()=>{void refresh();},[]);
  const selectedRoom=useMemo(()=>rooms.find(room=>room.id===selectedRoomId),[rooms,selectedRoomId]);
  const invitedPersonIds=useMemo(()=>selectedRoom?.memberships.filter(row=>row.status==='active'
    &&row.memberPersonId!==center?.ownerPersonId).map(row=>row.memberPersonId)??[],[center?.ownerPersonId,selectedRoom]);
  const topology=selectedRoom?.roomType==='direct'?'direct_p2p' as const:'family_group_sfu' as const;
  const createAllowed=Boolean(selectedRoom)&&(topology==='direct_p2p'?invitedPersonIds.length===1:invitedPersonIds.length>=2)
    &&invitedPersonIds.length<=15;
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{
    await run(operationId(key));operations.current.delete(key);await refresh();
  }catch(caught){setError(`${toUserFacingErrorMessage(caught,text('Çağrı planı güncellenemedi.','The call plan could not be updated.'))} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation ID.')}`);}finally{setBusy('');}};
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
      <span>{text('Canlı sesli veya görüntülü görüşme, ekran paylaşımı, canlı altyazı, anlık yazışma ve işletim sistemi çağrı bildirimleri henüz kullanıma hazır değildir.','Live audio or video calls, screen sharing, live captions, real-time text, and operating-system call notifications are not ready for use yet.')}</span>
      <span>{text('Yerel cihaz kontrolü:','Local device check:')} {center?.truth.localMediaPreflightProviderConfigured?text('güvenilir denetim hizmeti hazır','trusted checking service ready'):text('denetim hizmeti yok; işlem güvenle durdurulur','checking service unavailable; the action stops safely')}.</span>
      <span>{text('Bu kontrol yalnız işletim sistemi erişimini ve yerel ses çıkış yolunu sınar; fiziksel kamera, mikrofon veya duyulabilir hoparlörün çalıştığını garanti etmez.','This check tests only operating-system access and the local audio output path; it does not guarantee that the physical camera, microphone, or audible speaker works.')}</span>
      <span>{text('Bekleme alanı, el kaldırma, sabitleme, erişilebilirlik ve arka plan seçenekleri yalnız bu bilgisayardaki görüşme planında saklanır.','Waiting room, hand raising, pinning, accessibility, and background options are stored only in the call plan on this computer.')}</span></div>
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
          <header><strong>{stateText(session.state)}</strong><small>{text('değişiklik no','change no.')} {session.revision} · {session.requestedMediaMode==='audio'?text('ses','audio'):text('görüntü','video')}</small></header>
          <p>{session.participants.length} {text('katılımcı · bağlantı durumu:','participants · connection state:')} {networkStateLabels[session.networkState]} · {text('cihaz kontrolü: mikrofon','device check: microphone')} {deviceCheckLabels[session.preflight.microphone]}, {text('kamera','camera')} {deviceCheckLabels[session.preflight.camera]}, {text('hoparlör','speaker')} {deviceCheckLabels[session.preflight.speaker]}</p>
          <ul className="communication-calling-participants" aria-label={text('Yerel katılımcı planı','Local participant plan')}>{session.participants.map(participant=><li key={participant.personId}>
            <span>{participant.role==='host'?text('Yerel ev sahibi','Local host'):text('Davetli','Invitee')} · {participantStateLabels[participant.state]}</span>
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
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void preflight(session)}>{text('Yerel cihaz kontrolünü çalıştır','Run local device check')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)
              ||session.requestedMediaMode==='audio'} onClick={()=>void control(session,'audioOnly')}>{session.requestedMediaMode==='audio'
                ?text('Yalnız ses planı','Audio-only plan'):session.audioOnly?text('Görüntü iste','Request video'):text('Yalnız sese geç','Switch to audio only')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'captionsRequested')}>{session.captionsRequested?text('Altyazı isteğini kapat','Turn off caption request'):text('Altyazı iste','Request captions')}</button>
            <button type="button" disabled={Boolean(busy)||['ended','cancelled'].includes(session.state)} onClick={()=>void control(session,'realtimeTextRequested')}>{session.realtimeTextRequested?text('Anlık yazışma isteğini kapat','Turn off real-time text request'):text('Anlık yazışma iste','Request real-time text')}</button>
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
