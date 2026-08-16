import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { SmartHomeCameraConsentCenterItemView, SmartHomeEnergyCenterView } from '@ppt/domain';

const deviceLabels:Record<string,string>={matter_bridge:'Matter köprüsü',smoke_sensor:'Duman sensörü',
  carbon_monoxide_sensor:'CO sensörü',water_leak_sensor:'Su kaçağı sensörü',door_sensor:'Kapı sensörü',
  temperature_sensor:'Sıcaklık sensörü',humidity_sensor:'Nem sensörü',energy_meter:'Enerji sayacı',thermostat:'Termostat',
  light:'Aydınlatma',smart_plug:'Akıllı priz',camera:'Kamera',doorbell:'Kapı zili',ev_charger:'Elektrikli araç şarjı'};
const observationLabels:Record<string,string>={smoke_alarm:'Duman alarmı',carbon_monoxide_alarm:'CO alarmı',
  water_leak_alarm:'Su kaçağı',door_open:'Kapı',temperature_celsius:'Sıcaklık',humidity_percent:'Nem',
  energy_kilowatt_hour:'Enerji',power_watts:'Güç',ev_charge_kilowatt_hour:'Araç şarjı',
  thermostat_target_celsius:'Termostat hedefi',light_on:'Aydınlatma',smart_plug_on:'Akıllı priz'};
const unitLabels:Record<string,string>={boolean:'',celsius:'°C',percent:'%',watt:'W',kilowatt_hour:'kWh'};
interface PendingGrant{readonly signature:string;readonly clientOperationId:string;readonly consentId:string;readonly expiresAt:string}

export function SmartHomeEnergyPanel(){
  const [center,setCenter]=useState<SmartHomeEnergyCenterView>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [deviceId,setDeviceId]=useState('');const [purpose,setPurpose]=useState<'live_view'|'doorbell_answer'>('live_view');
  const [minutes,setMinutes]=useState(15);const operationIds=useRef(new Map<string,string>());
  const pendingGrant=useRef<PendingGrant|undefined>(undefined);
  const operation=(key:string)=>{const existing=operationIds.current.get(key);if(existing)return existing;
    const id=crypto.randomUUID();operationIds.current.set(key,id);return id;};
  const reload=async()=>{if(!window.pardus)return;const next=await window.pardus.getSmartHomeEnergyCenter();
    setCenter(next);if(!deviceId){const first=next.devices.find(item=>['camera','doorbell'].includes(item.kind)&&item.status==='active');
      if(first)setDeviceId(first.id);}};
  const refresh=async()=>{setError('');try{await reload();}catch(caught){setError(caught instanceof Error?caught.message:'Akıllı ev merkezi yüklenemedi.');}};
  useEffect(()=>{void reload().catch(caught=>setError(caught instanceof Error?caught.message:'Akıllı ev merkezi yüklenemedi.'));},[]);
  const cameras=useMemo(()=>center?.devices.filter(item=>['camera','doorbell'].includes(item.kind)&&item.status==='active')??[],[center]);
  const selectedCamera=useMemo(()=>cameras.find(item=>item.id===deviceId),[cameras,deviceId]);
  const activeConsents=useMemo(()=>center?.cameraConsents.filter(item=>item.effectiveStatus==='active')??[],[center]);
  const visibleConsents=useMemo(()=>center?.cameraConsents.filter(item=>item.effectiveStatus!=='revoked')??[],[center]);
  const writesBlocked=center?.storageCapacity.mutations.limitReached===true;
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>,fixedClientOperationId?:string):Promise<boolean>=>{
    setBusy(true);setError('');try{await run(fixedClientOperationId??operation(key));
    operationIds.current.delete(key);try{await reload();}catch(caught){setError(caught instanceof Error
      ?`İşlem kaydedildi; görünüm yenilenemedi: ${caught.message}`:'İşlem kaydedildi; görünüm yenilenemedi.');}return true;
    }catch(caught){setError(caught instanceof Error?`${caught.message} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`
      :'Akıllı ev işlemi tamamlanamadı; aynı işlem kimliğiyle yeniden deneyebilirsiniz.');return false;}finally{setBusy(false);}};
  const grant=async(event:FormEvent)=>{event.preventDefault();if(!window.pardus||!deviceId)return;
    if(!Number.isInteger(minutes)||minutes<5||minutes>60){setError('İzin süresi 5 ile 60 dakika arasında tam sayı olmalıdır.');return;}
    if(purpose==='doorbell_answer'&&selectedCamera?.kind!=='doorbell'){setError('Kapı zilini yanıtlama amacı yalnız kapı zili cihazında kullanılabilir.');return;}
    const signature=JSON.stringify({deviceId,purpose,minutes});let command=pendingGrant.current;
    if(!command||command.signature!==signature){command={signature,clientOperationId:crypto.randomUUID(),consentId:crypto.randomUUID(),
      expiresAt:new Date(Date.now()+minutes*60_000).toISOString()};pendingGrant.current=command;}
    const succeeded=await mutate('grant-camera',id=>window.pardus!.grantSmartHomeCameraConsent({clientOperationId:id,
      consentId:command!.consentId,deviceId,purpose,expiresAt:command!.expiresAt}),command.clientOperationId);
    if(succeeded)pendingGrant.current=undefined;};
  const revoke=async(consent:SmartHomeCameraConsentCenterItemView)=>{if(!window.pardus)return;
    await mutate(`revoke:${consent.id}:${consent.revision}`,id=>window.pardus!.revokeSmartHomeCameraConsent({clientOperationId:id,
      consentId:consent.id,expectedRevision:consent.revision}));};
  const toggleProcessing=async()=>{if(!window.pardus||!center)return;const enabled=!center.settings.processingEnabled;
    await mutate(`processing:${center.settings.revision}:${enabled}`,id=>window.pardus!.setSmartHomeProcessing({clientOperationId:id,
      expectedRevision:center.settings.revision,enabled,reason:enabled?'Kullanıcı yerel sensör metadatası işlemeyi açtı.':'Kullanıcı yerel işlemeyi kapattı.'}));};
  return <section className="smart-home-energy panel" aria-labelledby="smart-home-energy-title">
    <div className="panel-heading"><div><span className="eyebrow">33‑Y · Yerel ve fail-closed</span><h2 id="smart-home-energy-title">Akıllı ev ve enerji</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={busy}>Yenile</button></div>
    <div className="smart-home-truth" role="note"><strong>Gizli gözetim yasaktır.</strong><span>Ham kamera/ses saklanmaz; kamera ve kapı zili erişimi görünür, varsayılan kapalı ve en çok 60 dakikadır.</span>
      <span>Matter eşleme, canlı sağlayıcı bağlantısı, cihaz kontrolü, bulut ve haricî teslimat bu pakette yapılmadı.</span></div>
    {error&&<p className="status-message danger">{error}</p>}
    {!center?<p>Yerel merkez yükleniyor…</p>:<>
      <div className="smart-home-summary"><span><strong>{center.devices.length}</strong> cihaz metadatası</span>
        <span><strong>{center.observationTotal}</strong> sensör/enerji gözlemi</span><span><strong>{activeConsents.length}</strong> etkin süreli izin</span>
        <button type="button" disabled={busy||writesBlocked} onClick={()=>void toggleProcessing()}>{center.settings.processingEnabled?'Yerel işlemeyi kapat':'Yerel işlemeyi aç'}</button></div>
      <div className="smart-home-summary" aria-label="Akıllı ev güvenli yerel kapasitesi"><span>Cihaz: {center.storageCapacity.devices.remaining}/{center.storageCapacity.devices.maximum}</span>
        <span>Gözlem: {center.storageCapacity.observations.remaining}/{center.storageCapacity.observations.maximum}</span>
        <span>İzin: {center.storageCapacity.cameraConsents.remaining}/{center.storageCapacity.cameraConsents.maximum}</span>
        <span>İşlem: {center.storageCapacity.mutations.remaining}/{center.storageCapacity.mutations.maximum}</span></div>
      {Object.values(center.storageCapacity).some(item=>item.limitReached)&&<p className="status-message danger">Güvenli yerel kapasite sınırına ulaşılan türde yeni yazım fail‑closed kapatıldı; otomatik retention kurtarması uygulanmadı.</p>}
      {center.observationsTruncated&&<p className="status-message warning">Son 500 gözlem gösteriliyor; toplam sayı ayrıca korunur.</p>}
      {center.cameraConsentsTruncated&&<p className="status-message warning">Son 500 kamera izni gösteriliyor; toplam {center.cameraConsentTotal} kayıt korunur.</p>}
      <div className="smart-home-grid"><article aria-labelledby="smart-home-devices-title"><h3 id="smart-home-devices-title">Cihaz envanteri</h3>
        {center.devices.length===0?<p>İmzalı bir yerel adapter tarafından doğrulanmış cihaz yok.</p>:center.devices.map(device=><div className="smart-home-row" key={device.id}>
          <div><strong>{device.label}</strong><small>{deviceLabels[device.kind]??device.kind}{device.room?` · ${device.room}`:''}</small>
            <small>Sağlayıcı: {device.providerId} · Adapter: {device.adapterId}</small></div><span>{device.status==='active'?'Etkin':device.status==='offline'?'Çevrimdışı':'Emekli'}</span></div>)}</article>
        <article aria-labelledby="smart-home-observations-title"><h3 id="smart-home-observations-title">Son yerel gözlemler</h3>
          {center.observations.length===0?<p>Gerçek sensör sağlayıcı verisi alınmadı.</p>:center.observations.slice(0,12).map(item=><div className="smart-home-row" key={item.id}>
            <div><strong>{observationLabels[item.kind]??item.kind}</strong><small>{new Date(item.observedAt).toLocaleString('tr-TR')}</small></div>
            <span>{item.booleanValue===undefined?item.numericValue:item.booleanValue?'Evet':'Hayır'} {unitLabels[item.unit]}</span></div>)}</article></div>
      <article className="smart-home-consent" aria-labelledby="smart-home-consent-title"><h3 id="smart-home-consent-title">Görünür ve süreli kamera izni</h3>
        {cameras.length===0?<p>Etkin kamera veya kapı zili yok; izin verilemez.</p>:<form onSubmit={event=>void grant(event)}><label>Cihaz<select value={deviceId} onChange={event=>{setDeviceId(event.target.value);pendingGrant.current=undefined;}}>{cameras.map(device=><option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
          <label>Amaç<select value={purpose} onChange={event=>{setPurpose(event.target.value as typeof purpose);pendingGrant.current=undefined;}}><option value="live_view">Canlı görünüm</option><option value="doorbell_answer" disabled={selectedCamera?.kind!=='doorbell'}>Kapı zilini yanıtlama</option></select></label>
          <label>Süre (dakika)<input type="number" min={5} max={60} step={1} value={minutes} onChange={event=>{setMinutes(Number(event.target.value));pendingGrant.current=undefined;}}/></label>
          <button type="submit" disabled={busy||!deviceId||writesBlocked||center.storageCapacity.cameraConsents.limitReached}>Süreli izin ver</button></form>}
        {visibleConsents.map(consent=><div className="smart-home-row" key={consent.id}><div><strong>{consent.purpose==='live_view'?'Canlı görünüm':'Kapı zili'}</strong>
          <small>{consent.deviceId} · {consent.effectiveStatus==='expired'?'Süresi doldu':new Date(consent.expiresAt).toLocaleTimeString('tr-TR')}</small></div>
          <button type="button" disabled={busy||writesBlocked} onClick={()=>void revoke(consent)}>{consent.effectiveStatus==='expired'?'Süresi dolan kaydı kapat':'İzni geri al'}</button></div>)}</article>
    </>}
  </section>;
}
