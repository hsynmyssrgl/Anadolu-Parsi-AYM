import { useEffect, useState } from 'react';
import { AsyncStatePanel } from './form-ux';
import { Button, EmptyState, StatusMessage } from './ui';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

type Bridge=NonNullable<Window['pardus']>;
type Center=Awaited<ReturnType<Bridge['getCommunicationAuditArchiveCenter']>>;
type AuditResourceType=Center['recentEvents'][number]['resourceType'];
const eventLabel:Readonly<Record<Center['recentEvents'][number]['eventKind'],string>>=Object.freeze({
  room_joined:'Odaya katılım',room_left:'Odadan ayrılma',call_started:'Çağrı başlangıcı',call_ended:'Çağrı bitişi',
  file_shared:'Dosya paylaşımı',permission_changed:'İzin değişikliği',message_created:'Mesaj oluşturma',
  message_deleted:'Mesaj silme',recording_consent_changed:'Kayıt rızası değişikliği'
});

export function CommunicationAuditArchivePanel(){
  const {language,locale}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const resourceTypeLabels:Readonly<Record<AuditResourceType,string>>={
    communication_room:text('İletişim odası','Communication room'),communication_call_session:text('Çağrı planı','Call plan'),
    communication_file_sharing:text('Dosya paylaşımı','File sharing'),communication_permission:text('İletişim izni','Communication permission'),
    communication_message:text('Mesaj','Message'),communication_recording_request:text('Kayıt rıza planı','Recording consent plan')
  };
  const time=(value:string):string=>new Date(value).toLocaleString(locale);
  const label=(kind:Center['recentEvents'][number]['eventKind']):string=>language==='tr'?eventLabel[kind]:({
    room_joined:'Room joined',room_left:'Room left',call_started:'Call started',call_ended:'Call ended',file_shared:'File shared',
    permission_changed:'Permission changed',message_created:'Message created',message_deleted:'Message deleted',recording_consent_changed:'Recording consent changed'
  } as const)[kind];
  const [center,setCenter]=useState<Center>();const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState('');
  const refresh=async(initial=false)=>{const bridge=window.pardus;if(!bridge){setLoading(false);setLoadError(text('Masaüstü köprüsü kullanılamıyor.','Desktop bridge is unavailable.'));return;}
    if(initial)setLoading(true);setLoadError('');try{setCenter(await bridge.getCommunicationAuditArchiveCenter());}
    catch(caught){setLoadError(toUserFacingErrorMessage(caught,text('İletişim denetim merkezi yüklenemedi.','Communication audit center could not be loaded.')));}finally{setLoading(false);}};
  useEffect(()=>{void refresh(true);},[]);
  if(loading&&!center)return <AsyncStatePanel state="loading" title={text('İşlem geçmişi yükleniyor','Loading activity history')} message={text('İçerik taşımayan yerel işlem geçmişi doğrulanıyor.','Verifying the local activity history that contains no content.')}/>;
  if(loadError&&!center)return <AsyncStatePanel state="error" title={text('İşlem geçmişi yüklenemedi','Activity history could not be loaded')} message={loadError} onRetry={async()=>refresh(true)}/>;
  if(!center)return <AsyncStatePanel state="empty" title={text('İşlem geçmişi kullanılamıyor','Activity history is unavailable')} message={text('Güvenli masaüstü bağlantısı hazır değil.','The secure desktop connection is not ready.')}/>;
  return <section className="communication-audit-archive panel" aria-labelledby="communication-audit-archive-title" aria-busy={loading}>
    <div className="panel-heading"><div><span className="eyebrow">{text('İletişim denetimi ve arşiv bütünlüğü','Communication audit and archive integrity')}</span>
      <h2 id="communication-audit-archive-title">{text('İçerikten ayrı işlem geçmişi','Activity history kept separate from content')}</h2>
      <p>{center.eventCount} {text('olay','events')} · {center.checkpointCount} {text('arşiv doğrulaması','archive verifications')} · {text('son doğrulama','last verification')} {time(center.generatedAt)}</p></div>
      <Button onClick={()=>void refresh()} disabled={loading}>{text('Yenile','Refresh')}</Button></div>
    <div className="communication-recording-truth" role="note"><strong>{text('İşlem geçmişi mesaj, dosya, görüşme veya tutanak içeriğini kopyalayamaz.','Activity history cannot copy message, file, call, or transcript content.')}</strong>
      <span>{text('Bu ekranda yalnız olay türü, kaynak grubu, değişiklik numarası, kayıt sırası ve zamanı gösterilir; kişi, cihaz ve kayıt kimlikleri gizli kalır.','This screen shows only the event type, resource group, change number, record order, and time; person, device, and record identifiers stay private.')}</span>
      <span>{text('İletişim geçmişi sonradan değiştirilemeyen, birbirine bağlı kayıtlarla korunur; mevcut kayıtlar silinemez veya düzenlenemez.','Communication history is protected with linked records that cannot be altered later; existing entries cannot be deleted or edited.')}</span>
      <span>{text('Uzak eşitleme, dış yedek hizmeti ve gerçek geri yükleme denemesi doğrulanmamıştır. Ağ ve bulut kullanılmaz.','Remote synchronization, an external backup service, and a real recovery trial have not been verified. Network and cloud services are not used.')}</span></div>
    {loadError&&<StatusMessage tone="warning">{text('Son görünüm korunuyor; yenileme başarısız:','The last view is preserved; refresh failed:')} {loadError}</StatusMessage>}
    <StatusMessage tone={center.chainValid?'success':'warning'}>{center.chainValid
      ?text('Yerel işlem geçmişinin bütünlüğü doğrulandı.','The integrity of the local activity history was verified.'):text('Yerel işlem geçmişi doğrulanamadı; kayıtlar güvenilir kabul edilmemelidir.','The local activity history could not be verified; records must not be considered trustworthy.')}</StatusMessage>
    <div className="communication-audit-archive-grid"><section><h3>{text('Son işlem geçmişi','Recent activity history')}</h3>
      {center.recentEvents.length===0?<EmptyState title={text('Olay yok','No events')} body={text('Henüz işlem geçmişine eklenen bir iletişim değişikliği yapılmadı.','No communication change has been added to the activity history yet.')}/>:
        <ol className="communication-audit-event-list">{center.recentEvents.map((event)=><li key={`${event.sequence}-${event.occurredAt}`}>
          <strong>{label(event.eventKind)}</strong><span>{resourceTypeLabels[event.resourceType]} · {text('değişiklik no','change no.')} {event.resourceVersion}</span>
          <small>{text('Kayıt no','Record no.')} {event.sequence} · {time(event.occurredAt)}</small></li>)}</ol>}
      {center.recentEventsTruncated&&<small>{text('Güvenli görünüm yalnız son 100 olayı gösterir; toplam','The safe view shows only the last 100 events; total')} {center.eventCount}.</small>}</section>
      <section><h3>{text('Arşiv bütünlük doğrulamaları','Archive integrity verifications')}</h3>{center.recentCheckpoints.length===0?
        <EmptyState title={text('Arşiv doğrulaması yok','No archive verifications')} body={text('Gerçek yedekleme ve geri yükleme kanıtı henüz kaydedilmemiştir.','Real backup and recovery evidence has not been recorded yet.')}/>:
        <ol className="communication-audit-event-list">{center.recentCheckpoints.map((checkpoint)=><li key={checkpoint.archiveGeneration}>
          <strong>{text('Arşiv sürümü','Archive version')} {checkpoint.archiveGeneration}</strong><span>{text('Koruma alanı','Protected storage')} {checkpoint.vaultVerified?text('doğrulandı','verified'):text('doğrulanmadı','not verified')} · {text('yedek','backup')} {checkpoint.backupVerified?text('doğrulandı','verified'):text('doğrulanmadı','not verified')}</span>
          <small>{text('Geri yükleme','Recovery')} {checkpoint.restoreVerified?text('yerel kanıtlı','locally evidenced'):text('çalıştırılmadı','not run')} · {text('uzak eşitleme doğrulanmadı','remote synchronization not verified')} · {time(checkpoint.createdAt)}</small></li>)}</ol>}
      {center.recentCheckpointsTruncated&&<small>{text('Güvenli görünüm yalnız son 50 arşiv doğrulamasını gösterir.','The safe view shows only the last 50 archive verifications.')}</small>}</section></div>
  </section>;
}
