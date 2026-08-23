import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunicationMessageContentView,
  CommunicationMessageContentKind,
  CommunicationMessageRetentionMode,
  CommunicationMessageView,
  CommunicationMessagingCenterView,
  CommunicationPresenceStatus,
  CommunicationRoomView
} from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';

const documentMimeTypes=new Set(['application/pdf','text/plain','application/json','text/csv']);
type RelationMode='none'|'reply'|'quote'|'thread';
interface PreparedAttachment{readonly fileId:string;readonly displayName:string;readonly mimeType:string;readonly state:string;readonly scanState:string}

export function CommunicationMessagingPanel(){
  const { language }=useLocalization();
  const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const presenceLabels:Record<CommunicationPresenceStatus,string>={
    online:text('Çevrimiçi','Online'),away:text('Uzakta','Away'),busy:text('Meşgul','Busy'),
    in_meeting:text('Toplantıda','In a meeting'),do_not_disturb:text('Rahatsız etmeyin','Do not disturb'),
    invisible:text('Görünmez','Invisible'),offline:text('Çevrimdışı','Offline')
  };
  const contentKindLabels:Record<CommunicationMessageContentKind,string>={
    text:text('Metin','Text'),voice:text('Sesli mesaj','Voice message'),photo:text('Fotoğraf','Photo'),
    video:text('Video','Video'),location:text('Konum','Location'),document:text('Belge','Document')
  };
  const [center,setCenter]=useState<CommunicationMessagingCenterView>();
  const [rooms,setRooms]=useState<readonly CommunicationRoomView[]>([]);
  const [selectedRoomId,setSelectedRoomId]=useState('');
  const [messageText,setMessageText]=useState('');
  const [contentKind,setContentKind]=useState<CommunicationMessageContentKind>('text');
  const [preparedAttachment,setPreparedAttachment]=useState<PreparedAttachment>();
  const [relationMode,setRelationMode]=useState<RelationMode>('none');
  const [relatedMessageId,setRelatedMessageId]=useState('');
  const [silent,setSilent]=useState(false);
  const [scheduleEnabled,setScheduleEnabled]=useState(false);
  const [scheduledAt,setScheduledAt]=useState('');
  const [searchText,setSearchText]=useState('');
  const [searchResults,setSearchResults]=useState<readonly CommunicationMessageView[]>();
  const [revealed,setRevealed]=useState<Record<string,CommunicationMessageContentView>>({});
  const [editDrafts,setEditDrafts]=useState<Record<string,string>>({});
  const [presenceStatus,setPresenceStatus]=useState<CommunicationPresenceStatus>('offline');
  const [retentionDays,setRetentionDays]=useState(30);
  const [retentionMode,setRetentionMode]=useState<CommunicationMessageRetentionMode>('duration');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const operations=useRef(new Map<string,string>());
  const operationId=(key:string)=>{const current=operations.current.get(key);if(current)return current;
    const next=crypto.randomUUID();operations.current.set(key,next);return next;};
  const refresh=async()=>{if(!window.pardus)return;setError('');try{
    const [messaging,security]=await Promise.all([
      window.pardus.getCommunicationMessagingCenter(),window.pardus.getCommunicationSecurityCenter()
    ]);setCenter(messaging);const active=security.rooms.filter(room=>room.status==='active');setRooms(active);
    setSelectedRoomId(current=>current&&active.some(room=>room.id===current)?current:active[0]?.id??'');
    setPresenceStatus(messaging.presence.status);
  }catch(caught){setError(caught instanceof Error?caught.message:text('Mesajlaşma merkezi yüklenemedi.','Messaging center could not be loaded.'));}};
  useEffect(()=>{void refresh();},[]);
  const messages=useMemo(()=>{
    const source=searchResults??center?.messages??[];return selectedRoomId?source.filter(item=>item.roomId===selectedRoomId):source;
  },[center,searchResults,selectedRoomId]);
  const retention=center?.retentionPolicies.find(item=>item.roomId===selectedRoomId);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{
    await run(operationId(key));operations.current.delete(key);setSearchResults(undefined);await refresh();
  }catch(caught){setError(caught instanceof Error?`${caught.message} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation identifier.')}`
    :text('Mesajlaşma değişikliği tamamlanamadı.','The messaging change could not be completed.'));}finally{setBusy('');}};
  const createMessage=()=>{if(!window.pardus||!selectedRoomId)return;const normalized=messageText.normalize('NFKC').trim();
    const textual=contentKind==='text'||contentKind==='location';if(textual&&!normalized)return;
    if(!textual&&!preparedAttachment)return;
    const relation=relationMode==='reply'?{replyToMessageId:relatedMessageId}:relationMode==='quote'?{quotedMessageId:relatedMessageId}
      :relationMode==='thread'?{threadRootMessageId:relatedMessageId}:{};
    const scheduledMs=scheduleEnabled?Date.parse(scheduledAt):Number.NaN;
    if(scheduleEnabled&&(!Number.isFinite(scheduledMs)||scheduledMs<=Date.now())){setError(text('Zamanlanmış mesaj gelecekte olmalıdır.','A scheduled message must be in the future.'));return;}
    const schedule=scheduleEnabled?{scheduledAt:new Date(scheduledMs).toISOString()}:{};
    const payload={roomId:selectedRoomId,contentKind,contentMime:contentKind==='text'?'text/plain'
      :contentKind==='location'?'application/vnd.ppt.location+text':preparedAttachment?.mimeType??'',
      ...(textual?{text:normalized}:{opaqueAttachmentHandle:preparedAttachment!.fileId}),...relation,...schedule,silent};
    void mutate(`create:${selectedRoomId}:${JSON.stringify(payload)}`,async clientOperationId=>{
      await window.pardus!.createCommunicationMessage({clientOperationId,expectedRevision:0,...payload});
      setMessageText('');setPreparedAttachment(undefined);setRelationMode('none');setRelatedMessageId('');
      setScheduleEnabled(false);setScheduledAt('');});};
  const selectAttachment=async()=>{if(!window.pardus||!selectedRoomId)return;setBusy('attachment');setError('');try{
    const fileCenter=await window.pardus.getCommunicationFileSharingCenter();const clientOperationId=operationId(`attachment:${selectedRoomId}:${contentKind}`);
    const selected=await window.pardus.selectAndPrepareCommunicationFile({clientOperationId,expectedRevision:fileCenter.revision,
      roomId:selectedRoomId});
    if('canceled'in selected){operations.current.delete(`attachment:${selectedRoomId}:${contentKind}`);setPreparedAttachment(undefined);return;}
    const priorIds=new Set(fileCenter.files.map(item=>item.id));const refreshed=await window.pardus.getCommunicationFileSharingCenter();
    const sameReceipt=refreshed.files.filter(item=>item.roomId===selectedRoomId&&item.createdAt===selected.occurredAt);
    const newlyCreated=sameReceipt.filter(item=>!priorIds.has(item.id));
    const candidates=newlyCreated.length===0&&selected.replayed?sameReceipt:newlyCreated;
    if(candidates.length!==1)throw new Error(text('Hazırlanan yerel dosya metadata kaydı tekil olarak doğrulanamadı.','The prepared local file metadata record could not be uniquely verified.'));
    const file=candidates[0]!;
    const allowed=contentKind==='voice'?file.mimeType.startsWith('audio/'):contentKind==='photo'?file.mimeType.startsWith('image/')
      :contentKind==='video'?file.mimeType.startsWith('video/'):contentKind==='document'&&documentMimeTypes.has(file.mimeType);
    if(!allowed)throw new Error(text(`Seçilen dosya ${contentKindLabels[contentKind]} türüyle uyuşmuyor.`,`The selected file does not match the ${contentKindLabels[contentKind]} type.`));
    if(file.state!=='ready_local'||file.scanState!=='clean')throw new Error(
      text('Dosya yerel olarak şifrelendi ancak temiz tarama kanıtı olmadığı için mesaja eklenemez.','The file was encrypted locally but cannot be attached because clean scan evidence is missing.'));
    operations.current.delete(`attachment:${selectedRoomId}:${contentKind}`);
    setPreparedAttachment({fileId:file.id,displayName:file.displayName,mimeType:file.mimeType,state:file.state,scanState:file.scanState});
  }catch(caught){setPreparedAttachment(undefined);setError(caught instanceof Error?caught.message:text('Dosya seçimi tamamlanamadı.','File selection could not be completed.'));}
  finally{setBusy('');}};
  const relate=(message:CommunicationMessageView,mode:Exclude<RelationMode,'none'>)=>{
    setRelationMode(mode);setRelatedMessageId(message.id);setSelectedRoomId(message.roomId);
  };
  const reveal=async(message:CommunicationMessageView)=>{if(!window.pardus||message.deleted)return;setBusy(`reveal:${message.id}`);setError('');try{
    const content=await window.pardus.getCommunicationMessageContent({messageId:message.id});setRevealed(current=>({...current,[message.id]:content}));
    if(content.text!==undefined)setEditDrafts(current=>({...current,[message.id]:content.text!}));
  }catch(caught){setError(caught instanceof Error?caught.message:text('Mesaj içeriği açılamadı.','Message content could not be opened.'));}finally{setBusy('');}};
  const hide=(messageId:string)=>{setRevealed(current=>{const next={...current};delete next[messageId];return next;});
    setEditDrafts(current=>{const next={...current};delete next[messageId];return next;});};
  const edit=(message:CommunicationMessageView)=>window.pardus&&editDrafts[message.id]?.trim()&&mutate(`edit:${message.id}:${message.revision}`,
    clientOperationId=>window.pardus!.editCommunicationMessage({clientOperationId,expectedRevision:message.revision,messageId:message.id,
      text:editDrafts[message.id]!.normalize('NFKC').trim(),reason:text('Kullanıcı mesaj metnini düzeltti.','The user corrected the message text.')}));
  const lifecycle=(message:CommunicationMessageView,action:'delete'|'restore')=>window.pardus&&mutate(
    `${action}:${message.id}:${message.revision}`,clientOperationId=>window.pardus!.setCommunicationMessageLifecycle({clientOperationId,
      expectedRevision:message.revision,messageId:message.id,action,reason:action==='delete'
        ?text('Kullanıcı mesajı yerel olarak sildi.','The user deleted the message locally.')
        :text('Kullanıcı mesajı yerel olarak geri aldı.','The user restored the message locally.')}));
  const annotate=(message:CommunicationMessageView,field:'pinned'|'bookmarked')=>window.pardus&&mutate(
    `${field}:${message.id}:${message.revision}`,clientOperationId=>window.pardus!.annotateCommunicationMessage({clientOperationId,
      expectedRevision:message.revision,messageId:message.id,[field]:!message[field]}));
  const react=(message:CommunicationMessageView)=>window.pardus&&mutate(`reaction:${message.id}:${message.revision}`,
    clientOperationId=>window.pardus!.annotateCommunicationMessage({clientOperationId,expectedRevision:message.revision,
      messageId:message.id,reactionCode:message.reactionCode==='heart'?'none':'heart'}));
  const delivery=(message:CommunicationMessageView)=>window.pardus&&mutate(`delivery:${message.id}:${message.revision}`,
    clientOperationId=>window.pardus!.updateCommunicationDelivery({clientOperationId,expectedRevision:message.revision,
      messageId:message.id,action:message.deliveryState==='queued_offline'||message.deliveryState==='retry_wait'?'retry':'queue_offline'}));
  const setPresence=()=>window.pardus&&center&&mutate(`presence:${center.presence.revision}:${presenceStatus}`,
    clientOperationId=>window.pardus!.setCommunicationPresence({clientOperationId,expectedRevision:center.presence.revision,
      status:presenceStatus,audience:presenceStatus==='invisible'?'nobody':'room_members',lastSeenShared:false,
      typingIndicatorsEnabled:false,readReceiptsEnabled:false,emergencyReachabilityEnabled:false}));
  const setRetention=()=>window.pardus&&selectedRoomId&&mutate(`retention:${selectedRoomId}:${retention?.revision??0}:${retentionDays}`,
    clientOperationId=>window.pardus!.setCommunicationRetentionPolicy({clientOperationId,expectedRevision:retention?.revision??0,
      roomId:selectedRoomId,mode:retentionMode,
      ...(['duration','auto_delete'].includes(retentionMode)?{durationDays:retentionDays}:{}),
      reason:retentionMode==='legal_hold'
        ?text('Kullanıcı hukuki koruma etiketini açıkça kaydetti.','The user explicitly recorded the legal-hold label.')
        :text('Kullanıcı yerel saklama kararını güncelledi.','The user updated the local retention decision.')}));
  const searchMessages=async()=>{if(!window.pardus)return;setBusy('search');setError('');try{
    setSearchResults(await window.pardus.searchCommunicationMessages({...searchText.trim()?{queryText:searchText.normalize('NFKC').trim()}: {},
      ...selectedRoomId?{roomId:selectedRoomId}:{},limit:200}));
  }catch(caught){setError(caught instanceof Error?caught.message:text('Mesaj araması tamamlanamadı.','Message search could not be completed.'));}finally{setBusy('');}};
  return <section className="communication-messaging panel" aria-labelledby="communication-messaging-title">
    <div className="panel-heading"><div><span className="eyebrow">{text('Mesaj yaşam döngüsü ve mahremiyet','Message lifecycle and private presence')}</span>
      <h2 id="communication-messaging-title">{text('Yerel, mühürlü mesajlaşma çalışma alanı','Local sealed messaging workspace')}</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>{text('Yenile','Refresh')}</button></div>
    <div className="communication-messaging-truth" role="note"><strong>{text('Bu sürüm yalnız yerel ve ağsız çalışır.','This release works locally and without network access only.')}</strong>
      <span>{text('Mesaj metni uygulama veritabanına yazılmaz; içerik yalnız açık kullanıcı eylemiyle korumalı kasadan okunur.','Message text is not written to the application database; content is read from the protected vault only after an explicit user action.')}</span>
      <span>{text('Relay teslimi, uzak alındı bilgisi, mesaj imzası, production MLS payload sağlayıcısı ve gerçek mesaj alışverişi uygulanmadı.','Relay delivery, remote receipts, message signatures, a production MLS payload provider and real message exchange are not implemented.')}</span>
      <span>{text('Dosya ekleri ana süreçte seçilir, temiz tarama kanıtıyla aynı odaya bağlanır ve korumalı yerel kasada kalır.','File attachments are selected in the main process, bound to the same room with clean scan evidence and kept in the protected local vault.')}</span>
      <span>{text('Zamanlanmış mesajlar ana süreçte yerel olarak yürütülür. Süre dolumu mantıksal silmedir; fiziksel güvenli silme ve yedeklerden yayılım garantisi yoktur, çoklu cihaz presence birleştirmesi de henüz uygulanmamıştır.','Scheduled messages are released locally by the main process. Expiry is a logical deletion; physical secure erasure and propagation to backups are not guaranteed, and multi-device presence merging is not implemented yet.')}</span></div>
    {error&&<p className="status-message danger">{error}</p>}
    {!center?<p>{text('Mesajlaşma merkezi yükleniyor…','Loading messaging center…')}</p>:<>
      <div className="communication-messaging-summary"><span><strong>{center.messages.length}</strong> {text('yerel mesaj metadata kaydı','local message metadata records')}</span>
        <span><strong>{center.retentionPolicies.length}</strong> {text('saklama kararı','retention decisions')}</span><span><strong>0</strong> {text('uzak teslim kanıtı','remote delivery evidence')}</span></div>
      <div className="communication-messaging-compose">
        <label>{text('Oda','Room')}<select value={selectedRoomId} onChange={event=>{setSelectedRoomId(event.target.value);setSearchResults(undefined);}}>
          <option value="">{text('Etkin oda seçin','Select an active room')}</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label>
        <label>{text('İçerik türü','Content type')}<select value={contentKind} onChange={event=>{setContentKind(event.target.value as CommunicationMessageContentKind);
          setPreparedAttachment(undefined);setMessageText('');}}>{Object.entries(contentKindLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        {(contentKind==='text'||contentKind==='location')?<label>{contentKind==='location'?text('Konum açıklaması veya koordinat','Location description or coordinates'):text('Mesaj','Message')}
          <textarea value={messageText} maxLength={contentKind==='location'?2_000:32_768} rows={3} onChange={event=>setMessageText(event.target.value)} /></label>:
          <div className="communication-messaging-attachment"><button type="button" disabled={Boolean(busy)||!selectedRoomId}
            onClick={()=>void selectAttachment()}>{text('Ana süreçte dosya seç ve şifrele','Select and encrypt a file in the main process')}</button>
            {preparedAttachment?<small>{preparedAttachment.displayName} · {preparedAttachment.mimeType} · {text('temiz yerel kayıt','clean local record')}</small>:
              <small>{text('Dosya yolu ve ham baytlar bu ekrana aktarılmaz.','File paths and raw bytes are not transferred to this screen.')}</small>}</div>}
        {relationMode!=='none'&&<div className="communication-messaging-relation" role="status">
          <span>{relationMode==='reply'?text('Yanıt','Reply'):relationMode==='quote'?text('Alıntı','Quote'):text('Konu dizisi','Thread')} {text('hedefi','target')}: {relatedMessageId}</span>
          <button type="button" onClick={()=>{setRelationMode('none');setRelatedMessageId('');}}>{text('İlişkiyi kaldır','Remove relation')}</button></div>}
        <label className="communication-messaging-check"><input type="checkbox" checked={silent} onChange={event=>setSilent(event.target.checked)} />{text('Sessiz metadata','Silent metadata')}</label>
        <label className="communication-messaging-check"><input type="checkbox" checked={scheduleEnabled}
          onChange={event=>setScheduleEnabled(event.target.checked)} />{text('Gelecek tarih için zamanla','Schedule for a future date')}</label>
        {scheduleEnabled&&<label>{text('Zamanlama','Schedule')}<input type="datetime-local" value={scheduledAt}
          min={new Date(Date.now()+60_000).toISOString().slice(0,16)} onChange={event=>setScheduledAt(event.target.value)} /></label>}
        <button type="button" disabled={Boolean(busy)||!selectedRoomId
          ||((contentKind==='text'||contentKind==='location')?!messageText.trim():!preparedAttachment)
          ||(scheduleEnabled&&!scheduledAt)} onClick={()=>createMessage()}>{text('Yerel kasaya mühürle','Seal in local vault')}</button>
      </div>
      <div className="communication-messaging-controls">
        <label>{text('İçerik araması','Content search')}<input value={searchText} maxLength={128} onChange={event=>setSearchText(event.target.value)}
          placeholder={text('Mühürlü metinde yerel ara','Search sealed text locally')} /></label>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void searchMessages()}>{text('Yetkili yerel aramayı uygula','Run authorized local search')}</button>
        {searchResults&&<button type="button" onClick={()=>setSearchResults(undefined)}>{text('Filtreyi temizle','Clear filter')}</button>}
        <label>{text('Presence','Presence')}<select value={presenceStatus} onChange={event=>setPresenceStatus(event.target.value as CommunicationPresenceStatus)}>
          {Object.entries(presenceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void setPresence()}>{text('Çevrim içi durum kararını kaydet','Save presence decision')}</button>
        <label>{text('Saklama modu','Retention mode')}<select value={retentionMode} onChange={event=>setRetentionMode(event.target.value as CommunicationMessageRetentionMode)}>
          <option value="permanent">{text('Kalıcı','Permanent')}</option><option value="duration">{text('Süreli','Duration')}</option><option value="auto_delete">{text('Otomatik mantıksal sil','Automatic logical deletion')}</option>
          <option value="legal_hold">{text('Hukuki koruma etiketi','Legal-hold label')}</option></select></label>
        {['duration','auto_delete'].includes(retentionMode)&&<label>{text('Saklama günü','Retention days')}<input type="number" min={1} max={3650} value={retentionDays}
          onChange={event=>setRetentionDays(Math.max(1,Math.min(3650,Number(event.target.value)||1)))} /></label>
        }
        <button type="button" disabled={Boolean(busy)||!selectedRoomId} onClick={()=>void setRetention()}>{text('Saklamayı güncelle','Update retention')}</button>
      </div>
      <div className="communication-messaging-list">{messages.length===0?<p>{text('Bu oda için yerel mesaj metadata kaydı yok.','There are no local message metadata records for this room.')}</p>:messages.map(message=>
        <article key={message.id} className={message.deleted?'is-deleted':''}>
          <header><strong>{contentKindLabels[message.contentKind]}</strong><small>{message.updatedAt} · {text('sürüm','revision')} {message.revision}</small></header>
          <p>{text('Durum','State')}: {message.state} · {text('teslim','delivery')}: {message.deliveryState}{message.edited?text(' · düzenlendi',' · edited'):''}</p>
          {(message.replyToMessageId||message.quotedMessageId||message.threadRootMessageId)&&<p className="communication-messaging-relation-summary">
            {message.replyToMessageId&&`${text('Yanıt','Reply')}: ${message.replyToMessageId}`}{message.quotedMessageId&&`${text('Alıntı','Quote')}: ${message.quotedMessageId}`}
            {message.threadRootMessageId&&`${text('Konu kökü','Thread root')}: ${message.threadRootMessageId}`}</p>}
          {revealed[message.id]?.text!==undefined&&<div className="communication-messaging-content">
            <label>{text('Açık içerik','Revealed content')}<textarea rows={3} maxLength={32_768} value={editDrafts[message.id]??''}
              onChange={event=>setEditDrafts(current=>({...current,[message.id]:event.target.value}))} /></label>
            <div>{message.contentKind==='text'&&<button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void edit(message)}>{text('Düzeltmeyi mühürle','Seal correction')}</button>}
              <button type="button" onClick={()=>hide(message.id)}>{text('İçeriği gizle','Hide content')}</button></div></div>}
          {revealed[message.id]?.opaqueAttachmentHandle&&<div className="communication-messaging-content" role="status">
            <span>{revealed[message.id]!.contentKind} {text('eki, aynı oda içindeki temiz korumalı dosya kaydına bağlıdır.','attachment is bound to the clean protected file record in the same room.')}</span>
            <button type="button" onClick={()=>hide(message.id)}>{text('Bağı gizle','Hide binding')}</button></div>}
          <div className="communication-messaging-message-actions">
            {!revealed[message.id]&&!message.deleted&&<button type="button" disabled={Boolean(busy)} onClick={()=>void reveal(message)}>{text('İçeriği açıkça göster','Reveal content explicitly')}</button>}
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void annotate(message,'pinned')}>{message.pinned?text('Sabitlemeyi kaldır','Unpin'):text('Sabitle','Pin')}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void annotate(message,'bookmarked')}>{message.bookmarked?text('Yer imini kaldır','Remove bookmark'):text('Yer imi','Bookmark')}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void react(message)}>{text('Tepki','Reaction')}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>relate(message,'reply')}>{text('Yanıtla','Reply')}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>relate(message,'quote')}>{text('Alıntıla','Quote')}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>relate(message,'thread')}>{text('Konu dizisi','Thread')}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void delivery(message)}>{message.deliveryState==='queued_offline'||message.deliveryState==='retry_wait'?text('Yerel retry','Local retry'):text('Offline kuyruğa al','Queue offline')}</button>
            <button type="button" disabled={Boolean(busy)} onClick={()=>void lifecycle(message,message.deleted?'restore':'delete')}>{message.deleted?text('Geri al','Restore'):text('Yerel olarak sil','Delete locally')}</button>
          </div>
        </article>)}</div>
    </>}
  </section>;
}
