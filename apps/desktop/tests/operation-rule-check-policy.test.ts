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

  it('keeps the per-operation receipt outside the authoritative source hash cycle', async () => {
    const [governanceUtils, sourceProtection, deliveryReport] = await Promise.all([
      readSource('scripts/lib/governance-utils.mjs'),
      readSource('scripts/protect-authoritative-source.mjs'),
      readSource('scripts/generate-current-delivery-report.mjs')
    ]);
    expect(governanceUtils).toContain("'artifacts/validation/operation-rule-check.json'");
    expect(sourceProtection).toContain('...DERIVED_DOCUMENT_INDEX_PATHS');
    expect(deliveryReport).toContain('...DERIVED_DOCUMENT_INDEX_PATHS');
  });

  it('binds local, external and delivery verification to one live source boundary', async () => {
    const completionPaths = [
      'scripts/verify-33-l-long-term-portfolio-completion.mjs',
      'scripts/verify-33-m-accessibility-completion.mjs',
      'scripts/verify-33-n-draft-async-state-ux-completion.mjs',
      'scripts/verify-33-o-privacy-ownership-data-rights-incident-control-completion.mjs',
      'scripts/verify-33-p-passkeys-federated-identity-verifiable-temporary-credentials-completion.mjs'
    ];
    const [sourceProtection, externalProtection, deliveryReport, ...completionVerifiers] = await Promise.all([
      readSource('scripts/protect-authoritative-source.mjs'),
      readSource('scripts/protect-authoritative-source-external.mjs'),
      readSource('scripts/generate-current-delivery-report.mjs'),
      ...completionPaths.map(readSource)
    ]);
    for (const source of [sourceProtection, deliveryReport]) {
      expect(source).toContain('resolveCurrentDeliveryOutputBoundary');
      expect(source).toContain('currentDeliveryBoundary.excludedRelativePaths');
    }
    expect(deliveryReport).toContain('currentDeliveryBoundary.reportRelativePath');
    expect(deliveryReport).toContain('currentDeliveryBoundary.userVisibleRelativePath');
    expect(externalProtection).toContain("['scripts/protect-authoritative-source.mjs', 'verify']");
    expect(externalProtection).toContain('Live local source changed before external protection promotion');
    expect(externalProtection).toContain("requirement: 'PR-233', governanceRequirement: 'GOV-005', decision: 'DEC-267'");
    for (const verifier of completionVerifiers) {
      expect(verifier).toMatch(/protectionResult\?\.requirement\s*===\s*'PR-233'/u);
      expect(verifier).toMatch(/protectionResult\?\.governanceRequirement\s*===\s*'GOV-005'/u);
      expect(verifier).toMatch(/protectionResult\?\.decision\s*===\s*'DEC-267'/u);
      expect(verifier).not.toContain('"requirement":"GOV-005"');
    }
  });
});
