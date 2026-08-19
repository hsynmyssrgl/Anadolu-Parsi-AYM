import { useEffect, useState } from 'react';
import { AsyncStatePanel } from './form-ux';
import { Button, EmptyState, StatusMessage } from './ui';
import { selectUiCopy, useLocalization } from './localization';

type Bridge=NonNullable<Window['pardus']>;
type Center=Awaited<ReturnType<Bridge['getCommunicationAuditArchiveCenter']>>;
const eventLabel:Readonly<Record<Center['recentEvents'][number]['eventKind'],string>>=Object.freeze({
  room_joined:'Odaya katılım',room_left:'Odadan ayrılma',call_started:'Çağrı başlangıcı',call_ended:'Çağrı bitişi',
  file_shared:'Dosya paylaşımı',permission_changed:'İzin değişikliği',message_created:'Mesaj oluşturma',
  message_deleted:'Mesaj silme',recording_consent_changed:'Kayıt rızası değişikliği'
});

export function CommunicationAuditArchivePanel(){
  const {language,locale}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const time=(value:string):string=>new Date(value).toLocaleString(locale);
  const label=(kind:Center['recentEvents'][number]['eventKind']):string=>language==='tr'?eventLabel[kind]:({
    room_joined:'Room joined',room_left:'Room left',call_started:'Call started',call_ended:'Call ended',file_shared:'File shared',
    permission_changed:'Permission changed',message_created:'Message created',message_deleted:'Message deleted',recording_consent_changed:'Recording consent changed'
  } as const)[kind];
  const [center,setCenter]=useState<Center>();const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState('');
  const refresh=async(initial=false)=>{const bridge=window.pardus;if(!bridge){setLoading(false);setLoadError(text('Masaüstü köprüsü kullanılamıyor.','Desktop bridge is unavailable.'));return;}
    if(initial)setLoading(true);setLoadError('');try{setCenter(await bridge.getCommunicationAuditArchiveCenter());}
    catch(caught){setLoadError(caught instanceof Error?caught.message:text('İletişim denetim merkezi yüklenemedi.','Communication audit center could not be loaded.'));}finally{setLoading(false);}};
  useEffect(()=>{void refresh(true);},[]);
  if(loading&&!center)return <AsyncStatePanel state="loading" title={text('Denetim zinciri yükleniyor','Loading audit chain')} message={text('İçerik taşımayan yerel olay zinciri doğrulanıyor.','Verifying the content-free local event chain.')}/>;
  if(loadError&&!center)return <AsyncStatePanel state="error" title={text('Denetim zinciri yüklenemedi','Audit chain could not be loaded')} message={loadError} onRetry={async()=>refresh(true)}/>;
  if(!center)return <AsyncStatePanel state="empty" title={text('Denetim merkezi kullanılamıyor','Audit center is unavailable')} message={text('Masaüstü yetki sınırı hazır değil.','The desktop authorization boundary is not ready.')}/>;
  return <section className="communication-audit-archive panel" aria-labelledby="communication-audit-archive-title" aria-busy={loading}>
    <div className="panel-heading"><div><span className="eyebrow">{text('34-H · İletişim audit ve arşiv bütünlüğü','34-H · Communication audit and archive integrity')}</span>
      <h2 id="communication-audit-archive-title">{text('İçerikten ayrı denetim zinciri','Content-separated audit chain')}</h2>
      <p>{center.eventCount} {text('olay','events')} · {center.checkpointCount} {text('arşiv checkpoint’i','archive checkpoints')} · {text('son doğrulama','last verification')} {time(center.generatedAt)}</p></div>
      <Button onClick={()=>void refresh()} disabled={loading}>{text('Yenile','Refresh')}</Button></div>
    <div className="communication-recording-truth" role="note"><strong>{text('Audit olayları mesaj, dosya, görüşme veya tutanak içeriğini kopyalayamaz.','Audit events cannot copy message, file, call or transcript content.')}</strong>
      <span>{text('Renderer yalnız olay türü, kaynak sınıfı, sürüm, sıra ve zamanı görür; kişi, cihaz, kaynak kimliği, hash ve manifest verilmez.','The renderer sees only event type, resource class, revision, sequence and time; person, device, resource ID, hash and manifest are not exposed.')}</span>
      <span>{text('Ledger append-only ve previousHash→eventHash zincirlidir; SQLite trigger’ları update/delete işlemlerini reddeder.','The ledger is append-only and chained by previousHash→eventHash; SQLite triggers reject update and delete operations.')}</span>
      <span>{text('Uzak replikasyon, dış yedek sağlayıcısı ve gerçek restore tatbikatı doğrulanmamıştır. Ağ ve bulut kullanılmaz.','Remote replication, an external backup provider and a real restore drill have not been verified. Network and cloud services are not used.')}</span></div>
    {loadError&&<StatusMessage tone="warning">{text('Son görünüm korunuyor; yenileme başarısız:','The last view is preserved; refresh failed:')} {loadError}</StatusMessage>}
    <StatusMessage tone={center.chainValid?'success':'warning'}>{center.chainValid
      ?text('Yerel içeriksiz hash zinciri geçerli.','The local content-free hash chain is valid.'):text('Yerel hash zinciri doğrulanamadı; kayıtlar güvenilir kabul edilmemelidir.','The local hash chain could not be verified; records must not be considered trustworthy.')}</StatusMessage>
    <div className="communication-audit-archive-grid"><section><h3>{text('Son denetim olayları','Recent audit events')}</h3>
      {center.recentEvents.length===0?<EmptyState title={text('Olay yok','No events')} body={text('Üretim olay üretici kancaları henüz bağlı değildir.','Production event-producer hooks are not connected yet.')}/>:
        <ol className="communication-audit-event-list">{center.recentEvents.map((event)=><li key={`${event.sequence}-${event.occurredAt}`}>
          <strong>{label(event.eventKind)}</strong><span>{event.resourceType} · {text('sürüm','revision')} {event.resourceVersion}</span>
          <small>{text('Sıra','Sequence')} {event.sequence} · {time(event.occurredAt)}</small></li>)}</ol>}
      {center.recentEventsTruncated&&<small>{text('Güvenli görünüm yalnız son 100 olayı gösterir; toplam','The safe view shows only the last 100 events; total')} {center.eventCount}.</small>}</section>
      <section><h3>{text('Arşiv bütünlük checkpoint’leri','Archive integrity checkpoints')}</h3>{center.recentCheckpoints.length===0?
        <EmptyState title={text('Checkpoint yok','No checkpoints')} body={text('Gerçek yedek/restore kanıtı henüz kaydedilmemiştir.','Real backup/restore evidence has not been recorded yet.')}/>:
        <ol className="communication-audit-event-list">{center.recentCheckpoints.map((checkpoint)=><li key={checkpoint.archiveGeneration}>
          <strong>{text('Nesil','Generation')} {checkpoint.archiveGeneration}</strong><span>{text('Kasa','Vault')} {checkpoint.vaultVerified?text('doğrulandı','verified'):text('doğrulanmadı','not verified')} · {text('yedek','backup')} {checkpoint.backupVerified?text('doğrulandı','verified'):text('doğrulanmadı','not verified')}</span>
          <small>{text('Restore','Restore')} {checkpoint.restoreVerified?text('yerel kanıtlı','locally evidenced'):'NOT_RUN'} · {text('uzak replikasyon doğrulanmadı','remote replication not verified')} · {time(checkpoint.createdAt)}</small></li>)}</ol>}
      {center.recentCheckpointsTruncated&&<small>{text('Güvenli görünüm yalnız son 50 checkpoint’i gösterir.','The safe view shows only the last 50 checkpoints.')}</small>}</section></div>
  </section>;
}
