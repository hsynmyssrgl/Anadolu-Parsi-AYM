import { useEffect, useRef, useState } from 'react';
import { FAMILY_AI_ASSISTANT_KINDS } from '@ppt/domain/renderer';
import type {
  FamilyAiAssistantCenterView,
  FamilyAiAssistantKind,
  FamilyAiLocalModelResponseView,
  FamilyAiLocalModelStatusView,
  FamilyAiSuggestionReviewDecision,
  FamilyAiSuggestionView
} from '@ppt/domain';
import { Button, EmptyState, StatusMessage, Surface } from './ui';

const kindLabels:Readonly<Record<FamilyAiAssistantKind,string>>=Object.freeze({
  authorized_search:'İzinli yerel arama',daily_summary:'Günlük özet',weekly_summary:'Haftalık özet',
  reminder_review:'Hatırlatma incelemesi',emergency_bag:'Acil durum çantası',meeting_agenda:'Aile toplantısı gündemi',
  ocr_classification:'OCR sınıflandırma',duplicate_record:'Yinelenen kayıt incelemesi',family_story:'Aile hikâyesi',
  spending_review:'Harcama incelemesi',meal_plan:'Yemek planı',shopping_list:'Alışveriş listesi',
  plain_explanation:'Sade anlatım',read_aloud:'Sesli okuma hazırlığı',translation:'Çeviri hazırlığı'
});
const statusLabels:Readonly<Record<FamilyAiSuggestionView['status'],string>>=Object.freeze({
  pending_confirmation:'İnsan onayı bekliyor',confirmed:'İncelendi ve onaylandı',dismissed:'Reddedildi'
});
interface PendingGenerate { readonly clientOperationId:string;readonly suggestionId:string;readonly kind:FamilyAiAssistantKind;readonly query?:string }
interface PendingReview { readonly clientOperationId:string;readonly suggestionId:string;readonly expectedRevision:number;readonly decision:FamilyAiSuggestionReviewDecision }

export function FamilyAiAssistantPanel(){
  const [center,setCenter]=useState<FamilyAiAssistantCenterView>();
  const [kind,setKind]=useState<FamilyAiAssistantKind>('authorized_search');
  const [query,setQuery]=useState('');
  const [modelPrompt,setModelPrompt]=useState('');
  const [modelStatus,setModelStatus]=useState<FamilyAiLocalModelStatusView>();
  const [modelResponse,setModelResponse]=useState<FamilyAiLocalModelResponseView>();
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const pendingGenerate=useRef<PendingGenerate|undefined>(undefined);
  const pendingReviews=useRef(new Map<string,PendingReview>());
  const reload=async()=>{if(!window.pardus)return;const [nextCenter,nextModelStatus]=await Promise.all([
    window.pardus.getFamilyAiAssistantCenter(),window.pardus.getFamilyAiLocalModelStatus()]);
    setCenter(nextCenter);setModelStatus(nextModelStatus);};
  const refresh=async()=>{setError('');try{await reload();}catch(value){setError(value instanceof Error?value.message:'Aile asistanı yüklenemedi.');}};
  useEffect(()=>{void reload().catch(value=>setError(value instanceof Error?value.message:'Aile asistanı yüklenemedi.'));},[]);
  const generate=async()=>{
    if(!window.pardus)return;setBusy('generate');setError('');
    const normalized=kind==='authorized_search'?query.trim():'';const prior=pendingGenerate.current;
    const command=prior&&prior.kind===kind&&prior.query===(normalized||undefined)?prior:{
      clientOperationId:crypto.randomUUID(),suggestionId:crypto.randomUUID(),kind,...(normalized?{query:normalized}:{})
    };
    pendingGenerate.current=command;
    try{await window.pardus.generateFamilyAiSuggestion(command);pendingGenerate.current=undefined;await reload();}
    catch(value){setError(value instanceof Error?value.message:'Öneri üretilemedi; aynı işlem kimliğiyle yeniden deneyebilirsiniz.');}
    finally{setBusy('');}
  };
  const runLocalModel=async()=>{
    if(!window.pardus)return;setBusy('local-model');setError('');setModelResponse(undefined);
    try{setModelResponse(await window.pardus.runFamilyAiLocalModel({kind,prompt:modelPrompt.trim()}));}
    catch(value){setError(value instanceof Error?value.message:'Yerel model yanıt üretemedi.');}
    finally{setBusy('');}
  };
  const review=async(suggestion:Pick<FamilyAiSuggestionView,'id'|'revision'>,decision:FamilyAiSuggestionReviewDecision)=>{
    if(!window.pardus)return;const key=`${suggestion.id}:${decision}`;setBusy(key);setError('');
    const prior=pendingReviews.current.get(key);const command=prior?.expectedRevision===suggestion.revision?prior:{
      clientOperationId:crypto.randomUUID(),suggestionId:suggestion.id,expectedRevision:suggestion.revision,decision
    };
    pendingReviews.current.set(key,command);
    try{await window.pardus.reviewFamilyAiSuggestion(command);pendingReviews.current.delete(key);await reload();}
    catch(value){setError(value instanceof Error?value.message:'İnceleme kaydedilemedi; aynı işlem kimliğiyle yeniden deneyebilirsiniz.');}
    finally{setBusy('');}
  };
  return <Surface className="family-ai-assistant" aria-labelledby="family-ai-assistant-title">
    <div className="panel-heading"><div><span className="eyebrow">33‑W · onaya bağlı yerel yardımcı</span><h2 id="family-ai-assistant-title">Aile asistanı</h2><p>Yalnız açık izinli ve politika süzgecinden geçen yerel kaynaklardan, otomatik işlem yapmayan inceleme önerileri üretir.</p></div><Button disabled={!!busy} onClick={()=>void refresh()}>Yenile</Button></div>
    <div className="family-ai-truth" aria-label="Aile asistanı doğruluk sınırları"><strong>Yerel ve onaylı çalışma sınırı</strong><span>Buluta veya dış ağa veri gönderilmez. Sabit inceleme önerileri modelsiz çalışır; gerçek model yanıtı yalnız bilgisayardaki açıkça etkinleştirilmiş yerel modelle üretilir.</span><span>Model yanıtı kaydedilmez ve hiçbir kalıcı işlemi yürütmez. Kaynak izni model çalışırken değişirse yanıt atılır; finans ve sağlık için ayrıca süreli hassas veri onayı gerekir.</span></div>
    {error&&<StatusMessage tone="danger">{error}</StatusMessage>}
    <div className="family-ai-compose">
      <label>Öneri türü<select value={kind} onChange={event=>{setKind(event.target.value as FamilyAiAssistantKind);pendingGenerate.current=undefined;}}>{FAMILY_AI_ASSISTANT_KINDS.map(value=><option key={value} value={value}>{kindLabels[value]}</option>)}</select></label>
      {kind==='authorized_search'&&<label>Yerel arama ifadesi (zorunlu)<input value={query} minLength={2} maxLength={80} required onChange={event=>{setQuery(event.target.value);pendingGenerate.current=undefined;}} placeholder="Örneğin: yaklaşan aile işleri"/></label>}
      <Button tone="primary" disabled={!!busy||center?.suggestionCapacity.limitReached===true
        ||(kind==='authorized_search'&&query.trim().length<2)} onClick={()=>void generate()}>{busy==='generate'?'Hazırlanıyor…':'İnceleme önerisi hazırla'}</Button>
    </div>
    <section className="family-ai-model" aria-labelledby="family-ai-model-title">
      <div><span className="eyebrow">Yerel gerçek model · geçici yanıt</span><h3 id="family-ai-model-title">Bilgisayarımdaki modelle yanıtla</h3>
        <p>{modelStatus?.available?`${modelStatus.model} modeli hazır. Yanıt yalnız bu bilgisayarda üretilecek ve kaydedilmeyecek.`
          :modelStatus?.configured?'Yerel model ayarlı ancak hizmete veya seçili modele ulaşılamıyor.'
            :'Yerel Ollama hizmeti veya seçili model bulunamadı. Ollama ve qwen3:4b modeli kurulduğunda uygulama sabit yerel bağlantıyı otomatik keşfeder; bulut kullanılmaz.'}</p></div>
      <label>Modele sorunuz<textarea value={modelPrompt} minLength={2} maxLength={400} rows={3}
        onChange={event=>setModelPrompt(event.target.value)} placeholder="Örneğin: Bu hafta gözden geçirmem gerekenleri sade biçimde özetle"/></label>
      <Button tone="primary" disabled={!!busy||modelStatus?.available!==true||modelPrompt.trim().length<2}
        onClick={()=>void runLocalModel()}>{busy==='local-model'?'Yerel model çalışıyor…':'Yerel modelle yanıtla'}</Button>
      {modelResponse&&<article className="family-ai-model-response" aria-live="polite"><strong>Geçici yerel model yanıtı</strong>
        <p>{modelResponse.answer}</p><small>{modelResponse.sourceCount} izinli kaynak · {modelResponse.model} · kaydedilmedi · insan doğrulaması gerekir</small></article>}
    </section>
    <div className="family-ai-summary"><strong>{center?.suggestions.length??0} görünür öneri</strong><span>{center?.hiddenAfterConsentRevocationCount??0} öneri, kaynak izni artık etkin olmadığı için gizli</span><span>{center?`${center.suggestionCapacity.remaining}/${center.suggestionCapacity.maximum} güvenli yerel kapasite kaldı`:'Kapasite hesaplanıyor'}</span></div>
    {center?.suggestionCapacity.limitReached&&<StatusMessage tone="danger">Güvenli yerel öneri kapasitesine ulaşıldı; yeni öneri üretimi fail‑closed kapatıldı.</StatusMessage>}
    <div className="family-ai-list">{!center?<p>Yerel merkez yükleniyor…</p>:center.suggestions.length===0?<EmptyState title="Görünür öneri yok" body="Önce ilgili kayıtlar için amaç bazlı AI onayı verin; ardından burada yerel bir inceleme önerisi hazırlayın."/>:center.suggestions.map(suggestion=><article key={suggestion.id} className="family-ai-card"><div><span className="eyebrow">{kindLabels[suggestion.kind]} · kaynak kapsam göstergesi %{(suggestion.confidenceBasisPoints/100).toLocaleString('tr-TR')}</span><h3>{suggestion.title}</h3><p>{suggestion.explanation}</p><small>{statusLabels[suggestion.status]} · {suggestion.sources.length} içeriksiz kaynak bağı · sürüm {suggestion.revision}</small></div>{suggestion.status==='pending_confirmation'&&<div className="button-row"><Button tone="primary" disabled={!!busy} onClick={()=>void review(suggestion,'confirm')}>{busy===`${suggestion.id}:confirm`?'Kaydediliyor…':'İnceledim, onayla'}</Button><Button disabled={!!busy} onClick={()=>void review(suggestion,'dismiss')}>{busy===`${suggestion.id}:dismiss`?'Kaydediliyor…':'Reddet'}</Button></div>}</article>)}</div>
    {center&&center.inactiveConsentSuggestions.length>0&&<section aria-label="Kaynak izni artık etkin olmayan öneriler"><h3>Kaynak izni artık etkin olmayan öneriler</h3><p>Kaynak ayrıntıları gizlidir; geri çekilmiş veya süresi dolmuş izne bağlı bu içeriksiz kayıtları yalnız reddedebilirsiniz.</p><div className="family-ai-list">{center.inactiveConsentSuggestions.map(suggestion=><article key={suggestion.id} className="family-ai-card"><div><strong>Gizli öneri</strong><small>Kaynak izni artık etkin değil · sürüm {suggestion.revision}</small></div><Button disabled={!!busy} onClick={()=>void review(suggestion,'dismiss')}>{busy===`${suggestion.id}:dismiss`?'Kaydediliyor…':'Gizli öneriyi reddet'}</Button></article>)}</div></section>}
  </Surface>;
}
