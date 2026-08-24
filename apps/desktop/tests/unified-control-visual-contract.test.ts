import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../src/renderer/App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/renderer/styles.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8');

describe('unified rounded control visual contract', () => {
  it('uses one scalable radius language across fields, actions, surfaces and dialogs', () => {
    for (const token of [
      '--radius-control:14px',
      '--radius-action:12px',
      '--radius-surface:18px',
      '--radius-dialog:24px'
    ]) expect(styles).toContain(token);
    expect(styles).toContain('input:not([type="checkbox"]):not([type="radio"]):not([type="range"])');
    expect(styles).toContain('border-radius:var(--radius-control)');
    expect(styles).toContain('.app-shell .button,.modal .button{border-radius:var(--radius-action)}');
    expect(styles).toContain(':where(.app-shell #main-content button,.modal button){border-radius:var(--radius-action)}');
    expect(styles).toContain('.modal{border-radius:var(--radius-dialog)}');
  });

  it('keeps the first-run authenticator and password fields aligned, full width and responsive', () => {
    expect(app.match(/className="first-run-security-field"/gu)).toHaveLength(2);
    expect(app).toContain('className="first-run-security-form"');
    expect(styles).toContain('.first-run-security-field input{width:100%;min-width:0;min-height:52px');
    expect(styles).toContain('.first-run-security-form>.button.primary{width:100%;min-height:52px');
    expect(styles).toContain('.first-run-security-shell .status-message{border-radius:var(--radius-surface)}');
    expect(styles).toContain('.first-run-security-form .notes-card{');
    expect(styles).toContain('background:color-mix(in srgb,var(--release-panel-secondary) 86%,var(--release-panel));');
    expect(styles).toContain('.first-run-security-form .notes-card>small{padding:8px 10px;');
    expect(styles).toContain('.first-run-security-form .notes-card>.button{width:max-content;max-width:100%;margin-top:2px;background-color:#0f1f31}');
    expect(styles).toContain('white-space:normal;overflow-wrap:anywhere');
    expect(styles).toContain('@media(max-width:720px)');
  });

  it('does not force checkbox, radio or range geometry into text-field styling', () => {
    expect(styles).toContain(':not([type="checkbox"]):not([type="radio"]):not([type="range"])');
  });

  it('keeps compact interactive controls on the shared rounded language', () => {
    expect(styles).toContain('.tree-toolbar button { width: 29px; height: 29px; border: 1px solid var(--border); border-radius: var(--radius-md, 12px);');
    expect(styles).toContain('.segmented button { min-width: 185px; height: 32px; border: 0; background: transparent; border-radius: var(--radius-md, 12px);');
    expect(styles).toContain('.family-location-map-canvas .maplibregl-ctrl-group{overflow:hidden;border:1px solid var(--release-border);border-radius:var(--radius-action,12px);');
    expect(styles).toContain('.family-location-map-canvas .maplibregl-ctrl-group button{border-radius:var(--radius-action,12px);');
    expect(styles).toContain('.participant-chips button { min-height: 38px; padding: 7px 12px; border: 1px solid var(--glass-border); border-radius: 999px;');
    expect(styles).toContain('.participant-chips button.active { border-color: var(--release-accent); background: var(--release-accent); color: #fff; }');
  });

  it('keeps module hierarchy, topbar controls and popup menus aligned without wrapped labels', () => {
    expect(styles).toContain('font-size:var(--font-size-body)!important;');
    expect(styles).toContain('.app-shell .nav-module-items .nav-label {');
    expect(styles).toContain('font-size:var(--font-size-subheadline)!important;');
    expect(styles).toContain('grid-template-columns:minmax(170px,1fr) max-content max-content;');
    expect(styles).toContain('.app-shell .help-trigger>span,.app-shell .help-trigger kbd { flex:0 0 auto;white-space:nowrap; }');
    expect(styles).toContain('.sidebar nav { display:block; min-height:0; flex:1 1 auto; scrollbar-width:thin; }');
    expect(styles).toContain('.sidebar-footer { flex:0 0 auto; }');
    expect(styles).toContain('body {\n  min-width:0;\n  min-height:0;');
    expect(styles).toContain('.app-shell :is(.profile-popover>button,.command-results>button,.notification-row>button:first-child) {');
    expect(styles).toContain('@media(max-width:1600px)');
    expect(styles).toContain('@media(max-width:800px)');
  });

  it('collapses family and important grids before the packaged 900px window becomes cramped', () => {
    expect(styles).toMatch(
      /@media \(max-width: 1280px\) \{[\s\S]*?\.app-shell :is\(\.family-layout, \.important-layout\) \{\s*grid-template-columns: minmax\(0, 1fr\);\s*\}/u
    );
    expect(styles.indexOf('.app-shell :is(.family-layout, .important-layout)')).toBeGreaterThan(
      styles.indexOf('.important-layout { display: grid;')
    );
  });

  it('binds the real desktop minimum to the responsive 760x720 contract', () => {
    const restrictiveBodyIndex = styles.indexOf('body { margin: 0; min-width: 1180px; min-height: 760px;');
    const flexibleBodyIndex = styles.lastIndexOf('body {\n  min-width:0;\n  min-height:0;');
    const compactAppShellIndex = styles.indexOf('@media (max-width: 800px) {');
    const compactHeightIndex = styles.lastIndexOf('@media(max-height:760px) {');
    const compactWidthIndex = styles.lastIndexOf('@media(max-width:760px) {');

    expect(styles).toContain('.app-shell {\n  max-width: 100%;\n  overflow-x: clip;\n}');
    expect(main).toContain('minWidth: 760');
    expect(main).toContain('minHeight: 720');
    expect(styles).toContain(
      '.app-shell :is(main, section, article, aside, header, footer, div, form, fieldset) {\n  min-width: 0;\n}'
    );
    expect(styles).toContain('.main-area { min-width: 0; min-height: 0; display: grid; grid-template-rows: 58px 1fr; }');
    expect(styles).toContain('.page-content { min-height: 0; overflow: auto; padding: 24px 28px 34px; }');
    expect(styles).toMatch(
      /@media \(max-width: 800px\) \{\s*\.app-shell \{ grid-template-columns: minmax\(0, 1fr\); \}\s*\.app-shell \.sidebar \{ position: relative; width: 100%; max-height: none; \}/u
    );
    expect(styles).toMatch(
      /\.desktop-window-content \{\s*height:calc\(100vh - 42px\);\s*min-width:0;\s*min-height:0;\s*overflow:hidden;\s*\}[\s\S]*?\.desktop-window-content>\.first-run-shell,\s*\.desktop-window-content>\.first-run-security-shell \{ overflow:auto; \}/u
    );
    expect(styles).toMatch(
      /@media\(max-height:760px\) \{[\s\S]*?\.auth-entry \{ align-content:start;padding-block:18px; \}[\s\S]*?\.auth-fields input,\.auth-form>\.button \{ height:48px; \}\s*\}/u
    );
    expect(styles).toMatch(
      /@media\(max-width:760px\) \{\s*\.desktop-titlebar span \{ display:none; \}\s*\.auth-shell \{ grid-template-columns:1fr;overflow:auto; \}\s*\.auth-story \{ min-height:420px; \}\s*\.auth-entry \{ overflow:visible; \}\s*\}/u
    );
    expect(flexibleBodyIndex).toBeGreaterThan(restrictiveBodyIndex);
    expect(compactAppShellIndex).toBeGreaterThan(styles.indexOf('.app-shell { height: 100vh;'));
    expect(compactHeightIndex).toBeGreaterThan(styles.indexOf('.auth-shell {\n  grid-template-columns:minmax(340px,.98fr)'));
    expect(compactWidthIndex).toBeGreaterThan(compactHeightIndex);
  });
});
