import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const app=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
const panel=readFileSync('apps/desktop/src/renderer/MemoryStudioPanel.tsx','utf8');
const styles=readFileSync('apps/desktop/src/renderer/styles.css','utf8');

describe('33-X memory studio renderer surface',()=>{
  it('extends the existing digital legacy screen without adding a second route',()=>{
    expect(app).toContain("import { MemoryStudioPanel } from './MemoryStudioPanel';");
    expect(app.match(/<MemoryStudioPanel\/>/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'memory-studio'");
    expect(app.indexOf('<MemoryStudioPanel/>')).toBeGreaterThan(app.indexOf('function DigitalLegacyScreen'));
  });

  it('exposes the complete manual record and two-approval capsule workflow',()=>{
    for(const method of ['getMemoryStudioCenter','createMemoryStudioRecord','deleteMemoryStudioRecord','createMemoryTimeCapsule',
      'reviewMemoryTimeCapsule','transitionMemoryTimeCapsule'])expect(panel).toContain(`.${method}(`);
    for(const marker of ['face_group','manualFaceGroupingApproved','minimumApprovals','approvalCount','currentAccountApprovalRecorded',
      'approve','revoke_approval','seal','release','rollback','Onayımı geri al','storageCapacity','limitReached'])
      expect(panel).toContain(marker);
    expect(panel).toContain('aynı işlem kimliğiyle yeniden deneyebilirsiniz');
    expect(panel).toContain('İşlem kaydedildi; görünüm yenilenemedi');
    expect(panel).toContain('crypto.randomUUID()');
    expect(panel).toContain('if(succeeded)');
  });

  it('states the local no-claim boundary instead of promising unavailable media automation',()=>{
    for(const truth of ['Ses çözümleme','yüz tanıma','yinelenen fotoğraf bulma','belgesel/kitap üretme','Ağ, bulut','haricî teslimat kullanılmaz'])
      expect(panel).toContain(truth);
    expect(panel).not.toMatch(/otomatik olarak yüzleri tanır|buluta yükler|kitabı oluşturur ve yazdırır/iu);
  });

  it('keeps forms, lists and responsive actions visibly styled',()=>{
    for(const selector of ['.memory-studio{','.memory-studio-truth{','.memory-studio-grid{','.memory-studio-form{',
      '.memory-studio-row{','@media(max-width:900px)'])expect(styles).toContain(selector);
    expect(panel).toContain('aria-labelledby="memory-studio-title"');
    expect(panel).toContain('aria-labelledby="memory-records-title"');
    expect(panel).toContain('aria-labelledby="memory-capsules-title"');
  });
});
