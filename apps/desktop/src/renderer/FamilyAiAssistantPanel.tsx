import { useEffect, useRef, useState } from 'react';
import {
  FAMILY_AI_ASSISTANT_KINDS,
  type FamilyAiAssistantCenterView,
  type FamilyAiAssistantKind,
  type FamilyAiSuggestionReviewDecision,
  type FamilyAiSuggestionView
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
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const pendingGenerate=useRef<PendingGenerate|undefined>(undefined);
  const pendingReviews=useRef(new Map<string,PendingReview>());
  const reload=async()=>{if(!window.pardus)return;setCenter(await window.pardus.getFamilyAiAssistantCenter());};
  useEffect(()=>{void reload().catch(value=>setError(value instanceof Error?value.message:'Aile asistanı yüklenemedi.'));},[]);
  const generate=async()=>{
    if(!window.pardus)return;setBusy('generate');setError('');
    const normalized=query.trim();const prior=pendingGenerate.current;
    const command=prior&&prior.kind===kind&&prior.query===(normalized||undefined)?prior:{
      clientOperationId:crypto.randomUUID(),suggestionId:crypto.randomUUID(),kind,...(normalized?{query:normalized}:{})
    };
    pendingGenerate.current=command;
    try{await window.pardus.generateFamilyAiSuggestion(command);pendingGenerate.current=undefined;await reload();}
    catch(value){setError(value instanceof Error?value.message:'Öneri üretilemedi; aynı işlem kimliğiyle yeniden deneyebilirsiniz.');}
    finally{setBusy('');}
  };
  const review=async(suggestion:FamilyAiSuggestionView,decision:FamilyAiSuggestionReviewDecision)=>{
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
    <div className="panel-heading"><div><span className="eyebrow">33‑W · onaya bağlı yerel yardımcı</span><h2 id="family-ai-assistant-title">Aile asistanı</h2><p>Yalnız açık izinli ve politika süzgecinden geçen yerel kaynaklardan, otomatik işlem yapmayan inceleme önerileri üretir.</p></div><Button disabled={!!busy} onClick={()=>void reload()}>Yenile</Button></div>
    <div className="family-ai-truth" aria-label="Aile asistanı doğruluk sınırları"><strong>Yerel ve onaylı çalışma sınırı</strong><span>Ağ, bulut veya model çıkarımı kullanılmaz. Öneriyi onaylamak ödeme, rezervasyon, sağlık, acil durum ya da başka kalıcı bir işlemi yürütmez.</span><span>Kaynak izni geri çekilirse öneri görünmez olur; finans ve sağlık için ayrıca süreli hassas veri onayı gerekir.</span></div>
    {error&&<StatusMessage tone="danger">{error}</StatusMessage>}
    <div className="family-ai-compose">
      <label>Öneri türü<select value={kind} onChange={event=>{setKind(event.target.value as FamilyAiAssistantKind);pendingGenerate.current=undefined;}}>{FAMILY_AI_ASSISTANT_KINDS.map(value=><option key={value} value={value}>{kindLabels[value]}</option>)}</select></label>
      <label>Yerel arama ifadesi (isteğe bağlı)<input value={query} minLength={2} maxLength={80} onChange={event=>{setQuery(event.target.value);pendingGenerate.current=undefined;}} placeholder="Örneğin: yaklaşan aile işleri"/></label>
      <Button tone="primary" disabled={!!busy||(query.trim().length===1)} onClick={()=>void generate()}>{busy==='generate'?'Hazırlanıyor…':'İnceleme önerisi hazırla'}</Button>
    </div>
    <div className="family-ai-summary"><strong>{center?.suggestions.length??0} görünür öneri</strong><span>{center?.hiddenAfterConsentRevocationCount??0} öneri, kaynak izni geri çekildiği için gizli</span></div>
    <div className="family-ai-list">{!center?<p>Yerel merkez yükleniyor…</p>:center.suggestions.length===0?<EmptyState title="Görünür öneri yok" body="Önce ilgili kayıtlar için amaç bazlı AI onayı verin; ardından burada yerel bir inceleme önerisi hazırlayın."/>:center.suggestions.map(suggestion=><article key={suggestion.id} className="family-ai-card"><div><span className="eyebrow">{kindLabels[suggestion.kind]} · %{(suggestion.confidenceBasisPoints/100).toLocaleString('tr-TR')}</span><h3>{suggestion.title}</h3><p>{suggestion.explanation}</p><small>{statusLabels[suggestion.status]} · {suggestion.sources.length} içeriksiz kaynak bağı · sürüm {suggestion.revision}</small></div>{suggestion.status==='pending_confirmation'&&<div className="button-row"><Button tone="primary" disabled={!!busy} onClick={()=>void review(suggestion,'confirm')}>{busy===`${suggestion.id}:confirm`?'Kaydediliyor…':'İnceledim, onayla'}</Button><Button disabled={!!busy} onClick={()=>void review(suggestion,'dismiss')}>{busy===`${suggestion.id}:dismiss`?'Kaydediliyor…':'Reddet'}</Button></div>}</article>)}</div>
  </Surface>;
}
