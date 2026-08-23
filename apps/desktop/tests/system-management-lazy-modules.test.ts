import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');

describe('system management lazy module integrity', () => {
  it('keeps every heavy module closed until its exact module button is selected', () => {
    expect(app).toContain('const [activeSystemModule,setActiveSystemModule]=useState<string>();');
    expect(app).toContain('aria-expanded={activeSystemModule===module.id}');
    expect(app).toContain('const next=activeSystemModule===id?undefined:id;');
    expect(app).toContain("onDraftCenterVisibilityChange(next==='drafts');");
    expect(app).toContain("{id:'drafts',label:language==='tr'?'Kişisel taslaklar':'Personal drafts'}");
    for (const marker of [
      "activeSystemModule==='universal-ux'&&",
      "activeSystemModule==='distributed'&&",
      "activeSystemModule==='communication-audit'&&",
      "activeSystemModule==='communication-files'&&",
      "activeSystemModule==='communication-security'&&",
      "activeSystemModule==='communication-messaging'&&",
      "activeSystemModule==='communication-calling'&&",
      "activeSystemModule==='communication-recording'&&",
      "activeSystemModule==='translation'&&",
      "activeSystemModule==='signed-plugins'&&",
      "activeSystemModule==='operations'&&"
    ]) expect(app).toContain(marker);
  });

  it('loads core operations once and hydrates governance only after trusted core readiness', () => {
    expect(app).toContain("if(activeSystemModule!=='operations')return;void refresh()");
    expect(app).toContain('const operationsRefreshRef=useRef<Promise<void>|null>(null);');
    expect(app).toContain('const operationsGovernanceRefreshRef=useRef<Promise<void>|null>(null);');
    expect(app).toContain('if(operationsRefreshRef.current){await operationsRefreshRef.current;return;}');
    expect(app).toContain("if(coreHealth?.lifecycle==='ready')void refreshGovernance(true);");
    expect(app).toContain('const serviceAvailability=await optional(()=>window.pardus!.getPolicyServiceAvailabilityBoundary());');
    expect(app).toContain('if(!serviceAvailability)return;');
    expect(app).toContain('aria-busy={operationsLoading}');
    expect(app).toContain('Sistem verileri hazırlanıyor');
    const refreshBody=app.slice(app.indexOf('const refresh=async()=>{'),app.indexOf('const maintain=async'));
    expect(refreshBody).not.toContain('Promise.all');
    expect(refreshBody).not.toContain('Promise.allSettled');
  });

  it('keeps the module selector rounded and responsive', () => {
    for (const marker of [
      '.system-module-index {',
      'border-radius: var(--radius-xl, 24px);',
      '.system-module-grid {',
      'border-radius: var(--radius-lg, 16px);',
      '@media(max-width:620px){.system-module-grid{grid-template-columns:1fr}}'
    ]) expect(styles).toContain(marker);
  });
});
