import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../src/renderer/App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/renderer/styles.css', import.meta.url), 'utf8');

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
    expect(styles).toContain('.modal{border-radius:var(--radius-dialog)}');
  });

  it('keeps the first-run authenticator and password fields aligned, full width and responsive', () => {
    expect(app.match(/className="first-run-security-field"/gu)).toHaveLength(2);
    expect(app).toContain('className="first-run-security-form"');
    expect(styles).toContain('.first-run-security-field input{width:100%;min-width:0;min-height:52px');
    expect(styles).toContain('.first-run-security-form>.button.primary{width:100%;min-height:52px');
    expect(styles).toContain('.first-run-security-shell .status-message{border-radius:var(--radius-surface)}');
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
  });
});
