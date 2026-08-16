import { useEffect, useState } from 'react';
import { AsyncStatePanel } from './form-ux';
import { Button, EmptyState, StatusMessage } from './ui';

type Bridge=NonNullable<Window['pardus']>;
type Center=Awaited<ReturnType<Bridge['getCommunicationAuditArchiveCenter']>>;
const errorText=(caught:unknown):string=>caught instanceof Error?caught.message:'İletişim denetim merkezi yüklenemedi.';
const time=(value:string):string=>new Date(value).toLocaleString('tr-TR');
const eventLabel:Readonly<Record<Center['recentEvents'][number]['eventKind'],string>>=Object.freeze({
  room_joined:'Odaya katılım',room_left:'Odadan ayrılma',call_started:'Çağrı başlangıcı',call_ended:'Çağrı bitişi',
  file_shared:'Dosya paylaşımı',permission_changed:'İzin değişikliği',message_created:'Mesaj oluşturma',
  message_deleted:'Mesaj silme',recording_consent_changed:'Kayıt rızası değişikliği'
});

export function CommunicationAuditArchivePanel(){
  const [center,setCenter]=useState<Center>();const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState('');
  const refresh=async(initial=false)=>{const bridge=window.pardus;if(!bridge){setLoading(false);setLoadError('Masaüstü köprüsü kullanılamıyor.');return;}
    if(initial)setLoading(true);setLoadError('');try{setCenter(await bridge.getCommunicationAuditArchiveCenter());}
    catch(caught){setLoadError(errorText(caught));}finally{setLoading(false);}};
  useEffect(()=>{void refresh(true);},[]);
  if(loading&&!center)return <AsyncStatePanel state="loading" title="Denetim zinciri yükleniyor" message="İçerik taşımayan yerel olay zinciri doğrulanıyor."/>;
  if(loadError&&!center)return <AsyncStatePanel state="error" title="Denetim zinciri yüklenemedi" message={loadError} onRetry={async()=>refresh(true)}/>;
  if(!center)return <AsyncStatePanel state="empty" title="Denetim merkezi kullanılamıyor" message="Masaüstü yetki sınırı hazır değil."/>;
  return <section className="communication-audit-archive panel" aria-labelledby="communication-audit-archive-title" aria-busy={loading}>
    <div className="panel-heading"><div><span className="eyebrow">34-H · İletişim audit ve arşiv bütünlüğü</span>
      <h2 id="communication-audit-archive-title">İçerikten ayrı denetim zinciri</h2>
      <p>{center.eventCount} olay · {center.checkpointCount} arşiv checkpoint’i · son doğrulama {time(center.generatedAt)}</p></div>
      <Button onClick={()=>void refresh()} disabled={loading}>Yenile</Button></div>
    <div className="communication-recording-truth" role="note"><strong>Audit olayları mesaj, dosya, görüşme veya tutanak içeriğini kopyalayamaz.</strong>
      <span>Renderer yalnız olay türü, kaynak sınıfı, sürüm, sıra ve zamanı görür; kişi, cihaz, kaynak kimliği, hash ve manifest verilmez.</span>
      <span>Ledger append-only ve previousHash→eventHash zincirlidir; SQLite trigger’ları update/delete işlemlerini reddeder.</span>
      <span>Uzak replikasyon, dış yedek sağlayıcısı ve gerçek restore tatbikatı doğrulanmamıştır. Ağ ve bulut kullanılmaz.</span></div>
    {loadError&&<StatusMessage tone="warning">Son görünüm korunuyor; yenileme başarısız: {loadError}</StatusMessage>}
    <StatusMessage tone={center.chainValid?'success':'warning'}>{center.chainValid
      ?'Yerel içeriksiz hash zinciri geçerli.':'Yerel hash zinciri doğrulanamadı; kayıtlar güvenilir kabul edilmemelidir.'}</StatusMessage>
    <div className="communication-audit-archive-grid"><section><h3>Son denetim olayları</h3>
      {center.recentEvents.length===0?<EmptyState title="Olay yok" body="Üretim olay üretici kancaları henüz bağlı değildir."/>:
        <ol className="communication-audit-event-list">{center.recentEvents.map((event)=><li key={`${event.sequence}-${event.occurredAt}`}>
          <strong>{eventLabel[event.eventKind]}</strong><span>{event.resourceType} · sürüm {event.resourceVersion}</span>
          <small>Sıra {event.sequence} · {time(event.occurredAt)}</small></li>)}</ol>}
      {center.recentEventsTruncated&&<small>Güvenli görünüm yalnız son 100 olayı gösterir; toplam {center.eventCount}.</small>}</section>
      <section><h3>Arşiv bütünlük checkpoint’leri</h3>{center.recentCheckpoints.length===0?
        <EmptyState title="Checkpoint yok" body="Gerçek yedek/restore kanıtı henüz kaydedilmemiştir."/>:
        <ol className="communication-audit-event-list">{center.recentCheckpoints.map((checkpoint)=><li key={checkpoint.archiveGeneration}>
          <strong>Nesil {checkpoint.archiveGeneration}</strong><span>Kasa {checkpoint.vaultVerified?'doğrulandı':'doğrulanmadı'} · yedek {checkpoint.backupVerified?'doğrulandı':'doğrulanmadı'}</span>
          <small>Restore {checkpoint.restoreVerified?'yerel kanıtlı':'NOT_RUN'} · uzak replikasyon doğrulanmadı · {time(checkpoint.createdAt)}</small></li>)}</ol>}
      {center.recentCheckpointsTruncated&&<small>Güvenli görünüm yalnız son 50 checkpoint’i gösterir.</small>}</section></div>
  </section>;
}
