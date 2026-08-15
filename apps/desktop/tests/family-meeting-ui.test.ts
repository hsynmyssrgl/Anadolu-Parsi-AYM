import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
const panel=readFileSync('apps/desktop/src/renderer/FamilyMeetingPanel.tsx','utf8');
const styles=readFileSync('apps/desktop/src/renderer/styles.css','utf8');

describe('34-F family meeting renderer surface',()=>{
  it('extends the existing life center exactly once without adding a route',()=>{
    expect(app).toContain("import { FamilyMeetingPanel } from './FamilyMeetingPanel';");
    expect(app.match(/<FamilyMeetingPanel people=\{snapshot\.people\}\/>/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'family-meeting'");
  });

  it('uses every safe bridge and preserves operation identity and revision until success',()=>{
    for(const method of ['getFamilyMeetingCenter','getFamilyMeetingMinutes','createFamilyMeeting','updateFamilyMeetingPlan',
      'setFamilyMeetingState','upsertFamilyMeetingParticipant','upsertFamilyMeetingAgendaItem','createFamilyMeetingPoll',
      'castFamilyMeetingVote','recordFamilyMeetingDecision','upsertFamilyMeetingTask','addFamilyMeetingCollaboration',
      'prepareFamilyMeetingAiMinutes','finalizeFamilyMeetingMinutes'])expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('pending.current.get(key)');
    expect(panel).toContain('pending.current.delete(key)');
    expect(panel).toContain('Aynı işlem kimliği ve özgün revizyonla yeniden deneyebilirsiniz.');
    expect(panel).toContain("globalThis.crypto.subtle.digest('SHA-256',bytes)");
  });

  it('covers scheduling, agenda, roles, polls, decisions, tasks and collaboration controls',()=>{
    for(const label of ['Yeni toplantı','Plan ve hatırlatma','Roller ve katılım','Gündem ve ön okuma','Anket ve oy',
      'Çekimser','Append-only karar','Görev ve takip','Sonraki toplantıya taşı','Ortak çalışma referansı',
      'Beyaz tahta','Fotoğraf albümü','Belge açıklaması'])expect(panel).toContain(label);
    for(const state of ['Toplantıyı başlat','Toplantıyı tamamla','İptal et'])expect(panel).toContain(state);
  });

  it('requires human approval and states local encryption and provider truth without claims',()=>{
    for(const marker of ['İnsan onaylı şifreli tutanak','Tutanağı okudum; insan onayıyla mühürlemeyi açıkça kabul ediyorum.',
      'Şifrele ve mühürle','Tutanak yalnız katılımcılara açık ayrı bir yerel kasada şifrelenir.',
      'üretim AI sağlayıcısı yapılandırılmadığından varsayılan yol fail-closed kalır',
      'Takvim daveti, harici hatırlatma, uzaktan ortak çalışma, ağ veya bulut aktarımı yapılmaz',
      'Transkript renderer’a alınmaz'])expect(panel).toContain(marker);
    expect(panel).toContain('explicitHumanApproval:true as const');
    expect(panel).toContain('machineGeneratedSource:selected.minutes.aiSuggestionGenerated');
    for(const forbidden of ['sealedPayloadReference','payloadSha256','ledgerReference','providerEvidenceSha256','filePath'])
      expect(panel).not.toContain(forbidden);
  });

  it('provides accessible responsive layout and explicit load/error/empty states',()=>{
    expect(panel).toContain('aria-labelledby="family-meeting-title"');
    expect(panel).toContain('<AsyncStatePanel state="loading"');
    expect(panel).toContain('<AsyncStatePanel state="error"');
    expect(panel).toContain('<AsyncStatePanel state="empty"');
    expect(styles).toContain('.family-meeting{');
    expect(styles).toContain('@media(max-width:900px)');
  });
});
