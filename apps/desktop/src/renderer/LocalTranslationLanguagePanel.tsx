import { useEffect, useRef, useState } from 'react';
import type {
  LocalTranslationCenterView,
  LocalTranslationDictionaryCategory,
  LocalTranslationProviderMode,
  LocalTranslationSourceKind
} from '@ppt/domain';
import { selectUiCopy, useLocalization } from './localization';

const categoryLabels:Record<LocalTranslationDictionaryCategory,string>={
  family_name:'Aile adı',nickname:'Lakap',place:'Yer',medical_term:'Tıbbi terim'
};
const sourceLabels:Record<LocalTranslationSourceKind,string>={
  message:'Mesaj',live_caption:'Canlı altyazı',document:'Belge',meeting_summary:'Toplantı özeti'
};

export function LocalTranslationLanguagePanel(){
  const {language}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const categoryLabel=(value:LocalTranslationDictionaryCategory)=>language==='tr'?categoryLabels[value]:({family_name:'Family name',nickname:'Nickname',place:'Place',medical_term:'Medical term'} as const)[value];
  const sourceLabel=(value:LocalTranslationSourceKind)=>language==='tr'?sourceLabels[value]:({message:'Message',live_caption:'Live caption',document:'Document',meeting_summary:'Meeting summary'} as const)[value];
  const [center,setCenter]=useState<LocalTranslationCenterView>();
  const [busy,setBusy]=useState('');const [error,setError]=useState('');
  const [preferredLanguage,setPreferredLanguage]=useState('tr');const [secondaryLanguage,setSecondaryLanguage]=useState('en');
  const [sourceTerm,setSourceTerm]=useState('');const [preferredTerm,setPreferredTerm]=useState('');
  const [dictionarySourceLanguage,setDictionarySourceLanguage]=useState('tr');
  const [dictionaryTargetLanguage,setDictionaryTargetLanguage]=useState('en');const [editingEntryId,setEditingEntryId]=useState('');
  const [category,setCategory]=useState<LocalTranslationDictionaryCategory>('family_name');
  const [sourceResourceId,setSourceResourceId]=useState('');const [targetLanguage,setTargetLanguage]=useState('en');
  const [sourceKind,setSourceKind]=useState<LocalTranslationSourceKind>('message');
  const [providerMode,setProviderMode]=useState<LocalTranslationProviderMode>('local_offline');
  const [externalConsent,setExternalConsent]=useState(false);const [correction,setCorrection]=useState('');
  const operations=useRef(new Map<string,string>());
  const operationId=(key:string)=>{const existing=operations.current.get(key);if(existing)return existing;
    const created=crypto.randomUUID();operations.current.set(key,created);return created;};
  const refresh=async()=>{if(!window.pardus)return;setError('');try{const value=await window.pardus.getLocalTranslationCenter();
    setCenter(value);setPreferredLanguage(value.profile.preferredLanguage);setSecondaryLanguage(value.profile.secondaryLanguages[0]??'en');
  }catch(caught){setError(caught instanceof Error?caught.message:text('Dil ve çeviri merkezi yüklenemedi.','Language and translation center could not be loaded.'));}};
  useEffect(()=>{void refresh();},[]);
  const mutate=async(key:string,run:(id:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{await run(operationId(key));
    operations.current.delete(key);await refresh();}catch(caught){setError(caught instanceof Error
      ?`${caught.message} ${text('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.','You can retry with the same operation ID.')}`:text('Dil ve çeviri metadata işlemi tamamlanamadı.','The language and translation metadata operation could not be completed.'));}finally{setBusy('');}};
  const profile=center?.profile;
  const saveProfile=()=>window.pardus&&profile&&mutate(`profile:${profile.revision}`,clientOperationId=>
    window.pardus!.updateLocalTranslationProfile({clientOperationId,expectedRevision:profile.revision,
      preferredLanguage,secondaryLanguages:secondaryLanguage.trim()?[secondaryLanguage.trim()]:[],
      liveCaptionTranslationEnabled:profile.liveCaptionTranslationEnabled,
      translatedSpeechEnabled:profile.translatedSpeechEnabled,preserveOriginalAudio:true,
      externalProviderAllowed:providerMode==='external_preview',encryptedSyncRequested:profile.encryptedSyncRequested}));
  const saveDictionary=()=>window.pardus&&profile&&sourceTerm.trim()&&preferredTerm.trim()&&mutate(
    `dictionary:${editingEntryId||'new'}:${profile.revision}:${sourceTerm.trim()}`,async clientOperationId=>{
      const common={clientOperationId,expectedRevision:profile.revision,category,sourceLanguage:dictionarySourceLanguage,
        targetLanguage:dictionaryTargetLanguage,sourceTerm:sourceTerm.trim(),preferredTerm:preferredTerm.trim(),explicitPermission:true as const};
      const result=editingEntryId?await window.pardus!.updateLocalTranslationDictionaryEntry({...common,entryId:editingEntryId})
        :await window.pardus!.addLocalTranslationDictionaryEntry(common);
      setEditingEntryId('');setSourceTerm('');setPreferredTerm('');return result;});
  const deleteDictionary=(entryId:string)=>window.pardus&&profile&&mutate(`dictionary-delete:${profile.revision}:${entryId}`,
    clientOperationId=>window.pardus!.deleteLocalTranslationDictionaryEntry({clientOperationId,
      expectedRevision:profile.revision,entryId,reason:'Bu kişisel sözlük girdisini artık kullanmak istemiyorum.'}));
  const prepare=()=>window.pardus&&sourceResourceId.trim()&&mutate(`request:${sourceKind}:${sourceResourceId.trim()}:${targetLanguage}`,
    clientOperationId=>window.pardus!.prepareLocalTranslationRequest({clientOperationId,expectedRevision:0,sourceKind,
      sourceResourceId:sourceResourceId.trim(),targetLanguage,providerMode,
      externalPreviewAcknowledged:providerMode==='external_preview'&&externalConsent,
      explicitExternalConsent:providerMode==='external_preview'&&externalConsent}));
  const correct=(requestId:string,expectedRevision:number)=>window.pardus&&correction.trim()&&mutate(
    `correction:${requestId}:${expectedRevision}`,clientOperationId=>window.pardus!.recordLocalTranslationCorrection({
      clientOperationId,expectedRevision,requestId,correctedText:correction.trim(),explicitPermission:true}));
  const cancel=(requestId:string,expectedRevision:number)=>window.pardus&&mutate(`cancel:${requestId}:${expectedRevision}`,
    clientOperationId=>window.pardus!.cancelLocalTranslationRequest({clientOperationId,expectedRevision,requestId,
      reason:'Bu çeviri hazırlık talebine artık ihtiyaç yok.'}));
  return <section className="local-translation panel" aria-labelledby="local-translation-title">
    <div className="panel-heading"><div><span className="eyebrow">{text('Yerel öncelikli dil merkezi','Local-first language center')}</span>
      <h2 id="local-translation-title">{text('Çeviri, altyazı ve kişisel sözlük','Translation, captions and personal dictionary')}</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>{text('Yenile','Refresh')}</button></div>
    <div className="local-translation-truth" role="note"><strong>{text('Bu sürüm gerçek çeviri veya konuşma çözümü çalıştırmaz.','This release does not run a real translation or speech solution.')}</strong>
      <span>{text('Orijinali koruma, ayrı makine çevirisi etiketi, düşük güven işareti, yerel paket önceliği ve ortak sağlayıcı sözleşmesi modellenmiştir.','Original-content preservation, a separate machine-translation label, low-confidence marking, local-package priority and a common provider contract are modeled.')}</span>
      <span>{text('Yerel dil paketi, canlı altyazı, konuşmacı ayrımı, seslendirme ve dış sağlayıcı yapılandırılmadı; ağ ve bulut kullanılmaz.','No local language pack, live captions, speaker separation, speech output or external provider is configured; network and cloud services are not used.')}</span>
      <span>{text('Dış sağlayıcı seçimi yalnız önizleme ve ayrı açık onay metadata’sı oluşturur; hiçbir içerik gönderilmez.','Selecting an external provider creates preview and separate explicit-consent metadata only; no content is sent.')}</span></div>
    {error&&<p className="status-message danger" role="alert">{error}</p>}
    {profile&&<div className="local-translation-grid"><fieldset><legend>{text('Dil tercihleri','Language preferences')}</legend>
      <label>{text('Ana dil','Primary language')}<input value={preferredLanguage} maxLength={40} onChange={event=>setPreferredLanguage(event.target.value)}/></label>
      <label>{text('İkinci dil','Secondary language')}<input value={secondaryLanguage} maxLength={40} onChange={event=>setSecondaryLanguage(event.target.value)}/></label>
      <label>{text('Sağlayıcı modu','Provider mode')}<select value={providerMode} onChange={event=>{const value=event.target.value as LocalTranslationProviderMode;
        setProviderMode(value);if(value==='local_offline')setExternalConsent(false);}}><option value="local_offline">{text('Yerel/offline — paket yok','Local/offline — no package')}</option>
        <option value="external_preview">{text('Dış sağlayıcı önizlemesi — sağlayıcı yok','External provider preview — no provider')}</option></select></label>
      {providerMode==='external_preview'&&<label className="toggle-row"><input type="checkbox" checked={externalConsent}
        onChange={event=>setExternalConsent(event.target.checked)}/><span><strong>{text('Önizlemeyi gördüm ve ayrı açık onay veriyorum','I reviewed the preview and give separate explicit consent')}</strong>
        <small>{text('Onay yalnız metadata’dır; içerik aktarımı ve ağ kullanımı yapılmaz.','Consent is metadata only; no content transfer or network use occurs.')}</small></span></label>}
      <button type="button" disabled={Boolean(busy)} onClick={()=>void saveProfile()}>{text('Tercih metadata’sını kaydet','Save preference metadata')}</button>
      <small>{text('Şifreli cihazlar arası eşitleme henüz çalıştırılmadı.','Encrypted cross-device synchronization has not been run.')}</small></fieldset>
      <fieldset><legend>{text('Kişisel sözlük','Personal dictionary')}</legend><label>{text('Kategori','Category')}<select value={category}
        onChange={event=>setCategory(event.target.value as LocalTranslationDictionaryCategory)}>{Object.entries(categoryLabels)
          .map(([value])=><option key={value} value={value}>{categoryLabel(value as LocalTranslationDictionaryCategory)}</option>)}</select></label>
      <label>{text('Kaynak dil','Source language')}<input value={dictionarySourceLanguage} maxLength={40}
        onChange={event=>setDictionarySourceLanguage(event.target.value)}/></label>
      <label>{text('Hedef dil','Target language')}<input value={dictionaryTargetLanguage} maxLength={40}
        onChange={event=>setDictionaryTargetLanguage(event.target.value)}/></label>
      <label>{text('Kaynak terim','Source term')}<input value={sourceTerm} maxLength={120} onChange={event=>setSourceTerm(event.target.value)}/></label>
      <label>{text('Tercih edilen karşılık','Preferred equivalent')}<input value={preferredTerm} maxLength={120} onChange={event=>setPreferredTerm(event.target.value)}/></label>
      <button type="button" disabled={Boolean(busy)||!sourceTerm.trim()||!preferredTerm.trim()} onClick={()=>void saveDictionary()}>
        {editingEntryId?text('Açık izinle girdiyi güncelle','Update entry with explicit permission'):text('Açık izinle sözlüğe ekle','Add to dictionary with explicit permission')}</button>
      <ul>{center.dictionary.length===0?<li>{text('Henüz kişisel sözlük girdisi yok.','There are no personal dictionary entries yet.')}</li>:center.dictionary.map(entry=><li key={entry.id}>
        <span>{categoryLabel(entry.category)} · {entry.sourceTerm} → {entry.preferredTerm}</span>
        <button type="button" disabled={Boolean(busy)} onClick={()=>{setEditingEntryId(entry.id);setCategory(entry.category);
          setDictionarySourceLanguage(entry.sourceLanguage);setDictionaryTargetLanguage(entry.targetLanguage);
          setSourceTerm(entry.sourceTerm);setPreferredTerm(entry.preferredTerm);}}>{text('Düzenle','Edit')}</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void deleteDictionary(entry.id)}>{text('İçeriği sil ve tombstone bırak','Delete content and retain a tombstone')}</button></li>)}</ul></fieldset></div>}
    <fieldset><legend>{text('Çeviri hazırlık talebi','Translation preparation request')}</legend><label>{text('Kaynak türü','Source type')}<select value={sourceKind}
      onChange={event=>setSourceKind(event.target.value as LocalTranslationSourceKind)}>{Object.entries(sourceLabels)
        .map(([value])=><option key={value} value={value}>{sourceLabel(value as LocalTranslationSourceKind)}</option>)}</select></label>
      <label>{text('Yetkili kaynak kimliği','Authorized source ID')}<input value={sourceResourceId} maxLength={256}
        onChange={event=>setSourceResourceId(event.target.value)}/></label>
      <label>{text('Hedef dil','Target language')}<input value={targetLanguage} maxLength={40} onChange={event=>setTargetLanguage(event.target.value)}/></label>
      <button type="button" disabled={Boolean(busy)||!sourceResourceId.trim()||(providerMode==='external_preview'&&!externalConsent)}
        onClick={()=>void prepare()}>{text('Sağlayıcı kullanmadan hazırlık kaydı oluştur','Create a preparation record without using a provider')}</button></fieldset>
    <div className="local-translation-list">{center?.requests.length===0?<p>{text('Henüz çeviri hazırlık talebi yok.','There are no translation preparation requests yet.')}</p>:center?.requests.map(request=><article key={request.id}>
      <header><strong>{sourceLabel(request.sourceKind)} · {request.targetLanguage}</strong><small>{text('sürüm','revision')} {request.revision}</small></header>
      <p>{request.state} · {text('makine çevirisi etiketi zorunlu · kalite: değerlendirilmedi · ağ: hayır','machine-translation label required · quality: not evaluated · network: no')}</p>
      <label>{text('Kullanıcı düzeltmesi','User correction')}<input value={correction} maxLength={10_000} onChange={event=>setCorrection(event.target.value)}/></label>
      <div><button type="button" disabled={Boolean(busy)||request.state==='cancelled'||!correction.trim()}
        onClick={()=>void correct(request.id,request.revision)}>{text('Açık izinle düzeltme özetini kaydet','Save correction summary with explicit permission')}</button>
      <button type="button" disabled={Boolean(busy)||request.state==='cancelled'}
        onClick={()=>void cancel(request.id,request.revision)}>{text('Talebi iptal et','Cancel request')}</button></div></article>)}</div>
  </section>;
}
