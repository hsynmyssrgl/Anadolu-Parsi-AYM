import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
const panel=readFileSync('apps/desktop/src/renderer/CommunicationRealtimeCallingPanel.tsx','utf8');
const styles=readFileSync('apps/desktop/src/renderer/styles.css','utf8');

describe('34-C realtime calling renderer surface',()=>{
  it('extends the existing system screen exactly once without adding a route',()=>{
    expect(app).toContain("import { CommunicationRealtimeCallingPanel } from './CommunicationRealtimeCallingPanel';");
    expect(app.match(/<CommunicationRealtimeCallingPanel\/>/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'communication-realtime-calling'");
    expect(app.indexOf('<CommunicationRealtimeCallingPanel/>')).toBeGreaterThan(app.indexOf('<CommunicationMessagingPanel/>'));
  });

  it('uses all six safe bridge methods and retains the operation identity until success',()=>{
    for(const method of ['getCommunicationRealtimeCallingCenter','createCommunicationCall','runCommunicationCallPreflight',
      'updateCommunicationCallControls','advanceCommunicationCall','setCommunicationCallPreferences'])expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('operations.current.get(key)');expect(panel).toContain('operations.current.delete(key)');
    expect(panel).toContain('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.');
  });

  it('states provider and delivery limits without claiming a real call or network use',()=>{
    for(const marker of ['Bu sürüm gerçek çağrı başlatmaz ve ağ kullanmaz.','Canlı sesli veya görüntülü görüşme',
      'henüz kullanıma hazır değildir','işlem güvenle durdurulur','yalnız bu bilgisayardaki görüşme planında saklanır',
      'fiziksel kamera, mikrofon veya duyulabilir hoparlörün çalıştığını garanti etmez'])
      expect(panel).toContain(marker);
    for(const technicalCopy of ['WebRTC, SFU, STUN/TURN, SFrame/MLS','production ortamında','main-process','canlı track','planlama metadatasıdır'])expect(panel).not.toContain(technicalCopy);
    for(const forbidden of ['providerEvidenceSha256','turnCredential','sframeKey','mediaStreamId','screenCaptureSourceId',
      'recordCommunicationCallQuality','navigator.mediaDevices','RTCPeerConnection'])expect(panel).not.toContain(forbidden);
  });

  it('provides accessible bounded local planning, preflight, fallback, caption, RTT and lifecycle controls',()=>{
    for(const label of ['Yerel çağrı planı oluştur','Sade ve büyük görünümü aç','Yerel cihaz kontrolünü çalıştır','Yalnız sese geç',
      'Altyazı iste','Anlık yazışma iste','Ekran paylaşımı iste','El kaldır','Yerel toplantı planını kilitle','Yerel olarak sabitle',
      'İşaret dili konuşmacısı olarak sabitle','Yerel bekleme alanına geç',
      'Yerel sabitlemeyi kaldır','İşaret dili sabitlemesini kaldır','Planı sonlandır','Planı iptal et'])
      expect(panel).toContain(label);
    expect(panel).toContain('aria-labelledby="communication-calling-title"');
    expect(panel).toContain("invitedPersonIds.length<=15");
    expect(styles).toContain('.communication-calling');expect(styles).toContain('.communication-calling-actions');
    expect(styles).toContain('.communication-calling-participants');
  });
});
