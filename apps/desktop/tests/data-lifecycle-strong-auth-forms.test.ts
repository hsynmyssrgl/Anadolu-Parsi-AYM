import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');

describe('data lifecycle strong authentication forms', () => {
  it('does not invoke critical backup policy mutations while the password is empty', () => {
    expect(app).toContain('const strongAuthenticationReady=password.length>0;');
    expect(app).toContain('if(!window.pardus||!strongAuthenticationReady)return;try{await window.pardus.updateBackupCleanRewritePolicy');
    expect(app).toContain('if(!window.pardus||!strongAuthenticationReady)return;try{const next=await window.pardus.updateBackupQuarantinePolicy');
    expect(app).toContain('<Button type="submit" disabled={!strongAuthenticationReady}>Politikayı kaydet</Button>');
    expect(app).toContain('<Button type="submit" disabled={!strongAuthenticationReady}>Karantina politikasını güncelle</Button>');
  });
});
