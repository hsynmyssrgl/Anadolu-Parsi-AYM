import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { SmartHomeCameraConsentView, SmartHomeEnergyCenterView } from '@ppt/domain';

const deviceLabels:Record<string,string>={matter_bridge:'Matter köprüsü',smoke_sensor:'Duman sensörü',
  carbon_monoxide_sensor:'CO sensörü',water_leak_sensor:'Su kaçağı sensörü',door_sensor:'Kapı sensörü',
  temperature_sensor:'Sıcaklık sensörü',humidity_sensor:'Nem sensörü',energy_meter:'Enerji sayacı',thermostat:'Termostat',
  light:'Aydınlatma',smart_plug:'Akıllı priz',camera:'Kamera',doorbell:'Kapı zili',ev_charger:'Elektrikli araç şarjı'};
const observationLabels:Record<string,string>={smoke_alarm:'Duman alarmı',carbon_monoxide_alarm:'CO alarmı',
  water_leak_alarm:'Su kaçağı',door_open:'Kapı',temperature_celsius:'Sıcaklık',humidity_percent:'Nem',
  energy_kilowatt_hour:'Enerji',power_watts:'Güç',ev_charge_kilowatt_hour:'Araç şarjı',
  thermostat_target_celsius:'Termostat hedefi',light_on:'Aydınlatma',smart_plug_on:'Akıllı priz'};
const unitLabels:Record<string,string>={boolean:'',celsius:'°C',percent:'%',watt:'W',kilowatt_hour:'kWh'};

export function SmartHomeEnergyPanel(){
  const [center,setCenter]=useState<SmartHomeEnergyCenterView>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [deviceId,setDeviceId]=useState('');const [purpose,setPurpose]=useState<'live_view'|'doorbell_answer'>('live_view');
  const [minutes,setMinutes]=useState(15);const operationIds=useRef(new Map<string,string>());
  const operation=(key:string)=>{const existing=operationIds.current.get(key);if(existing)return existing;
    const id=crypto.randomUUID();operationIds.current.set(key,id);return id;};
  const refresh=async()=>{if(!window.pardus)return;setError('');try{const next=await window.pardus.getSmartHomeEnergyCenter();
    setCenter(next);if(!deviceId){const first=next.devices.find(item=>['camera','doorbell'].includes(item.kind)&&item.status==='active');
      if(first)setDeviceId(first.id);}}catch(caught){setError(caught instanceof Error?caught.message:'Akıllı ev merkezi yüklenemedi.');}};
  useEffect(()=>{void refresh();},[]);
  const cameras=useMemo(()=>center?.devices.filter(item=>['camera','doorbell'].includes(item.kind)&&item.status==='active')??[],[center]);
  const activeConsents=useMemo(()=>center?.cameraConsents.filter(item=>item.status==='active'&&Date.parse(item.expiresAt)>Date.now())??[],[center]);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(true);setError('');try{await run(operation(key));
    operationIds.current.delete(key);await refresh();}catch(caught){setError(caught instanceof Error
      ?`${caught.message} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`:'Akıllı ev işlemi tamamlanamadı.');}finally{setBusy(false);}};
  const grant=async(event:FormEvent)=>{event.preventDefault();if(!window.pardus||!deviceId)return;const consentId=crypto.randomUUID();
    await mutate(`grant:${consentId}`,id=>window.pardus!.grantSmartHomeCameraConsent({clientOperationId:id,consentId,deviceId,purpose,
      expiresAt:new Date(Date.now()+Math.min(60,Math.max(5,minutes))*60_000).toISOString()}));};
  const revoke=async(consent:SmartHomeCameraConsentView)=>{if(!window.pardus)return;
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
        <button type="button" disabled={busy} onClick={()=>void toggleProcessing()}>{center.settings.processingEnabled?'Yerel işlemeyi kapat':'Yerel işlemeyi aç'}</button></div>
      {center.observationsTruncated&&<p className="status-message warning">Son 500 gözlem gösteriliyor; toplam sayı ayrıca korunur.</p>}
      <div className="smart-home-grid"><article aria-labelledby="smart-home-devices-title"><h3 id="smart-home-devices-title">Cihaz envanteri</h3>
        {center.devices.length===0?<p>İmzalı bir yerel adapter tarafından doğrulanmış cihaz yok.</p>:center.devices.map(device=><div className="smart-home-row" key={device.id}>
          <div><strong>{device.label}</strong><small>{deviceLabels[device.kind]??device.kind}{device.room?` · ${device.room}`:''}</small>
            <small>Sağlayıcı: {device.providerId} · Adapter: {device.adapterId}</small></div><span>{device.status==='active'?'Etkin':device.status==='offline'?'Çevrimdışı':'Emekli'}</span></div>)}</article>
        <article aria-labelledby="smart-home-observations-title"><h3 id="smart-home-observations-title">Son yerel gözlemler</h3>
          {center.observations.length===0?<p>Gerçek sensör sağlayıcı verisi alınmadı.</p>:center.observations.slice(0,12).map(item=><div className="smart-home-row" key={item.id}>
            <div><strong>{observationLabels[item.kind]??item.kind}</strong><small>{new Date(item.observedAt).toLocaleString('tr-TR')}</small></div>
            <span>{item.booleanValue===undefined?item.numericValue:item.booleanValue?'Evet':'Hayır'} {unitLabels[item.unit]}</span></div>)}</article></div>
      <article className="smart-home-consent" aria-labelledby="smart-home-consent-title"><h3 id="smart-home-consent-title">Görünür ve süreli kamera izni</h3>
        {cameras.length===0?<p>Etkin kamera veya kapı zili yok; izin verilemez.</p>:<form onSubmit={event=>void grant(event)}><label>Cihaz<select value={deviceId} onChange={event=>setDeviceId(event.target.value)}>{cameras.map(device=><option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
          <label>Amaç<select value={purpose} onChange={event=>setPurpose(event.target.value as typeof purpose)}><option value="live_view">Canlı görünüm</option><option value="doorbell_answer">Kapı zilini yanıtlama</option></select></label>
          <label>Süre (dakika)<input type="number" min={5} max={60} value={minutes} onChange={event=>setMinutes(Number(event.target.value))}/></label>
          <button type="submit" disabled={busy||!deviceId}>Süreli izin ver</button></form>}
        {activeConsents.map(consent=><div className="smart-home-row" key={consent.id}><div><strong>{consent.purpose==='live_view'?'Canlı görünüm':'Kapı zili'}</strong>
          <small>{consent.deviceId} · {new Date(consent.expiresAt).toLocaleTimeString('tr-TR')}</small></div><button type="button" disabled={busy} onClick={()=>void revoke(consent)}>İzni geri al</button></div>)}</article>
    </>}
  </section>;
}
