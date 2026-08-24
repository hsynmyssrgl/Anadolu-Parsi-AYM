import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
const panel=readFileSync('apps/desktop/src/renderer/CommunicationMessagingPanel.tsx','utf8');
const styles=readFileSync('apps/desktop/src/renderer/styles.css','utf8');

describe('34-B communication messaging renderer surface',()=>{
  it('extends the existing system screen once without creating a parallel route',()=>{
    expect(app).toContain("import { CommunicationMessagingPanel } from './CommunicationMessagingPanel';");
    expect(app.match(/<CommunicationMessagingPanel\/>/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'communication-messaging'");
    expect(app.indexOf('<CommunicationMessagingPanel/>')).toBeGreaterThan(app.indexOf('<CommunicationSecurityPanel/>'));
  });

  it('uses all ten safe messaging methods and keeps retry identity until success',()=>{
    for(const method of ['getCommunicationMessagingCenter','searchCommunicationMessages','getCommunicationMessageContent',
      'createCommunicationMessage','editCommunicationMessage','setCommunicationMessageLifecycle','annotateCommunicationMessage',
      'updateCommunicationDelivery','setCommunicationPresence','setCommunicationRetentionPolicy'])expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('operations.current.get(key)');
    expect(panel).toContain('operations.current.delete(key)');
    expect(panel).toContain('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.');
  });

  it('requires an explicit reveal and exposes no renderer storage, provider or relay authority',()=>{
    expect(panel).toContain('İçeriği açıkça göster');
    expect(panel).toContain('İçeriği gizle');
    expect(panel).toContain('Mesaj metni uygulama veritabanına yazılmaz');
    for(const forbidden of ['sealedPayloadReference','payloadSha256','providerEvidenceSha256','policyReceiptHash',
      'communicationMessagePayloadPath','relayUrl','privateKey','ciphertext'])expect(panel).not.toContain(forbidden);
    expect(panel).toContain('opaqueAttachmentHandle:preparedAttachment!.fileId');
    expect(panel).toContain("file.state!=='ready_local'||file.scanState!=='clean'");
    expect(panel).toContain('if(candidates.length!==1)');
  });

  it('presents local-only delivery, privacy-preserving presence and honest retention limits',()=>{
    for(const marker of ['Bu sürüm yalnız yerel ve ağsız çalışır.','Uzak teslim','karşı taraftan alındı bilgisi',
      'gerçek mesaj alışverişi henüz kullanıma hazır değildir','fiziksel güvenli silme','yedeklerden kaldırma garantisi yoktur',
      "audience:presenceStatus==='invisible'?'nobody':'room_members'",'lastSeenShared:false',
      'typingIndicatorsEnabled:false','readReceiptsEnabled:false'])expect(panel).toContain(marker);
    for(const technicalCopy of ['Relay teslimi','production MLS payload','ana süreçte seçilir','mantıksal silmedir','presence birleştirmesi','yerel mesaj metadata kaydı','Sessiz metadata'])expect(panel).not.toContain(technicalCopy);
    expect(panel).toContain("contentKind==='location'?'application/vnd.ppt.location+text'");
    expect(panel).toContain("contentKind==='text'?'text/plain'");
  });

  it('provides accessible bounded controls for compose, lifecycle, retry, presence and retention',()=>{
    for(const label of ['Yerel kasaya mühürle','Çevrimdışı kuyruğa al','Yerel yeniden dene','Yerel olarak sil','Geri al',
      'Çevrim içi durumunu kaydet','Saklamayı güncelle','Yetkili yerel aramayı uygula','Dosya seç ve korumalı alana ekle',
      'Yanıtla','Alıntıla','Konu dizisi'])expect(panel).toContain(label);
    expect(panel).toContain('maxLength={32_768}');
    expect(panel).toContain('aria-labelledby="communication-messaging-title"');
    expect(styles).toContain('.communication-messaging');
    expect(styles).toContain('.communication-messaging-content');
  });
});
