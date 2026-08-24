import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommunicationDeviceCredentialView,
  CommunicationRoomType,
  CommunicationMembershipRole,
  CommunicationRoomStatus,
  CommunicationRoomView,
  CommunicationSecurityCenterView
} from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

const roomLabels:Record<CommunicationRoomType,string>={
  direct:'Bire bir',family:'Aile',household:'Hane',family_branch:'Aile dalı',event:'Etkinlik',care:'Bakım',private_topic:'Özel konu'
};

export function CommunicationSecurityPanel(){
  const {language}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const roomLabel=(value:CommunicationRoomType)=>language==='tr'?roomLabels[value]:({direct:'One-to-one',family:'Family',household:'Household',family_branch:'Family branch',event:'Event',care:'Care',private_topic:'Private topic'} as const)[value];
  const roomStatusLabels:Readonly<Record<CommunicationRoomStatus,string>>={active:text('Etkin','Active'),frozen:text('Donduruldu','Frozen'),closed:text('Kapatıldı','Closed')};
  const membershipRoleLabels:Readonly<Record<CommunicationMembershipRole,string>>={owner:text('Sahip','Owner'),administrator:text('Yönetici','Administrator'),member:text('Üye','Member')};
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
  }catch(caught){setError(toUserFacingErrorMessage(caught,text('İletişim güvenlik merkezi yüklenemedi.','Communication security center could not be loaded.')));}};
  useEffect(()=>{void refresh();},[]);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{
    await run(operationId(key));operations.current.delete(key);await refresh();
  }catch(caught){setError(`${toUserFacingErrorMessage(caught,text('İletişim güvenliği değişikliği tamamlanamadı.','The communication security change could not be completed.'))} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation ID.')}`);}finally{setBusy('');}};
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
    <div className="panel-heading"><div><span className="eyebrow">{text('İletişim güvenliği','Communication security')}</span>
      <h2 id="communication-security-title">{text('Oda ve cihaz güvenliğinin yerel temeli','Local foundation for room and device security')}</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>{text('Yenile','Refresh')}</button></div>
    <div className="communication-security-truth" role="note"><strong>{text('Bu ekran mesaj göndermez ve anahtar yönetmez.','This screen does not send messages or manage keys.')}</strong>
      <span>{text('Yalnız merkezî izin kaydıyla bağlı oda, üyelik, güvenilir cihaz ve şifreli hizmet durumu gösterilir.','Only rooms, memberships, trusted devices, and encrypted-service status linked to the central permission record are shown.')}</span>
      <span>{text('Gerçek ağ üzerinden güvenli mesajlaşma, geçmişi koruma, kayıp cihaz sonrası güvenliği yenileme ve mesaj doğrulama henüz hazır değildir.','Secure messaging over a real network, history protection, security renewal after a lost device, and message verification are not ready yet.')}</span>
      <span>{text('Yeni üyeler katılmadan önceki geçmişi varsayılan olarak göremez; ayrı geçmiş paylaşımı seçilse bile bu ekran içerik aktarmaz.','New members cannot see history from before they joined by default; this screen transfers no content even if separate history sharing is selected.')}</span>
      <span>{text('Kapsamlı kaynak yetkilendirmesi henüz uygulanmadı; kapsam bağlı oda oluşturma reddedilir.','Comprehensive resource authorization is not implemented yet; scope-bound room creation is rejected.')}</span>
      <span>{text('Yerel kayıt sınırlarına ulaşıldığında yeni işlemler güvenle durdurulur; otomatik saklama temizliği henüz yoktur.','New actions stop safely when local record limits are reached; automatic retention cleanup is not available yet.')}</span></div>
    {error&&<p className="status-message danger">{error}</p>}
    {!center?<p>{text('İletişim güvenlik merkezi yükleniyor…','Loading communication security center…')}</p>:<>
      <div className="communication-security-summary"><span><strong>{center.deviceCredentials.length}</strong> {text('cihaz kimliği','device credentials')}</span>
        <span><strong>{center.rooms.length}</strong> {text('yerel oda kaydı','local room records')}</span><span><strong>0</strong> {text('gönderilmiş mesaj','sent messages')}</span>
        <span>{text('Cihaz','Device')} {center.storageCapacity.deviceCredentials.current}/{center.storageCapacity.deviceCredentials.limit}</span>
        <span>{text('Oda','Room')} {center.storageCapacity.rooms.current}/{center.storageCapacity.rooms.limit}</span>
        <span>{text('İşlem','Operation')} {center.storageCapacity.mutations.current}/{center.storageCapacity.mutations.limit}</span></div>
      <div className="communication-security-actions">
        <button type="button" disabled={Boolean(busy)||!providerReady||center.storageCapacity.deviceCredentials.limitReached
          ||center.storageCapacity.mutations.limitReached} onClick={()=>void registerDevice()}>{text('Bu cihaz için güvenli iletişim kimliği oluştur','Create a secure communication identity for this device')}</button>
        <small>{text('Gerçek şifreli iletişim hizmeti hazır olmadığı için güvenlik anahtarlarıyla yapılan değişiklikler kapalıdır.','Changes that require security keys are disabled because the real encrypted communication service is not ready.')}</small>
      </div>
      <div className="communication-security-create" aria-label={text('İletişim odası oluşturma','Create communication room')}>
        <input aria-label={text('Oda adı','Room name')} value={roomName} maxLength={160} onChange={event=>setRoomName(event.target.value)} />
        <select aria-label={text('Oda türü','Room type')} value={roomType} onChange={event=>setRoomType(event.target.value as CommunicationRoomType)}>
          {Object.keys(roomLabels).map(value=><option key={value} value={value}>{roomLabel(value as CommunicationRoomType)}</option>)}</select>
        <select aria-label={text('Oda sahibi cihaz kimliği','Room owner device credential')} value={ownerCredentialId} onChange={event=>setOwnerCredentialId(event.target.value)}>
          <option value="">{text('Cihaz kimliği seçin','Select a device credential')}</option>{activeCredentials.map(item=><option key={item.id} value={item.id}>{item.id}</option>)}</select>
        <button type="button" disabled={Boolean(busy)||!providerReady||!roomName.trim()||!ownerCredentialId
          ||center.storageCapacity.rooms.limitReached||center.storageCapacity.mutations.limitReached}
          onClick={()=>void createRoom()}>{text('Oda temelini oluştur','Create room foundation')}</button>
      </div>
      <div className="communication-security-devices">{center.deviceCredentials.map(device=>{
        const used=center.rooms.some(room=>room.status==='active'&&room.memberships.some(member=>
          member.status==='active'&&member.deviceCredentialId===device.id));
        return <article key={device.id}><strong>{device.trustedDeviceId}</strong><span>{device.status==='active'?text('Etkin','Active'):text('İptal edildi','Revoked')}</span>
          <small>{text('Hizmet doğrulaması tamamlandı; güvenlik anahtarı paketi uygulama kayıtlarında tutulmaz.','Service verification is complete; the security key package is not stored in application records.')}</small>
          <button type="button" disabled={Boolean(busy)||device.status!=='active'||center.storageCapacity.mutations.limitReached
            ||(used&&!providerReady)}
            onClick={()=>void revokeDevice(device)}>{text('Cihaz kimliğini iptal et','Revoke device credential')}</button></article>;})}</div>
      {center.rooms.map(room=><article className="communication-security-room" key={room.id}>
        <div><strong>{room.displayName}</strong><small>{roomLabel(room.roomType)} · {text('güvenlik sürümü','security version')} {room.currentEpoch} · {roomStatusLabels[room.status]}</small></div>
        <p>{room.historyAccessMode==='new_members_no_history'?text('Yeni üyeler geçmişi göremez.','New members cannot see history.'):text('Geçmiş için ayrı paylaşım kararı seçili; içerik aktarımı yok.','A separate sharing decision is selected for history; no content is transferred.')}</p>
        <small>{text('Üyelik','Membership')} {room.storageCapacity.memberships.current}/{room.storageCapacity.memberships.limit} · {text('güvenlik değişikliği','security changes')} {room.storageCapacity.epochs.current}/{room.storageCapacity.epochs.limit}</small>
        <ul>{room.memberships.map(member=><li key={member.id}><span>{member.memberPersonId} · {membershipRoleLabels[member.role]} · {text('katıldığı güvenlik sürümü','security version at joining')} {member.joinedAtEpoch}</span>
          {member.status==='active'&&<>{member.role!=='owner'&&<button type="button" disabled={Boolean(busy)||!providerReady
            ||room.storageCapacity.epochs.limitReached||center.storageCapacity.mutations.limitReached}
            onClick={()=>void removeMember(room,member.id)}>{text('Üyeyi güvenliği yenileyerek çıkar','Remove member and renew security')}</button>}
            <button type="button" disabled={Boolean(busy)||!providerReady||room.storageCapacity.epochs.limitReached
              ||center.storageCapacity.mutations.limitReached||(member.role==='owner'&&!activeCredentials.some(item=>item.id!==member.deviceCredentialId))}
              onClick={()=>void rekeyRoom(room,member.deviceCredentialId,member.memberPersonId)}>{text('Kayıp cihaz sonrası güvenliği yenile','Renew security after a lost device')}</button></>}</li>)}</ul>
        <div className="communication-security-member-form"><input aria-label={text('Üye kişi kimliği','Member person ID')} value={memberPersonId}
          onChange={event=>setMemberPersonId(event.target.value)} /><input aria-label={text('Üye cihaz kimliği','Member device credential')} value={memberCredentialId}
          onChange={event=>setMemberCredentialId(event.target.value)} /><button type="button"
          disabled={Boolean(busy)||!providerReady||!memberPersonId.trim()||!memberCredentialId.trim()
            ||room.storageCapacity.memberships.limitReached||room.storageCapacity.epochs.limitReached
            ||center.storageCapacity.mutations.limitReached}
          onClick={()=>void addMember(room)}>{text('Üye ekle','Add member')}</button></div>
        <div className="communication-security-room-actions"><button type="button" disabled={Boolean(busy)||room.status!=='active'
          ||center.storageCapacity.mutations.limitReached}
          onClick={()=>void setHistory(room)}>{text('Geçmiş politikasını değiştir','Change history policy')}</button><button type="button"
          disabled={Boolean(busy)||room.status!=='active'||center.storageCapacity.mutations.limitReached}
          onClick={()=>void freezeRoom(room)}>{text('Odayı dondur','Freeze room')}</button></div>
      </article>)}</>}
  </section>;
}
