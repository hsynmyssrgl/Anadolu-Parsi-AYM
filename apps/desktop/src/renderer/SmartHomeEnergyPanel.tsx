import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { SmartHomeCameraConsentCenterItemView, SmartHomeEnergyCenterView } from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

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
  const {language,locale}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const deviceLabel=(kind:string)=>language==='tr'?(deviceLabels[kind]??kind):({matter_bridge:'Matter bridge',smoke_sensor:'Smoke sensor',carbon_monoxide_sensor:'CO sensor',water_leak_sensor:'Water leak sensor',door_sensor:'Door sensor',temperature_sensor:'Temperature sensor',humidity_sensor:'Humidity sensor',energy_meter:'Energy meter',thermostat:'Thermostat',light:'Lighting',smart_plug:'Smart plug',camera:'Camera',doorbell:'Doorbell',ev_charger:'Electric vehicle charger'} as Record<string,string>)[kind]??kind;
  const observationLabel=(kind:string)=>language==='tr'?(observationLabels[kind]??kind):({smoke_alarm:'Smoke alarm',carbon_monoxide_alarm:'CO alarm',water_leak_alarm:'Water leak',door_open:'Door',temperature_celsius:'Temperature',humidity_percent:'Humidity',energy_kilowatt_hour:'Energy',power_watts:'Power',ev_charge_kilowatt_hour:'Vehicle charge',thermostat_target_celsius:'Thermostat target',light_on:'Lighting',smart_plug_on:'Smart plug'} as Record<string,string>)[kind]??kind;
  const [center,setCenter]=useState<SmartHomeEnergyCenterView>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [deviceId,setDeviceId]=useState('');const [purpose,setPurpose]=useState<'live_view'|'doorbell_answer'>('live_view');
  const [minutes,setMinutes]=useState(15);const operationIds=useRef(new Map<string,string>());
  const pendingGrant=useRef<PendingGrant|undefined>(undefined);
  const operation=(key:string)=>{const existing=operationIds.current.get(key);if(existing)return existing;
    const id=crypto.randomUUID();operationIds.current.set(key,id);return id;};
  const reload=async()=>{if(!window.pardus)return;const next=await window.pardus.getSmartHomeEnergyCenter();
    setCenter(next);if(!deviceId){const first=next.devices.find(item=>['camera','doorbell'].includes(item.kind)&&item.status==='active');
      if(first)setDeviceId(first.id);}};
  const refresh=async()=>{setError('');try{await reload();}catch(caught){setError(toUserFacingErrorMessage(caught,text('Akıllı ev merkezi yüklenemedi.','Smart home center could not be loaded.')));}};
  useEffect(()=>{void reload().catch(caught=>setError(toUserFacingErrorMessage(caught,text('Akıllı ev merkezi yüklenemedi.','Smart home center could not be loaded.'))));},[]);
  const cameras=useMemo(()=>center?.devices.filter(item=>['camera','doorbell'].includes(item.kind)&&item.status==='active')??[],[center]);
  const selectedCamera=useMemo(()=>cameras.find(item=>item.id===deviceId),[cameras,deviceId]);
  const activeConsents=useMemo(()=>center?.cameraConsents.filter(item=>item.effectiveStatus==='active')??[],[center]);
  const visibleConsents=useMemo(()=>center?.cameraConsents.filter(item=>item.effectiveStatus!=='revoked')??[],[center]);
  const writesBlocked=center?.storageCapacity.mutations.limitReached===true;
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>,fixedClientOperationId?:string):Promise<boolean>=>{
    setBusy(true);setError('');try{await run(fixedClientOperationId??operation(key));
    operationIds.current.delete(key);try{await reload();}catch(caught){setError(`${text('İşlem kaydedildi; görünüm yenilenemedi:','The operation was saved; the view could not be refreshed:')} ${toUserFacingErrorMessage(caught,text('Lütfen yeniden deneyin.','Please try again.'))}`);}return true;
    }catch(caught){setError(`${toUserFacingErrorMessage(caught,text('Akıllı ev işlemi tamamlanamadı.','The smart-home operation could not be completed.'))} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation ID.')}`);return false;}finally{setBusy(false);}};
  const grant=async(event:FormEvent)=>{event.preventDefault();if(!window.pardus||!deviceId)return;
    if(!Number.isInteger(minutes)||minutes<5||minutes>60){setError(text('İzin süresi 5 ile 60 dakika arasında tam sayı olmalıdır.','Consent duration must be a whole number between 5 and 60 minutes.'));return;}
    if(purpose==='doorbell_answer'&&selectedCamera?.kind!=='doorbell'){setError(text('Kapı zilini yanıtlama amacı yalnız kapı zili cihazında kullanılabilir.','Doorbell answering may be used only with a doorbell device.'));return;}
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
    <div className="panel-heading"><div><span className="eyebrow">{text('Yerel ve güvenli biçimde kapalı','Local and safely restricted')}</span><h2 id="smart-home-energy-title">{text('Akıllı ev ve enerji','Smart home and energy')}</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={busy}>{text('Yenile','Refresh')}</button></div>
    <div className="smart-home-truth" role="note"><strong>{text('Gizli gözetim yasaktır.','Hidden surveillance is prohibited.')}</strong><span>{text('Ham kamera/ses saklanmaz; kamera ve kapı zili erişimi görünür, varsayılan kapalı ve en çok 60 dakikadır.','Raw camera/audio is not stored; camera and doorbell access is visible, off by default and limited to 60 minutes.')}</span>
      <span>{text('Akıllı ev eşleme, canlı hizmet bağlantısı, cihaz kontrolü, bulut ve haricî teslimat bu sürümde kullanılmaz.','Smart-home pairing, live service connections, device control, cloud services, and external delivery are unavailable in this release.')}</span></div>
    {error&&<p className="status-message danger">{error}</p>}
    {!center?<p>{text('Yerel merkez yükleniyor…','Loading local center…')}</p>:<>
      <div className="smart-home-summary"><span><strong>{center.devices.length}</strong> {text('cihaz kaydı','device records')}</span>
        <span><strong>{center.observationTotal}</strong> {text('sensör/enerji gözlemi','sensor/energy observations')}</span><span><strong>{activeConsents.length}</strong> {text('etkin süreli izin','active time-bound consents')}</span>
        <button type="button" disabled={busy||writesBlocked} onClick={()=>void toggleProcessing()}>{center.settings.processingEnabled?text('Yerel işlemeyi kapat','Disable local processing'):text('Yerel işlemeyi aç','Enable local processing')}</button></div>
      <div className="smart-home-summary" aria-label={text('Akıllı ev güvenli yerel kapasitesi','Smart-home safe local capacity')}><span>{text('Cihaz','Device')}: {center.storageCapacity.devices.remaining}/{center.storageCapacity.devices.maximum}</span>
        <span>{text('Gözlem','Observation')}: {center.storageCapacity.observations.remaining}/{center.storageCapacity.observations.maximum}</span>
        <span>{text('İzin','Consent')}: {center.storageCapacity.cameraConsents.remaining}/{center.storageCapacity.cameraConsents.maximum}</span>
        <span>{text('İşlem','Operation')}: {center.storageCapacity.mutations.remaining}/{center.storageCapacity.mutations.maximum}</span></div>
      {Object.values(center.storageCapacity).some(item=>item.limitReached)&&<p className="status-message danger">{text('Güvenli yerel kapasite sınırına ulaşıldı; yeni kayıt güvenli biçimde durduruldu ve eski kayıtlar otomatik silinmedi.','The safe local capacity limit was reached; new records were safely stopped and older records were not deleted automatically.')}</p>}
      {center.observationsTruncated&&<p className="status-message warning">{text('Son 500 gözlem gösteriliyor; toplam sayı ayrıca korunur.','The latest 500 observations are shown; the total count is preserved separately.')}</p>}
      {center.cameraConsentsTruncated&&<p className="status-message warning">{text('Son 500 kamera izni gösteriliyor; toplam','The latest 500 camera consents are shown; a total of')} {center.cameraConsentTotal} {text('kayıt korunur.','records is preserved.')}</p>}
      <div className="smart-home-grid"><article aria-labelledby="smart-home-devices-title"><h3 id="smart-home-devices-title">{text('Cihaz envanteri','Device inventory')}</h3>
        {center.devices.length===0?<p>{text('İmzalı bir yerel adapter tarafından doğrulanmış cihaz yok.','No device has been verified by a signed local adapter.')}</p>:center.devices.map(device=><div className="smart-home-row" key={device.id}>
          <div><strong>{device.label}</strong><small>{deviceLabel(device.kind)}{device.room?` · ${device.room}`:''}</small>
            <small>{text('Bağlantı ayrıntıları yalnız yerel cihaz kaydında tutulur.','Connection details are kept only in the local device record.')}</small></div><span>{device.status==='active'?text('Etkin','Active'):device.status==='offline'?text('Çevrimdışı','Offline'):text('Kullanımdan kaldırıldı','Retired')}</span></div>)}</article>
        <article aria-labelledby="smart-home-observations-title"><h3 id="smart-home-observations-title">{text('Son yerel gözlemler','Recent local observations')}</h3>
          {center.observations.length===0?<p>{text('Gerçek sensör sağlayıcı verisi alınmadı.','No real sensor-provider data has been received.')}</p>:center.observations.slice(0,12).map(item=><div className="smart-home-row" key={item.id}>
            <div><strong>{observationLabel(item.kind)}</strong><small>{new Date(item.observedAt).toLocaleString(locale)}</small></div>
            <span>{item.booleanValue===undefined?item.numericValue:item.booleanValue?text('Evet','Yes'):text('Hayır','No')} {unitLabels[item.unit]}</span></div>)}</article></div>
      <article className="smart-home-consent" aria-labelledby="smart-home-consent-title"><h3 id="smart-home-consent-title">{text('Görünür ve süreli kamera izni','Visible, time-bound camera consent')}</h3>
        {cameras.length===0?<p>{text('Etkin kamera veya kapı zili yok; izin verilemez.','There is no active camera or doorbell; consent cannot be granted.')}</p>:<form onSubmit={event=>void grant(event)}><label>{text('Cihaz','Device')}<select value={deviceId} onChange={event=>{setDeviceId(event.target.value);pendingGrant.current=undefined;}}>{cameras.map(device=><option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
          <label>{text('Amaç','Purpose')}<select value={purpose} onChange={event=>{setPurpose(event.target.value as typeof purpose);pendingGrant.current=undefined;}}><option value="live_view">{text('Canlı görünüm','Live view')}</option><option value="doorbell_answer" disabled={selectedCamera?.kind!=='doorbell'}>{text('Kapı zilini yanıtlama','Answer doorbell')}</option></select></label>
          <label>{text('Süre (dakika)','Duration (minutes)')}<input type="number" min={5} max={60} step={1} value={minutes} onChange={event=>{setMinutes(Number(event.target.value));pendingGrant.current=undefined;}}/></label>
          <button type="submit" disabled={busy||!deviceId||writesBlocked||center.storageCapacity.cameraConsents.limitReached}>{text('Süreli izin ver','Grant time-bound consent')}</button></form>}
        {visibleConsents.map(consent=><div className="smart-home-row" key={consent.id}><div><strong>{consent.purpose==='live_view'?text('Canlı görünüm','Live view'):text('Kapı zili','Doorbell')}</strong>
          <small>{consent.deviceId} · {consent.effectiveStatus==='expired'?text('Süresi doldu','Expired'):new Date(consent.expiresAt).toLocaleTimeString(locale)}</small></div>
          <button type="button" disabled={busy||writesBlocked} onClick={()=>void revoke(consent)}>{consent.effectiveStatus==='expired'?text('Süresi dolan kaydı kapat','Close expired record'):text('İzni geri al','Revoke consent')}</button></div>)}</article>
    </>}
  </section>;
}
