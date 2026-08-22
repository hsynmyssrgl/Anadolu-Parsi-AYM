import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');

describe('system management lazy module integrity', () => {
  it('keeps every heavy module closed until its exact module button is selected', () => {
    expect(app).toContain('const [activeSystemModule,setActiveSystemModule]=useState<string>();');
    expect(app).toContain('aria-expanded={activeSystemModule===module.id}');
    expect(app).toContain('current===module.id?undefined:module.id');
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

  it('starts system polling only while the operations module is open', () => {
    expect(app).toContain("if(activeSystemModule!=='operations')return;void refresh()");
    expect(app).toContain("if(activeSystemModule!=='operations')return;const load=");
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
