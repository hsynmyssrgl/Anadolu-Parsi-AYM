import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunicationMessageContentView,
  CommunicationMessageView,
  CommunicationMessagingCenterView,
  CommunicationPresenceStatus,
  CommunicationRoomView
} from '@ppt/domain';

const presenceLabels:Record<CommunicationPresenceStatus,string>={
  online:'Çevrimiçi',away:'Uzakta',busy:'Meşgul',in_meeting:'Toplantıda',do_not_disturb:'Rahatsız etmeyin',
  invisible:'Görünmez',offline:'Çevrimdışı'
};

export function CommunicationMessagingPanel(){
  const [center,setCenter]=useState<CommunicationMessagingCenterView>();
  const [rooms,setRooms]=useState<readonly CommunicationRoomView[]>([]);
  const [selectedRoomId,setSelectedRoomId]=useState('');
  const [messageText,setMessageText]=useState('');
  const [silent,setSilent]=useState(false);
  const [searchResults,setSearchResults]=useState<readonly CommunicationMessageView[]>();
  const [revealed,setRevealed]=useState<Record<string,CommunicationMessageContentView>>({});
  const [editDrafts,setEditDrafts]=useState<Record<string,string>>({});
  const [presenceStatus,setPresenceStatus]=useState<CommunicationPresenceStatus>('offline');
  const [retentionDays,setRetentionDays]=useState(30);
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
  const createMessage=()=>window.pardus&&selectedRoomId&&messageText.trim()&&mutate(`create:${selectedRoomId}:${messageText.trim()}`,
    async clientOperationId=>{await window.pardus!.createCommunicationMessage({clientOperationId,expectedRevision:0,
      roomId:selectedRoomId,contentKind:'text',contentMime:'text/plain',text:messageText.normalize('NFKC').trim(),silent});
      setMessageText('');});
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
      roomId:selectedRoomId,mode:'duration',durationDays:retentionDays,reason:'Kullanıcı yerel saklama süresini güncelledi.'}));
  const searchMetadata=async()=>{if(!window.pardus)return;setBusy('search');setError('');try{
    setSearchResults(await window.pardus.searchCommunicationMessages({...selectedRoomId?{roomId:selectedRoomId}:{},limit:200}));
  }catch(caught){setError(caught instanceof Error?caught.message:'Mesaj metadata araması tamamlanamadı.');}finally{setBusy('');}};
  return <section className="communication-messaging panel" aria-labelledby="communication-messaging-title">
    <div className="panel-heading"><div><span className="eyebrow">34-B · Mesaj yaşam döngüsü ve mahrem presence</span>
      <h2 id="communication-messaging-title">Yerel, mühürlü mesajlaşma çalışma alanı</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>Yenile</button></div>
    <div className="communication-messaging-truth" role="note"><strong>Bu sürüm yalnız yerel ve ağsız çalışır.</strong>
      <span>Mesaj metni uygulama veritabanına yazılmaz; içerik yalnız açık kullanıcı eylemiyle korumalı kasadan okunur.</span>
      <span>Relay teslimi, uzak alındı bilgisi, mesaj imzası, production MLS payload sağlayıcısı ve gerçek mesaj alışverişi uygulanmadı.</span>
      <span>Silme mantıksaldır; fiziksel güvenli silme ve yedeklerden yayılım garantisi yoktur. Medya eki için main-issued güvenli seçim akışı henüz yoktur.</span></div>
    {error&&<p className="status-message danger">{error}</p>}
    {!center?<p>Mesajlaşma merkezi yükleniyor…</p>:<>
      <div className="communication-messaging-summary"><span><strong>{center.messages.length}</strong> yerel mesaj metadata kaydı</span>
        <span><strong>{center.retentionPolicies.length}</strong> saklama kararı</span><span><strong>0</strong> uzak teslim kanıtı</span></div>
      <div className="communication-messaging-compose">
        <label>Oda<select value={selectedRoomId} onChange={event=>{setSelectedRoomId(event.target.value);setSearchResults(undefined);}}>
          <option value="">Etkin oda seçin</option>{rooms.map(room=><option key={room.id} value={room.id}>{room.displayName}</option>)}</select></label>
        <label>Mesaj<textarea value={messageText} maxLength={32_768} rows={3} onChange={event=>setMessageText(event.target.value)} /></label>
        <label className="communication-messaging-check"><input type="checkbox" checked={silent} onChange={event=>setSilent(event.target.checked)} />Sessiz metadata</label>
        <button type="button" disabled={Boolean(busy)||!selectedRoomId||!messageText.trim()} onClick={()=>void createMessage()}>Yerel kasaya mühürle</button>
      </div>
      <div className="communication-messaging-controls">
        <button type="button" disabled={Boolean(busy)} onClick={()=>void searchMetadata()}>Metadata filtresini uygula</button>
        {searchResults&&<button type="button" onClick={()=>setSearchResults(undefined)}>Filtreyi temizle</button>}
        <label>Presence<select value={presenceStatus} onChange={event=>setPresenceStatus(event.target.value as CommunicationPresenceStatus)}>
          {Object.entries(presenceLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void setPresence()}>Presence kararını kaydet</button>
        <label>Saklama günü<input type="number" min={1} max={3650} value={retentionDays}
          onChange={event=>setRetentionDays(Math.max(1,Math.min(3650,Number(event.target.value)||1)))} /></label>
        <button type="button" disabled={Boolean(busy)||!selectedRoomId} onClick={()=>void setRetention()}>Saklamayı güncelle</button>
      </div>
      <div className="communication-messaging-list">{messages.length===0?<p>Bu oda için yerel mesaj metadata kaydı yok.</p>:messages.map(message=>
        <article key={message.id} className={message.deleted?'is-deleted':''}>
          <header><strong>{message.contentKind==='text'?'Metin mesajı':message.contentKind}</strong><small>{message.updatedAt} · sürüm {message.revision}</small></header>
          <p>Durum: {message.state} · teslim: {message.deliveryState}{message.edited?' · düzenlendi':''}</p>
          {revealed[message.id]?.text!==undefined&&<div className="communication-messaging-content">
            <label>Açık içerik<textarea rows={3} maxLength={32_768} value={editDrafts[message.id]??''}
              onChange={event=>setEditDrafts(current=>({...current,[message.id]:event.target.value}))} /></label>
            <div><button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void edit(message)}>Düzeltmeyi mühürle</button>
              <button type="button" onClick={()=>hide(message.id)}>İçeriği gizle</button></div></div>}
          <div className="communication-messaging-message-actions">
            {!revealed[message.id]&&!message.deleted&&<button type="button" disabled={Boolean(busy)} onClick={()=>void reveal(message)}>İçeriği açıkça göster</button>}
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void annotate(message,'pinned')}>{message.pinned?'Sabitlemeyi kaldır':'Sabitle'}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void annotate(message,'bookmarked')}>{message.bookmarked?'Yer imini kaldır':'Yer imi'}</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void react(message)}>Tepki</button>
            <button type="button" disabled={Boolean(busy)||message.deleted} onClick={()=>void delivery(message)}>{message.deliveryState==='queued_offline'||message.deliveryState==='retry_wait'?'Yerel retry':'Offline kuyruğa al'}</button>
            <button type="button" disabled={Boolean(busy)} onClick={()=>void lifecycle(message,message.deleted?'restore':'delete')}>{message.deleted?'Geri al':'Yerel olarak sil'}</button>
          </div>
        </article>)}</div>
    </>}
  </section>;
}
