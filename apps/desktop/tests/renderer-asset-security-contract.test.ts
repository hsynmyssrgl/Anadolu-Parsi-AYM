import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESKTOP_RENDERER_CSP } from '../src/main/renderer-session-security.js';

describe('renderer asset security contract', () => {
  it('serves module workers as JavaScript and enforces frame ancestry in the response header', () => {
    const main = readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

    expect(main).toContain("['.mjs','text/javascript; charset=utf-8']");
    expect(DESKTOP_RENDERER_CSP).toContain("frame-ancestors 'none'");
    expect(html).not.toContain('frame-ancestors');
  });
});
