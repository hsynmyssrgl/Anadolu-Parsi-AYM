import { useEffect, useRef, useState } from 'react';
import type {
  LocalTranslationCenterView,
  LocalTranslationDictionaryCategory,
  LocalTranslationProviderMode,
  LocalTranslationSourceKind
} from '@ppt/domain';

const categoryLabels:Record<LocalTranslationDictionaryCategory,string>={
  family_name:'Aile adı',nickname:'Lakap',place:'Yer',medical_term:'Tıbbi terim'
};
const sourceLabels:Record<LocalTranslationSourceKind,string>={
  message:'Mesaj',live_caption:'Canlı altyazı',document:'Belge',meeting_summary:'Toplantı özeti'
};

export function LocalTranslationLanguagePanel(){
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
  }catch(caught){setError(caught instanceof Error?caught.message:'Dil ve çeviri merkezi yüklenemedi.');}};
  useEffect(()=>{void refresh();},[]);
  const mutate=async(key:string,run:(id:string)=>Promise<unknown>)=>{setBusy(key);setError('');try{await run(operationId(key));
    operations.current.delete(key);await refresh();}catch(caught){setError(caught instanceof Error
      ?`${caught.message} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`:'Dil ve çeviri metadata işlemi tamamlanamadı.');}finally{setBusy('');}};
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
    <div className="panel-heading"><div><span className="eyebrow">34-E · Yerel öncelikli dil merkezi</span>
      <h2 id="local-translation-title">Çeviri, altyazı ve kişisel sözlük</h2></div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)}>Yenile</button></div>
    <div className="local-translation-truth" role="note"><strong>Bu sürüm gerçek çeviri veya konuşma çözümü çalıştırmaz.</strong>
      <span>Orijinali koruma, ayrı makine çevirisi etiketi, düşük güven işareti, yerel paket önceliği ve ortak sağlayıcı sözleşmesi modellenmiştir.</span>
      <span>Yerel dil paketi, canlı altyazı, konuşmacı ayrımı, seslendirme ve dış sağlayıcı yapılandırılmadı; ağ ve bulut kullanılmaz.</span>
      <span>Dış sağlayıcı seçimi yalnız önizleme ve ayrı açık onay metadata’sı oluşturur; hiçbir içerik gönderilmez.</span></div>
    {error&&<p className="status-message danger" role="alert">{error}</p>}
    {profile&&<div className="local-translation-grid"><fieldset><legend>Dil tercihleri</legend>
      <label>Ana dil<input value={preferredLanguage} maxLength={40} onChange={event=>setPreferredLanguage(event.target.value)}/></label>
      <label>İkinci dil<input value={secondaryLanguage} maxLength={40} onChange={event=>setSecondaryLanguage(event.target.value)}/></label>
      <label>Sağlayıcı modu<select value={providerMode} onChange={event=>{const value=event.target.value as LocalTranslationProviderMode;
        setProviderMode(value);if(value==='local_offline')setExternalConsent(false);}}><option value="local_offline">Yerel/offline — paket yok</option>
        <option value="external_preview">Dış sağlayıcı önizlemesi — sağlayıcı yok</option></select></label>
      {providerMode==='external_preview'&&<label className="toggle-row"><input type="checkbox" checked={externalConsent}
        onChange={event=>setExternalConsent(event.target.checked)}/><span><strong>Önizlemeyi gördüm ve ayrı açık onay veriyorum</strong>
        <small>Onay yalnız metadata’dır; içerik aktarımı ve ağ kullanımı yapılmaz.</small></span></label>}
      <button type="button" disabled={Boolean(busy)} onClick={()=>void saveProfile()}>Tercih metadata’sını kaydet</button>
      <small>Şifreli cihazlar arası eşitleme henüz çalıştırılmadı.</small></fieldset>
      <fieldset><legend>Kişisel sözlük</legend><label>Kategori<select value={category}
        onChange={event=>setCategory(event.target.value as LocalTranslationDictionaryCategory)}>{Object.entries(categoryLabels)
          .map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Kaynak dil<input value={dictionarySourceLanguage} maxLength={40}
        onChange={event=>setDictionarySourceLanguage(event.target.value)}/></label>
      <label>Hedef dil<input value={dictionaryTargetLanguage} maxLength={40}
        onChange={event=>setDictionaryTargetLanguage(event.target.value)}/></label>
      <label>Kaynak terim<input value={sourceTerm} maxLength={120} onChange={event=>setSourceTerm(event.target.value)}/></label>
      <label>Tercih edilen karşılık<input value={preferredTerm} maxLength={120} onChange={event=>setPreferredTerm(event.target.value)}/></label>
      <button type="button" disabled={Boolean(busy)||!sourceTerm.trim()||!preferredTerm.trim()} onClick={()=>void saveDictionary()}>
        {editingEntryId?'Açık izinle girdiyi güncelle':'Açık izinle sözlüğe ekle'}</button>
      <ul>{center.dictionary.length===0?<li>Henüz kişisel sözlük girdisi yok.</li>:center.dictionary.map(entry=><li key={entry.id}>
        <span>{categoryLabels[entry.category]} · {entry.sourceTerm} → {entry.preferredTerm}</span>
        <button type="button" disabled={Boolean(busy)} onClick={()=>{setEditingEntryId(entry.id);setCategory(entry.category);
          setDictionarySourceLanguage(entry.sourceLanguage);setDictionaryTargetLanguage(entry.targetLanguage);
          setSourceTerm(entry.sourceTerm);setPreferredTerm(entry.preferredTerm);}}>Düzenle</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>void deleteDictionary(entry.id)}>İçeriği sil ve tombstone bırak</button></li>)}</ul></fieldset></div>}
    <fieldset><legend>Çeviri hazırlık talebi</legend><label>Kaynak türü<select value={sourceKind}
      onChange={event=>setSourceKind(event.target.value as LocalTranslationSourceKind)}>{Object.entries(sourceLabels)
        .map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Yetkili kaynak kimliği<input value={sourceResourceId} maxLength={256}
        onChange={event=>setSourceResourceId(event.target.value)}/></label>
      <label>Hedef dil<input value={targetLanguage} maxLength={40} onChange={event=>setTargetLanguage(event.target.value)}/></label>
      <button type="button" disabled={Boolean(busy)||!sourceResourceId.trim()||(providerMode==='external_preview'&&!externalConsent)}
        onClick={()=>void prepare()}>Sağlayıcı kullanmadan hazırlık kaydı oluştur</button></fieldset>
    <div className="local-translation-list">{center?.requests.length===0?<p>Henüz çeviri hazırlık talebi yok.</p>:center?.requests.map(request=><article key={request.id}>
      <header><strong>{sourceLabels[request.sourceKind]} · {request.targetLanguage}</strong><small>sürüm {request.revision}</small></header>
      <p>{request.state} · makine çevirisi etiketi zorunlu · kalite: değerlendirilmedi · ağ: hayır</p>
      <label>Kullanıcı düzeltmesi<input value={correction} maxLength={10_000} onChange={event=>setCorrection(event.target.value)}/></label>
      <div><button type="button" disabled={Boolean(busy)||request.state==='cancelled'||!correction.trim()}
        onClick={()=>void correct(request.id,request.revision)}>Açık izinle düzeltme özetini kaydet</button>
      <button type="button" disabled={Boolean(busy)||request.state==='cancelled'}
        onClick={()=>void cancel(request.id,request.revision)}>Talebi iptal et</button></div></article>)}</div>
  </section>;
}
