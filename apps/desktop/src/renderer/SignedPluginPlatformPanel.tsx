import { useEffect, useRef, useState } from 'react';
import type { SignedPluginInstallationView, SignedPluginPlatformCenterView } from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';

const providerLabels:Record<string,string>={bank:'Banka',school:'Okul',matter:'Matter',fhir:'FHIR',onedrive:'OneDrive',
  maps:'Harita',ocr:'OCR',ai:'AI',browser:'Tarayıcı'};
const desiredStateLabel:Record<string,string>={enabled:'Etkin olması istendi',disabled:'Kapalı',emergency_disabled:'Acil kapatıldı'};

export function SignedPluginPlatformPanel(){
  const {language}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const [center,setCenter]=useState<SignedPluginPlatformCenterView>();const [error,setError]=useState('');const [busy,setBusy]=useState('');
  const operations=useRef(new Map<string,string>());
  const operationId=(key:string)=>{const current=operations.current.get(key);if(current)return current;const next=crypto.randomUUID();
    operations.current.set(key,next);return next;};
  const refresh=async():Promise<boolean>=>{if(!window.pardus)return false;setError('');
    try{setCenter(await window.pardus.getSignedPluginPlatformCenter());return true;}
    catch(caught){setError(caught instanceof Error?caught.message:text('İmzalı eklenti merkezi yüklenemedi.','Signed plugin center could not be loaded.'));return false;}};
  useEffect(()=>{void refresh();},[]);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');
    try{await run(operationId(key));operations.current.delete(key);if(!await refresh())setError(text('Değişiklik kaydedildi; güncel merkez yeniden yüklenemedi. Yenileyin.','The change was saved, but the current center could not be reloaded. Refresh the page.'));}
    catch(caught){setError(caught instanceof Error?`${caught.message} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation ID.')}`
      :text('Eklenti durumu değiştirilemedi. Aynı işlem kimliği korunuyor.','Plugin state could not be changed. The same operation ID is preserved.'));}finally{setBusy('');}};
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
    <div className="panel-heading"><div><span className="eyebrow">{text('İmzalı aday kaydı','Signed candidate registry')}</span>
      <h2 id="signed-plugin-platform-title">{text('Eklenti ve dış sağlayıcı platformu','Plugin and external provider platform')}</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>{text('Yenile','Refresh')}</button></div>
    <div className="signed-plugin-truth" role="note"><strong>{text('Bu ekran eklenti kodu çalıştırmaz.','This screen does not execute plugin code.')}</strong>
      <span>{text('Ed25519 manifesti, minimum yetki, veri amacı, retention, egress allowlist, SBOM, lisans ve provenance kanıtı kayıt sınırıdır.','The Ed25519 manifest, minimum permissions, data purpose, retention, egress allowlist, SBOM, license and provenance evidence form the registry boundary.')}</span>
      <span>{text('Production imza güveni, gerçek sandbox/ağ izolasyonu ve banka, okul, Matter, FHIR, OneDrive, harita, OCR, AI veya tarayıcı bağlantısı doğrulanmadı.','Production signature trust, real sandbox/network isolation, and bank, school, Matter, FHIR, OneDrive, map, OCR, AI or browser connectivity have not been verified.')}</span></div>
    {error&&<p className="status-message danger">{error}</p>}
    {!center?<p>{text('Yerel eklenti merkezi yükleniyor…','Loading the local plugin center…')}</p>:<>
      <div className="signed-plugin-summary"><span><strong>{center.installationTotal}</strong> {text('yerel aday','local candidates')}</span>
        <span><strong>{center.installations.filter(item=>item.desiredState==='enabled').length}</strong> {text('etkin olması istenen','requested to be enabled')}</span>
        <span><strong>0</strong> {text('çalıştırılmış eklenti','executed plugins')}</span>
        <span><strong>{center.storageCapacity.installations.remaining}</strong> {text('kurulum yuvası kaldı','installation slots remaining')}</span>
        <span><strong>{center.storageCapacity.mutations.remaining}</strong> {text('mutasyon yuvası kaldı','mutation slots remaining')}</span></div>
      {center.installations.length===0?<p>{text('Yerel güvenilen imza anahtarıyla doğrulanmış eklenti adayı yok.','No plugin candidate has been verified with a locally trusted signing key.')}</p>:center.installations.map(item=><article className="signed-plugin-card" key={item.id}>
        <div className="signed-plugin-card-heading"><div><strong>{item.displayName}</strong><small>{item.id} · {item.currentRelease.version}</small></div>
          <span>{language==='tr'?desiredStateLabel[item.desiredState]:({enabled:'Enable requested',disabled:'Disabled',emergency_disabled:'Emergency disabled'} as const)[item.desiredState]}</span></div>
        <p>{item.currentRelease.providerKinds.map(kind=>language==='tr'?(providerLabels[kind]??kind):({bank:'Bank',school:'School',matter:'Matter',fhir:'FHIR',onedrive:'OneDrive',maps:'Maps',ocr:'OCR',ai:'AI',browser:'Browser'} as Record<string,string>)[kind]??kind).join(', ')}</p>
        <small>{item.currentRelease.capabilityCodes.join(' · ')} · {item.currentRelease.egressMode==='none'?text('Ağ yok','No network'):`${item.currentRelease.egressHostCount} ${text('exact egress hostu','exact egress hosts')}`}</small>
        <small>{text('Minimum uygulama','Minimum application')} {item.currentRelease.minimumHostVersion} · {text('manifest','manifest')} {item.currentRelease.manifestStatus==='valid'?text('geçerli','valid'):text('süresi dolmuş','expired')} · {text('sürüm geçmişi','release history')} {item.releaseHistoryCount}/64.</small>
        <small>{text('İmza, SBOM, lisans ve provenance hash kanıtları mevcut · sandbox beyanı var; runtime doğrulaması yok. Otomatik retention kurtarma yok.','Signature, SBOM, license and provenance hash evidence are present · a sandbox declaration exists, but runtime verification does not. There is no automatic retention recovery.')}</small>
        <div className="signed-plugin-actions"><button type="button" disabled={Boolean(busy)||item.desiredState==='emergency_disabled'
          ||(item.desiredState!=='enabled'&&item.currentRelease.manifestStatus==='expired')} onClick={()=>void toggle(item)}>
          {item.desiredState==='enabled'?text('Kapat','Disable'):text('Etkin olmasını iste','Request enablement')}</button>
          <button type="button" disabled={Boolean(busy)||item.desiredState==='emergency_disabled'} onClick={()=>void emergency(item)}>{text('Acil kapat','Emergency disable')}</button>
          <button type="button" disabled={Boolean(busy)||item.desiredState==='emergency_disabled'||!item.rollbackAvailable
            ||!item.previousVersion} onClick={()=>void rollback(item)}>{text('Önceki sürüme dön','Roll back to previous version')}</button></div>
      </article>)}</>}
  </section>;
}
