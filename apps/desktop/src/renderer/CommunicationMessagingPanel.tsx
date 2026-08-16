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

const presenceLabels:Record<CommunicationPresenceStatus,string>={
  online:'Çevrimiçi',away:'Uzakta',busy:'Meşgul',in_meeting:'Toplantıda',do_not_disturb:'Rahatsız etmeyin',
  invisible:'Görünmez',offline:'Çevrimdışı'
};
const contentKindLabels:Record<CommunicationMessageContentKind,string>={text:'Metin',voice:'Sesli mesaj',photo:'Fotoğraf',
  video:'Video',location:'Konum',document:'Belge'};
const documentMimeTypes=new Set(['application/pdf','text/plain','application/json','text/csv']);
type RelationMode='none'|'reply'|'quote'|'thread';
interface PreparedAttachment{readonly fileId:string;readonly displayName:string;readonly mimeType:string;readonly state:string;readonly scanState:string}

export function CommunicationMessagingPanel(){
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
  }catch(caught){setError(caught instanceof Error?caught.message:'Mesajlaşma merkezi yüklenemedi.');}};
  useEffect(()=>{void refresh();},[]);
  const messages=useMemo(()=>{
    const source=searchResults??center?.messages??[];return selectedRoomId?source.filter(item=>item.roomId===selectedRoomId):source;
  },[center,searchResults,selectedRoomId]);
  const retention=center?.retentionPolicies.find(item=>item.roomId===selectedRoomId);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{
    await run(operationId(key));operations.current.delete(key);setSearchResults(undefined);await refresh();
  }catch(caught){setError(caught instanceof Error?`${caught.message} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`
    :'Mesajlaşma değişikliği tamamlanamadı.');}finally{setBusy('');}};
  const createMessage=()=>{if(!window.pardus||!selectedRoomId)return;const normalized=messageText.normalize('NFKC').trim();
    const textual=contentKind==='text'||contentKind==='location';if(textual&&!normalized)return;
    if(!textual&&!preparedAttachment)return;
    const relation=relationMode==='reply'?{replyToMessageId:relatedMessageId}:relationMode==='quote'?{quotedMessageId:relatedMessageId}
      :relationMode==='thread'?{threadRootMessageId:relatedMessageId}:{};
    const scheduledMs=scheduleEnabled?Date.parse(scheduledAt):Number.NaN;
    if(scheduleEnabled&&(!Number.isFinite(scheduledMs)||scheduledMs<=Date.now())){setError('Zamanlanmış mesaj gelecekte olmalıdır.');return;}
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
    if(candidates.length!==1)throw new Error('Hazırlanan yerel dosya metadata kaydı tekil olarak doğrulanamadı.');
    const file=candidates[0]!;
    const allowed=contentKind==='voice'?file.mimeType.startsWith('audio/'):contentKind==='photo'?file.mimeType.startsWith('image/')
      :contentKind==='video'?file.mimeType.startsWith('video/'):contentKind==='document'&&documentMimeTypes.has(file.mimeType);
    if(!allowed)throw new Error(`Seçilen dosya ${contentKindLabels[contentKind]} türüyle uyuşmuyor.`);
    if(file.state!=='ready_local'||file.scanState!=='clean')throw new Error(
      'Dosya yerel olarak şifrelendi ancak temiz tarama kanıtı olmadığı için mesaja eklenemez.');
    operations.current.delete(`attachment:${selectedRoomId}:${contentKind}`);
    setPreparedAttachment({fileId:file.id,displayName:file.displayName,mimeType:file.mimeType,state:file.state,scanState:file.scanState});
  }catch(caught){setPreparedAttachment(undefined);setError(caught instanceof Error?caught.message:'Dosya seçimi tamamlanamadı.');}
  finally{setBusy('');}};
  const relate=(message:CommunicationMessageView,mode:Exclude<RelationMode,'none'>)=>{
    setRelationMode(mode);setRelatedMessageId(message.id);setSelectedRoomId(message.roomId);
  };
  const reveal=async(message:CommunicationMessageView)=>{if(!window.pardus||message.deleted)return;setBusy(`reveal:${message.id}`);setError('');try{
    const content=await window.pardus.getCommunicationMessageContent({messageId:message.id});setRevealed(current=>({...current,[message.id]:content}));
    if(content.text!==undefined)setEditDrafts(current=>({...current,[message.id]:content.text!}));
  }catch(caught){setError(caught instanceof Error?caught.message:'Mesaj içeriği açılamadı.');}finally{setBusy('');}};
  const hide=(messageId:string)=>{setRevealed(current=>{const next={...current};delete next[messageId];return next;});
    setEditDrafts(current=>{const next={...current};delete next[messageId];return next;});};
  const edit=(message:CommunicationMessageView)=>window.pardus&&editDrafts[message.id]?.trim()&&mutate(`edit:${message.id}:${message.revision}`,
    clientOperationId=>window.pardus!.editCommunicationMessage({clientOperationId,expectedRevision:message.revision,messageId:message.id,
      text:editDrafts[message.id]!.normalize('NFKC').trim(),reason:'Kullanıcı mesaj metnini düzeltti.'}));
  const lifecycle=(message:CommunicationMessageView,action:'delete'|'restore')=>window.pardus&&mutate(
    `${action}:${message.id}:${message.revision}`,clientOperationId=>window.pardus!.setCommunicationMessageLifecycle({clientOperationId,
      expectedRevision:message.revision,messageId:message.id,action,reason:action==='delete'?'Kullanıcı mesajı yerel olarak sildi.':'Kullanıcı mesajı yerel olarak geri aldı.'}));
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
      reason:retentionMode==='legal_hold'?'Kullanıcı hukuki koruma etiketini açıkça kaydetti.':'Kullanıcı yerel saklama kararını güncelledi.'}));
  const searchMessages=async()=>{if(!window.pardus)return;setBusy('search');setError('');try{
    setSearchResults(await window.pardus.searchCommunicationMessages({...searchText.trim()?{queryText:searchText.normalize('NFKC').trim()}: {},
      ...selectedRoomId?{roomId:selectedRoomId}:{},limit:200}));
  }catch(caught){setError(caught instanceof Error?caught.message:'Mesaj araması tamamlanamadı.');}finally{setBusy('');}};
  return <section className="communication-messaging panel" aria-labelledby="communication-messaging-title">
    <div className="panel-heading"><div><span className="eyebrow">34-B · Mesaj yaşam döngüsü ve mahrem presence</span>
      <h2 id="communication-messaging-title">Yerel, mühürlü mesajlaşma çalışma alanı</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>Yenile</button></div>
    <div className="communication-messaging-truth" role="note"><strong>Bu sürüm yalnız yerel ve ağsız çalışır.</strong>
      <span>Mesaj metni uygulama veritabanına yazılmaz; içerik yalnız açık kullanıcı eylemiyle korumalı kasadan okunur.</span>
      <span>Relay teslimi, uzak alındı bilgisi, mesaj imzası, production MLS payload sağlayıcısı ve gerçek mesaj alışverişi uygulanmadı.</span>
      <span>Dosya ekleri ana süreçte seçilir, temiz tarama kanıtıyla aynı odaya bağlanır ve korumalı yerel kasada kalır.</span>
      <span>Süre dolumu mantıksal silmedir; fiziksel güvenli silme ve yedeklerden yayılım garantisi yoktur. Hatırlatma yürütücüsü ve çoklu cihaz presence birleştirmesi henüz yoktur.</span></div>
    {error&&<p className="status-message danger">{error}</p>}
    {!center?<p>Mesajlaşma merkezi yükleniyor…</p>:<>
      <div className="communication-messaging-summary"><span><strong>{center.messages.length}</strong> yerel mesaj metadata kaydı</span>
        <span><strong>{center.retentionPolicies.length}</strong> saklama kararı</span><span><strong>0</strong> uzak teslim kanıtı</span></div>
      <div className="communication-messaging-compose">
        <label>Oda<select value={selectedRoomId} onChange={event=>{setSelectedRoomId(event.target.value);setSearchResults(undefined);}}>
          <option value="">Etkin oda seçin</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label>
        <label>İçerik türü<select value={contentKind} onChange={event=>{setContentKind(event.target.value as CommunicationMessageContentKind);
          setPreparedAttachment(undefined);setMessageText('');}}>{Object.entries(contentKindLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        {(contentKind==='text'||contentKind==='location')?<label>{contentKind==='location'?'Konum açıklaması veya koordinat':'Mesaj'}
          <textarea value={messageText} maxLength={contentKind==='location'?2_000:32_768} rows={3} onChange={event=>setMessageText(event.target.value)} /></label>:
          <div className="communication-messaging-attachment"><button type="button" disabled={Boolean(busy)||!selectedRoomId}
            onClick={()=>void selectAttachment()}>Ana süreçte dosya seç ve şifrele</button>
            {preparedAttachment?<small>{preparedAttachment.displayName} · {preparedAttachment.mimeType} · temiz yerel kayıt</small>:
              <small>Dosya yolu ve ham baytlar bu ekrana aktarılmaz.</small>}</div>}
        {relationMode!=='none'&&<div className="communication-messaging-relation" role="status">
          <span>{relationMode==='reply'?'Yanıt':relationMode==='quote'?'Alıntı':'Konu dizisi'} hedefi: {relatedMessageId}</span>
          <button type="button" onClick={()=>{setRelationMode('none');setRelatedMessageId('');}}>İlişkiyi kaldır</button></div>}
        <label className="communication-messaging-check"><input type="checkbox" checked={silent} onChange={event=>setSilent(event.target.checked)} />Sessiz metadata</label>
        <label className="communication-messaging-check"><input type="checkbox" checked={scheduleEnabled}
          onChange={event=>setScheduleEnabled(event.target.checked)} />Gelecek tarih için zamanla</label>
        {scheduleEnabled&&<label>Zamanlama<input type="datetime-local" value={scheduledAt}
          min={new Date(Date.now()+60_000).toISOString().slice(0,16)} onChange={event=>setScheduledAt(event.target.value)} /></label>}
        <button type="button" disabled={Boolean(busy)||!selectedRoomId
          ||((contentKind==='text'||contentKind==='location')?!messageText.trim():!preparedAttachment)
          ||(scheduleEnabled&&!scheduledAt)} onClick={()=>createMessage()}>Yerel kasaya mühürle</button>
      </div>
      <div className="communication-messaging-controls">
        <label>İçerik araması<input value={searchText} maxLength={128} onChange={event=>setSearchText(event.target.value)}
          placeholder="Mühürlü metinde yerel ara" /></label>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void searchMessages()}>Yetkili yerel aramayı uygula</button>
        {searchResults&&<button type="button" onClick={()=>setSearchResults(undefined)}>Filtreyi temizle</button>}
        <label>Presence<select value={presenceStatus} onChange={event=>setPresenceStatus(event.target.value as CommunicationPresenceStatus)}>
          {Object.entries(presenceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void setPresence()}>Presence kararını kaydet</button>
        <label>Saklama modu<select value={retentionMode} onChange={event=>setRetentionMode(event.target.value as CommunicationMessageRetentionMode)}>
          <option value="permanent">Kalıcı</option><option value="duration">Süreli</option><option value="auto_delete">Otomatik mantıksal sil</option>
          <option value="legal_hold">Hukuki koruma etiketi</option></select></label>
        {['duration','auto_delete'].includes(retentionMode)&&<label>Saklama günü<input type="number" min={1} max={3650} value={retentionDays}
          onChange={event=>setRetentionDays(Math.max(1,Math.min(3650,Number(event.target.value)||1)))} /></label>
        }
        <button type="button" disabled={Boolean(busy)||!selectedRoomId} onClick={()=>void setRetention()}>Saklamayı güncelle</button>
      </div>
      <div className="communication-messaging-list">{messages.length===0?<p>Bu oda için yerel mesaj metadata kaydı yok.</p>:messages.map(message=>
        <article key={message.id} className={message.deleted?'is-deleted':''}>
          <header><strong>{contentKindLabels[message.contentKind]}</strong><small>{message.updatedAt} · sürüm {message.revision}</small></header>
          <p>Durum: {message.state} · teslim: {message.deliveryState}{message.edited?' · düzenlendi':''}</p>
          {(message.replyToMessageId||message.quotedMessageId||message.threadRootMessageId)&&<p className="communication-messaging-relation-summary">
            {message.replyToMessageId&&`Yanıt: ${message.replyToMessageId}`}{message.quotedMessageId&&`Alıntı: ${message.quotedMessageId}`}
            {message.threadRootMessageId&&`Konu kökü: ${message.threadRootMessageId}`}</p>}
          {revealed[message.id]?.text!==undefined&&<div className="communication-messaging-content">
            <label>Açık içerik<textarea rows={3} maxLength={32_768} value={editDrafts[message.id]??''}
              onChange={event=>setEditDrafts(current=>({...current,[message.id]:event.target.value}))} /></label>
            <div>{message.contentKind==='text'&&<button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void edit(message)}>Düzeltmeyi mühürle</button>}
              <button type="button" onClick={()=>hide(message.id)}>İçeriği gizle</button></div></div>}
          {revealed[message.id]?.opaqueAttachmentHandle&&<div className="communication-messaging-content" role="status">
            <span>{revealed[message.id]!.contentKind} eki, aynı oda içindeki temiz korumalı dosya kaydına bağlıdır.</span>
            <button type="button" onClick={()=>hide(message.id)}>Bağı gizle</button></div>}
          <div className="communication-messaging-message-actions">
            {!revealed[message.id]&&!message.deleted&&<button type="button" disabled={Boolean(busy)} onClick={()=>void reveal(message)}>İçeriği açıkça göster</button>}
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void annotate(message,'pinned')}>{message.pinned?'Sabitlemeyi kaldır':'Sabitle'}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void annotate(message,'bookmarked')}>{message.bookmarked?'Yer imini kaldır':'Yer imi'}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void react(message)}>Tepki</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>relate(message,'reply')}>Yanıtla</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>relate(message,'quote')}>Alıntıla</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>relate(message,'thread')}>Konu dizisi</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void delivery(message)}>{message.deliveryState==='queued_offline'||message.deliveryState==='retry_wait'?'Yerel retry':'Offline kuyruğa al'}</button>
            <button type="button" disabled={Boolean(busy)} onClick={()=>void lifecycle(message,message.deleted?'restore':'delete')}>{message.deleted?'Geri al':'Yerel olarak sil'}</button>
          </div>
        </article>)}</div>
    </>}
  </section>;
}
