import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string): Promise<string> => readFile(resolve(process.cwd(), path), 'utf8');

describe('operation rule check policy', () => {
  it('validates rule integrity, acknowledgement and universal fail-closed enforcement', async () => {
    const source = await readSource('scripts/verify-operation-rule-check.mjs');
    expect(source).toContain("readJson('config/canonical-rule-registry.json')");
    expect(source).toContain("readJson('config/rule-acknowledgement.json')");
    expect(source).toContain('registry.rulesSha256 === calculatedHash');
    expect(source).toContain('activeRules.every((rule) => enforcementIds.has(rule.id))');
    expect(source).toContain('entry.waiverAllowed === false && entry.skipAllowed === false');
    expect(source).toContain("entry.evidencePolicy === 'MISSING_EVIDENCE_NEVER_PASS'");
    expect(source).toContain("entry.violationEffect === 'BLOCK_CURRENT_REQUIRED_STAGE'");
  });

  it('requires an explicit operation and rerun guidance before mutations', async () => {
    const [source, workspaceInstructions] = await Promise.all([
      readSource('scripts/verify-operation-rule-check.mjs'),
      readSource('AGENTS.md')
    ]);
    expect(source).toContain("valueAfter('--operation')");
    expect(source).toContain("valueAfter('--kind')");
    expect(workspaceInstructions).toContain('durum değiştiren hiçbir işlem');
    expect(workspaceInstructions).toContain('kural hash\'i değişirse');
    expect(workspaceInstructions).toContain('Waiver, sessiz atlama');
  });
});
