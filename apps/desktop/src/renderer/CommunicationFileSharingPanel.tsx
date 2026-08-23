import { useEffect, useRef, useState } from 'react';
import { AsyncStatePanel } from './form-ux';
import { Button, EmptyState, StatusMessage } from './ui';
import { selectUiCopy, useLocalization } from './localization';

type Bridge=NonNullable<Window['pardus']>;
type Center=Awaited<ReturnType<Bridge['getCommunicationFileSharingCenter']>>;
type FileView=Center['files'][number];
type SafePreview=Awaited<ReturnType<Bridge['getCommunicationFileSafePreview']>>;
type Command=Parameters<Bridge['applyCommunicationFileSharingCommand']>[0]['command'];

interface PendingOperation {readonly clientOperationId:string;readonly expectedRevision:number;readonly requestFingerprint:string}
const operationId=():string=>`file-sharing-${globalThis.crypto.randomUUID()}`;
const errorText=(caught:unknown,fallback:string):string=>caught instanceof Error?caught.message:fallback;
const fingerprint=(value:unknown):string=>JSON.stringify(value);
const futureIso=(minutes:number):string=>new Date(Date.now()+minutes*60_000).toISOString();

export function CommunicationFileSharingPanel(){
  const { language }=useLocalization();
  const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const [center,setCenter]=useState<Center>();
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [operationError,setOperationError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState('');
  const [preview,setPreview]=useState<SafePreview>();
  const [roomId,setRoomId]=useState('family-room');
  const [meetingId,setMeetingId]=useState('');
  const [accessMode,setAccessMode]=useState<'preview_only'|'download'>('preview_only');
  const [quietEnabled,setQuietEnabled]=useState(true);
  const [quietStart,setQuietStart]=useState('22:00');
  const [quietEnd,setQuietEnd]=useState('07:00');
  const [digestEnabled,setDigestEnabled]=useState(true);
  const [emergencyTitle,setEmergencyTitle]=useState(text('Aile içi acil durum duyurusu','Family emergency announcement'));
  const [helperPersonId,setHelperPersonId]=useState('');
  const [coWatchReference,setCoWatchReference]=useState('');
  const [voiceTarget,setVoiceTarget]=useState('');
  const pending=useRef(new Map<string,PendingOperation>());

  const refresh=async(initial=false)=>{const bridge=window.pardus;if(!bridge){setLoading(false);setLoadError(text('Masaüstü köprüsü kullanılamıyor.','Desktop bridge is unavailable.'));return;}
    if(initial)setLoading(true);setLoadError('');try{const value=await bridge.getCommunicationFileSharingCenter();setCenter(value);
      setQuietEnabled(value.notificationProfile.quietHoursEnabled);setQuietStart(value.notificationProfile.quietHoursStart);
      setQuietEnd(value.notificationProfile.quietHoursEnd);setDigestEnabled(value.notificationProfile.nonEmergencyDigestEnabled);
    }catch(caught){setLoadError(errorText(caught,text('Dosya paylaşım merkezi yüklenemedi.','File sharing center could not be loaded.')));}finally{setLoading(false);}};
  useEffect(()=>{void refresh(true);},[]);

  const getOperation=(key:string,expectedRevision:number,payload:unknown):PendingOperation=>{const requestFingerprint=fingerprint(payload);
    const existing=pending.current.get(key);if(existing){if(existing.requestFingerprint!==requestFingerprint)
      throw new Error(text('Bekleyen işlem aynı anahtarda farklı içerikle değiştirilemez.','A pending operation cannot be changed with different content under the same key.'));return existing;}
    const created=Object.freeze({clientOperationId:operationId(),expectedRevision,requestFingerprint});pending.current.set(key,created);return created;};
  const mutate=async(key:string,command:Command,success:string)=>{const bridge=window.pardus;if(!bridge||!center)return;
    setBusy(key);setOperationError('');setNotice('');try{const operation=getOperation(key,center.revision,command);
      await bridge.applyCommunicationFileSharingCommand({clientOperationId:operation.clientOperationId,
        expectedRevision:operation.expectedRevision,command});pending.current.delete(key);setNotice(success);await refresh();
    }catch(caught){setOperationError(`${errorText(caught,text('Dosya paylaşım işlemi tamamlanamadı.','The file sharing operation could not be completed.'))} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation identifier.')}`);}
    finally{setBusy('');}};
  const selectFile=async()=>{const bridge=window.pardus;if(!bridge||!center)return;const payload={roomId:roomId.trim(),meetingId:meetingId.trim()};
    const key=`prepare:${payload.roomId}:${payload.meetingId}`;setBusy(key);setOperationError('');setNotice('');try{
      const operation=getOperation(key,center.revision,payload);const result=await bridge.selectAndPrepareCommunicationFile({
        clientOperationId:operation.clientOperationId,expectedRevision:operation.expectedRevision,
        ...(payload.roomId?{roomId:payload.roomId}:{}),...(payload.meetingId?{meetingId:payload.meetingId}:{})});
      if('canceled'in result){pending.current.delete(key);setNotice(text('Dosya seçimi iptal edildi; hiçbir içerik okunmadı veya yazılmadı.','File selection was canceled; no content was read or written.'));return;}
      pending.current.delete(key);setNotice(result.commandKind==='prepare_file'
        ?text('Dosya ana süreçte yerel olarak şifrelendi; tarama sağlayıcısı yoksa paylaşım kapalı kalır.','The file was encrypted locally in the main process; sharing stays disabled when a scan provider is unavailable.')
        :text('Dosya işlemi tamamlandı.','The file operation was completed.'));await refresh();
    }catch(caught){setOperationError(`${errorText(caught,text('Yerel dosya hazırlığı tamamlanamadı.','Local file preparation could not be completed.'))} ${text('Yeniden denemede aynı dosyayı seçin.','Select the same file when retrying.')}`);}
    finally{setBusy('');}};
  const addComment=(file:FileView)=>{const body=globalThis.prompt(text('Dosya yorumu:','File comment:'),'')?.normalize('NFKC').trim();if(!body)return;
    void mutate(`comment:${file.id}:${body}`,{kind:'add_comment',fileId:file.id,commentId:`comment-${globalThis.crypto.randomUUID()}`,body},text('Yorum yerel metadata olarak eklendi.','The comment was added as local metadata.'));};
  const grantAccess=(file:FileView)=>{const personId=globalThis.prompt(text('Erişim verilecek kişi kimliği:','Identifier of the person to receive access:'),'')?.trim();if(!personId)return;
    void mutate(`grant:${file.id}:${personId}:${accessMode}`,{kind:'grant_access',fileId:file.id,
      grantId:`grant-${globalThis.crypto.randomUUID()}`,personId,mode:accessMode,startsAt:new Date().toISOString(),endsAt:futureIso(24*60)},
    text('24 saatlik yerel erişim kararı kaydedildi; uzak teslim yapılmadı.','A 24-hour local access decision was recorded; no remote delivery occurred.'));};
  const openPreview=async(file:FileView)=>{const bridge=window.pardus;if(!bridge)return;const key=`preview:${file.id}`;
    setBusy(key);setOperationError('');setNotice('');try{setPreview(await bridge.getCommunicationFileSafePreview({fileId:file.id}));
      setNotice(text('Temiz dosya yalnız kaçışlanmış düz metin olarak yerel kasadan açıldı.','The clean file was opened from the local vault as escaped plain text only.'));}
    catch(caught){setPreview(undefined);setOperationError(errorText(caught,text('Güvenli dosya önizlemesi açılamadı.','Safe file preview could not be opened.')));}
    finally{setBusy('');}};
  const linkArchive=(file:FileView)=>{const archiveItemId=globalThis.prompt(text('Tek arşiv kopyası kimliği:','Single archive copy identifier:'),'')?.trim();if(!archiveItemId)return;
    void mutate(`archive:${file.id}:${archiveItemId}`,{kind:'link_archive',fileId:file.id,archiveItemId},text('Tek arşiv kopyası bağlantısı kaydedildi.','The single archive copy binding was recorded.'));};
  const updateAlbum=(file:FileView)=>{const albumId=globalThis.prompt(text('Albüm kimliği:','Album identifier:'),'')?.trim();if(!albumId)return;
    void mutate(`album:${file.id}:${albumId}`,{kind:'update_album',fileId:file.id,albumId,selectedForStory:true,likedByPersonIds:[]},
      text('Albüm ve aile hikâyesi seçimi yalnız yerel metadata olarak kaydedildi.','The album and family-story selection was recorded as local metadata only.'));};
  const notificationsChanged=Boolean(center&&(center.notificationProfile.quietHoursEnabled!==quietEnabled
    ||center.notificationProfile.quietHoursStart!==quietStart||center.notificationProfile.quietHoursEnd!==quietEnd
    ||center.notificationProfile.nonEmergencyDigestEnabled!==digestEnabled));
  const saveNotifications=()=>center&&notificationsChanged&&void mutate(`notifications:${center.revision}`,{kind:'set_notifications',quietHoursEnabled:quietEnabled,
    quietHoursStart:quietStart,quietHoursEnd:quietEnd,nonEmergencyDigestEnabled:digestEnabled,roomOverrides:[],personOverrides:[]},
    text('Sessiz saatler ve acil olmayan özet kararı kaydedildi.','Quiet hours and the non-emergency digest decision were recorded.'));
  const announce=()=>emergencyTitle.trim()&&void mutate(`emergency:${emergencyTitle.trim()}`,{kind:'announce_emergency',
    announcementId:`announcement-${globalThis.crypto.randomUUID()}`,title:emergencyTitle.normalize('NFKC').trim()},
    text('Acil aile duyurusu yerel olarak kaydedildi; acil servis teslim garantisi yoktur.','The family emergency announcement was recorded locally; emergency-service delivery is not guaranteed.'));
  const requestAssistance=()=>helperPersonId.trim()&&void mutate(`remote:${helperPersonId.trim()}`,{kind:'request_remote_assistance',
    sessionId:`remote-${globalThis.crypto.randomUUID()}`,helperPersonId:helperPersonId.trim(),allowedControls:['pointer','annotate'],endsAt:futureIso(30)},
    text('Tek kullanımlık rıza bekleyen yerel yardım planı oluşturuldu; transport başlatılmadı.','A local assistance plan awaiting single-use consent was created; no transport was started.'));
  const planCoWatch=()=>coWatchReference.trim()&&void mutate(`cowatch:${coWatchReference.trim()}`,{kind:'plan_co_watch',
    sessionId:`cowatch-${globalThis.crypto.randomUUID()}`,mediaReference:coWatchReference.normalize('NFKC').trim(),narrationEnabled:true},
    text('Birlikte izleme yerel planı oluşturuldu; SharePlay çağrılmadı.','A local co-watching plan was created; SharePlay was not called.'));
  const prepareVoice=()=>voiceTarget.trim()&&void mutate(`voice:${voiceTarget.trim()}`,{kind:'prepare_voice_action',
    actionId:`voice-${globalThis.crypto.randomUUID()}`,action:'send_message',targetReference:voiceTarget.normalize('NFKC').trim()},
    text('Sesli işlem yalnız açık onay bekleyen yerel plana dönüştürüldü.','The voice action was converted into a local plan awaiting explicit confirmation.'));

  if(loading&&!center)return <AsyncStatePanel state="loading" title={text('Dosya paylaşımı yükleniyor','Loading file sharing')} message={text('Yerel şifreli dosya metadata kayıtları okunuyor.','Reading local encrypted file metadata records.')}/>;
  if(loadError&&!center)return <AsyncStatePanel state="error" title={text('Dosya paylaşımı yüklenemedi','File sharing could not be loaded')} message={loadError} onRetry={async()=>refresh(true)}/>;
  if(!center)return <AsyncStatePanel state="empty" title={text('Dosya paylaşımı kullanılamıyor','File sharing is unavailable')} message={text('Masaüstü yetki sınırı hazır değil.','The desktop authorization boundary is not ready.')}/>;

  return <section className="communication-file-sharing panel" aria-labelledby="communication-file-sharing-title" aria-busy={Boolean(busy)}>
    <div className="panel-heading"><div><span className="eyebrow">{text('Yerel şifreli dosya ve iletişim deneyimi','Local encrypted files and communication experience')}</span>
      <h2 id="communication-file-sharing-title">{text('Dosya paylaşımı ve aile iletişim araçları','File sharing and family communication tools')}</h2>
      <p>{text('Dosya baytları yalnız ana süreçte seçilir, 4 MiB parçalarla doğrulanır ve ayrı korumalı kasada şifrelenir.','File bytes are selected only in the main process, verified in 4 MiB chunks and encrypted in a separate protected vault.')}</p></div>
      <Button onClick={()=>void refresh()} disabled={Boolean(busy)}>{text('Yenile','Refresh')}</Button></div>
    <div className="communication-recording-truth" role="note"><strong>{text('Üretim dosya aktarımı ve zararlı dosya tarayıcısı yapılandırılmamıştır.','Production file transfer and malware scanning are not configured.')}</strong>
      <span>{text('Tarama sağlayıcısı yoksa dosya “provider_unavailable” kalır ve erişim verilmez. Ekran yol, ham bayt, hash veya kasa referansı almaz.','Without a scan provider, the file remains “provider_unavailable” and access is denied. The screen receives no path, raw bytes, hash or vault reference.')}</span>
      <span>{text('Haricî link kapalıdır. Uzaktan yardım, SharePlay ve sesli işlem sağlayıcıları yoktur; yalnız rıza ve açık onay gerektiren yerel planlar tutulur.','External links are disabled. Remote assistance, SharePlay and voice-action providers are unavailable; only local plans requiring consent and explicit confirmation are stored.')}</span>
      <span>{text('Acil aile duyurusu acil servis değildir; ağ, bulut veya uzak teslim kanıtı üretilmez.','A family emergency announcement is not an emergency service; no network, cloud or remote-delivery evidence is produced.')}</span></div>
    {loadError&&<StatusMessage tone="warning">{text('Kayıt yapılmış olabilir ancak görünüm yenilenemedi:','A record may have been written, but the view could not be refreshed:')} {loadError}</StatusMessage>}
    {operationError&&<StatusMessage tone="warning">{operationError}</StatusMessage>}{notice&&<StatusMessage tone="success">{notice}</StatusMessage>}

    <div className="communication-file-sharing-grid"><form onSubmit={(event)=>{event.preventDefault();void selectFile();}}>
      <h3>{text('Ana süreçte dosya seç','Select a file in the main process')}</h3><label>{text('Oda kimliği','Room identifier')}<input value={roomId} onChange={(event)=>setRoomId(event.target.value)} maxLength={256}/></label>
      <label>{text('Toplantı kimliği (isteğe bağlı)','Meeting identifier (optional)')}<input value={meetingId} onChange={(event)=>setMeetingId(event.target.value)} maxLength={256}/></label>
      <Button type="submit" tone="primary" disabled={Boolean(busy)||(!roomId.trim()&&!meetingId.trim())}>{text('Dosya seç ve yerel olarak şifrele','Select and encrypt locally')}</Button>
      <small>{text('Seçici ana süreçte açılır. En fazla 64 MiB; PDF, görsel, MP4 ve sınırlı metin dosyaları kabul edilir.','The picker opens in the main process. Up to 64 MiB; PDF, image, MP4 and limited text formats are accepted.')}</small></form>
      <form onSubmit={(event)=>{event.preventDefault();saveNotifications();}}><h3>{text('Bildirim ve sessiz saatler','Notifications and quiet hours')}</h3>
        <label><input type="checkbox" checked={quietEnabled} onChange={(event)=>setQuietEnabled(event.target.checked)}/>{text('Sessiz saatleri etkinleştir','Enable quiet hours')}</label>
        <label>{text('Başlangıç','Start')}<input type="time" value={quietStart} onChange={(event)=>setQuietStart(event.target.value)}/></label>
        <label>{text('Bitiş','End')}<input type="time" value={quietEnd} onChange={(event)=>setQuietEnd(event.target.value)}/></label>
        <label><input type="checkbox" checked={digestEnabled} onChange={(event)=>setDigestEnabled(event.target.checked)}/>{text('Acil olmayan yerel özet','Local non-emergency digest')}</label>
        <Button type="submit" disabled={Boolean(busy)||!notificationsChanged}>{text('Kararı kaydet','Save decision')}</Button></form></div>

    <section><h3>{text('Yerel dosya kayıtları','Local file records')}</h3>{center.files.length===0?<EmptyState title={text('Dosya yok','No files')} body={text('İlk dosyayı ana süreç seçicisiyle yerel kasaya mühürleyin.','Seal the first file in the local vault with the main-process picker.')}/>:
      <div className="communication-file-sharing-list">{center.files.map((file)=><article key={file.id}>
        <header><div><strong>{file.displayName}</strong><span>{file.mimeType} · {(file.totalBytes/1024).toFixed(1)} KiB</span></div>
          <b>{file.state} / {file.scanState}</b></header><p>{file.verifiedChunkCount}/{file.totalChunks} {text('parça doğrulandı','chunks verified')} · {file.versionCount} {text('sürüm','versions')} · {text('merkez sürümü','center revision')} {center.revision}</p>
        <div className="communication-file-sharing-actions"><Button disabled={Boolean(busy)||file.state==='revoked'} onClick={()=>addComment(file)}>{text('Yorum ekle','Add comment')}</Button>
          <Button disabled={Boolean(busy)||file.state!=='ready_local'||file.scanState!=='clean'
            ||!['text/plain','text/markdown','text/csv','application/json'].includes(file.mimeType)||file.totalBytes>256*1024}
            onClick={()=>void openPreview(file)}>{text('Güvenli düz metin önizleme','Safe plain-text preview')}</Button>
          <label>{text('Erişim','Access')}<select value={accessMode} onChange={(event)=>setAccessMode(event.target.value as typeof accessMode)}><option value="preview_only">{text('Yalnız önizleme','Preview only')}</option><option value="download">{text('İndirme','Download')}</option></select></label>
          <Button disabled={Boolean(busy)||file.scanState!=='clean'||file.state==='revoked'} onClick={()=>grantAccess(file)}>{text('24 saat erişim ver','Grant access for 24 hours')}</Button>
          <Button disabled={Boolean(busy)||file.state==='revoked'} onClick={()=>linkArchive(file)}>{text('Arşive bağla','Link to archive')}</Button>
          <Button disabled={Boolean(busy)||file.state==='revoked'} onClick={()=>updateAlbum(file)}>{text('Albüme ve hikâyeye seç','Select for album and story')}</Button>
          <Button disabled={Boolean(busy)||file.state==='revoked'} onClick={()=>void mutate(`revoke:${file.id}`,{kind:'revoke_share',fileId:file.id},text('Paylaşım yerel olarak iptal edildi; uzak silme iddiası yoktur.','Sharing was revoked locally; no remote deletion is claimed.'))}>{text('Paylaşımı iptal et','Revoke sharing')}</Button></div>
        {file.comments.length>0&&<ul>{file.comments.map((comment)=><li key={comment.id}>{comment.body}</li>)}</ul>}
        {preview?.fileId===file.id&&<section className="communication-file-safe-preview" aria-label={`${preview.displayName} ${text('güvenli önizlemesi','safe preview')}`}>
          <header><strong>{text('Kaçışlanmış yerel düz metin','Escaped local plain text')}</strong><Button onClick={()=>setPreview(undefined)}>{text('Kapat','Close')}</Button></header>
          <pre>{preview.text}</pre><small>{preview.totalBytes} {text('bayt · ağ yok · bulut yok · indirme yok','bytes · no network · no cloud · no download')}</small></section>}
        {file.accessGrants.length>0&&<small>{file.accessGrants.filter((grant)=>!grant.revokedAt).length} {text('etkin süreli erişim kararı','active time-limited access decisions')}</small>}
      </article>)}</div>}</section>

    <div className="communication-file-sharing-grid"><form onSubmit={(event)=>{event.preventDefault();announce();}}><h3>{text('Acil aile duyurusu','Family emergency announcement')}</h3>
      <label>{text('Duyuru','Announcement')}<input value={emergencyTitle} maxLength={500} onChange={(event)=>setEmergencyTitle(event.target.value)}/></label>
      <Button type="submit" disabled={Boolean(busy)||emergencyTitle.trim().length<2}>{text('Yerel duyuru oluştur','Create local announcement')}</Button>
      <div>{center.emergencyAnnouncements.map((item)=><p key={item.id}><strong>{item.title}</strong> · {item.acknowledgedPersonIds.length} {text('onay','acknowledgements')}
        <Button disabled={Boolean(busy)||item.acknowledgedPersonIds.length>0} onClick={()=>void mutate(`ack:${item.id}`,{kind:'acknowledge_emergency',announcementId:item.id},text('Duyuru yerel olarak onaylandı.','The announcement was acknowledged locally.'))}>{text('Onayla','Acknowledge')}</Button></p>)}</div></form>
      <form onSubmit={(event)=>{event.preventDefault();requestAssistance();}}><h3>{text('Uzaktan yardım rıza planı','Remote-assistance consent plan')}</h3>
        <label>{text('Yardımcı kişi kimliği','Helper person identifier')}<input value={helperPersonId} onChange={(event)=>setHelperPersonId(event.target.value)}/></label>
        <Button type="submit" disabled={Boolean(busy)||!helperPersonId.trim()}>{text('30 dakikalık rıza isteği','Request 30-minute consent')}</Button>
        {center.remoteAssistance.map((item)=><p key={item.id}><strong>{item.state}</strong> · {text('transport yok','no transport')}
          {item.state==='consent_pending'&&<Button disabled={Boolean(busy)} onClick={()=>void mutate(`grant-remote:${item.id}`,{kind:'grant_remote_assistance',sessionId:item.id,explicitSingleUseConsent:true},text('Tek kullanımlık rıza kaydedildi; transport yine başlatılmadı.','Single-use consent was recorded; transport was still not started.'))}>{text('Açık rıza ver','Give explicit consent')}</Button>}
          {!['revoked','expired'].includes(item.state)&&<Button disabled={Boolean(busy)} onClick={()=>void mutate(`revoke-remote:${item.id}`,{kind:'revoke_remote_assistance',sessionId:item.id},text('Yardım planı anında yerel olarak iptal edildi.','The assistance plan was immediately revoked locally.'))}>{text('İptal et','Revoke')}</Button>}</p>)}</form>
      <form onSubmit={(event)=>{event.preventDefault();planCoWatch();}}><h3>{text('Birlikte izleme planı','Co-watching plan')}</h3>
        <label>{text('Medya referansı','Media reference')}<input value={coWatchReference} onChange={(event)=>setCoWatchReference(event.target.value)} maxLength={500}/></label>
        <Button type="submit" disabled={Boolean(busy)||coWatchReference.trim().length<2}>{text('Yerel plan oluştur','Create local plan')}</Button>
        <small>{text('SharePlay sağlayıcısı çağrılmaz; ekran anlatımı tercihi metadata olarak tutulur.','The SharePlay provider is not called; the screen narration preference is stored as metadata.')}</small></form>
      <form onSubmit={(event)=>{event.preventDefault();prepareVoice();}}><h3>{text('Sesli işlem doğrulaması','Voice-action verification')}</h3>
        <label>{text('Hedef referans','Target reference')}<input value={voiceTarget} onChange={(event)=>setVoiceTarget(event.target.value)} maxLength={500}/></label>
        <Button type="submit" disabled={Boolean(busy)||voiceTarget.trim().length<2}>{text('Onay bekleyen işlem hazırla','Prepare action awaiting confirmation')}</Button>
        {center.voiceActions.map((item)=><p key={item.id}><strong>{item.action}</strong> · {item.state}
          {item.state==='confirmation_required'&&<Button disabled={Boolean(busy)} onClick={()=>void mutate(`confirm-voice:${item.id}`,{kind:'confirm_voice_action',actionId:item.id,explicitConfirmation:true},text('Sesli işlem yerel olarak onaylandı; dışarıda yürütülmedi.','The voice action was confirmed locally and not executed externally.'))}>{text('Açıkça onayla','Confirm explicitly')}</Button>}</p>)}</form></div>
  </section>;
}
