import { useEffect, useRef, useState } from 'react';
import { AsyncStatePanel } from './form-ux';
import { Button, EmptyState, StatusMessage } from './ui';

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
  const [emergencyTitle,setEmergencyTitle]=useState('Aile içi acil durum duyurusu');
  const [helperPersonId,setHelperPersonId]=useState('');
  const [coWatchReference,setCoWatchReference]=useState('');
  const [voiceTarget,setVoiceTarget]=useState('');
  const pending=useRef(new Map<string,PendingOperation>());

  const refresh=async(initial=false)=>{const bridge=window.pardus;if(!bridge){setLoading(false);setLoadError('Masaüstü köprüsü kullanılamıyor.');return;}
    if(initial)setLoading(true);setLoadError('');try{const value=await bridge.getCommunicationFileSharingCenter();setCenter(value);
      setQuietEnabled(value.notificationProfile.quietHoursEnabled);setQuietStart(value.notificationProfile.quietHoursStart);
      setQuietEnd(value.notificationProfile.quietHoursEnd);setDigestEnabled(value.notificationProfile.nonEmergencyDigestEnabled);
    }catch(caught){setLoadError(errorText(caught,'Dosya paylaşım merkezi yüklenemedi.'));}finally{setLoading(false);}};
  useEffect(()=>{void refresh(true);},[]);

  const getOperation=(key:string,expectedRevision:number,payload:unknown):PendingOperation=>{const requestFingerprint=fingerprint(payload);
    const existing=pending.current.get(key);if(existing){if(existing.requestFingerprint!==requestFingerprint)
      throw new Error('Bekleyen işlem aynı anahtarda farklı içerikle değiştirilemez.');return existing;}
    const created=Object.freeze({clientOperationId:operationId(),expectedRevision,requestFingerprint});pending.current.set(key,created);return created;};
  const mutate=async(key:string,command:Command,success:string)=>{const bridge=window.pardus;if(!bridge||!center)return;
    setBusy(key);setOperationError('');setNotice('');try{const operation=getOperation(key,center.revision,command);
      await bridge.applyCommunicationFileSharingCommand({clientOperationId:operation.clientOperationId,
        expectedRevision:operation.expectedRevision,command});pending.current.delete(key);setNotice(success);await refresh();
    }catch(caught){setOperationError(`${errorText(caught,'Dosya paylaşım işlemi tamamlanamadı.')} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`);}
    finally{setBusy('');}};
  const selectFile=async()=>{const bridge=window.pardus;if(!bridge||!center)return;const payload={roomId:roomId.trim(),meetingId:meetingId.trim()};
    const key=`prepare:${payload.roomId}:${payload.meetingId}`;setBusy(key);setOperationError('');setNotice('');try{
      const operation=getOperation(key,center.revision,payload);const result=await bridge.selectAndPrepareCommunicationFile({
        clientOperationId:operation.clientOperationId,expectedRevision:operation.expectedRevision,
        ...(payload.roomId?{roomId:payload.roomId}:{}),...(payload.meetingId?{meetingId:payload.meetingId}:{})});
      if('canceled'in result){pending.current.delete(key);setNotice('Dosya seçimi iptal edildi; hiçbir içerik okunmadı veya yazılmadı.');return;}
      pending.current.delete(key);setNotice(result.commandKind==='prepare_file'
        ?'Dosya ana süreçte yerel olarak şifrelendi; tarama sağlayıcısı yoksa paylaşım kapalı kalır.':'Dosya işlemi tamamlandı.');await refresh();
    }catch(caught){setOperationError(`${errorText(caught,'Yerel dosya hazırlığı tamamlanamadı.')} Yeniden denemede aynı dosyayı seçin.`);}
    finally{setBusy('');}};
  const addComment=(file:FileView)=>{const body=globalThis.prompt('Dosya yorumu:','')?.normalize('NFKC').trim();if(!body)return;
    void mutate(`comment:${file.id}:${body}`,{kind:'add_comment',fileId:file.id,commentId:`comment-${globalThis.crypto.randomUUID()}`,body},'Yorum yerel metadata olarak eklendi.');};
  const grantAccess=(file:FileView)=>{const personId=globalThis.prompt('Erişim verilecek kişi kimliği:','')?.trim();if(!personId)return;
    void mutate(`grant:${file.id}:${personId}:${accessMode}`,{kind:'grant_access',fileId:file.id,
      grantId:`grant-${globalThis.crypto.randomUUID()}`,personId,mode:accessMode,startsAt:new Date().toISOString(),endsAt:futureIso(24*60)},
    '24 saatlik yerel erişim kararı kaydedildi; uzak teslim yapılmadı.');};
  const openPreview=async(file:FileView)=>{const bridge=window.pardus;if(!bridge)return;const key=`preview:${file.id}`;
    setBusy(key);setOperationError('');setNotice('');try{setPreview(await bridge.getCommunicationFileSafePreview({fileId:file.id}));
      setNotice('Temiz dosya yalnız kaçışlanmış düz metin olarak yerel kasadan açıldı.');}
    catch(caught){setPreview(undefined);setOperationError(errorText(caught,'Güvenli dosya önizlemesi açılamadı.'));}
    finally{setBusy('');}};
  const linkArchive=(file:FileView)=>{const archiveItemId=globalThis.prompt('Tek arşiv kopyası kimliği:','')?.trim();if(!archiveItemId)return;
    void mutate(`archive:${file.id}:${archiveItemId}`,{kind:'link_archive',fileId:file.id,archiveItemId},'Tek arşiv kopyası bağlantısı kaydedildi.');};
  const updateAlbum=(file:FileView)=>{const albumId=globalThis.prompt('Albüm kimliği:','')?.trim();if(!albumId)return;
    void mutate(`album:${file.id}:${albumId}`,{kind:'update_album',fileId:file.id,albumId,selectedForStory:true,likedByPersonIds:[]},
      'Albüm ve aile hikâyesi seçimi yalnız yerel metadata olarak kaydedildi.');};
  const saveNotifications=()=>center&&void mutate(`notifications:${center.revision}`,{kind:'set_notifications',quietHoursEnabled:quietEnabled,
    quietHoursStart:quietStart,quietHoursEnd:quietEnd,nonEmergencyDigestEnabled:digestEnabled,roomOverrides:[],personOverrides:[]},
    'Sessiz saatler ve acil olmayan özet kararı kaydedildi.');
  const announce=()=>emergencyTitle.trim()&&void mutate(`emergency:${emergencyTitle.trim()}`,{kind:'announce_emergency',
    announcementId:`announcement-${globalThis.crypto.randomUUID()}`,title:emergencyTitle.normalize('NFKC').trim()},
    'Acil aile duyurusu yerel olarak kaydedildi; acil servis teslim garantisi yoktur.');
  const requestAssistance=()=>helperPersonId.trim()&&void mutate(`remote:${helperPersonId.trim()}`,{kind:'request_remote_assistance',
    sessionId:`remote-${globalThis.crypto.randomUUID()}`,helperPersonId:helperPersonId.trim(),allowedControls:['pointer','annotate'],endsAt:futureIso(30)},
    'Tek kullanımlık rıza bekleyen yerel yardım planı oluşturuldu; transport başlatılmadı.');
  const planCoWatch=()=>coWatchReference.trim()&&void mutate(`cowatch:${coWatchReference.trim()}`,{kind:'plan_co_watch',
    sessionId:`cowatch-${globalThis.crypto.randomUUID()}`,mediaReference:coWatchReference.normalize('NFKC').trim(),narrationEnabled:true},
    'Birlikte izleme yerel planı oluşturuldu; SharePlay çağrılmadı.');
  const prepareVoice=()=>voiceTarget.trim()&&void mutate(`voice:${voiceTarget.trim()}`,{kind:'prepare_voice_action',
    actionId:`voice-${globalThis.crypto.randomUUID()}`,action:'send_message',targetReference:voiceTarget.normalize('NFKC').trim()},
    'Sesli işlem yalnız açık onay bekleyen yerel plana dönüştürüldü.');

  if(loading&&!center)return <AsyncStatePanel state="loading" title="Dosya paylaşımı yükleniyor" message="Yerel şifreli dosya metadata kayıtları okunuyor."/>;
  if(loadError&&!center)return <AsyncStatePanel state="error" title="Dosya paylaşımı yüklenemedi" message={loadError} onRetry={async()=>refresh(true)}/>;
  if(!center)return <AsyncStatePanel state="empty" title="Dosya paylaşımı kullanılamıyor" message="Masaüstü yetki sınırı hazır değil."/>;

  return <section className="communication-file-sharing panel" aria-labelledby="communication-file-sharing-title" aria-busy={Boolean(busy)}>
    <div className="panel-heading"><div><span className="eyebrow">34-G · Yerel şifreli dosya ve iletişim UX</span>
      <h2 id="communication-file-sharing-title">Dosya paylaşımı ve aile iletişim araçları</h2>
      <p>Dosya baytları yalnız ana süreçte seçilir, 4 MiB parçalarla doğrulanır ve ayrı korumalı kasada şifrelenir.</p></div>
      <Button onClick={()=>void refresh()} disabled={Boolean(busy)}>Yenile</Button></div>
    <div className="communication-recording-truth" role="note"><strong>Üretim dosya aktarımı ve zararlı dosya tarayıcısı yapılandırılmamıştır.</strong>
      <span>Tarama sağlayıcısı yoksa dosya “provider_unavailable” kalır ve erişim verilmez. Ekran yol, ham bayt, hash veya kasa referansı almaz.</span>
      <span>Haricî link kapalıdır. Uzaktan yardım, SharePlay ve sesli işlem sağlayıcıları yoktur; yalnız rıza ve açık onay gerektiren yerel planlar tutulur.</span>
      <span>Acil aile duyurusu acil servis değildir; ağ, bulut veya uzak teslim kanıtı üretilmez.</span></div>
    {loadError&&<StatusMessage tone="warning">Kayıt yapılmış olabilir ancak görünüm yenilenemedi: {loadError}</StatusMessage>}
    {operationError&&<StatusMessage tone="warning">{operationError}</StatusMessage>}{notice&&<StatusMessage tone="success">{notice}</StatusMessage>}

    <div className="communication-file-sharing-grid"><form onSubmit={(event)=>{event.preventDefault();void selectFile();}}>
      <h3>Ana süreçte dosya seç</h3><label>Oda kimliği<input value={roomId} onChange={(event)=>setRoomId(event.target.value)} maxLength={256}/></label>
      <label>Toplantı kimliği (isteğe bağlı)<input value={meetingId} onChange={(event)=>setMeetingId(event.target.value)} maxLength={256}/></label>
      <Button type="submit" tone="primary" disabled={Boolean(busy)||(!roomId.trim()&&!meetingId.trim())}>Dosya seç ve yerel olarak şifrele</Button>
      <small>Seçici ana süreçte açılır. En fazla 64 MiB; PDF, görsel, MP4 ve sınırlı metin dosyaları kabul edilir.</small></form>
      <form onSubmit={(event)=>{event.preventDefault();saveNotifications();}}><h3>Bildirim ve sessiz saatler</h3>
        <label><input type="checkbox" checked={quietEnabled} onChange={(event)=>setQuietEnabled(event.target.checked)}/>Sessiz saatleri etkinleştir</label>
        <label>Başlangıç<input type="time" value={quietStart} onChange={(event)=>setQuietStart(event.target.value)}/></label>
        <label>Bitiş<input type="time" value={quietEnd} onChange={(event)=>setQuietEnd(event.target.value)}/></label>
        <label><input type="checkbox" checked={digestEnabled} onChange={(event)=>setDigestEnabled(event.target.checked)}/>Acil olmayan yerel özet</label>
        <Button type="submit" disabled={Boolean(busy)}>Kararı kaydet</Button></form></div>

    <section><h3>Yerel dosya kayıtları</h3>{center.files.length===0?<EmptyState title="Dosya yok" body="İlk dosyayı ana süreç seçicisiyle yerel kasaya mühürleyin."/>:
      <div className="communication-file-sharing-list">{center.files.map((file)=><article key={file.id}>
        <header><div><strong>{file.displayName}</strong><span>{file.mimeType} · {(file.totalBytes/1024).toFixed(1)} KiB</span></div>
          <b>{file.state} / {file.scanState}</b></header><p>{file.verifiedChunkCount}/{file.totalChunks} parça doğrulandı · {file.versionCount} sürüm · merkez sürümü {center.revision}</p>
        <div className="communication-file-sharing-actions"><Button disabled={Boolean(busy)||file.state==='revoked'} onClick={()=>addComment(file)}>Yorum ekle</Button>
          <Button disabled={Boolean(busy)||file.state!=='ready_local'||file.scanState!=='clean'
            ||!['text/plain','text/markdown','text/csv','application/json'].includes(file.mimeType)||file.totalBytes>256*1024}
            onClick={()=>void openPreview(file)}>Güvenli düz metin önizleme</Button>
          <label>Erişim<select value={accessMode} onChange={(event)=>setAccessMode(event.target.value as typeof accessMode)}><option value="preview_only">Yalnız önizleme</option><option value="download">İndirme</option></select></label>
          <Button disabled={Boolean(busy)||file.scanState!=='clean'||file.state==='revoked'} onClick={()=>grantAccess(file)}>24 saat erişim ver</Button>
          <Button disabled={Boolean(busy)||file.state==='revoked'} onClick={()=>linkArchive(file)}>Arşive bağla</Button>
          <Button disabled={Boolean(busy)||file.state==='revoked'} onClick={()=>updateAlbum(file)}>Albüme ve hikâyeye seç</Button>
          <Button disabled={Boolean(busy)||file.state==='revoked'} onClick={()=>void mutate(`revoke:${file.id}`,{kind:'revoke_share',fileId:file.id},'Paylaşım yerel olarak iptal edildi; uzak silme iddiası yoktur.')}>Paylaşımı iptal et</Button></div>
        {file.comments.length>0&&<ul>{file.comments.map((comment)=><li key={comment.id}>{comment.body}</li>)}</ul>}
        {preview?.fileId===file.id&&<section className="communication-file-safe-preview" aria-label={`${preview.displayName} güvenli önizlemesi`}>
          <header><strong>Kaçışlanmış yerel düz metin</strong><Button onClick={()=>setPreview(undefined)}>Kapat</Button></header>
          <pre>{preview.text}</pre><small>{preview.totalBytes} bayt · ağ yok · bulut yok · indirme yok</small></section>}
        {file.accessGrants.length>0&&<small>{file.accessGrants.filter((grant)=>!grant.revokedAt).length} etkin süreli erişim kararı</small>}
      </article>)}</div>}</section>

    <div className="communication-file-sharing-grid"><form onSubmit={(event)=>{event.preventDefault();announce();}}><h3>Acil aile duyurusu</h3>
      <label>Duyuru<input value={emergencyTitle} maxLength={500} onChange={(event)=>setEmergencyTitle(event.target.value)}/></label>
      <Button type="submit" disabled={Boolean(busy)||emergencyTitle.trim().length<2}>Yerel duyuru oluştur</Button>
      <div>{center.emergencyAnnouncements.map((item)=><p key={item.id}><strong>{item.title}</strong> · {item.acknowledgedPersonIds.length} onay
        <Button disabled={Boolean(busy)||item.acknowledgedPersonIds.length>0} onClick={()=>void mutate(`ack:${item.id}`,{kind:'acknowledge_emergency',announcementId:item.id},'Duyuru yerel olarak onaylandı.')}>Onayla</Button></p>)}</div></form>
      <form onSubmit={(event)=>{event.preventDefault();requestAssistance();}}><h3>Uzaktan yardım rıza planı</h3>
        <label>Yardımcı kişi kimliği<input value={helperPersonId} onChange={(event)=>setHelperPersonId(event.target.value)}/></label>
        <Button type="submit" disabled={Boolean(busy)||!helperPersonId.trim()}>30 dakikalık rıza isteği</Button>
        {center.remoteAssistance.map((item)=><p key={item.id}><strong>{item.state}</strong> · transport yok
          {item.state==='consent_pending'&&<Button disabled={Boolean(busy)} onClick={()=>void mutate(`grant-remote:${item.id}`,{kind:'grant_remote_assistance',sessionId:item.id,explicitSingleUseConsent:true},'Tek kullanımlık rıza kaydedildi; transport yine başlatılmadı.')}>Açık rıza ver</Button>}
          {!['revoked','expired'].includes(item.state)&&<Button disabled={Boolean(busy)} onClick={()=>void mutate(`revoke-remote:${item.id}`,{kind:'revoke_remote_assistance',sessionId:item.id},'Yardım planı anında yerel olarak iptal edildi.')}>İptal et</Button>}</p>)}</form>
      <form onSubmit={(event)=>{event.preventDefault();planCoWatch();}}><h3>Birlikte izleme planı</h3>
        <label>Medya referansı<input value={coWatchReference} onChange={(event)=>setCoWatchReference(event.target.value)} maxLength={500}/></label>
        <Button type="submit" disabled={Boolean(busy)||coWatchReference.trim().length<2}>Yerel plan oluştur</Button>
        <small>SharePlay sağlayıcısı çağrılmaz; ekran anlatımı tercihi metadata olarak tutulur.</small></form>
      <form onSubmit={(event)=>{event.preventDefault();prepareVoice();}}><h3>Sesli işlem doğrulaması</h3>
        <label>Hedef referans<input value={voiceTarget} onChange={(event)=>setVoiceTarget(event.target.value)} maxLength={500}/></label>
        <Button type="submit" disabled={Boolean(busy)||voiceTarget.trim().length<2}>Onay bekleyen işlem hazırla</Button>
        {center.voiceActions.map((item)=><p key={item.id}><strong>{item.action}</strong> · {item.state}
          {item.state==='confirmation_required'&&<Button disabled={Boolean(busy)} onClick={()=>void mutate(`confirm-voice:${item.id}`,{kind:'confirm_voice_action',actionId:item.id,explicitConfirmation:true},'Sesli işlem yerel olarak onaylandı; dışarıda yürütülmedi.')}>Açıkça onayla</Button>}</p>)}</form></div>
  </section>;
}
