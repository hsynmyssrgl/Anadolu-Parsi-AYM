import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
const panel=readFileSync('apps/desktop/src/renderer/CommunicationRecordingRetentionPanel.tsx','utf8');
const styles=readFileSync('apps/desktop/src/renderer/styles.css','utf8');

describe('34-D explicit-consent recording renderer surface',()=>{
  it('extends the existing system screen exactly once without a new route',()=>{
    expect(app).toContain("import { CommunicationRecordingRetentionPanel } from './CommunicationRecordingRetentionPanel';");
    expect(app.match(/<CommunicationRecordingRetentionPanel\/>/gu)).toHaveLength(1);
    expect(app.indexOf('<CommunicationRecordingRetentionPanel/>')).toBeGreaterThan(app.indexOf('<CommunicationRealtimeCallingPanel/>'));
    expect(app).not.toContain("id: 'communication-recording'");
  });

  it('uses every safe bridge and preserves the client operation identity until success',()=>{
    for(const method of ['getCommunicationRecordingCenter','createCommunicationRecordingRequest','decideCommunicationRecordingConsent',
      'withdrawCommunicationRecordingConsent','addCommunicationRecordingLateJoiner','setCommunicationRecordingSegment',
      'updateCommunicationRecordingRetention','requestCommunicationRecordingDeletion'])expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('operations.current.get(key)');expect(panel).toContain('operations.current.delete(key)');
    expect(panel).toContain('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.');
  });

  it('states fail-closed media, encryption, deletion and child-policy truth without a false red indicator',()=>{
    for(const marker of ['Varsayılan kapalıdır','gerçek ses, video, konuşma dökümü veya çeviri kaydı oluşturmaz',
      'Kırmızı kayıt göstergesi','şu an kayıt başlamadı','Uçtan uca şifreli kayıt','bütünlük doğrulaması',
      'fiziksel güvenli silme','çocuk veya veli kuralları henüz hazır değildir','güvenle kapalı kalır'])expect(panel).toContain(marker);
    for(const technicalCopy of ['Kayıt ve rıza metadata','gerçek capture','E2EE kayıt rolü','hash/imza','fail-closed'])expect(panel).not.toContain(technicalCopy);
    expect(panel).toContain('recording-indicator--inactive');expect(panel).not.toContain('recording-indicator--active');
    for(const forbidden of ['MediaRecorder','getUserMedia','RTCPeerConnection','mediaStreamId','recordingPath','providerEvidenceSha256'])
      expect(panel).not.toContain(forbidden);
  });

  it('offers explicit self-consent, refusal, withdrawal, late-joiner pause, off-record and retention controls',()=>{
    for(const label of ['Rıza planı oluştur','Kendi açık rızamı ver','Kaydı reddet, görüşmeye kayıt dışı devam et',
      'Gelecekteki kayıt rızamı geri çek','Kayıtlı bölüm iste','Kayıt dışı bölüme geç',
      'Ayrı saklama politikasını doğrula','Kayıt bilgisini kaldırmayı iste','Kaydı duraklat ve rıza iste'])expect(panel).toContain(label);
    expect(panel).toContain('aria-labelledby="communication-recording-title"');
    expect(styles).toContain('.communication-recording');expect(styles).toContain('.recording-indicator--inactive');
  });
});
