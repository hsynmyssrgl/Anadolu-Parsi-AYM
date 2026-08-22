import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MEMORY_STUDIO_RECORD_KINDS } from '@ppt/domain/renderer';
import type { MemoryStudioCenterView, MemoryStudioRecordKind,
  MemoryTimeCapsuleCenterItemView } from '@ppt/domain';
import { Button, EmptyState, StatusMessage, Surface } from './ui';
import { selectUiCopy, useLocalization } from './localization';

const splitIds=(value:string):readonly string[]=>[...new Set(value.split(',').map(item=>item.trim()).filter(Boolean))];
const futureDefault=():string=>{const value=new Date(Date.now()+8*86_400_000);value.setSeconds(0,0);return value.toISOString().slice(0,16);};
interface PendingOperation{readonly clientOperationId:string;readonly resourceId:string;readonly signature:string}

export function MemoryStudioPanel(){
  const { language, locale }=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const kindLabels:Readonly<Record<MemoryStudioRecordKind,string>>=Object.freeze({
    voice_story:text('Sesli yaşam hikâyesi bağlantısı','Voice life-story link'),transcript:text('Yerel transkript bağlantısı','Local transcript link'),photo_book:text('Fotoğraf kitabı','Photo book'),
    annual_album:text('Yıllık albüm','Annual album'),on_this_day:text('Bugün geçmişte','On this day'),duplicate_photo_review:text('Yinelenen fotoğraf incelemesi','Duplicate photo review'),
    face_group:text('Manuel kişi grubu','Manual person group'),genealogy_media_link:text('Soy ağacı medya bağlantısı','Family-tree media link'),recipe:text('Aile tarifi','Family recipe'),
    tradition:text('Aile geleneği','Family tradition'),letter:text('Mektup','Letter'),future_message:text('Gelecek kuşak mesajı','Future-generation message'),
    family_documentary:text('Aile belgeseli taslağı','Family documentary draft'),printable_book:text('Basılabilir kitap taslağı','Printable book draft')
  });
  const capsuleStatus:Readonly<Record<MemoryTimeCapsuleCenterItemView['status'],string>>=Object.freeze({
    awaiting_approvals:text('İki ayrı hesap onayı bekliyor','Awaiting two separate account approvals'),sealed:text('Yerel olarak mühürlü','Sealed locally'),released:text('Yerel olarak açıldı','Released locally'),
    cancelled:text('İptal edildi','Canceled'),rolled_back:text('Açılış geri alındı','Release rolled back')
  });
  const [center,setCenter]=useState<MemoryStudioCenterView>();const [kind,setKind]=useState<MemoryStudioRecordKind>('voice_story');
  const [title,setTitle]=useState('');const [summary,setSummary]=useState('');const [archiveIds,setArchiveIds]=useState('');
  const [personIds,setPersonIds]=useState('');const [ocrJobId,setOcrJobId]=useState('');const [faceApproved,setFaceApproved]=useState(false);
  const [capsuleTitle,setCapsuleTitle]=useState('');const [capsuleArchiveIds,setCapsuleArchiveIds]=useState('');
  const [selectedRecords,setSelectedRecords]=useState<readonly string[]>([]);const [unlockAt,setUnlockAt]=useState(futureDefault);
  const [busy,setBusy]=useState('');const [error,setError]=useState('');const pending=useRef(new Map<string,PendingOperation>());
  const reload=async()=>{if(window.pardus)setCenter(await window.pardus.getMemoryStudioCenter());};
  const refresh=async()=>{setError('');try{await reload();}catch(value){setError(value instanceof Error?value.message:text('Hafıza stüdyosu yüklenemedi.','Memory studio could not be loaded.'));}};
  useEffect(()=>{void reload().catch(value=>setError(value instanceof Error?value.message:text('Hafıza stüdyosu yüklenemedi.','Memory studio could not be loaded.')));},[]);
  const operation=(key:string,signature:string):PendingOperation=>{const prior=pending.current.get(key);if(prior?.signature===signature)return prior;
    const next={clientOperationId:crypto.randomUUID(),resourceId:crypto.randomUUID(),signature};pending.current.set(key,next);return next;};
  const run=async(key:string,task:()=>Promise<unknown>):Promise<boolean>=>{setBusy(key);setError('');try{await task();pending.current.delete(key);
      try{await reload();}catch(value){setError(value instanceof Error?`${text('İşlem kaydedildi; görünüm yenilenemedi:','The operation was saved, but the view could not be refreshed:')} ${value.message}`:text('İşlem kaydedildi; görünüm yenilenemedi.','The operation was saved, but the view could not be refreshed.'));}
      return true;}catch(value){setError(value instanceof Error?value.message:text('İşlem kaydedilemedi; aynı işlem kimliğiyle yeniden deneyebilirsiniz.','The operation could not be saved; you can retry with the same operation identifier.'));return false;}finally{setBusy('');}};
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
    if(!Number.isFinite(parsed.getTime())){setError(text('Geçerli bir açılma tarihi seçin.','Select a valid release date.'));return;}
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
    <div className="panel-heading"><div><span className="eyebrow">{text('Yerel anı ve zaman kapsülü','Local memories and time capsules')}</span><h2 id="memory-studio-title">{text('Hafıza stüdyosu','Memory studio')}</h2><p>{text('Korunan arşiv kayıtlarını kopyalamadan aile anlatıları, albüm taslakları ve iki onaylı zaman kapsülleri düzenleyin.','Organize family stories, album drafts and two-approval time capsules without copying protected archive records.')}</p></div><Button disabled={!!busy} onClick={()=>void refresh()}>{text('Yenile','Refresh')}</Button></div>
    <div className="memory-studio-truth"><strong>{text('Manuel ve yerel çalışma sınırı','Manual and local operation boundary')}</strong><span>{text('Ses çözümleme, yüz tanıma, yinelenen fotoğraf bulma, belgesel/kitap üretme veya yazdırma yapılmaz. Bu ekran yalnız kullanıcı tarafından girilen metni ve korunan yerel kaynak kimliklerini düzenler.','Speech transcription, face recognition, duplicate photo detection, documentary/book generation and printing are not performed. This screen organizes only user-entered text and protected local resource identifiers.')}</span><span>{text('Ağ, bulut ve haricî teslimat kullanılmaz. Kapsül açılışı yalnız yerel görünürlüğü değiştirir; başka hesaba veri göndermez.','Network, cloud and external delivery are not used. Releasing a capsule changes local visibility only and sends no data to another account.')}</span></div>
    {error&&<StatusMessage tone="danger">{error}</StatusMessage>}
    <div className="memory-studio-grid"><form className="memory-studio-form" onSubmit={event=>void createRecord(event)}><span className="eyebrow">{text('Yeni içeriksiz bağlantı','New content-free link')}</span><h3>{text('Anı kaydı oluştur','Create memory record')}</h3>
      <label>{text('Tür','Type')}<select value={kind} onChange={event=>{setKind(event.target.value as MemoryStudioRecordKind);pending.current.delete('create-record');}}>{MEMORY_STUDIO_RECORD_KINDS.map(value=><option key={value} value={value}>{kindLabels[value]}</option>)}</select></label>
      <label>{text('Başlık','Title')}<input required minLength={2} maxLength={160} value={title} onChange={event=>{setTitle(event.target.value);pending.current.delete('create-record');}}/></label>
      <label>{text('Manuel özet veya mesaj','Manual summary or message')}<textarea maxLength={2000} rows={4} value={summary} onChange={event=>{setSummary(event.target.value);pending.current.delete('create-record');}}/></label>
      <label>{text('Arşiv kayıt kimlikleri','Archive record identifiers')} <small>{text('(virgülle)','(comma-separated)')}</small><input value={archiveIds} onChange={event=>{setArchiveIds(event.target.value);pending.current.delete('create-record');}}/></label>
      <label>{text('Kişi kimlikleri','Person identifiers')} <small>{text('(virgülle)','(comma-separated)')}</small><input value={personIds} onChange={event=>{setPersonIds(event.target.value);pending.current.delete('create-record');}}/></label>
      <label>{text('Yerel OCR işi kimliği','Local OCR job identifier')} <small>{text('(isteğe bağlı)','(optional)')}</small><input value={ocrJobId} onChange={event=>{setOcrJobId(event.target.value);pending.current.delete('create-record');}}/></label>
      {kind==='face_group'&&<label className="memory-studio-check"><input type="checkbox" checked={faceApproved} onChange={event=>{setFaceApproved(event.target.checked);pending.current.delete('create-record');}}/>{text('Kişileri otomatik tanıma olmadan elle seçtiğimi onaylıyorum.','I confirm that I selected people manually without automatic recognition.')}</label>}
      <Button tone="primary" type="submit" disabled={!!busy||center?.storageCapacity.records.limitReached===true}>{busy==='create-record'?text('Kaydediliyor…','Saving…'):text('Anı kaydını ekle','Add memory record')}</Button></form>
      <form className="memory-studio-form" onSubmit={event=>void createCapsule(event)}><span className="eyebrow">{text('İki onay ve zaman kilidi','Two approvals and a time lock')}</span><h3>{text('Zaman kapsülü oluştur','Create time capsule')}</h3>
      <label>{text('Başlık','Title')}<input required minLength={2} maxLength={160} value={capsuleTitle} onChange={event=>{setCapsuleTitle(event.target.value);pending.current.delete('create-capsule');}}/></label>
      <label>{text('Açılma zamanı','Release time')}<input type="datetime-local" required value={unlockAt} onChange={event=>{setUnlockAt(event.target.value);pending.current.delete('create-capsule');}}/></label>
      <label>{text('Ek arşiv kayıt kimlikleri','Additional archive record identifiers')} <small>{text('(virgülle)','(comma-separated)')}</small><input value={capsuleArchiveIds} onChange={event=>{setCapsuleArchiveIds(event.target.value);pending.current.delete('create-capsule');}}/></label>
      <fieldset><legend>{text('Hafıza kayıtları','Memory records')}</legend>{center?.records.length?center.records.map(record=><label className="memory-studio-check" key={record.id}><input type="checkbox" checked={selectedRecords.includes(record.id)} onChange={event=>{setSelectedRecords(current=>event.target.checked?[...current,record.id]:current.filter(id=>id!==record.id));pending.current.delete('create-capsule');}}/>{record.title}</label>):<small>{text('Önce bir anı kaydı oluşturabilir veya arşiv kimliği ekleyebilirsiniz.','Create a memory record first or add an archive identifier.')}</small>}</fieldset>
      <Button tone="primary" type="submit" disabled={!!busy||center?.storageCapacity.capsules.limitReached===true||(selectedRecords.length===0&&splitIds(capsuleArchiveIds).length===0)}>{busy==='create-capsule'?text('Kaydediliyor…','Saving…'):text('Kapsülü oluştur','Create capsule')}</Button></form></div>
    {center&&<div className="family-ai-summary" aria-label={text('Hafıza stüdyosu yerel kapasitesi','Memory studio local capacity')}><span>{text('Anı kapasitesi','Memory capacity')}: {center.storageCapacity.records.remaining}/{center.storageCapacity.records.maximum}</span><span>{text('Kapsül kapasitesi','Capsule capacity')}: {center.storageCapacity.capsules.remaining}/{center.storageCapacity.capsules.maximum}</span></div>}
    {(center?.storageCapacity.records.limitReached||center?.storageCapacity.capsules.limitReached)&&<StatusMessage tone="danger">{text('Güvenli yerel kapasite sınırına ulaşılan türde yeni kayıt oluşturma fail‑closed kapatıldı.','Creating new records of the type that reached its secure local capacity limit was disabled fail-closed.')}</StatusMessage>}
    <section className="memory-studio-list" aria-labelledby="memory-records-title"><div className="panel-heading"><div><span className="eyebrow">{center?.records.length??0} {text('kayıt','records')}</span><h3 id="memory-records-title">{text('Anı kayıtları','Memory records')}</h3></div></div>
      {!center?<p>{text('Yerel merkez yükleniyor…','Loading local center…')}</p>:center.records.length===0?<EmptyState title={text('Anı kaydı yok','No memory records')} body={text('Tarif, gelenek, mektup veya korunan medya bağlantısı ekleyin.','Add a recipe, tradition, letter or protected media link.')}/>:center.records.map(record=><article className="memory-studio-row" key={record.id}><div><strong>{record.title}</strong><span>{kindLabels[record.kind]} · {record.archiveItemIds.length} {text('arşiv bağı','archive links')} · {text('sürüm','revision')} {record.revision}</span>{record.summary&&<p>{record.summary}</p>}</div><Button tone="danger" disabled={!!busy} onClick={()=>deleteRecord(record.id,record.revision)}>{text('Kaydı kaldır','Remove record')}</Button></article>)}</section>
    <section className="memory-studio-list" aria-labelledby="memory-capsules-title"><div className="panel-heading"><div><span className="eyebrow">{center?.capsules.length??0} {text('kapsül','capsules')}</span><h3 id="memory-capsules-title">{text('Zaman kapsülleri','Time capsules')}</h3></div></div>
       {!center?<p>{text('Yerel merkez yükleniyor…','Loading local center…')}</p>:center.capsules.length===0?<EmptyState title={text('Zaman kapsülü yok','No time capsules')} body={text('En az bir korunan kaynakla, yedi günden ileri bir açılma tarihi belirleyin.','Choose a release date more than seven days ahead with at least one protected source.')}/>:center.capsules.map(capsule=><article className="memory-studio-row memory-capsule-row" key={capsule.id}><div><strong>{capsule.title}</strong><span>{capsuleStatus[capsule.status]} · {capsule.approvalCount}/{capsule.minimumApprovals} {text('onay','approvals')} · {new Date(capsule.unlockAt).toLocaleString(locale)}</span></div><div className="button-row">{capsule.status==='awaiting_approvals'&&<><Button disabled={!!busy} onClick={()=>reviewCapsule(capsule,capsule.currentAccountApprovalRecorded?'revoke_approval':'approve')}>{capsule.currentAccountApprovalRecorded?text('Onayımı geri al','Revoke my approval'):text('Onayla','Approve')}</Button><Button disabled={!!busy||capsule.approvalCount<capsule.minimumApprovals} onClick={()=>transitionCapsule(capsule,'seal')}>{text('Mühürle','Seal')}</Button><Button tone="danger" disabled={!!busy} onClick={()=>transitionCapsule(capsule,'cancel')}>{text('İptal et','Cancel')}</Button></>}{capsule.status==='sealed'&&<><Button tone="primary" disabled={!!busy||Date.now()<Date.parse(capsule.unlockAt)} onClick={()=>transitionCapsule(capsule,'release')}>{text('Yerel olarak aç','Release locally')}</Button><Button tone="danger" disabled={!!busy} onClick={()=>transitionCapsule(capsule,'cancel')}>{text('İptal et','Cancel')}</Button></>}{capsule.status==='released'&&<Button tone="danger" disabled={!!busy||!capsule.releasedAt||Date.now()<Date.parse(capsule.releasedAt)||Date.now()>Date.parse(capsule.releasedAt)+86_400_000} onClick={()=>transitionCapsule(capsule,'rollback')}>{text('Açılışı geri al','Roll back release')}</Button>}</div></article>)}</section>
  </Surface>;
}
