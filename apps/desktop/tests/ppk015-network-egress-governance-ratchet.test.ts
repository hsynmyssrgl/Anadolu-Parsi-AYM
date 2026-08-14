import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { inspectNetworkEgressStaticRatchet, scanNetworkEgressBoundary } from '../../../scripts/verify-network-egress-boundary.mjs';

const read = async (path: string): Promise<Buffer> => readFile(path);
const json = async (path: string): Promise<Record<string, unknown>> => JSON.parse((await read(path)).toString('utf8')) as Record<string, unknown>;
const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex');

describe('PPK-015 historical closure and current egress ratchet', () => {
  it('keeps the historical 32-K scope decision and audit byte-exact', async () => {
    const [ratchet, index] = await Promise.all([
      json('config/ppk-015-network-egress-current-ratchet.json'),
      json('artifacts/manifests/ALL_DOCUMENTS_INDEX.json')
    ]);
    const historical = ratchet.historicalClosure as Record<string, unknown>;
    expect(sha256(await read('config/32-k-ppk-015-network-egress-policy-scope.json'))).toBe(historical.scopeSha256);
    expect(sha256(await read('docs/decisions/DEC-196-ppk-015-network-egress-policy.md'))).toBe(historical.decisionSha256);
    expect(sha256(await read('docs/audit/32-K_PPK-015_NETWORK_EGRESS_POLICY_UST_KAPANIS.md'))).toBe(historical.auditSha256);
    expect(historical).toMatchObject({ decisionId: 'DEC-196', latestMigrationAtClosure: 76,
      packageOwnedMigrationAdded: false, evidenceRewritten: false });
    const documents = index.documents as Array<{ path: string; sha256: string; classification: string }>;
    expect(documents.find(({ path }) => path === 'config/32-k-ppk-015-network-egress-policy-scope.json')).toMatchObject({
      sha256: historical.scopeSha256, classification: 'ACTIVE_REFERENCE'
    });
    expect(documents.find(({ path }) => path === 'docs/decisions/DEC-196-ppk-015-network-egress-policy.md')).toMatchObject({
      sha256: historical.decisionSha256, classification: 'ACTIVE_REFERENCE'
    });
    expect(documents.find(({ path }) => path === 'docs/audit/32-K_PPK-015_NETWORK_EGRESS_POLICY_UST_KAPANIS.md')).toMatchObject({
      sha256: historical.auditSha256, classification: 'ACTIVE_REFERENCE'
    });
  });

  it('treats DEC-196 and migration 76 as history while recording later migration ownership separately', async () => {
    const [ratchet, ledger, migrations] = await Promise.all([
      json('config/ppk-015-network-egress-current-ratchet.json'),
      json('config/user-decision-ledger.json'),
      read('packages/database/src/family-database-migrations.ts')
    ]);
    const decisions = ledger.decisions as Array<{ id: string; requirements?: string[] }>;
    const historicalIndex = decisions.findIndex(({ id }) => id === 'DEC-196');
    expect(historicalIndex).toBeGreaterThanOrEqual(0);
    expect(historicalIndex).toBeLessThan(decisions.length - 1);
    expect(decisions[historicalIndex]?.requirements).toContain('PPK-015');
    const source = migrations.toString('utf8');
    expect(source).toContain("createMigrationDefinition(77, 'ppk016_derived_data_policy_inheritance'");
    expect(source).toContain(`createMigrationDefinition(${(ratchet.currentBoundary as Record<string, unknown>).latestDatabaseMigration},`);
    expect(source).not.toMatch(/createMigrationDefinition\([^\n]+(?:ppk015|network_egress)/iu);
  });

  it('pins the exact current production source and authorized inventory counts', async () => {
    const ratchet = await json('config/ppk-015-network-egress-current-ratchet.json');
    const current = ratchet.currentBoundary as Record<string, unknown>;
    const scan = await scanNetworkEgressBoundary();
    const staticRatchet = inspectNetworkEgressStaticRatchet();
    expect(scan).toMatchObject({
      zones: current.productionSourceZones,
      files: current.scannedFiles,
      sourceInventorySha256: current.sourceInventorySha256,
      findings: []
    });
    expect(current).toMatchObject({ maliciousSelfTests: staticRatchet.selfTestAssertions, directPrimitiveExceptionCount: 0,
      authorizedAdapterCount: staticRatchet.authorizedExternalEgressAdapters,
      authorizedPurposeCount: staticRatchet.authorizedEgressPurposeCount,
      authorizedInventorySha256: staticRatchet.authorizedInventorySha256,
      localOnlyTransportFiles: staticRatchet.localOnlyTransportFiles });
    expect((current.authorizedAdapters as unknown[])).toHaveLength(2);
    expect((current.authorizedPurposes as unknown[])).toHaveLength(3);
  });

  it('forbids restoring stale latest-decision and no-migration-77 checks', async () => {
    const verifier = (await read('scripts/verify-32-k-ppk-015-network-egress-contract.mjs')).toString('utf8');
    expect(verifier).not.toContain("ledger.decisions.at(-1)?.id === 'DEC-196'");
    expect(verifier).not.toContain("!sources.migration.includes('createMigrationDefinition(77,'");
    expect(verifier).toContain('NETWORK_EGRESS_HISTORICAL_CLOSURE_AND_CURRENT_RATCHET');
    expect(verifier).toContain('evidenceRewritten: false');
  });
});
