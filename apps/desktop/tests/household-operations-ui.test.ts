import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('apps/desktop/src/renderer/HouseholdOperationsPanel.tsx','utf8');
const app = readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css','utf8');

describe('33-T household operations renderer surface',()=>{
  it('extends the existing Life route exactly once without adding a competing menu route',()=>{
    expect(app).toContain("import { HouseholdOperationsPanel } from './HouseholdOperationsPanel';");
    expect(app).toContain('<HouseholdOperationsPanel people={snapshot.people}/>');
    expect(app.match(/<HouseholdOperationsPanel\b/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'household-operations'");
  });

  it('covers the eight household areas and their thirteen canonical item kinds',()=>{
    for(const area of ['shopping','inventory','meals','chores','expenses','deliveries','guests','pets']){
      expect(panel).toContain(`value:'${area}'`);
    }
    for(const kind of [
      'shopping_list','shopping_item','stock_item','recipe','meal_plan','chore','routine',
      'bill','subscription','shared_expense','delivery','guest_access','pet_care'
    ]) expect(panel).toContain(`'${kind}'`);
    expect(panel).toContain('Hane operasyonları merkezi');
    expect(panel).toContain('aria-label="Hane operasyonu alanları"');
  });

  it('uses only four renderer-safe bridge methods and retains stable retry identities',()=>{
    for(const method of [
      'getHouseholdOperationsCenter','createHouseholdOperationItem',
      'updateHouseholdOperationItem','deleteHouseholdOperationItem'
    ]) expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('pendingCreate.current.fingerprint!==fingerprint');
    expect(panel).toContain('existing?.fingerprint===fingerprint');
    expect(panel).toContain('Değişiklik yapmazsanız aynı işlem kimliğiyle yeniden deneyebilirsiniz.');
    for(const forbidden of ['policyReceipt','stateFingerprint','requestFingerprint','familyId','accountId:','fullTrackingId','paymentToken']){
      expect(panel).not.toContain(forbidden);
    }
  });

  it('keeps allergy, split, tracking and guest inputs minimum-necessary and bounded',()=>{
    expect(panel).toContain('Kaçınılan alerjenler');
    expect(panel).toContain('basisPoints:10_000-shareBasisPoints');
    expect(panel).toContain('Takip son dört');
    expect(panel).toContain('pattern="[A-Za-z0-9]{4}"');
    expect(panel).toContain('Erişim alanı');
    expect(panel).not.toContain('Anahtar kodu<input');
    expect(panel).toContain('Yerel evcil hayvan referansı');
    expect(panel).toContain("stockCategory!=='food'||Boolean(isoOrUndefined(expiresAt))");
    expect(panel).toContain("kind!=='meal_plan'||Boolean(parentItemId)&&Boolean(isoOrUndefined(scheduledAt))");
    expect(panel).toContain("!['chore','routine'].includes(kind)||Boolean(assignedPersonId)");
    expect(panel).toContain("!['bill','subscription'].includes(kind)||Boolean(isoOrUndefined(dueAt))");
    expect(panel).toContain("kind!=='pet_care'||petReference.trim().length>0&&Boolean(isoOrUndefined(dueAt))");
    expect(panel).toContain('son kullanım ${formatDate(entry.expiresAt)}');
  });

  it('states external-action limits and provides responsive accessible presentation',()=>{
    expect(panel).toContain('dış sipariş, ödeme, kargo senkronizasyonu veya uzaktan anahtar kontrolü yapmaz');
    expect(panel).toContain('Tarif filtresi tıbbi tavsiye değildir');
    expect(panel).toContain('aria-live="polite"');
    expect(styles).toContain('.household-operations-layout');
    expect(styles).toContain('.household-area-tabs');
    expect(styles).toContain('@media(max-width:680px)');
  });
});
