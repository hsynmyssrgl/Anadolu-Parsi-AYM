import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const mode = process.argv[2];
const noWrite = process.argv.includes('--no-write');
if (!['boundary', 'contract', 'runtime'].includes(mode)) {
  throw new Error('Usage: node scripts/verify-34-l-bronze-final-local-closure.mjs <boundary|contract|runtime> [--no-write]');
}

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const checks = [];
const check = (name, passed, detail = '') => checks.push({ name, status: passed ? 'PASS' : 'FAIL', detail });
const run = (name, args) => {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', stdio: 'pipe', maxBuffer: 96 * 1024 * 1024 });
  const output = `${result.error?.stack ?? ''}${result.stdout ?? ''}${result.stderr ?? ''}`;
  checks.push({ name, status: result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status ?? 1, output: output.slice(-20000) });
  return { result, output };
};
const headResult = spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'rev-parse', 'HEAD'],
  { cwd: root, encoding: 'utf8', stdio: 'pipe' });
if (headResult.status !== 0 || !/^[0-9a-f]{40}\s*$/u.test(headResult.stdout ?? '')) {
  throw new Error('Cannot resolve exact source HEAD.');
}
const sourceBaseHead = headResult.stdout.trim();

const governanceFiles = [
  'config/34-l-bronze-final-drift-deterministic-delivery-closure-scope.json',
  'config/34-l-bronze-final-drift-deterministic-delivery-closure-inventory.json',
  'docs/decisions/DEC-249-bronze-final-drift-deterministic-delivery-closure.md',
  'docs/security/THREAT_MODEL_34_L_BRONZE_FINAL_LOCAL_CLOSURE.md',
  'docs/audit/34-L_BRONZE_FINAL_LOCAL_CLOSURE_AUDIT.md',
  'scripts/verify-remaining-package-local-foundation.mjs',
  'scripts/create-34-l-bronze-local-closure-receipt.mjs'
];
const localSteps = ['34-G', '34-H', '34-I', '34-J', '34-K'];

if (mode === 'boundary' || mode === 'runtime') {
  check('34-L governance and automation files exist', governanceFiles.every((path) => existsSync(resolve(root, path))));
  const packageJson = json('package.json');
  const commands = ['boundary', 'contract', 'runtime', 'receipt'];
  check('34-L package commands are wired', commands.every((command) => typeof packageJson.scripts?.[`verify:34-l:${command}`] === 'string'));
  for (const step of localSteps) {
    run(`${step} boundary`, ['scripts/verify-remaining-package-local-foundation.mjs', step, 'boundary', '--no-write']);
  }
}

if (mode === 'contract' || mode === 'runtime') {
  const scope = json(governanceFiles[0]);
  const inventory = json(governanceFiles[1]);
  const roadmap = json('config/remaining-scope-package-roadmap.json');
  const registry = json('config/accepted-scope-registry.json');
  const decision = read(governanceFiles[2]);
  const threat = read(governanceFiles[3]);
  const audit = read(governanceFiles[4]);
  const steps = roadmap.packages.map((item) => item.step);
  const assigned = roadmap.packages.flatMap((item) => item.requirementIds);
  check('34-L identity and final planned state are exact', scope.step === '34-L' && scope.decision === 'DEC-249'
    && scope.status === 'PLANNED_FINAL' && inventory.status === 'PLANNED_FINAL');
  check('acceptance remains fail-honest', scope.truth?.requirementsClosed === false
    && scope.truth?.countsAsRequirementPass === false && inventory.countsAsRequirementPass === false);
  check('current local validation evidence is exact and remains non-accepting', scope.validation?.localPackageBoundaries?.checks === 52
    && scope.validation?.localPackageContracts?.checks === 30
    && scope.validation?.localPackageRuntimes?.checks === 172
    && scope.validation?.targeted?.files === 12 && scope.validation?.targeted?.tests === 50
    && scope.validation?.fullRegression?.status === 'PASS' && scope.validation?.fullRegression?.files === 306
    && scope.validation?.fullRegression?.tests === 2047 && scope.validation?.rootTypecheck === 'PASS'
    && scope.validation?.productionBuilds?.status === 'PASS' && scope.validation?.productionBuilds?.workspaces === 18
    && scope.validation?.artifactIndex?.checks === 19394 && scope.validation?.artifactIndex?.files === 5993
    && scope.validation?.artifactIndex?.documents === 3683 && inventory.localEvidence?.fullRegressionStatus === 'PASS'
    && inventory.localEvidence?.fullRegressionFiles === 306 && inventory.localEvidence?.fullRegressionTests === 2047
    && audit.includes('306/306') && audit.includes('2047/2047'));
  check('versioned local receipt rollover is supported while manual and external evidence remain NOT_RUN', Object.values(scope.manualEvidence ?? {}).every((value) => value === 'NOT_RUN')
    && scope.persistentReceiptStatus === 'VERSIONED_LOCAL_RECEIPT_SUPPORTED'
    && scope.persistentReceiptPathPattern === 'artifacts/validation/34-L-bronze-local-closure-receipts/<source-head>-<evidence-digest>.json'
    && scope.externalPersistentReceiptStatus === 'NOT_RUN'
    && inventory.localPersistentReceiptStatus === 'VERSIONED_LOCAL_RECEIPT_SUPPORTED'
    && inventory.externalPersistentReceiptStatus === 'NOT_RUN');
  check('roadmap identity is complete and non-duplicated', roadmap.packageCount === 26 && steps.length === 26
    && new Set(steps).size === 26 && assigned.length === 274 && new Set(assigned).size === 274);
  check('roadmap acceptance states were not invented', roadmap.packages.find((item) => item.step === '33-P')?.status === 'IN_PROGRESS'
    && localSteps.every((step) => roadmap.packages.find((item) => item.step === step)?.status === 'PLANNED')
    && roadmap.packages.find((item) => item.step === '34-L')?.status === 'PLANNED_FINAL');
  check('accepted registry count and identities are stable', registry.requirementCount === 358 && registry.requirements.length === 358
    && new Set(registry.requirements.map((item) => item.id)).size === 358);
  check('decision and threat model reject false closure', decision.includes('countsAsRequirementPass=false')
    && decision.includes('PLANNED_FINAL') && threat.includes('Residual risk'));
  for (const step of localSteps) {
    run(`${step} contract`, ['scripts/verify-remaining-package-local-foundation.mjs', step, 'contract', '--no-write']);
  }
}

if (mode === 'runtime') {
  const tests = [
    'packages/application/tests/communication-file-sharing-use-cases.test.ts',
    'packages/repositories/communication-file-sharing-repository-policy.test.ts',
    'packages/application/tests/communication-audit-archive-use-cases.test.ts',
    'packages/repositories/communication-audit-archive-repository-policy.test.ts',
    'apps/core-service/tests/distributed-core-cluster-runtime.test.ts',
    'apps/core-service/tests/distributed-core-migration-boundary.test.ts',
    'apps/core-service/tests/distributed-operations-runtime.test.ts',
    'apps/core-service/tests/distributed-operations-migration-boundary.test.ts',
    'packages/application/tests/windows-resilience-universal-ux-use-cases.test.ts',
    'packages/repositories/windows-resilience-universal-ux-repository-policy.test.ts',
    'apps/desktop/tests/remaining-communication-distributed-ui.test.ts',
    'apps/desktop/tests/universal-ux-consolidation-ui.test.ts'
  ];
  const targeted = run('34-G..34-K targeted tests', [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run',
    ...tests, '--maxWorkers=1']);
  check('combined targeted runtime ratchet is exact', targeted.result.status === 0
    && targeted.output.includes('Test Files  12 passed (12)') && targeted.output.includes('Tests  50 passed (50)'));
  const projects = [
    'packages/domain/tsconfig.json',
    'packages/repository-contracts/tsconfig.json',
    'packages/application/tsconfig.json',
    'packages/database/tsconfig.json',
    'packages/repositories/tsconfig.json',
    'apps/core-service/tsconfig.json',
    'apps/desktop/tsconfig.electron.json',
    'apps/desktop/tsconfig.renderer.json'
  ];
  for (const project of projects) run(`typecheck ${project}`, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', project, '--noEmit']);
  run('migration verification', ['scripts/verify-database-migrations.mjs', '--no-write']);
  run('monthly release identity', ['scripts/verify-monthly-release-contract.mjs', '--no-write']);
  run('personal identity sweep', ['scripts/verify-personal-identity-sweep.mjs', '--no-write']);
  run('feature reality gate', ['scripts/verify-feature-reality-gate.mjs', '--no-write']);
  run('current document and artifact index', ['scripts/verify-project-artifact-index-v2.mjs', '--no-report']);
  const statusResult = spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'status', '--porcelain=v1',
    '--untracked-files=all'], { cwd: root, encoding: 'utf8', stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 });
  const allowedEvidenceChanges = new Set([
    'artifacts/validation/34-L-bronze-final-local-closure-boundary.json',
    'artifacts/validation/34-L-bronze-final-local-closure-contract.json',
    'artifacts/validation/34-L-bronze-final-local-closure-runtime.json'
  ]);
  const unexpectedChanges = statusResult.status === 0 ? statusResult.stdout.split(/\r?\n/u).filter(Boolean)
    .filter((line) => !allowedEvidenceChanges.has(line.slice(3).replaceAll('\\', '/'))) : [];
  check('deterministic delivery worktree contains only closure evidence changes',
    statusResult.status === 0 && unexpectedChanges.length === 0,
    statusResult.status === 0 ? unexpectedChanges.slice(0, 100).join('\n') : statusResult.stderr);
}

const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  step: '34-L',
  decision: 'DEC-249',
  mode,
  sourceBaseHead,
  status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED_FINAL',
  localImplementationStatus: 'LOCAL_CLOSURE_AUTOMATION_COMPOSED_ACCEPTANCE_BLOCKED',
  requirementsClosed: false,
  countsAsRequirementPass: false,
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  evidenceDigest: sha256(JSON.stringify(checks)),
  checks,
  generatedAt: new Date().toISOString()
};
if (!noWrite) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/validation', `34-L-bronze-final-local-closure-${mode}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`34-L ${mode}: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(item.name);
  process.exit(1);
}
console.log(`34-L ${mode}: PASS (${checks.length}/${checks.length}; requirement PASS=false; write=${!noWrite}).`);
