import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  evaluatePlatformPolicyAstAllowlist,
  inventoryPlatformPolicyAstSurfaces,
  scanPlatformPolicyAstSource
} from './lib/platform-policy-ast-scanner.mjs';

const MANIFEST = 'config/32-q-ppk-021-platform-policy-ast-allowlist.json';

const selfTest = () => {
  const malicious = [
    ["import { DatabaseSync as DB } from 'node:sqlite'; new DB('x.db')", 'SQL_IMPORT'],
    ["const statement = db['prepare']('SELECT 1')", 'SQL_CALL'],
    ["const sqlite = await import('node:sqlite')", 'SQL_IMPORT'],
    ["const hidden = 'node:' + 'sqlite'; await import(hidden)", 'DYNAMIC_IMPORT_UNRESOLVED'],
    ["const repos = require('@ppt/repositories')", 'REPOSITORY_IMPORT'],
    ["import { createHash as digest } from 'node:crypto'", 'CRYPTO_IMPORT'],
    ["import * as transport from 'node:https'", 'NETWORK_IMPORT'],
    ["await fetch(endpoint)", 'NETWORK_GLOBAL'],
    ["const send = globalThis.fetch; await send(endpoint)", 'NETWORK_GLOBAL'],
    ["const c = globalThis.crypto; c.randomUUID()", 'CRYPTO_GLOBAL'],
    ["if (account.role === 'family_admin') authorize()", 'ROLE_CHECK'],
    ["if (roles.includes('caregiver')) authorize()", 'ROLE_CHECK'],
    ["const { role: disguised } = account; if (disguised === 'family_admin') authorize()", 'ROLE_CHECK'],
    ["new UnsafeMutationUseCase(repository)", 'USE_CASE_COMPOSITION'],
    ["import { UnsafeMutationUseCase as InnocentName } from '@ppt/application'; new InnocentName(repository)", 'USE_CASE_COMPOSITION'],
    ["Reflect.construct(UnsafeMutationUseCase, [repository])", 'USE_CASE_COMPOSITION'],
    ["const run = database.prepare; run('SELECT 1')", 'SQL_METHOD_ALIAS']
  ];
  const maliciousFailures = malicious.filter(([source, expected]) => !scanPlatformPolicyAstSource('apps/example/src/bypass.ts', source).some((item) => item.kind === expected));
  if (maliciousFailures.length) throw new Error(`PPK-021 malicious AST self-test failed: ${maliciousFailures.length}/${malicious.length}`);

  const benign = [
    ["const label = 'family_admin';", 'apps/example/src/labels.ts'],
    ["regex.exec(value); kitchen.prepare(meal);", 'apps/example/src/ordinary.ts'],
    ["const text = 'SELECT * FROM examples';", 'apps/example/src/docs.ts'],
    ["auth.role === 'family_admin'", 'apps/desktop/src/renderer/example.tsx']
  ];
  const benignFailures = benign.filter(([source, path], index) => {
    const result = scanPlatformPolicyAstSource(path, source);
    return index < 3 ? result.length !== 0 : result.length !== 1 || result[0].kind !== 'ROLE_PRESENTATION';
  });
  if (benignFailures.length) throw new Error(`PPK-021 benign AST self-test failed: ${benignFailures.length}/${benign.length}`);
  return { malicious: malicious.length, benign: benign.length };
};

export const runPlatformPolicyAstGate = async (root = process.cwd(), options = {}) => {
  const assertions = selfTest();
  const inventory = await inventoryPlatformPolicyAstSurfaces(root);
  if (options.inventoryOnly) {
    return {
      status: inventory.observations.some((item) => item.kind === 'AST_PARSE_ERROR') ? 'FAIL' : 'INVENTORY',
      productionSourceZones: inventory.zones,
      scannedFiles: inventory.files,
      privilegedSurfaces: inventory.observations.length,
      maliciousSelfTestAssertions: assertions.malicious,
      benignSelfTestAssertions: assertions.benign,
      observations: inventory.observations
    };
  }
  const manifest = JSON.parse(await readFile(resolve(root, MANIFEST), 'utf8'));
  const evaluation = evaluatePlatformPolicyAstAllowlist(inventory, manifest);
  const manifestBody = await readFile(resolve(root, MANIFEST));
  return {
    status: evaluation.findings.length === 0 ? 'PASS' : 'FAIL',
    productionSourceZones: inventory.zones,
    scannedFiles: inventory.files,
    privilegedSurfaces: inventory.observations.length,
    exactAllowlistEntries: evaluation.allowedCount,
    exactAllowlistSha256: createHash('sha256').update(manifestBody).digest('hex'),
    surfaceCounts: evaluation.counts,
    maliciousSelfTestAssertions: assertions.malicious,
    benignSelfTestAssertions: assertions.benign,
    directRoleAuthorizationBypasses: inventory.observations.filter((item) => item.kind === 'ROLE_CHECK').length,
    findings: evaluation.findings
  };
};

const main = async () => {
  const inventoryOnly = process.argv.includes('--inventory');
  const report = await runPlatformPolicyAstGate(process.cwd(), { inventoryOnly });
  if (inventoryOnly) {
    const kind = process.argv.find((item) => item.startsWith('--kind='))?.slice('--kind='.length);
    const path = process.argv.find((item) => item.startsWith('--path='))?.slice('--path='.length);
    const detailPattern = process.argv.find((item) => item.startsWith('--detail-pattern='))?.slice('--detail-pattern='.length);
    const pattern = detailPattern ? new RegExp(detailPattern, 'u') : undefined;
    const offset = Number.parseInt(process.argv.find((item) => item.startsWith('--offset='))?.slice('--offset='.length) ?? '0', 10);
    const limit = Number.parseInt(process.argv.find((item) => item.startsWith('--limit='))?.slice('--limit='.length) ?? String(report.observations.length), 10);
    const observations = report.observations.filter((item) =>
      (kind === undefined || item.kind === kind)
      && (path === undefined || item.path === path)
      && (pattern === undefined || pattern.test(item.detail))
    ).slice(offset, offset + limit);
    console.log(JSON.stringify(process.argv.includes('--keys') ? observations.map((item) => item.key) : { ...report, observations }, null, 2));
    if (report.status === 'FAIL') process.exitCode = 1;
    return;
  }
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/platform-policy-ast-gate.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
