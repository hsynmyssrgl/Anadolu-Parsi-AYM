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
    expect(styles).toContain('@media(max-width:720px)');
  });

  it('does not force checkbox, radio or range geometry into text-field styling', () => {
    expect(styles).toContain(':not([type="checkbox"]):not([type="radio"]):not([type="range"])');
  });
});
