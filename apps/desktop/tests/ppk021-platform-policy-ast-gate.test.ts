import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  evaluatePlatformPolicyAstAllowlist,
  inventoryPlatformPolicyAstSurfaces,
  scanPlatformPolicyAstSource
} from '../../../scripts/lib/platform-policy-ast-scanner.mjs';
import { runPlatformPolicyAstGate } from '../../../scripts/verify-platform-policy-ast-gate.mjs';

const kinds = (source, path = 'apps/untrusted/src/bypass.ts') =>
  scanPlatformPolicyAstSource(path, source).map((item) => item.kind);

describe('32-Q PPK-021 TypeScript AST fail-closed gate', () => {
  it('detects aliased, dynamic and computed SQL access', () => {
    expect(kinds("import { DatabaseSync as Hidden } from 'node:sqlite'; const db = new Hidden('x'); db['prepare']('SELECT 1')"))
      .toEqual(expect.arrayContaining(['SQL_IMPORT', 'SQL_CALL']));
    expect(kinds("const sqlite = await import('node:sqlite')")).toContain('SQL_IMPORT');
  });

  it('detects concrete repository and database imports', () => {
    expect(kinds("import { SqliteFamilyRepository } from '@ppt/repositories'"))
      .toContain('REPOSITORY_IMPORT');
    expect(kinds("const database = require('@ppt/database')"))
      .toContain('DATABASE_IMPORT');
  });

  it('detects aliased crypto and network capabilities', () => {
    expect(kinds("import { createHash as harmless } from 'node:crypto'"))
      .toContain('CRYPTO_IMPORT');
    expect(kinds("import * as transport from 'node:https'; fetch(endpoint)"))
      .toEqual(expect.arrayContaining(['NETWORK_IMPORT', 'NETWORK_GLOBAL']));
  });

  it('detects direct role authorization after destructuring', () => {
    expect(kinds("const { role: disguised } = account; if (disguised === 'family_admin') permit()"))
      .toContain('ROLE_CHECK');
  });

  it('keeps renderer role conditions presentation-only', () => {
    expect(kinds("auth.role === 'family_admin'", 'apps/desktop/src/renderer/example.tsx'))
      .toEqual(['ROLE_PRESENTATION']);
  });

  it('detects an aliased unapproved use-case composition', () => {
    expect(kinds("import { DeleteFamilyUseCase as Helper } from '@ppt/application'; new Helper(repository)"))
      .toContain('USE_CASE_COMPOSITION');
  });

  it('fails closed on syntax that cannot be parsed', () => {
    expect(kinds('const broken: =')).toEqual(['AST_PARSE_ERROR']);
  });

  it('rejects unexpected, stale and wildcard allowances', () => {
    const observation = scanPlatformPolicyAstSource('apps/untrusted/src/bypass.ts', "import { createHash } from 'node:crypto'")[0];
    const base = {
      defaultDecision: 'DENY', exactMatchRequired: true, wildcardsAllowed: false,
      categoryRationales: { CRYPTO_IMPORT: 'Reviewed cryptographic implementation boundary.' }
    };
    expect(evaluatePlatformPolicyAstAllowlist({ observations: [observation] }, { ...base, allowedSurfaceKeys: [] }).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'UNAPPROVED_PRIVILEGED_SURFACE' })]));
    expect(evaluatePlatformPolicyAstAllowlist({ observations: [] }, { ...base, allowedSurfaceKeys: [observation.key] }).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'STALE_ALLOWLIST_ENTRY' })]));
    expect(evaluatePlatformPolicyAstAllowlist({ observations: [], }, { ...base, allowedSurfaceKeys: ['CRYPTO_IMPORT|apps/*|node:crypto:createHash'] }).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'ALLOWLIST_WILDCARD_FORBIDDEN' })]));
  });

  it('never permits a direct authorization role check through the allowlist', () => {
    const observation = scanPlatformPolicyAstSource('apps/service/src/bypass.ts', "account.role === 'family_admin'")[0];
    const manifest = {
      defaultDecision: 'DENY', exactMatchRequired: true, wildcardsAllowed: false,
      categoryRationales: { ROLE_CHECK: 'No direct authorization role check is authorized.' },
      allowedSurfaceKeys: [observation.key]
    };
    expect(evaluatePlatformPolicyAstAllowlist({ observations: [observation] }, manifest).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'DIRECT_ROLE_AUTHORIZATION_FORBIDDEN' })]));
  });

  it('matches the complete production inventory to the exact manifest', async () => {
    const manifest = JSON.parse(await readFile('config/32-q-ppk-021-platform-policy-ast-allowlist.json', 'utf8'));
    const inventory = await inventoryPlatformPolicyAstSurfaces();
    const result = evaluatePlatformPolicyAstAllowlist(inventory, manifest);
    expect(result.findings).toEqual([]);
    expect(result.allowedCount).toBe(886);
    expect(inventory.zones).toBe(18);
    expect(inventory.files).toBe(563);
  }, 30_000);

  it('produces a content-free PASS report without exposing the allowlist', async () => {
    const report = await runPlatformPolicyAstGate();
    expect(report).toMatchObject({
      status: 'PASS',
      productionSourceZones: 18,
      scannedFiles: 563,
      privilegedSurfaces: 886,
      exactAllowlistEntries: 886,
      directRoleAuthorizationBypasses: 0,
      maliciousSelfTestAssertions: 17,
      benignSelfTestAssertions: 4,
      findings: []
    });
    expect(Object.hasOwn(report, 'observations')).toBe(false);
  }, 30_000);
});
