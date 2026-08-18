import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MEMORY_STUDIO_RECORD_KINDS } from '@ppt/domain/renderer';
import type { MemoryStudioCenterView, MemoryStudioRecordKind,
  MemoryTimeCapsuleCenterItemView } from '@ppt/domain';
import { Button, EmptyState, StatusMessage, Surface } from './ui';

const kindLabels:Readonly<Record<MemoryStudioRecordKind,string>>=Object.freeze({
  voice_story:'Sesli yaşam hikâyesi bağlantısı',transcript:'Yerel transkript bağlantısı',photo_book:'Fotoğraf kitabı',
  annual_album:'Yıllık albüm',on_this_day:'Bugün geçmişte',duplicate_photo_review:'Yinelenen fotoğraf incelemesi',
  face_group:'Manuel kişi grubu',genealogy_media_link:'Soy ağacı medya bağlantısı',recipe:'Aile tarifi',
  tradition:'Aile geleneği',letter:'Mektup',future_message:'Gelecek kuşak mesajı',
  family_documentary:'Aile belgeseli taslağı',printable_book:'Basılabilir kitap taslağı'
});
const capsuleStatus:Readonly<Record<MemoryTimeCapsuleCenterItemView['status'],string>>=Object.freeze({
  awaiting_approvals:'İki ayrı hesap onayı bekliyor',sealed:'Yerel olarak mühürlü',released:'Yerel olarak açıldı',
  cancelled:'İptal edildi',rolled_back:'Açılış geri alındı'
});
const splitIds=(value:string):readonly string[]=>[...new Set(value.split(',').map(item=>item.trim()).filter(Boolean))];
const futureDefault=():string=>{const value=new Date(Date.now()+8*86_400_000);value.setSeconds(0,0);return value.toISOString().slice(0,16);};
interface PendingOperation{readonly clientOperationId:string;readonly resourceId:string;readonly signature:string}

export function MemoryStudioPanel(){
  const [center,setCenter]=useState<MemoryStudioCenterView>();const [kind,setKind]=useState<MemoryStudioRecordKind>('voice_story');
  const [title,setTitle]=useState('');const [summary,setSummary]=useState('');const [archiveIds,setArchiveIds]=useState('');
  const [personIds,setPersonIds]=useState('');const [ocrJobId,setOcrJobId]=useState('');const [faceApproved,setFaceApproved]=useState(false);
  const [capsuleTitle,setCapsuleTitle]=useState('');const [capsuleArchiveIds,setCapsuleArchiveIds]=useState('');
  const [selectedRecords,setSelectedRecords]=useState<readonly string[]>([]);const [unlockAt,setUnlockAt]=useState(futureDefault);
  const [busy,setBusy]=useState('');const [error,setError]=useState('');const pending=useRef(new Map<string,PendingOperation>());
  const reload=async()=>{if(window.pardus)setCenter(await window.pardus.getMemoryStudioCenter());};
  const refresh=async()=>{setError('');try{await reload();}catch(value){setError(value instanceof Error?value.message:'Hafıza stüdyosu yüklenemedi.');}};
  useEffect(()=>{void reload().catch(value=>setError(value instanceof Error?value.message:'Hafıza stüdyosu yüklenemedi.'));},[]);
  const operation=(key:string,signature:string):PendingOperation=>{const prior=pending.current.get(key);if(prior?.signature===signature)return prior;
    const next={clientOperationId:crypto.randomUUID(),resourceId:crypto.randomUUID(),signature};pending.current.set(key,next);return next;};
  const run=async(key:string,task:()=>Promise<unknown>):Promise<boolean>=>{setBusy(key);setError('');try{await task();pending.current.delete(key);
      try{await reload();}catch(value){setError(value instanceof Error?`İşlem kaydedildi; görünüm yenilenemedi: ${value.message}`:'İşlem kaydedildi; görünüm yenilenemedi.');}
      return true;}catch(value){setError(value instanceof Error?value.message:'İşlem kaydedilemedi; aynı işlem kimliğiyle yeniden deneyebilirsiniz.');return false;}finally{setBusy('');}};
  const createRecord=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus)return;
    const payload={kind,title:title.trim(),summary:summary.trim(),archiveItemIds:splitIds(archiveIds),personIds:splitIds(personIds),
      ocrJobId:ocrJobId.trim(),manualFaceGroupingApproved:faceApproved};const signature=JSON.stringify(payload);const key='create-record';const op=operation(key,signature);
    const succeeded=await run(key,()=>window.pardus!.createMemoryStudioRecord({clientOperationId:op.clientOperationId,recordId:op.resourceId,kind,title:payload.title,
      ...(payload.summary?{summary:payload.summary}:{}),...(payload.archiveItemIds.length?{archiveItemIds:payload.archiveItemIds}:{}),
      ...(payload.personIds.length?{personIds:payload.personIds}:{}),...(payload.ocrJobId?{ocrJobId:payload.ocrJobId}:{}),
      ...(kind==='face_group'?{manualFaceGroupingApproved:faceApproved}:{})}));
    if(succeeded){setTitle('');setSummary('');setArchiveIds('');setPersonIds('');setOcrJobId('');setFaceApproved(false);}
  };
  const createCapsule=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus)return;const parsed=new Date(unlockAt);
    if(!Number.isFinite(parsed.getTime())){setError('Geçerli bir açılma tarihi seçin.');return;}
    const payload={title:capsuleTitle.trim(),archiveItemIds:splitIds(capsuleArchiveIds),memoryRecordIds:[...selectedRecords].sort(),unlockAt:parsed.toISOString()};
    const signature=JSON.stringify(payload);const key='create-capsule';const op=operation(key,signature);
    const succeeded=await run(key,()=>window.pardus!.createMemoryTimeCapsule({clientOperationId:op.clientOperationId,capsuleId:op.resourceId,...payload}));
    if(succeeded){setCapsuleTitle('');setCapsuleArchiveIds('');setSelectedRecords([]);setUnlockAt(futureDefault());}
  };
  const deleteRecord=(recordId:string,revision:number)=>{if(!window.pardus)return;const key=`delete:${recordId}`;const op=operation(key,`${recordId}:${revision}`);
    void run(key,()=>window.pardus!.deleteMemoryStudioRecord({clientOperationId:op.clientOperationId,recordId,expectedRevision:revision}));};
  const reviewCapsule=(capsule:MemoryTimeCapsuleCenterItemView,decision:'approve'|'revoke_approval')=>{if(!window.pardus)return;const key=`${decision}:${capsule.id}`;
    const op=operation(key,`${capsule.id}:${capsule.revision}:${decision}`);void run(key,()=>window.pardus!.reviewMemoryTimeCapsule({clientOperationId:op.clientOperationId,
      capsuleId:capsule.id,expectedRevision:capsule.revision,decision}));};
  const transitionCapsule=(capsule:MemoryTimeCapsuleCenterItemView,transition:'seal'|'release'|'cancel'|'rollback')=>{if(!window.pardus)return;const key=`${transition}:${capsule.id}`;
    const op=operation(key,`${capsule.id}:${capsule.revision}:${transition}`);void run(key,()=>window.pardus!.transitionMemoryTimeCapsule({clientOperationId:op.clientOperationId,
      capsuleId:capsule.id,expectedRevision:capsule.revision,transition}));};
  return <Surface className="memory-studio" aria-labelledby="memory-studio-title">
    <div className="panel-heading"><div><span className="eyebrow">33‑X · yerel anı ve zaman kapsülü</span><h2 id="memory-studio-title">Hafıza stüdyosu</h2><p>Korunan arşiv kayıtlarını kopyalamadan aile anlatıları, albüm taslakları ve iki onaylı zaman kapsülleri düzenleyin.</p></div><Button disabled={!!busy} onClick={()=>void refresh()}>Yenile</Button></div>
    <div className="memory-studio-truth"><strong>Manuel ve yerel çalışma sınırı</strong><span>Ses çözümleme, yüz tanıma, yinelenen fotoğraf bulma, belgesel/kitap üretme veya yazdırma yapılmaz. Bu ekran yalnız kullanıcı tarafından girilen metni ve korunan yerel kaynak kimliklerini düzenler.</span><span>Ağ, bulut ve haricî teslimat kullanılmaz. Kapsül açılışı yalnız yerel görünürlüğü değiştirir; başka hesaba veri göndermez.</span></div>
    {error&&<StatusMessage tone="danger">{error}</StatusMessage>}
    <div className="memory-studio-grid"><form className="memory-studio-form" onSubmit={event=>void createRecord(event)}><span className="eyebrow">Yeni içeriksiz bağlantı</span><h3>Anı kaydı oluştur</h3>
      <label>Tür<select value={kind} onChange={event=>{setKind(event.target.value as MemoryStudioRecordKind);pending.current.delete('create-record');}}>{MEMORY_STUDIO_RECORD_KINDS.map(value=><option key={value} value={value}>{kindLabels[value]}</option>)}</select></label>
      <label>Başlık<input required minLength={2} maxLength={160} value={title} onChange={event=>{setTitle(event.target.value);pending.current.delete('create-record');}}/></label>
      <label>Manuel özet veya mesaj<textarea maxLength={2000} rows={4} value={summary} onChange={event=>{setSummary(event.target.value);pending.current.delete('create-record');}}/></label>
      <label>Arşiv kayıt kimlikleri <small>(virgülle)</small><input value={archiveIds} onChange={event=>{setArchiveIds(event.target.value);pending.current.delete('create-record');}}/></label>
      <label>Kişi kimlikleri <small>(virgülle)</small><input value={personIds} onChange={event=>{setPersonIds(event.target.value);pending.current.delete('create-record');}}/></label>
      <label>Yerel OCR işi kimliği <small>(isteğe bağlı)</small><input value={ocrJobId} onChange={event=>{setOcrJobId(event.target.value);pending.current.delete('create-record');}}/></label>
      {kind==='face_group'&&<label className="memory-studio-check"><input type="checkbox" checked={faceApproved} onChange={event=>{setFaceApproved(event.target.checked);pending.current.delete('create-record');}}/>Kişileri otomatik tanıma olmadan elle seçtiğimi onaylıyorum.</label>}
      <Button tone="primary" type="submit" disabled={!!busy||center?.storageCapacity.records.limitReached===true}>{busy==='create-record'?'Kaydediliyor…':'Anı kaydını ekle'}</Button></form>
      <form className="memory-studio-form" onSubmit={event=>void createCapsule(event)}><span className="eyebrow">İki onay ve zaman kilidi</span><h3>Zaman kapsülü oluştur</h3>
      <label>Başlık<input required minLength={2} maxLength={160} value={capsuleTitle} onChange={event=>{setCapsuleTitle(event.target.value);pending.current.delete('create-capsule');}}/></label>
      <label>Açılma zamanı<input type="datetime-local" required value={unlockAt} onChange={event=>{setUnlockAt(event.target.value);pending.current.delete('create-capsule');}}/></label>
      <label>Ek arşiv kayıt kimlikleri <small>(virgülle)</small><input value={capsuleArchiveIds} onChange={event=>{setCapsuleArchiveIds(event.target.value);pending.current.delete('create-capsule');}}/></label>
      <fieldset><legend>Hafıza kayıtları</legend>{center?.records.length?center.records.map(record=><label className="memory-studio-check" key={record.id}><input type="checkbox" checked={selectedRecords.includes(record.id)} onChange={event=>{setSelectedRecords(current=>event.target.checked?[...current,record.id]:current.filter(id=>id!==record.id));pending.current.delete('create-capsule');}}/>{record.title}</label>):<small>Önce bir anı kaydı oluşturabilir veya arşiv kimliği ekleyebilirsiniz.</small>}</fieldset>
      <Button tone="primary" type="submit" disabled={!!busy||center?.storageCapacity.capsules.limitReached===true||(selectedRecords.length===0&&splitIds(capsuleArchiveIds).length===0)}>{busy==='create-capsule'?'Kaydediliyor…':'Kapsülü oluştur'}</Button></form></div>
    {center&&<div className="family-ai-summary" aria-label="Hafıza stüdyosu yerel kapasitesi"><span>Anı kapasitesi: {center.storageCapacity.records.remaining}/{center.storageCapacity.records.maximum}</span><span>Kapsül kapasitesi: {center.storageCapacity.capsules.remaining}/{center.storageCapacity.capsules.maximum}</span></div>}
    {(center?.storageCapacity.records.limitReached||center?.storageCapacity.capsules.limitReached)&&<StatusMessage tone="danger">Güvenli yerel kapasite sınırına ulaşılan türde yeni kayıt oluşturma fail‑closed kapatıldı.</StatusMessage>}
    <section className="memory-studio-list" aria-labelledby="memory-records-title"><div className="panel-heading"><div><span className="eyebrow">{center?.records.length??0} kayıt</span><h3 id="memory-records-title">Anı kayıtları</h3></div></div>
      {!center?<p>Yerel merkez yükleniyor…</p>:center.records.length===0?<EmptyState title="Anı kaydı yok" body="Tarif, gelenek, mektup veya korunan medya bağlantısı ekleyin."/>:center.records.map(record=><article className="memory-studio-row" key={record.id}><div><strong>{record.title}</strong><span>{kindLabels[record.kind]} · {record.archiveItemIds.length} arşiv bağı · sürüm {record.revision}</span>{record.summary&&<p>{record.summary}</p>}</div><Button tone="danger" disabled={!!busy} onClick={()=>deleteRecord(record.id,record.revision)}>Kaydı kaldır</Button></article>)}</section>
    <section className="memory-studio-list" aria-labelledby="memory-capsules-title"><div className="panel-heading"><div><span className="eyebrow">{center?.capsules.length??0} kapsül</span><h3 id="memory-capsules-title">Zaman kapsülleri</h3></div></div>
       {!center?<p>Yerel merkez yükleniyor…</p>:center.capsules.length===0?<EmptyState title="Zaman kapsülü yok" body="En az bir korunan kaynakla, yedi günden ileri bir açılma tarihi belirleyin."/>:center.capsules.map(capsule=><article className="memory-studio-row memory-capsule-row" key={capsule.id}><div><strong>{capsule.title}</strong><span>{capsuleStatus[capsule.status]} · {capsule.approvalCount}/{capsule.minimumApprovals} onay · {new Date(capsule.unlockAt).toLocaleString('tr-TR')}</span></div><div className="button-row">{capsule.status==='awaiting_approvals'&&<><Button disabled={!!busy} onClick={()=>reviewCapsule(capsule,capsule.currentAccountApprovalRecorded?'revoke_approval':'approve')}>{capsule.currentAccountApprovalRecorded?'Onayımı geri al':'Onayla'}</Button><Button disabled={!!busy||capsule.approvalCount<capsule.minimumApprovals} onClick={()=>transitionCapsule(capsule,'seal')}>Mühürle</Button><Button tone="danger" disabled={!!busy} onClick={()=>transitionCapsule(capsule,'cancel')}>İptal et</Button></>}{capsule.status==='sealed'&&<><Button tone="primary" disabled={!!busy||Date.now()<Date.parse(capsule.unlockAt)} onClick={()=>transitionCapsule(capsule,'release')}>Yerel olarak aç</Button><Button tone="danger" disabled={!!busy} onClick={()=>transitionCapsule(capsule,'cancel')}>İptal et</Button></>}{capsule.status==='released'&&<Button tone="danger" disabled={!!busy||!capsule.releasedAt||Date.now()<Date.parse(capsule.releasedAt)||Date.now()>Date.parse(capsule.releasedAt)+86_400_000} onClick={()=>transitionCapsule(capsule,'rollback')}>Açılışı geri al</Button>}</div></article>)}</section>
  </Surface>;
}
