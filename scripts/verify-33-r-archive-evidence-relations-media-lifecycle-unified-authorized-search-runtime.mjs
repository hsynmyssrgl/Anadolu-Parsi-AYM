import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);

const noWrite = process.argv.includes('--no-write');
const output = 'artifacts/validation/33-R-archive-evidence-relations-media-lifecycle-unified-authorized-search-runtime.json';
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [scope, inventory, registry, roadmap, plan, ledger] = await Promise.all([
  readJson('config/33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-scope.json'),
  readJson('config/33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json')
]);

const testFiles = Object.freeze([
  'packages/application/tests/archive-evidence-media-use-cases.test.ts',
  'packages/repositories/archive-evidence-media-repository-policy.test.ts',
  'apps/desktop/tests/archive-core-table-receipt-fence.test.ts',
  'apps/desktop/tests/archive-evidence-media-data-store.test.ts',
  'apps/desktop/tests/archive-evidence-media-ipc-ui.test.ts',
  'packages/application/tests/unified-authorized-search-use-cases.test.ts',
  'apps/desktop/tests/unified-authorized-search-application-adapter.test.ts',
  'apps/desktop/tests/unified-authorized-search-ipc-ui.test.ts'
]);
const execute = (args, timeout = 300_000) => spawnSync(process.execPath, args, {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  timeout,
  maxBuffer: 64 * 1024 * 1024,
  env: process.env
});
const clean = (value) => String(value ?? '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '');
const combined = (result) => clean(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
const parseJson = (result) => {
  try { return JSON.parse(clean(result.stdout).trim()); } catch { return undefined; }
};

const vitest = execute(['node_modules/vitest/vitest.mjs', 'run', ...testFiles, '--maxWorkers=1']);
const vitestOutput = combined(vitest);
const filesMatch = vitestOutput.match(/Test Files\s+(\d+) passed/u);
const testsMatch = vitestOutput.match(/Tests\s+(\d+) passed/u);
const filesPassed = filesMatch ? Number(filesMatch[1]) : 0;
const testsPassed = testsMatch ? Number(testsMatch[1]) : 0;

const migration = execute(['scripts/verify-database-migrations.mjs']);
const migrationReport = parseJson(migration);
const migration96 = migrationReport?.migrationVersions?.find((item) => item.version === 96);
const smoke = execute(['scripts/verify-data-store-smoke.mjs']);
const smokeReport = parseJson(smoke);
const ppk021 = execute(['scripts/verify-platform-policy-ast-gate.mjs']);
const ppk021Report = parseJson(ppk021);
const ppk022 = execute(['scripts/verify-platform-capability-manifest-gate.mjs']);
const ppk022Report = parseJson(ppk022);

const typechecks = {
  domain: execute(['node_modules/typescript/bin/tsc', '-p', 'packages/domain/tsconfig.json', '--noEmit']),
  application: execute(['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json', '--noEmit']),
  repositoryContracts: execute(['node_modules/typescript/bin/tsc', '-p', 'packages/repository-contracts/tsconfig.json', '--noEmit']),
  repositories: execute(['node_modules/typescript/bin/tsc', '-p', 'packages/repositories/tsconfig.json', '--noEmit']),
  database: execute(['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json', '--noEmit']),
  desktopElectron: execute(['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.electron.json', '--noEmit']),
  desktopRenderer: execute(['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.renderer.json', '--noEmit'])
};

const requirements = ['B3-01', 'B3-03', 'B3-05'];
const registryItems = requirements.map((id) => registry.requirements?.find((item) => item.id === id));
const roadmapItem = roadmap.packages?.find((item) => item.step === '33-R');
const manualNotRun = Object.entries(scope.manualEvidence ?? {})
  .filter(([key]) => key !== 'certificationClaimed')
  .every(([, value]) => value === 'NOT_RUN');

const definitions = [
  ['exact eight-file local Vitest process exits successfully', vitest.status === 0 && vitest.signal === null],
  ['local test result meets exact 8/30 ratchet', filesPassed === 8 && testsPassed === 30
    && scope.validation?.targetedTestFileRatchet === 8 && scope.validation?.targetedTestRatchet === 30
    && inventory.validation?.targetedTestFileRatchet === 8 && inventory.validation?.targetedTestRatchet === 30],
  ['migration verifier passes with exact migration 96 checksum', migration.status === 0
    && migrationReport?.status === 'passed' && migrationReport?.checkCount === 9
    && migration96?.name === 'archive_evidence_relations_media_search'
    && migration96?.checksum === 'c00b2a72bf49d2200c85b2045a8ab7a01ef7a41882b2b14eb5a1f4715bde1eb2'],
  ['data store smoke passes current schema checks', smoke.status === 0 && smokeReport?.status === 'passed'
    && smokeReport?.checks === 14],
  ['PPK-021 raw gate passes exact 556/876 ratchet', ppk021.status === 0 && ppk021Report?.status === 'PASS'
    && ppk021Report?.scannedFiles === 556 && ppk021Report?.privilegedSurfaces === 876
    && ppk021Report?.exactAllowlistSha256 === '709379784b8e59727f58d54c6187a4f2924d19c0bcefbe6efb976ed64f825dd0'],
  ['PPK-022 raw gate passes exact 556/395 ratchet', ppk022.status === 0 && ppk022Report?.status === 'PASS'
    && ppk022Report?.scannedFiles === 556 && ppk022Report?.capabilitySurfaces === 395
    && ppk022Report?.exactManifestSha256 === 'a3b3f91af4a08d2b4fcb58d71b67a9e40283e6b94364a64519409c4d44a21d0e'],
  ['domain application contract repository and database typechecks pass',
    ['domain', 'application', 'repositoryContracts', 'repositories', 'database'].every((key) => typechecks[key].status === 0)],
  ['desktop Electron typecheck passes', typechecks.desktopElectron.status === 0],
  ['desktop renderer typecheck passes', typechecks.desktopRenderer.status === 0],
  ['33-R stays planned behind 33-Q while 33-P remains active', roadmapItem?.status === 'PLANNED'
    && JSON.stringify(roadmapItem.dependsOn) === JSON.stringify(['33-Q'])
    && plan.currentStep === '33-P' && ledger.activeMicroStep === '33-P'
    && registryItems.every((item) => item && item.status !== 'COMPLETE' && item.chain?.evidence === false)],
  ['manual evidence certification and requirement pass remain closed', manualNotRun
    && scope.manualEvidence?.certificationClaimed === false
    && scope.validation?.countsAsRequirementPass === false
    && inventory.validation?.countsAsRequirementPass === false
    && scope.persistentReceiptStatus === 'NOT_RUN']
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  step: '33-R',
  decision: 'DEC-229',
  status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED',
  automatedRuntimeStatus: failures.length ? 'FAIL' : 'LOCAL_COMPOSED_COMPONENT_MATRIX_PASS',
  countsAsRequirementPass: false,
  targetedTestFilesPassed: filesPassed,
  targetedTestsPassed: testsPassed,
  targetedTestFileRatchet: 8,
  targetedTestRatchet: 30,
  migration96Sha256: migration96?.checksum ?? null,
  ppk021: ppk021Report,
  ppk022: ppk022Report,
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  generatedAt: new Date().toISOString()
};

if (!noWrite) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'w' });
}
if (failures.length) {
  console.error(`33-R runtime: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(failure.name);
  process.exit(1);
}
console.log(`33-R runtime: PASS (${checks.length}/${checks.length}); ${filesPassed}/${filesPassed} files, ${testsPassed}/${testsPassed} tests.`);
