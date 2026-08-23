import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');

describe('governed form draft trusted-startup retry', () => {
  it('retries only known transient startup failures with a finite bounded schedule', () => {
    expect(app).toContain('const FORM_DRAFT_STARTUP_RETRY_DELAYS_MS=Object.freeze([250,500,1_000,2_000,4_000]);');
    expect(app).toContain('isTransientFormDraftStartupError(caught)');
    expect(app).toContain("if(delayMs===undefined||!isTransientFormDraftStartupError(caught)){setLoadState('error');return;}");
    expect(app).toContain('await waitForFormDraftStartup(delayMs);');
    expect(app).toContain('return()=>{workspaceRefreshGenerationRef.current+=1;};');
  });
});
