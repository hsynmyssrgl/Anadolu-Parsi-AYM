import { useEffect, useRef, useState } from 'react';
import type { SignedPluginInstallationView, SignedPluginPlatformCenterView } from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

const providerLabels:Readonly<Record<string,readonly [string,string]>>={bank:['Banka','Bank'],school:['Okul','School'],matter:['Akıllı ev','Smart home'],fhir:['Sağlık','Health'],onedrive:['Dosya depolama','File storage'],
  maps:['Harita','Maps'],ocr:['Metin tanıma','Text recognition'],ai:['Yapay zekâ','AI'],browser:['Tarayıcı','Browser']};
export const signedPluginProviderLabel=(kind:string,language:'tr'|'en'):string=>(providerLabels[kind]??['Haricî hizmet','External service'])[language==='tr'?0:1];
const desiredStateLabel:Record<string,string>={enabled:'Etkin olması istendi',disabled:'Kapalı',emergency_disabled:'Acil kapatıldı'};

export function SignedPluginPlatformPanel(){
  const {language}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const [center,setCenter]=useState<SignedPluginPlatformCenterView>();const [error,setError]=useState('');const [busy,setBusy]=useState('');
  const operations=useRef(new Map<string,string>());
  const operationId=(key:string)=>{const current=operations.current.get(key);if(current)return current;const next=crypto.randomUUID();
    operations.current.set(key,next);return next;};
  const refresh=async():Promise<boolean>=>{if(!window.pardus)return false;setError('');
    try{setCenter(await window.pardus.getSignedPluginPlatformCenter());return true;}
    catch(caught){setError(toUserFacingErrorMessage(caught,text('İmzalı eklenti merkezi yüklenemedi.','Signed plugin center could not be loaded.')));return false;}};
  useEffect(()=>{void refresh();},[]);
  const mutate=async(key:string,run:(clientOperationId:string)=>Promise<unknown>)=>{setBusy(key);setError('');
    try{await run(operationId(key));operations.current.delete(key);if(!await refresh())setError(text('Değişiklik kaydedildi; güncel merkez yeniden yüklenemedi. Yenileyin.','The change was saved, but the current center could not be reloaded. Refresh the page.'));}
    catch(caught){setError(`${toUserFacingErrorMessage(caught,text('Eklenti durumu değiştirilemedi.','Plugin state could not be changed.'))} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation ID.')}`);}finally{setBusy('');}};
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
      <h2 id="signed-plugin-platform-title">{text('Eklenti ve haricî hizmetler','Plugins and external services')}</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>{text('Yenile','Refresh')}</button></div>
    <div className="signed-plugin-truth" role="note"><strong>{text('Bu ekran eklenti kodu çalıştırmaz.','This screen does not execute plugin code.')}</strong>
      <span>{text('Her eklenti için imza, en az yetki, veri amacı, saklama süresi, izinli bağlantılar, lisans ve kaynak doğrulaması aranır.','Each plugin requires a verified signature, minimum permissions, a data purpose, a retention period, allowed connections, a license, and source verification.')}</span>
      <span>{text('Canlı sürüm imza güveni, çalışma alanı yalıtımı ve banka, okul, sağlık, akıllı ev, dosya, harita, metin tanıma, yapay zekâ veya tarayıcı bağlantıları doğrulanmamıştır.','Live-release signature trust, workspace isolation, and connections to banking, school, health, smart-home, file, map, text-recognition, AI, or browser services have not been verified.')}</span></div>
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
        <p>{item.currentRelease.providerKinds.map(kind=>signedPluginProviderLabel(kind,language)).join(', ')}</p>
        <small>{item.currentRelease.capabilityCodes.length} {text('izin alanı','permission areas')} · {item.currentRelease.egressMode==='none'?text('Ağ bağlantısı yok','No network connection'):`${item.currentRelease.egressHostCount} ${text('izinli ağ hedefi','allowed network destinations')}`}</small>
        <small>{text('En düşük uygulama sürümü','Minimum application version')} {item.currentRelease.minimumHostVersion} · {text('kayıt belgesi','registry document')} {item.currentRelease.manifestStatus==='valid'?text('geçerli','valid'):text('süresi dolmuş','expired')} · {text('sürüm geçmişi','release history')} {item.releaseHistoryCount}/64.</small>
        <small>{text('İmza, lisans ve kaynak bütünlüğü kayıtları mevcut · çalışma alanı yalıtımı bildirilmiş, ancak canlı çalışmada doğrulanmamıştır. Eski kayıtlar otomatik silinmez.','Signature, license, and source-integrity records are present. Workspace isolation is declared but has not been verified during live operation. Older records are not deleted automatically.')}</small>
        <div className="signed-plugin-actions"><button type="button" disabled={Boolean(busy)||item.desiredState==='emergency_disabled'
          ||(item.desiredState!=='enabled'&&item.currentRelease.manifestStatus==='expired')} onClick={()=>void toggle(item)}>
          {item.desiredState==='enabled'?text('Kapat','Disable'):text('Etkin olmasını iste','Request enablement')}</button>
          <button type="button" disabled={Boolean(busy)||item.desiredState==='emergency_disabled'} onClick={()=>void emergency(item)}>{text('Acil kapat','Emergency disable')}</button>
          <button type="button" disabled={Boolean(busy)||item.desiredState==='emergency_disabled'||!item.rollbackAvailable
            ||!item.previousVersion} onClick={()=>void rollback(item)}>{text('Önceki sürüme dön','Roll back to previous version')}</button></div>
      </article>)}</>}
  </section>;
}
