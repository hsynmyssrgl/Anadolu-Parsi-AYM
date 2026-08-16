import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const panel=readFileSync('apps/desktop/src/renderer/FamilyAiAssistantPanel.tsx','utf8');
const app=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
const styles=readFileSync('apps/desktop/src/renderer/styles.css','utf8');

describe('33-W family AI assistant renderer surface',()=>{
  it('extends the existing AI permission center once without a competing route',()=>{
    expect(app).toContain("import { FamilyAiAssistantPanel } from './FamilyAiAssistantPanel';");
    expect(app.match(/<FamilyAiAssistantPanel\b/gu)).toHaveLength(1);expect(app).not.toContain("id: 'family-ai-assistant'");
    const centerStart=app.indexOf('function AiGovernanceScreen()');const panelIndex=app.indexOf('<FamilyAiAssistantPanel/>');
    expect(panelIndex).toBeGreaterThan(centerStart);
  });

  it('covers every bounded local suggestion workflow',()=>{
    for(const kind of ['authorized_search','daily_summary','weekly_summary','reminder_review','emergency_bag','meeting_agenda',
      'ocr_classification','duplicate_record','family_story','spending_review','meal_plan','shopping_list','plain_explanation','read_aloud','translation'])
      expect(panel).toContain(`${kind}:`);
  });

  it('uses only three safe bridge methods with stable retry identities',()=>{
    for(const method of ['getFamilyAiAssistantCenter','generateFamilyAiSuggestion','reviewFamilyAiSuggestion'])expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('pendingGenerate.current=command');expect(panel).toContain('pendingReviews.current.set(key,command)');
    expect(panel).toContain('aynı işlem kimliğiyle yeniden deneyebilirsiniz');
    for(const forbidden of ['policyReceipt','stateFingerprint','sourceFingerprint','accountId:','familyId:','sourcePath','rawText','providerToken'])
      expect(panel).not.toContain(forbidden);
  });

  it('requires search text only for search and exposes content-free revoked-consent dismissal',()=>{
    expect(panel).toContain("kind==='authorized_search'");expect(panel).toContain('Yerel arama ifadesi (zorunlu)');
    expect(panel).toContain('required');expect(panel).toContain('inactiveConsentSuggestions');
    expect(panel).toContain('Kaynak ayrıntıları gizlidir');expect(panel).toContain("review(suggestion,'dismiss')");
    expect(panel).toContain('suggestionCapacity.limitReached');expect(panel).toContain('kaynak kapsam göstergesi');
  });

  it('states consent, local-only and non-autonomous truth boundaries',()=>{
    for(const marker of ['Yalnız açık izinli','Ağ, bulut veya model çıkarımı kullanılmaz','ödem','rezervasyon','sağlık','acil durum',
      'Kaynak izni geri çekilirse','süreli hassas veri onayı'])expect(panel).toContain(marker);
    expect(panel).toContain("review(suggestion,'confirm')");expect(panel).toContain("review(suggestion,'dismiss')");
  });

  it('provides responsive accessible presentation',()=>{
    expect(panel).toContain('aria-labelledby="family-ai-assistant-title"');expect(panel).toContain('aria-label="Aile asistanı doğruluk sınırları"');
    expect(styles).toContain('.family-ai-assistant');expect(styles).toContain('@media(max-width:800px)');
  });
});
