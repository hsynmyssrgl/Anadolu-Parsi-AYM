import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
const readText = (path) => readFile(resolve(root, path), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));

const [scope, authority, priority, execution, plan, ledger, registry, packageJson, appMeta, rendererExports, main, preload, globalType, app, ui, domainTest, desktopTest, deliveryGenerator] = await Promise.all([
  readJson('config/31-e-user-visible-release-boundary-scope.json'),
  readJson('artifacts/authority/31-E_AUTO_PRIORITY_SELECTION_AUTHORITY.json'),
  readJson('artifacts/validation/31-E_PRIORITY_SELECTION_VALIDATION.json'),
  readJson('artifacts/checkpoints/31-E_EXECUTION_RECORD.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('package.json'),
  readText('packages/domain/src/app-meta.ts'),
  readText('packages/domain/src/renderer.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('apps/desktop/src/renderer/ui.tsx'),
  readText('packages/domain/tests/user-visible-release.test.ts'),
  readText('apps/desktop/tests/user-visible-release-boundary-runtime.test.ts'),
  readText('scripts/generate-current-delivery-report.mjs')
]);

const requirement = registry.requirements.find((item) => item.id === 'B0-02');
const step = plan.steps.find((item) => item.id === '31-E');
const step31F = plan.steps.find((item) => item.id === '31-F');
const lifecycleComplete = scope.status === 'COMPLETED';
const successor31FCompleted = plan.currentStep === '31-F' && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0 && lifecycleComplete && step31F?.status === 'COMPLETED' && step31F.validationStatus === 'PASS' && step31F.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-F' });
const check = (name, passed) => ({ name, status: passed ? 'PASS' : 'FAIL' });
const checks = [
  check('scope identity', scope.step === '31-E' && scope.requirement === 'B0-02' && scope.decision === 'DEC-165'),
  check('scope lifecycle', ['IN_PROGRESS', 'COMPLETED'].includes(scope.status)),
  check('authority PASS', authority.status === 'PASS' && authority.predecessor?.step === '31-D'),
  check('priority selection PASS', priority.status === 'PASS' && priority.failed === 0),
  check('execution lifecycle', lifecycleComplete ? execution.officialStepStatus === 'COMPLETED' : execution.officialStepStatus.startsWith('IN_PROGRESS')),
  check('plan identity', (plan.currentStep === '31-E' && step) || successor31FCompleted || laterSuccessor.planValid),
  check('plan lifecycle', lifecycleComplete ? step?.status === 'COMPLETED' : step?.status === 'IN_PROGRESS'),
  check('ledger identity', lifecycleComplete
    ? (ledger.activeMicroStep === null && (ledger.libraryUploadStatus === '31-E_COMPLETED_RECEIPT_PASS' || (successor31FCompleted && ledger.libraryUploadStatus === '31-F_COMPLETED_RECEIPT_PASS'))) || laterSuccessor.ledgerValid
    : ledger.activeMicroStep === '31-E'),
  check('registry priority', requirement?.priority === 'P0'),
  check('registry lifecycle', lifecycleComplete ? requirement?.status === 'COMPLETE' : requirement?.status === 'PARTIAL'),
  check('internal metadata preserved', ['packageVersion', 'releaseId', 'monthlySequence'].every((token) => appMeta.includes(token))),
  check('public DTO type', appMeta.includes('export interface UserVisibleAppInfo')),
  check('public DTO fields', ['name:', 'releaseLabel:', 'channel:', 'stage:'].every((token) => appMeta.includes(token))),
  check('canonical public release pattern', appMeta.includes('Bronze|Silver|Gold') && appMeta.includes('\\d{2}\\.\\d{2}\\.\\d{4}\\.\\d+')),
  check('legacy visible tokens rejected', appMeta.includes('RC2?|MVP|Build')),
  check('public projection fail closed', appMeta.includes('toUserVisibleAppInfo') && appMeta.includes('throw new Error')),
  check('canonical delivery helper', appMeta.includes('createUserVisibleDeliveryFileName') && appMeta.includes('USER_VISIBLE_DELIVERY_FILE_NAME')),
  check('renderer hides APP_META', rendererExports.includes('USER_VISIBLE_APP_INFO') && !rendererExports.includes('APP_META')),
  check('IPC returns public DTO', main.includes("registerIpcHandler('app:getInfo', () => USER_VISIBLE_APP_INFO)") && !main.includes("registerIpcHandler('app:getInfo', () => APP_META)")),
  check('preload public type', preload.includes('export type AppInfo = UserVisibleAppInfo;')),
  check('renderer global public type', globalType.includes('getAppInfo(): Promise<UserVisibleAppInfo>;')),
  check('auth footer public label', app.includes('USER_VISIBLE_APP_INFO.releaseLabel') && !app.includes('APP_META.version')),
  check('sidebar public label', app.includes('appInfo.releaseLabel') && !app.includes('appInfo.version') && !app.includes('appInfo.edition')),
  check('modal public label', ui.includes('USER_VISIBLE_APP_INFO.releaseLabel') && !ui.includes('APP_META.stage')),
  check('domain targeted tests', domainTest.includes('exact public release DTO') || domainTest.includes('projects only the public release DTO')),
  check('domain fail-closed test', domainTest.includes('Bronze RC2 Build 229')),
  check('desktop boundary tests', desktopTest.includes('app:getInfo') && desktopTest.includes('canonical public delivery file')),
  check('user delivery filename field', deliveryGenerator.includes('userVisibleDeliveryFileName')),
  check('user delivery directory', deliveryGenerator.includes("'artifacts', 'deliveries'")),
  check('delivery filename legacy-token gate', deliveryGenerator.includes('RC2?|MVP|Build')),
  check('package contract script', packageJson.scripts?.['verify:31-e:user-visible-release-contract'] === 'node scripts/verify-31-e-user-visible-release-boundary-contract.mjs')
];

const failed = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  release: scope.release,
  step: '31-E',
  requirement: 'B0-02',
  phase: 'USER_VISIBLE_RELEASE_BOUNDARY_CONTRACT',
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  lifecycle: lifecycleComplete ? 'COMPLETED' : 'IN_PROGRESS',
  checks,
  generatedAt: new Date().toISOString()
};
const target = resolve(root, 'artifacts', 'validation', '31-E_USER_VISIBLE_RELEASE_BOUNDARY_CONTRACT.json');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (failed.length > 0) throw new Error(`31-E user-visible release boundary contract failed: ${failed.map((item) => item.name).join(', ')}`);
console.log(`31-E user-visible release boundary contract: PASS (${checks.length}/${checks.length}).`);
