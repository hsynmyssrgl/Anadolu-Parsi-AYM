import { readFileSync } from 'node:fs';import { describe,expect,it } from 'vitest';
const panel=readFileSync('apps/desktop/src/renderer/PlacesTravelAssetPetPanel.tsx','utf8');
const app=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');const styles=readFileSync('apps/desktop/src/renderer/styles.css','utf8');
describe('33-V places travel asset and pet renderer surface',()=>{
  it('extends the existing Life route once without a competing route',()=>{
    expect(app).toContain("import { PlacesTravelAssetPetPanel } from './PlacesTravelAssetPetPanel';");
    expect(app).toContain('<PlacesTravelAssetPetPanel people={snapshot.people}/>');
    expect(app.match(/<PlacesTravelAssetPetPanel\b/gu)).toHaveLength(1);expect(app).not.toContain("id: 'places-travel'");
  });
  it('covers four areas and all fourteen canonical workflows',()=>{
    for(const area of ['places','moving','pet_care','travel'])expect(panel).toContain(`value:'${area}'`);
    for(const kind of ['stored_place','moving_inventory','pet_care_record','travel_plan','reservation','travel_document',
      'travel_budget','shared_expense','packing_item','travel_requirement','offline_travel_pack','language_pack','travel_album','expense_settlement'])
      expect(panel).toContain(`'${kind}'`);expect(panel).toContain('aria-label="Yer ve seyahat alanları"');
  });
  it('uses only four safe bridge methods with stable retry identity',()=>{
    for(const method of ['getPlacesTravelCenter','createPlacesTravelItem','updatePlacesTravelItem','deletePlacesTravelItem'])expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('pendingCreate.current.fingerprint!==fingerprint');expect(panel).toContain('current?.fingerprint===fingerprint');
    expect(panel).toContain('aynı işlem kimliğiyle yeniden deneyebilirsiniz');
    for(const forbidden of ['policyReceipt','stateFingerprint','requestFingerprint','accountId:','familyId:','sourcePath','bookingToken','paymentCard'])
      expect(panel).not.toContain(forbidden);
  });
  it('keeps coordinates participants documents budgets packs OCR and pet references explicit',()=>{
    for(const marker of ['Enlem','Boylam','Katılımcılar','Opak seyahat / gider referansı','Opak arşiv öğesi','Yerel OCR iş kimliği',
      'Opak hayvan referansı','Hatırlatma / belge bitiş tarihi','Pasaport','Tutar','Valiz öğesi','Opak gereksinim referansı','Dil kodu'])expect(panel).toContain(marker);
    expect(panel).toContain("useState<PlacesTravelVisibility>('private')");expect(panel).toContain('selected_members');
  });
  it('renders meaningful local summaries for coordinates dates participants budgets and workflow state',()=>{
    for(const marker of ['itemSummary(item)','Koordinat','Geçerlilik','katılımcı','item.amountMinor/100','Evcil hayvan akışı',
      'Gereksinim:','Sağlayıcı etiketi:'])expect(panel).toContain(marker);
    expect(panel).toContain("['travel_plan','reservation','shared_expense','expense_settlement']");
    expect(panel).toContain("['travel_plan','reservation','travel_budget']");
  });
  it('states local-only no-claim boundaries in responsive accessible presentation',()=>{
    expect(panel).toContain('Harita, rezervasyon, ödeme, belge doğrulama, canlı takip veya dış paylaşım yapılmaz');
    expect(panel).toContain('OCR kimliği sadece öneri referansıdır; sonuç otomatik kabul edilmez');
    expect(panel).toContain('Evcil hayvan kaydı sağlık tavsiyesi değildir');expect(panel).toContain('aria-live="polite"');
    expect(styles).toContain('.child-education-layout');expect(styles).toContain('@media(max-width:680px)');
  });
});
