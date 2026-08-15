import { useEffect, useRef, useState } from 'react';
import type { SignedPluginInstallationView, SignedPluginPlatformCenterView } from '@ppt/domain';

const providerLabels:Record<string,string>={bank:'Banka',school:'Okul',matter:'Matter',fhir:'FHIR',onedrive:'OneDrive',
  maps:'Harita',ocr:'OCR',ai:'AI',browser:'Tarayıcı'};
const desiredStateLabel:Record<string,string>={enabled:'Etkin olması istendi',disabled:'Kapalı',emergency_disabled:'Acil kapatıldı'};

export function SignedPluginPlatformPanel(){
  const [center,setCenter]=useState<SignedPluginPlatformCenterView>();const [error,setError]=useState('');const [busy,setBusy]=useState('');
  const operations=useRef(new Map<string,string>());
  const operationId=(key:string)=>{const current=operations.current.get(key);if(current)return current;const next=crypto.randomUUID();
    operations.current.set(key,next);return next;};
  const refresh=async()=>{if(!window.pardus)return;setError('');try{setCenter(await window.pardus.getSignedPluginPlatformCenter());}
    catch(caught){setError(caught instanceof Error?caught.message:'İmzalı eklenti merkezi yüklenemedi.');}};
  useEffect(()=>{void refresh();},[]);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{await run(operationId(key));
    operations.current.delete(key);await refresh();}catch(caught){setError(caught instanceof Error
      ?`${caught.message} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`:'Eklenti durumu değiştirilemedi.');}finally{setBusy('');}};
  const toggle=async(item:SignedPluginInstallationView)=>{if(!window.pardus)return;const enabled=item.desiredState!=='enabled';
    await mutate(`desired:${item.id}:${item.revision}:${enabled}`,clientOperationId=>window.pardus!.setSignedPluginDesiredState({
      clientOperationId,pluginId:item.id,expectedRevision:item.revision,enabled,
      reason:enabled?'Kullanıcı doğrulanmış eklentinin etkin olmasını istedi.':'Kullanıcı eklentiyi yerel kayıt düzeyinde kapattı.'}));};
  const emergency=async(item:SignedPluginInstallationView)=>{if(!window.pardus)return;
    await mutate(`emergency:${item.id}:${item.revision}`,clientOperationId=>window.pardus!.emergencyDisableSignedPlugin({
      clientOperationId,pluginId:item.id,expectedRevision:item.revision,confirmation:'EKLENTIYI ACIL DURDUR',
      reason:'Kullanıcı şüpheli veya istenmeyen eklenti için acil kapatma istedi.'}));};
  const rollback=async(item:SignedPluginInstallationView)=>{if(!window.pardus||!item.previousVersion)return;
    await mutate(`rollback:${item.id}:${item.revision}:${item.previousVersion}`,clientOperationId=>window.pardus!.rollbackSignedPlugin({
      clientOperationId,pluginId:item.id,expectedRevision:item.revision,targetVersion:item.previousVersion!,confirmation:'ONCEKI SURUME DON'}));};
  return <section className="signed-plugin-platform panel" aria-labelledby="signed-plugin-platform-title">
    <div className="panel-heading"><div><span className="eyebrow">33-Z · İmzalı aday kayıt</span>
      <h2 id="signed-plugin-platform-title">Eklenti ve dış sağlayıcı platformu</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>Yenile</button></div>
    <div className="signed-plugin-truth" role="note"><strong>Bu ekran eklenti kodu çalıştırmaz.</strong>
      <span>Ed25519 manifesti, minimum yetki, veri amacı, retention, egress allowlist, SBOM, lisans ve provenance kanıtı kayıt sınırıdır.</span>
      <span>Production imza güveni, gerçek sandbox/ağ izolasyonu ve banka, okul, Matter, FHIR, OneDrive, harita, OCR, AI veya tarayıcı bağlantısı doğrulanmadı.</span></div>
    {error&&<p className="status-message danger">{error}</p>}
    {!center?<p>Yerel eklenti merkezi yükleniyor…</p>:<>
      <div className="signed-plugin-summary"><span><strong>{center.installations.length}</strong> yerel aday</span>
        <span><strong>{center.installations.filter(item=>item.desiredState==='enabled').length}</strong> etkin olması istenen</span>
        <span><strong>0</strong> çalıştırılmış eklenti</span></div>
      {center.installations.length===0?<p>Güvenilir production anahtarıyla doğrulanmış eklenti adayı yok.</p>:center.installations.map(item=><article className="signed-plugin-card" key={item.id}>
        <div className="signed-plugin-card-heading"><div><strong>{item.displayName}</strong><small>{item.id} · {item.currentRelease.version}</small></div>
          <span>{desiredStateLabel[item.desiredState]}</span></div>
        <p>{item.currentRelease.providerKinds.map(kind=>providerLabels[kind]??kind).join(', ')}</p>
        <small>{item.currentRelease.capabilityCodes.join(' · ')} · {item.currentRelease.egressMode==='none'?'Ağ yok':`${item.currentRelease.egressHostCount} exact egress hostu`}</small>
        <small>İmza, SBOM, lisans ve provenance hash kanıtları mevcut · sandbox beyanı var; runtime doğrulaması yok.</small>
        <div className="signed-plugin-actions"><button type="button" disabled={Boolean(busy)||item.desiredState==='emergency_disabled'} onClick={()=>void toggle(item)}>
          {item.desiredState==='enabled'?'Kapat':'Etkin olmasını iste'}</button>
          <button type="button" disabled={Boolean(busy)||item.desiredState==='emergency_disabled'} onClick={()=>void emergency(item)}>Acil kapat</button>
          <button type="button" disabled={Boolean(busy)||!item.rollbackAvailable||!item.previousVersion} onClick={()=>void rollback(item)}>Önceki sürüme dön</button></div>
      </article>)}</>}
  </section>;
}
