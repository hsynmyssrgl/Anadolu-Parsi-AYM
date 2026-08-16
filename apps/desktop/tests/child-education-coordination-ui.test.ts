import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel=readFileSync('apps/desktop/src/renderer/ChildEducationCoordinationPanel.tsx','utf8');
const app=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
const styles=readFileSync('apps/desktop/src/renderer/styles.css','utf8');

describe('33-U child education coordination renderer surface',()=>{
  it('extends the existing Life route once without adding a competing route',()=>{
    expect(app).toContain("import { ChildEducationCoordinationPanel } from './ChildEducationCoordinationPanel';");
    expect(app).toContain('<ChildEducationCoordinationPanel people={snapshot.people}/>');
    expect(app.match(/<ChildEducationCoordinationPanel\b/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'child-education'");
  });

  it('covers four areas and all fourteen canonical coordination kinds',()=>{
    for(const area of ['schoolwork','events_access','activities','money_goals'])expect(panel).toContain(`value:'${area}'`);
    for(const kind of [
      'school','class','timetable','homework','exam','school_event','transport_plan','pickup_authority',
      'course','sport','certificate','book','allowance_budget','education_goal'
    ])expect(panel).toContain(`'${kind}'`);
    expect(panel).toContain('aria-label="Çocuk eğitim alanları"');
  });

  it('uses only the four safe bridge methods and stable retry identities',()=>{
    for(const method of ['getChildEducationCenter','createChildEducationItem','updateChildEducationItem','deleteChildEducationItem'])
      expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('pendingCreate.current.fingerprint!==fingerprint');
    expect(panel).toContain('existing?.fingerprint===fingerprint');
    expect(panel).toContain('aynı işlem kimliğiyle yeniden deneyebilirsiniz');
    for(const forbidden of ['policyReceipt','stateFingerprint','requestFingerprint','accountId:','familyId:','sourcePath','schoolPortalToken'])
      expect(panel).not.toContain(forbidden);
  });

  it('presents age-aware privacy choices and keeps special actions separately governed',()=>{
    expect(panel).toContain("center?.ageBand==='teen'");
    expect(panel).toContain('disabled={center?.ageBand!==\'teen\'}');
    expect(panel).toContain('Çocuk ve seçili vasiler');
    expect(panel).toContain('Ergen özel alanı');
    expect(panel).toContain('Kimlik Merkezi referansı');
    expect(panel).not.toContain('Teslim kodu');
    expect(panel).toContain("kind!=='class'||classLabel.trim().length>0");
    expect(panel).toContain("!scheduleRequired||Boolean(isoOrUndefined(scheduledAt))");
    expect(panel).toContain("!dueRequired||Boolean(isoOrUndefined(dueAt))");
    expect(panel).toContain("entry.dueAt?`son tarih ${new Date(entry.dueAt).toLocaleString('tr-TR')}`");
    expect(panel).toContain("entry.progressBasisPoints!==undefined?`ilerleme %${entry.progressBasisPoints/100}`");
  });

  it('states local-only boundaries and provides responsive accessible presentation',()=>{
    expect(panel).toContain('okul portalına bağlanmaz, öğretmene mesaj göndermez ve servisi canlı izlemez');
    expect(panel).toContain('Harçlık kaydı ödeme yapmaz');
    expect(panel).toContain('Sertifika doğrulanmış sayılmaz');
    expect(panel).toContain('AI işleme ve dışa paylaşım kapalıdır');
    expect(panel).toContain('aria-live="polite"');
    expect(styles).toContain('.child-education-layout');
    expect(styles).toContain('.child-education-tabs');
    expect(styles).toContain('@media(max-width:680px)');
  });
});
