import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read=(name:string):string=>readFileSync(new URL(`../src/renderer/${name}`,import.meta.url),'utf8');
const rendererDirectory=fileURLToPath(new URL('../src/renderer/',import.meta.url));
const rendererSources=Object.fromEntries(readdirSync(rendererDirectory)
  .filter((name)=>name.endsWith('.tsx'))
  .sort((left,right)=>left.localeCompare(right,'en'))
  .map((name)=>[name,read(name)]));
const app=read('App.tsx');
const naturalPanels=[
  'HealthCareCoordinationPanel.tsx','ChildEducationCoordinationPanel.tsx','HouseholdOperationsPanel.tsx',
  'PlacesTravelAssetPetPanel.tsx','LongTermPortfolioPanel.tsx','LocalGovernedOcrPanel.tsx',
  'UniversalUxConsolidationPanel.tsx','CommunicationAuditArchivePanel.tsx','CommunicationRecordingRetentionPanel.tsx',
  'CommunicationRealtimeCallingPanel.tsx','CommunicationSecurityPanel.tsx','CommunicationMessagingPanel.tsx','FinancePlanningPanel.tsx',
  'FamilyMeetingPanel.tsx','CommunicationFileSharingPanel.tsx','SmartHomeEnergyPanel.tsx',
  'LocalTranslationLanguagePanel.tsx','SignedPluginPlatformPanel.tsx','ManagedLifePanel.tsx'
].map(read).join('\n');

describe('final natural user-surface copy',()=>{
  it('keeps internal rule identifiers out of natural headings',()=>{
    expect(naturalPanels).not.toMatch(/(?:33-[A-Z]|DEC-\d+|LTP-\d+)/u);
    for(const heading of [
      'Yerel ve yalnız gerekli bilgi','Yerel çocuk eğitim koordinasyonu','Yerel hane koordinasyonu',
      'Yerel yer, varlık, evcil hayvan ve seyahat','Yerel ve manuel portföy planlaması'
    ]) expect(naturalPanels).toContain(heading);
  });

  it('uses natural copy instead of implementation vocabulary on ordinary screens',()=>{
    for(const forbidden of [
      'Büyük zaman çizgileri anahtar tabanlı sayfalama','Sorgu IPC yanıtında yankılanmaz',
      'Veri deposu, SQL, SQLite ve kasa erişimi kapalı','Tam PAN, CVV/CVC, PIN',
      "kaynak baytları renderer'a verilmez",'previousHash→eventHash','SQLite trigger’ları update/delete',
      'Renderer yalnız olay türü','Yerel içeriksiz hash zinciri','Arşiv bütünlük checkpoint’leri',
      'gerçek capture','E2EE kayıt rolü','WebRTC, SFU, STUN/TURN, SFrame/MLS','Production RFC 9420',
      'production MLS payload','yerel mesaj metadata kaydı','imzalı QR payload’a','minimum disclosure metadata’sıyla',
      'Ana süreçte dosya seç','SharePlay','child process','renderer sonucunda','Local and fail-closed','fail‑closed',
      'Rızalı AI tutanak önerisi','Tercih metadata’sını kaydet','Production imza güveni','provenance hash','Opak arşiv öğesi kimliği'
    ]) expect(`${app}\n${naturalPanels}`).not.toContain(forbidden);
    for(const expected of [
      'Aramanız kaydedilmez','Uygulama verilerine güvenli erişim',
      'Tam kart numarası, güvenlik kodu','Metin tanıma bu bilgisayarda yapılır',
      'İletişim geçmişi sonradan değiştirilemeyen','İçerikten ayrı işlem geçmişi',
      'Canlı sesli veya görüntülü görüşme','Gerçek ağ üzerinden güvenli mesajlaşma','Uzak teslim, karşı taraftan alındı bilgisi',
      'Bu karekod resmî kimlik veya hukuki yetki belgesi değildir.'
    ]) expect(`${app}\n${naturalPanels}`).toContain(expected);
    for(const expected of ['Bu bilgisayardan dosya seç','işletim sistemi düzeyindeki ek yalıtım','güvenli biçimde kapalı kalır',
      'Tercih ayarını kaydet','Canlı sürüm imza güveni','Arşiv belge bağlantısı'])expect(naturalPanels).toContain(expected);
  });

  it('does not render audited raw storage values or ordinary record identifiers',()=>{
    for(const forbidden of [
      '{item.category} ·','{item.kind} · {item.status}','{item.severity} · {item.status}',
      '{item.scopeResourceType}/{item.scopeResourceId}','{lease.capability} · {lease.state}',
      '{p.resourceType}/{p.resourceId}','{g.resourceType}:{g.resourceId}',"item.source.replaceAll('_', ' ')",
      '<span>{card}</span>','{collaborationKindLabels[item.kind]} · {item.resourceId}'
    ]) expect(`${app}\n${naturalPanels}`).not.toContain(forbidden);
  });

  it('statically covers every renderer TSX against raw technical exception leakage',()=>{
    expect(Object.keys(rendererSources)).toContain('App.tsx');
    expect(Object.keys(rendererSources).length).toBeGreaterThan(40);
    for(const [name,source] of Object.entries(rendererSources)){
      expect(source,name).not.toMatch(/Error invoking remote method|\[object Object\]|CORE-UNEXPECTED|UNKNOWN_IPC_CHANNEL|repository policy denied|stack trace/iu);
      const exceptionSource=name==='App.tsx'
        ?source
          .replace(/test\(caught\.message\);/gu,'')
          .replace('{e.message}','')
          .replace('{x.message}','')
        :source;
      expect(exceptionSource,name).not.toMatch(/\b(?:caught|error|err|e|x|value)\.message\b/u);
      expect(exceptionSource,name).not.toMatch(/set[A-Z][A-Za-z0-9]*\(\s*(?:caught|error|err)\s*\)/u);
      expect(exceptionSource,name).not.toMatch(/\{\s*(?:caught|err)\s*\}/u);
    }
  });

  it('keeps archive document rows keyboard-operable and isolates the nested selection control',()=>{
    expect(app).toContain('className={`document-row ${selectedItemId===item.id?\'selected\':\'\'}`}');
    expect(app).toContain('role="button" tabIndex={0} aria-pressed={selectedItemId===item.id}');
    expect(app).toContain('aria-label={`${item.title} belgesini seç`}');
    expect(app).toContain("if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedItemId(item.id);}");
    expect(app).toContain('aria-label={`${item.title} belgesini toplu işleme dahil et`}');
    expect(app).toContain('onClick={event=>event.stopPropagation()}');
  });
});
