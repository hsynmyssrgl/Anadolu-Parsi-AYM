import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertGovernedSourceRoot } from './lib/governed-source-root.mjs';
import { networkEgressReportMatchesCurrentRatchet } from './verify-network-egress-boundary.mjs';

const noWrite = process.argv.includes('--no-write');
const root = assertGovernedSourceRoot({ allowReleaseChannel: noWrite });
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [scope, inventory, registry, roadmap, plan, ledger, ppk015Ratchet] = await Promise.all([
  json('config/33-z-signed-plugin-external-provider-platform-scope.json'),
  json('config/33-z-signed-plugin-external-provider-platform-inventory.json'),
  json('config/accepted-scope-registry.json'),
  json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),
  json('config/active-governance-ledger.json'),
  json('config/ppk-015-network-egress-current-ratchet.json')
]);

const execute = (args, timeout = 300_000) => spawnSync(process.execPath, args, {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, env: process.env
});
const governedNodeScript = (path) => [path, ...(noWrite ? ['--no-write'] : [])];
const clean = (value) => String(value ?? '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '');
const output = (result) => clean(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
const parse = (result) => { try { return JSON.parse(clean(result.stdout).trim()); } catch { return undefined; } };

const vitest = execute(['node_modules/vitest/vitest.mjs', 'run', ...scope.validation.targetedTestFiles, '--maxWorkers=1']);
const vitestText = output(vitest);
const files = Number(vitestText.match(/Test Files\s+(?:\d+ failed\s+\|\s+)?(\d+) passed/u)?.[1] ?? 0);
const tests = Number(vitestText.match(/Tests\s+(?:\d+ failed\s+\|\s+)?(\d+) passed/u)?.[1] ?? 0);
const migration = execute(governedNodeScript('scripts/verify-database-migrations.mjs'));
const migrationReport = parse(migration);
const m104 = migrationReport?.migrationVersions?.find((item) => item.version === 104);
const latestMigrationVersion = migrationReport?.migrationVersions?.at(-1)?.version;
const smoke = execute(governedNodeScript('scripts/verify-data-store-smoke.mjs'));
const smokeReport = parse(smoke);
const gate15 = execute(governedNodeScript('scripts/verify-network-egress-boundary.mjs'));
const p15 = parse(gate15);
const gate21 = execute(governedNodeScript('scripts/verify-platform-policy-ast-gate.mjs'));
const p21 = parse(gate21);
const gate22 = execute(governedNodeScript('scripts/verify-platform-capability-manifest-gate.mjs'));
const p22 = parse(gate22);
const packages = ['domain', 'security', 'application', 'repository-contracts', 'repositories', 'database'];
const types = Object.fromEntries(packages.map((name) => [name, execute(['node_modules/typescript/bin/tsc', '-p', `packages/${name}/tsconfig.json`, '--noEmit'])]));
types.electron = execute(['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.electron.json', '--noEmit']);
types.renderer = execute(['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.renderer.json', '--noEmit']);

const requirements = scope.requirements;
const dependencies = ['33-O', '33-P', '33-Q'];
const roadmapItem = roadmap.packages?.find((item) => item.step === '33-Z');
const registryItems = requirements.map((id) => registry.requirements?.find((item) => item.id === id));
const manualNotRun = Object.entries(scope.manualEvidence ?? {})
  .filter(([key]) => key !== 'certificationClaimed')
  .every(([, value]) => value === 'NOT_RUN');

const definitions = [
  ['exact six-file local Vitest exits successfully', vitest.status === 0 && vitest.signal === null],
  ['local test result meets exact 6/30 ratchet', files === 6 && tests === 30
    && scope.validation.targetedTestFileRatchet === 6 && scope.validation.targetedTestRatchet === 30
    && inventory.validation.targetedTestFileRatchet === 6 && inventory.validation.targetedTestRatchet === 30],
  ['migration verifier passes exact migration 104 checksum', migration.status === 0 && migrationReport?.status === 'passed'
    && migrationReport?.checkCount === 9 && m104?.name === 'signed_plugin_external_provider_platform'
    && m104?.checksum === scope.validation.migrationSha256],
  ['data store smoke includes migration 104 under the current migration head', smoke.status === 0 && smokeReport?.status === 'passed'
    && smokeReport?.migrationVersions?.includes(104) && smokeReport?.migrationVersions?.at(-1) === latestMigrationVersion],
  ['PPK-015 raw gate matches canonical current ratchet', gate15.status === 0
    && networkEgressReportMatchesCurrentRatchet(p15, ppk015Ratchet.currentBoundary)],
  ['PPK-021 raw gate matches scope ratchet', gate21.status === 0 && p21?.status === 'PASS'
    && p21?.scannedFiles === scope.validation.ppk021.files && p21?.privilegedSurfaces === scope.validation.ppk021.surfaces
    && p21?.exactAllowlistSha256 === scope.validation.ppk021.sha256 && p21?.findings?.length === 0],
  ['PPK-022 raw gate matches scope ratchet', gate22.status === 0 && p22?.status === 'PASS'
    && p22?.scannedFiles === scope.validation.ppk022.files && p22?.capabilitySurfaces === scope.validation.ppk022.surfaces
    && p22?.exactManifestSha256 === scope.validation.ppk022.sha256 && p22?.findings?.length === 0],
  ['all package and desktop typechecks pass', Object.values(types).every((result) => result.status === 0)],
  ['33-Z remains planned behind exact dependencies while 33-P stays active', roadmapItem?.status === 'PLANNED'
    && JSON.stringify(roadmapItem.dependsOn) === JSON.stringify(dependencies) && plan.currentStep === '33-P'
    && ledger.activeMicroStep === '33-P' && registryItems.every((item) => item && item.status !== 'COMPLETE' && item.chain?.evidence === false)],
  ['execution provider credentials trust sandbox network and release truth remain closed', scope.truth.thirdPartyCodeExecutionPerformed === false
    && scope.truth.externalProviderConnectionPerformed === false && scope.truth.providerCredentialsStored === false
    && scope.truth.productionSigningTrustProvisioned === false && scope.truth.productionReleaseEligible === false
    && scope.truth.sandboxRuntimeVerified === false && scope.truth.osNetworkIsolationVerified === false
    && scope.truth.providerAvailabilityGuaranteed === false && scope.truth.networkUsedByCurrentImplementation === false],
  ['manual evidence receipt and acceptance remain closed', manualNotRun && scope.manualEvidence.certificationClaimed === false
    && scope.validation.countsAsRequirementPass === false && inventory.validation.countsAsRequirementPass === false
    && scope.persistentReceiptStatus === 'NOT_RUN']
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '33-Z', decision: 'DEC-237', status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED', countsAsRequirementPass: false, targetedTestFilesPassed: files, targetedTestsPassed: tests,
  migration104Sha256: m104?.checksum ?? null, ppk015RatchetSource: 'config/ppk-015-network-egress-current-ratchet.json',
  ppk015: p15, ppk021: p21, ppk022: p22,
  checkCount: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, generatedAt: new Date().toISOString() };
if (!noWrite) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/validation/33-Z-signed-plugin-external-provider-platform-runtime.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`33-Z runtime: FAIL (${failures.length}/${checks.length}; ${files}/6 files; ${tests}/30 tests).`);
  for (const item of failures) console.error(item.name);
  console.error(vitestText.slice(-4000));
  process.exit(1);
}
console.log(`33-Z runtime: PASS (${checks.length}/${checks.length}; ${files}/6 files; ${tests}/30 tests; requirement PASS=false; write=${!noWrite}).`);
