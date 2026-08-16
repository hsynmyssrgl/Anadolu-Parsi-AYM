import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunicationDeviceCredentialView,
  CommunicationRoomType,
  CommunicationRoomView,
  CommunicationSecurityCenterView
} from '@ppt/domain';

const roomLabels:Record<CommunicationRoomType,string>={
  direct:'Bire bir',family:'Aile',household:'Hane',family_branch:'Aile dalı',event:'Etkinlik',care:'Bakım',private_topic:'Özel konu'
};

export function CommunicationSecurityPanel(){
  const [center,setCenter]=useState<CommunicationSecurityCenterView>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState('');
  const [roomName,setRoomName]=useState('');
  const [roomType,setRoomType]=useState<CommunicationRoomType>('family');
  const [ownerCredentialId,setOwnerCredentialId]=useState('');
  const [memberPersonId,setMemberPersonId]=useState('');
  const [memberCredentialId,setMemberCredentialId]=useState('');
  const operations=useRef(new Map<string,string>());
  const operationId=(key:string)=>{const current=operations.current.get(key);if(current)return current;
    const next=crypto.randomUUID();operations.current.set(key,next);return next;};
  const providerReady=false;
  const activeCredentials=useMemo(()=>center?.deviceCredentials.filter(item=>item.status==='active')??[],[center]);
  const refresh=async()=>{if(!window.pardus)return;setError('');try{
    const next=await window.pardus.getCommunicationSecurityCenter();setCenter(next);
    setOwnerCredentialId(current=>current||next.deviceCredentials.find(item=>item.status==='active')?.id||'');
  }catch(caught){setError(caught instanceof Error?caught.message:'İletişim güvenlik merkezi yüklenemedi.');}};
  useEffect(()=>{void refresh();},[]);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{
    await run(operationId(key));operations.current.delete(key);await refresh();
  }catch(caught){setError(caught instanceof Error?`${caught.message} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`
    :'İletişim güvenliği değişikliği tamamlanamadı.');}finally{setBusy('');}};
  const registerDevice=()=>window.pardus&&mutate('register-current-device',clientOperationId=>
    window.pardus!.registerCommunicationDeviceCredential({clientOperationId,expectedRevision:0}));
  const createRoom=()=>window.pardus&&ownerCredentialId&&roomName.trim()&&mutate(`create:${roomType}:${roomName.trim()}`,
    clientOperationId=>window.pardus!.createCommunicationRoom({clientOperationId,expectedRevision:0,
      ownerDeviceCredentialId:ownerCredentialId,roomType,displayName:roomName.normalize('NFKC').trim()}));
  const revokeDevice=(device:CommunicationDeviceCredentialView)=>window.pardus&&mutate(`revoke:${device.id}:${device.revision}`,
    clientOperationId=>window.pardus!.revokeCommunicationDeviceCredential({clientOperationId,expectedRevision:device.revision,
      deviceCredentialId:device.id,confirmation:'ILETISIM CIHAZ KIMLIGINI IPTAL ET',reason:'Kullanıcı cihaz kimliğini yerel olarak iptal etti.'}));
  const addMember=(room:CommunicationRoomView)=>window.pardus&&memberPersonId.trim()&&memberCredentialId.trim()
    &&mutate(`add:${room.id}:${room.revision}:${memberCredentialId}`,clientOperationId=>window.pardus!.addCommunicationRoomMember({
      clientOperationId,expectedRevision:room.revision,roomId:room.id,memberPersonId:memberPersonId.trim(),
      deviceCredentialId:memberCredentialId.trim(),role:'member'}));
  const removeMember=(room:CommunicationRoomView,membershipId:string)=>window.pardus&&mutate(
    `remove:${room.id}:${room.revision}:${membershipId}`,clientOperationId=>window.pardus!.removeCommunicationRoomMember({
      clientOperationId,expectedRevision:room.revision,roomId:room.id,membershipId,reason:'Kullanıcı oda üyeliğini kaldırdı.'}));
  const rekeyRoom=(room:CommunicationRoomView,deviceCredentialId:string,memberPersonId:string)=>{
    const replacement=memberPersonId===center?.ownerPersonId
      ?activeCredentials.find(item=>item.id!==deviceCredentialId):undefined;
    return window.pardus&&mutate(
    `rekey:${room.id}:${room.revision}:${deviceCredentialId}`,clientOperationId=>
      window.pardus!.rekeyCommunicationRoomAfterDeviceRevocation({clientOperationId,expectedRevision:room.revision,
        roomId:room.id,revokedDeviceCredentialId:deviceCredentialId,
        ...(replacement?{replacementDeviceCredentialId:replacement.id}:{}),
        confirmation:'KAYIP CIHAZ SONRASI ODAYI YENIDEN ANAHTARLA',reason:'İptal edilmiş cihaz sonrası oda dönemi yenileniyor.'}));
  };
  const setHistory=(room:CommunicationRoomView)=>window.pardus&&mutate(`history:${room.id}:${room.revision}`,
    clientOperationId=>window.pardus!.setCommunicationHistoryAccess({clientOperationId,expectedRevision:room.revision,
      roomId:room.id,historyAccessMode:room.historyAccessMode==='new_members_no_history'
        ?'explicit_snapshot_grant':'new_members_no_history',reason:'Kullanıcı oda geçmiş erişim politikasını güncelledi.'}));
  const freezeRoom=(room:CommunicationRoomView)=>window.pardus&&mutate(`freeze:${room.id}:${room.revision}`,
    clientOperationId=>window.pardus!.freezeCommunicationRoom({clientOperationId,expectedRevision:room.revision,
      roomId:room.id,confirmation:'ILETISIM ODASINI DONDUR',reason:'Kullanıcı odayı yerel olarak dondurdu.'}));
  return <section className="communication-security panel" aria-labelledby="communication-security-title">
    <div className="panel-heading"><div><span className="eyebrow">34-A · İletişim politika çekirdeği</span>
      <h2 id="communication-security-title">Oda, cihaz ve MLS dönem temeli</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>Yenile</button></div>
    <div className="communication-security-truth" role="note"><strong>Bu ekran mesaj göndermez ve anahtar yönetmez.</strong>
      <span>Yalnız merkezî politika receipt’iyle bağlı oda, üyelik, cihaz kimliği ve şifreli sağlayıcı durumuna ait güvenli metadata gösterilir.</span>
      <span>Production RFC 9420 sağlayıcısı, ileri gizlilik, saldırı sonrası güvenlik, relay içerik körlüğü, mesaj imzası ve gerçek ağ teslimi doğrulanmadı.</span>
      <span>Yeni üyeler katılım öncesi geçmişi varsayılan göremez; explicit snapshot kararı bu foundation içinde içerik paylaşmaz.</span>
      <span>Kapsamlı kaynak yetkilendirmesi henüz uygulanmadı; kapsam bağlı oda oluşturma reddedilir.</span>
      <span>Metadata kotaları fail-closed uygulanır; otomatik retention ve kapasite kurtarma yoktur.</span></div>
    {error&&<p className="status-message danger">{error}</p>}
    {!center?<p>İletişim güvenlik merkezi yükleniyor…</p>:<>
      <div className="communication-security-summary"><span><strong>{center.deviceCredentials.length}</strong> cihaz kimliği</span>
        <span><strong>{center.rooms.length}</strong> yerel oda kaydı</span><span><strong>0</strong> gönderilmiş mesaj</span>
        <span>Cihaz {center.storageCapacity.deviceCredentials.current}/{center.storageCapacity.deviceCredentials.limit}</span>
        <span>Oda {center.storageCapacity.rooms.current}/{center.storageCapacity.rooms.limit}</span>
        <span>İşlem {center.storageCapacity.mutations.current}/{center.storageCapacity.mutations.limit}</span></div>
      <div className="communication-security-actions">
        <button type="button" disabled={Boolean(busy)||!providerReady||center.storageCapacity.deviceCredentials.limitReached
          ||center.storageCapacity.mutations.limitReached} onClick={()=>void registerDevice()}>Bu cihaz için MLS kimliği oluştur</button>
        <small>Production MLS sağlayıcısı yapılandırılmadığı için kriptografik yazmalar fail-closed kapalıdır.</small>
      </div>
      <div className="communication-security-create" aria-label="İletişim odası oluşturma">
        <input aria-label="Oda adı" value={roomName} maxLength={160} onChange={event=>setRoomName(event.target.value)} />
        <select aria-label="Oda türü" value={roomType} onChange={event=>setRoomType(event.target.value as CommunicationRoomType)}>
          {Object.entries(roomLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Oda sahibi cihaz kimliği" value={ownerCredentialId} onChange={event=>setOwnerCredentialId(event.target.value)}>
          <option value="">Cihaz kimliği seçin</option>{activeCredentials.map(item=><option key={item.id} value={item.id}>{item.id}</option>)}</select>
        <button type="button" disabled={Boolean(busy)||!providerReady||!roomName.trim()||!ownerCredentialId
          ||center.storageCapacity.rooms.limitReached||center.storageCapacity.mutations.limitReached}
          onClick={()=>void createRoom()}>Oda temelini oluştur</button>
      </div>
      <div className="communication-security-devices">{center.deviceCredentials.map(device=>{
        const used=center.rooms.some(room=>room.status==='active'&&room.memberships.some(member=>
          member.status==='active'&&member.deviceCredentialId===device.id));
        return <article key={device.id}><strong>{device.trustedDeviceId}</strong><span>{device.status==='active'?'Etkin':'İptal edildi'}</span>
          <small>Sağlayıcı kanıtı doğrulandı; key package uygulama veritabanında tutulmaz.</small>
          <button type="button" disabled={Boolean(busy)||device.status!=='active'||center.storageCapacity.mutations.limitReached
            ||(used&&!providerReady)}
            onClick={()=>void revokeDevice(device)}>Cihaz kimliğini iptal et</button></article>;})}</div>
      {center.rooms.map(room=><article className="communication-security-room" key={room.id}>
        <div><strong>{room.displayName}</strong><small>{roomLabels[room.roomType]} · dönem {room.currentEpoch} · {room.status}</small></div>
        <p>{room.historyAccessMode==='new_members_no_history'?'Yeni üyeler geçmişi göremez.':'Geçmiş için ayrı snapshot kararı seçili; içerik aktarımı yok.'}</p>
        <small>Üyelik {room.storageCapacity.memberships.current}/{room.storageCapacity.memberships.limit} · dönem kanıtı {room.storageCapacity.epochs.current}/{room.storageCapacity.epochs.limit}</small>
        <ul>{room.memberships.map(member=><li key={member.id}><span>{member.memberPersonId} · {member.role} · dönem {member.joinedAtEpoch}</span>
          {member.status==='active'&&<>{member.role!=='owner'&&<button type="button" disabled={Boolean(busy)||!providerReady
            ||room.storageCapacity.epochs.limitReached||center.storageCapacity.mutations.limitReached}
            onClick={()=>void removeMember(room,member.id)}>Üyeyi dönem yenileyerek çıkar</button>}
            <button type="button" disabled={Boolean(busy)||!providerReady||room.storageCapacity.epochs.limitReached
              ||center.storageCapacity.mutations.limitReached||(member.role==='owner'&&!activeCredentials.some(item=>item.id!==member.deviceCredentialId))}
              onClick={()=>void rekeyRoom(room,member.deviceCredentialId,member.memberPersonId)}>Kayıp cihaz sonrası rekey</button></>}</li>)}</ul>
        <div className="communication-security-member-form"><input aria-label="Üye kişi kimliği" value={memberPersonId}
          onChange={event=>setMemberPersonId(event.target.value)} /><input aria-label="Üye cihaz kimliği" value={memberCredentialId}
          onChange={event=>setMemberCredentialId(event.target.value)} /><button type="button"
          disabled={Boolean(busy)||!providerReady||!memberPersonId.trim()||!memberCredentialId.trim()
            ||room.storageCapacity.memberships.limitReached||room.storageCapacity.epochs.limitReached
            ||center.storageCapacity.mutations.limitReached}
          onClick={()=>void addMember(room)}>Üye ekle</button></div>
        <div className="communication-security-room-actions"><button type="button" disabled={Boolean(busy)||room.status!=='active'
          ||center.storageCapacity.mutations.limitReached}
          onClick={()=>void setHistory(room)}>Geçmiş politikasını değiştir</button><button type="button"
          disabled={Boolean(busy)||room.status!=='active'||center.storageCapacity.mutations.limitReached}
          onClick={()=>void freezeRoom(room)}>Odayı dondur</button></div>
      </article>)}</>}
  </section>;
}
