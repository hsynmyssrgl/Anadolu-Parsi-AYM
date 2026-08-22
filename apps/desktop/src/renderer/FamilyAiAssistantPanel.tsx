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
import { selectUiCopy, useLocalization } from './localization';

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
  const {language,locale}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const kindLabel=(value:FamilyAiAssistantKind)=>language==='tr'?kindLabels[value]:({
    authorized_search:'Authorized local search',daily_summary:'Daily summary',weekly_summary:'Weekly summary',reminder_review:'Reminder review',
    emergency_bag:'Emergency bag',meeting_agenda:'Family meeting agenda',ocr_classification:'OCR classification',duplicate_record:'Duplicate record review',
    family_story:'Family story',spending_review:'Spending review',meal_plan:'Meal plan',shopping_list:'Shopping list',plain_explanation:'Plain explanation',
    read_aloud:'Read-aloud preparation',translation:'Translation preparation'
  } as const)[value];
  const statusLabel=(value:FamilyAiSuggestionView['status'])=>language==='tr'?statusLabels[value]:({pending_confirmation:'Waiting for human approval',confirmed:'Reviewed and approved',dismissed:'Dismissed'} as const)[value];
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
  const refresh=async()=>{setError('');try{await reload();}catch(value){setError(value instanceof Error?value.message:text('Aile asistanı yüklenemedi.','Family assistant could not be loaded.'));}};
  useEffect(()=>{void reload().catch(value=>setError(value instanceof Error?value.message:text('Aile asistanı yüklenemedi.','Family assistant could not be loaded.')));},[]);
  const generate=async()=>{
    if(!window.pardus)return;setBusy('generate');setError('');
    const normalized=kind==='authorized_search'?query.trim():'';const prior=pendingGenerate.current;
    const command=prior&&prior.kind===kind&&prior.query===(normalized||undefined)?prior:{
      clientOperationId:crypto.randomUUID(),suggestionId:crypto.randomUUID(),kind,...(normalized?{query:normalized}:{})
    };
    pendingGenerate.current=command;
    try{await window.pardus.generateFamilyAiSuggestion(command);pendingGenerate.current=undefined;await reload();}
    catch(value){setError(value instanceof Error?value.message:text('Öneri üretilemedi; aynı işlem kimliğiyle yeniden deneyebilirsiniz.','The suggestion could not be generated; you can retry with the same operation ID.'));}
    finally{setBusy('');}
  };
  const runLocalModel=async()=>{
    if(!window.pardus)return;setBusy('local-model');setError('');setModelResponse(undefined);
    try{setModelResponse(await window.pardus.runFamilyAiLocalModel({kind,prompt:modelPrompt.trim()}));}
    catch(value){setError(value instanceof Error?value.message:text('Yerel model yanıt üretemedi.','The local model could not generate a response.'));}
    finally{setBusy('');}
  };
  const review=async(suggestion:Pick<FamilyAiSuggestionView,'id'|'revision'>,decision:FamilyAiSuggestionReviewDecision)=>{
    if(!window.pardus)return;const key=`${suggestion.id}:${decision}`;setBusy(key);setError('');
    const prior=pendingReviews.current.get(key);const command=prior?.expectedRevision===suggestion.revision?prior:{
      clientOperationId:crypto.randomUUID(),suggestionId:suggestion.id,expectedRevision:suggestion.revision,decision
    };
    pendingReviews.current.set(key,command);
    try{await window.pardus.reviewFamilyAiSuggestion(command);pendingReviews.current.delete(key);await reload();}
    catch(value){setError(value instanceof Error?value.message:text('İnceleme kaydedilemedi; aynı işlem kimliğiyle yeniden deneyebilirsiniz.','The review could not be saved; you can retry with the same operation ID.'));}
    finally{setBusy('');}
  };
  return <Surface className="family-ai-assistant" aria-labelledby="family-ai-assistant-title">
    <div className="panel-heading"><div><span className="eyebrow">{text('Onaya bağlı yerel yardımcı','Approval-bound local assistant')}</span><h2 id="family-ai-assistant-title">{text('Aile asistanı','Family assistant')}</h2><p>{text('Yalnız açık izinli ve politika süzgecinden geçen yerel kaynaklardan, otomatik işlem yapmayan inceleme önerileri üretir.','Creates non-automating review suggestions only from explicitly permitted local sources that pass the policy filter.')}</p></div><Button disabled={!!busy} onClick={()=>void refresh()}>{text('Yenile','Refresh')}</Button></div>
    <div className="family-ai-truth" aria-label={text('Aile asistanı doğruluk sınırları','Family assistant truth boundaries')}><strong>{text('Yerel ve onaylı çalışma sınırı','Local, approval-bound operating boundary')}</strong><span>{text('Buluta veya dış ağa veri gönderilmez. Sabit inceleme önerileri modelsiz çalışır; gerçek model yanıtı yalnız bilgisayardaki açıkça etkinleştirilmiş yerel modelle üretilir.','No data is sent to the cloud or an external network. Fixed review suggestions work without a model; a real model response is generated only by an explicitly enabled local model on this computer.')}</span><span>{text('Model yanıtı kaydedilmez ve hiçbir kalıcı işlemi yürütmez. Kaynak izni model çalışırken değişirse yanıt atılır; finans ve sağlık için ayrıca süreli hassas veri onayı gerekir.','The model response is not saved and performs no persistent operation. If source permission changes while the model is running, the response is discarded; finance and health also require time-bound sensitive-data consent.')}</span></div>
    {error&&<StatusMessage tone="danger">{error}</StatusMessage>}
    <div className="family-ai-compose">
      <label>{text('Öneri türü','Suggestion type')}<select value={kind} onChange={event=>{setKind(event.target.value as FamilyAiAssistantKind);pendingGenerate.current=undefined;}}>{FAMILY_AI_ASSISTANT_KINDS.map(value=><option key={value} value={value}>{kindLabel(value)}</option>)}</select></label>
      {kind==='authorized_search'&&<label>{text('Yerel arama ifadesi (zorunlu)','Local search phrase (required)')}<input value={query} minLength={2} maxLength={80} required onChange={event=>{setQuery(event.target.value);pendingGenerate.current=undefined;}} placeholder={text('Örneğin: yaklaşan aile işleri','For example: upcoming family tasks')}/></label>}
      <Button tone="primary" disabled={!!busy||center?.suggestionCapacity.limitReached===true
        ||(kind==='authorized_search'&&query.trim().length<2)} onClick={()=>void generate()}>{busy==='generate'?text('Hazırlanıyor…','Preparing…'):text('İnceleme önerisi hazırla','Prepare review suggestion')}</Button>
    </div>
    <section className="family-ai-model" aria-labelledby="family-ai-model-title">
      <div><span className="eyebrow">{text('Yerel gerçek model · geçici yanıt','Real local model · temporary response')}</span><h3 id="family-ai-model-title">{text('Bilgisayarımdaki modelle yanıtla','Answer with the model on my computer')}</h3>
        <p>{modelStatus?.available?`${modelStatus.model} ${text('modeli hazır. Yanıt yalnız bu bilgisayarda üretilecek ve kaydedilmeyecek.','is ready. The response will be generated only on this computer and will not be saved.')}`
          :modelStatus?.configured?text('Yerel model ayarlı ancak hizmete veya seçili modele ulaşılamıyor.','The local model is configured, but the service or selected model cannot be reached.')
            :text('Yerel Ollama hizmeti veya seçili model bulunamadı. Ollama ve qwen3:4b modeli kurulduğunda uygulama sabit yerel bağlantıyı otomatik keşfeder; bulut kullanılmaz.','The local Ollama service or selected model was not found. When Ollama and the qwen3:4b model are installed, the application automatically discovers the fixed local connection; the cloud is not used.')}</p></div>
      <label>{text('Modele sorunuz','Ask the model')}<textarea value={modelPrompt} minLength={2} maxLength={400} rows={3}
        onChange={event=>setModelPrompt(event.target.value)} placeholder={text('Örneğin: Bu hafta gözden geçirmem gerekenleri sade biçimde özetle','For example: summarize what I should review this week in plain language')}/></label>
      <Button tone="primary" disabled={!!busy||modelStatus?.available!==true||modelPrompt.trim().length<2}
        onClick={()=>void runLocalModel()}>{busy==='local-model'?text('Yerel model çalışıyor…','Local model is running…'):text('Yerel modelle yanıtla','Answer with local model')}</Button>
      {modelResponse&&<article className="family-ai-model-response" aria-live="polite"><strong>{text('Geçici yerel model yanıtı','Temporary local model response')}</strong>
        <p>{modelResponse.answer}</p><small>{modelResponse.sourceCount} {text('izinli kaynak','authorized sources')} · {modelResponse.model} · {text('kaydedilmedi · insan doğrulaması gerekir','not saved · human verification required')}</small></article>}
    </section>
    <div className="family-ai-summary"><strong>{center?.suggestions.length??0} {text('görünür öneri','visible suggestions')}</strong><span>{center?.hiddenAfterConsentRevocationCount??0} {text('öneri, kaynak izni artık etkin olmadığı için gizli','suggestions hidden because source permission is no longer active')}</span><span>{center?`${center.suggestionCapacity.remaining}/${center.suggestionCapacity.maximum} ${text('güvenli yerel kapasite kaldı','safe local capacity remaining')}`:text('Kapasite hesaplanıyor','Calculating capacity')}</span></div>
    {center?.suggestionCapacity.limitReached&&<StatusMessage tone="danger">{text('Güvenli yerel öneri kapasitesine ulaşıldı; yeni öneri üretimi fail‑closed kapatıldı.','Safe local suggestion capacity has been reached; new suggestion generation was disabled fail-closed.')}</StatusMessage>}
    <div className="family-ai-list">{!center?<p>{text('Yerel merkez yükleniyor…','Loading local center…')}</p>:center.suggestions.length===0?<EmptyState title={text('Görünür öneri yok','No visible suggestions')} body={text('Önce ilgili kayıtlar için amaç bazlı AI onayı verin; ardından burada yerel bir inceleme önerisi hazırlayın.','First grant purpose-based AI consent for the relevant records, then prepare a local review suggestion here.')}/>:center.suggestions.map(suggestion=><article key={suggestion.id} className="family-ai-card"><div><span className="eyebrow">{kindLabel(suggestion.kind)} · {text('kaynak kapsam göstergesi','source scope indicator')} %{(suggestion.confidenceBasisPoints/100).toLocaleString(locale)}</span><h3>{suggestion.title}</h3><p>{suggestion.explanation}</p><small>{statusLabel(suggestion.status)} · {suggestion.sources.length} {text('içeriksiz kaynak bağı · sürüm','content-free source bindings · revision')} {suggestion.revision}</small></div>{suggestion.status==='pending_confirmation'&&<div className="button-row"><Button tone="primary" disabled={!!busy} onClick={()=>void review(suggestion,'confirm')}>{busy===`${suggestion.id}:confirm`?text('Kaydediliyor…','Saving…'):text('İnceledim, onayla','Reviewed, approve')}</Button><Button disabled={!!busy} onClick={()=>void review(suggestion,'dismiss')}>{busy===`${suggestion.id}:dismiss`?text('Kaydediliyor…','Saving…'):text('Reddet','Dismiss')}</Button></div>}</article>)}</div>
    {center&&center.inactiveConsentSuggestions.length>0&&<section aria-label={text('Kaynak izni artık etkin olmayan öneriler','Suggestions whose source permission is no longer active')}><h3>{text('Kaynak izni artık etkin olmayan öneriler','Suggestions whose source permission is no longer active')}</h3><p>{text('Kaynak ayrıntıları gizlidir; geri çekilmiş veya süresi dolmuş izne bağlı bu içeriksiz kayıtları yalnız reddedebilirsiniz.','Source details are hidden; you may only dismiss these content-free records linked to withdrawn or expired consent.')}</p><div className="family-ai-list">{center.inactiveConsentSuggestions.map(suggestion=><article key={suggestion.id} className="family-ai-card"><div><strong>{text('Gizli öneri','Hidden suggestion')}</strong><small>{text('Kaynak izni artık etkin değil · sürüm','Source permission is no longer active · revision')} {suggestion.revision}</small></div><Button disabled={!!busy} onClick={()=>void review(suggestion,'dismiss')}>{busy===`${suggestion.id}:dismiss`?text('Kaydediliyor…','Saving…'):text('Gizli öneriyi reddet','Dismiss hidden suggestion')}</Button></article>)}</div></section>}
  </Surface>;
}
