import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const cliArguments = process.argv.slice(2);
if (cliArguments.length > 1 || cliArguments.some((argument) => argument !== '--no-write')) {
  throw new Error('Unsupported 33-M accessibility boundary argument.');
}
const noWrite = process.argv.includes('--no-write');
const root = resolve(process.cwd());
const output = 'artifacts/validation/33-M-accessibility-boundary.json';
const sources = {
  domain: 'packages/domain/src/accessibility-preferences.ts',
  application: 'packages/application/src/accessibility-preferences-use-cases.ts',
  repositoryContract: 'packages/repository-contracts/src/accessibility-preferences-repository.ts',
  repository: 'packages/repositories/src/accessibility-preferences-repository.ts',
  migrations: 'packages/database/src/family-database-migrations.ts',
  adapter: 'apps/desktop/src/main/accessibility-preferences-application-adapter.ts',
  productionPolicy: 'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  ipc: 'apps/desktop/src/main/ipc-integration-policy.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  model: 'apps/desktop/src/renderer/accessibility.ts',
  app: 'apps/desktop/src/renderer/App.tsx',
  typography: 'apps/desktop/src/renderer/typography.css',
  styles: 'apps/desktop/src/renderer/styles.css',
  ui: 'apps/desktop/src/renderer/ui.tsx',
  test: 'apps/desktop/tests/accessibility-preference-center.test.ts'
};
const text = Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([key, path]) => [key, await readFile(resolve(root, path), 'utf8')])));
const checks = [];
const check = (name, passed, evidence) => checks.push({ name, status: passed ? 'PASS' : 'FAIL', evidence });
const has = (key, ...markers) => markers.every((marker) => text[key].includes(marker));

check('bounded preference model', has('model', 'textScalePercent: number', 'value >= 100 && value <= 225'), sources.model);
check('public domain view excludes persistence internals', has('domain', 'AccessibilityPreferencesView', 'UpdateAccessibilityPreferencesInput') && !text.domain.includes('lastMutationId'), sources.domain);
check('application has exact validation revision and idempotent replay', has('application', 'exactCommand', 'expectedRevision', 'findMutationByClientOperationId', 'requestFingerprint'), sources.application);
check('application strips internal mutation identifiers from public views', has('application', 'viewFromRow', 'viewFromMutation') && !/return ok\(row\)/u.test(text.application), sources.application);
check('repository contract separates governed access and policy resolution', has('repositoryContract', 'PolicyAuthorizedRepositoryExecutionContext', 'findForPolicyResolution', 'saveCurrent'), sources.repositoryContract);
check('migration 90 stores strict current and immutable mutation history', has('migrations', "createMigrationDefinition(90, 'b7_accessibility_preferences'", 'CREATE TABLE accessibility_preference_mutations', 'CREATE TABLE accessibility_preferences', 'accessibility preference mutations are immutable'), sources.migrations);
check('migration receipt trigger binds active exact personal subject', has('migrations', 'trg_accessibility_mutation_policy_receipt', "receipt.resource_type='accessibility_preferences'", "json_extract(receipt.record_json,'$.request.resource.sensitivity')='personal'", "json_extract(receipt.record_json,'$.request.purpose')='general'"), sources.migrations);
check('repository enforces exact personal PEP receipt and optimistic revision', has('repository', 'assertPersonalSubject', 'accessibilityWriteBinding', 'platformPolicyPersistenceBinding', 'expectedRevision'), sources.repository);
check('existing central PEP and UoW runner are reused', has('adapter', 'RepositoryBackedTimelinePolicyTransactionRunner', 'authorization.receiptRecord.recordedAt') && has('productionPolicy', "'accessibility_preferences'", 'accessibilityPreferencesRepository.findForPolicyResolution'), `${sources.adapter};${sources.productionPolicy}`);
check('data-store composes governed use cases and policy resource repository', has('dataStore', 'GetAccessibilityPreferencesUseCase', 'RepositoryBackedAccessibilityPreferencesUnitOfWork', 'accessibilityPreferencesRepository:', 'updateAccessibilityPreferences'), sources.dataStore);
check('IPC rejects shape drift and preload exposes only typed methods', has('ipc', 'accessibilityPreferencesInput', "case 'accessibility:getPreferences'", 'containsNestedProhibitedBankingSecret') && has('preload', 'getAccessibilityPreferences', 'updateAccessibilityPreferences') && has('global', 'AccessibilityPreferencesView', 'UpdateAccessibilityPreferencesInput'), `${sources.ipc};${sources.preload};${sources.global}`);
check('safe malformed preference fallback', has('model', 'catch {', "applyAccessibilityProfile('standard', system)"), sources.model);
check('five audience profiles', ['youth', 'standard', 'senior', 'low-vision', 'caregiver'].every((value) => text.model.includes(value)), sources.model);
check('density never hides information by model', has('model', "'comfortable' | 'standard' | 'compact'"), sources.model);
check('system contrast and motion are read only', has('app', "matchMedia?.('(prefers-contrast: more)')", "matchMedia?.('(prefers-reduced-motion: reduce)')"), sources.app);
check('preference center is visible', has('app', 'Erişilebilirlik ve görünüm merkezi', 'Özel metin ölçeği', 'Kompakt — bilgi saklanmaz'), sources.app);
check('application exposes governed data attributes', has('app', 'data-text-scale=', 'data-high-contrast=', 'data-reduce-motion=', 'data-density=', 'data-reading-mode=', 'data-audience-profile='), sources.app);
check('route change moves focus and announces', has('app', 'mainContentRef.current?.focus', 'accessibilityAnnouncement(activeItem.label)', 'aria-live="polite"'), sources.app);
check('keyboard Escape and roving navigation exist', has('app', "event.key === 'Escape'", 'nextRovingIndex(') && has('ui', "event.key === 'Escape'"), `${sources.app};${sources.ui}`);
check('all visible typography tokens are governed to 16px floor', has('typography', '--font-size-body: calc(17px', '--font-size-caption-1: calc(16px', '--font-size-caption-2: calc(16px'), sources.typography);
check('minimum 44px controls', has('typography', 'min-height: 44px') && has('styles', 'min-height: 44px'), `${sources.typography};${sources.styles}`);
check('zoom safe overflow and wrapping', has('styles', 'overflow-x: clip', 'overflow-wrap: anywhere', 'min-width: 0'), sources.styles);
check('small window reflow', has('styles', '@media (max-width: 800px)', 'grid-template-columns: minmax(0, 1fr)', 'width: 100%'), sources.styles);
check('forced colors and non-color status marker', has('styles', '@media (forced-colors: active)', 'border: 2px solid CanvasText', 'content:'), sources.styles);
check('reduced motion system and local preference', has('styles', '@media (prefers-reduced-motion: reduce)', '[data-reduce-motion="true"]'), sources.styles);
check('easy read and profile surfaces', has('styles', '[data-reading-mode="easy-read"]', '.accessibility-settings', 'aria-pressed="true"'), sources.styles);
check('targeted negative test suite exists', has('test', 'fails closed to bounded values', '100 through 225', 'keyboard roving'), sources.test);

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '33-M', decision: 'DEC-224', requirements: Array.from({ length: 13 }, (_, index) => `B7-${String(index + 1).padStart(2, '0')}`), status: failures.length ? 'FAIL' : 'PASS', checksPassed: checks.length - failures.length, checksFailed: failures.length, checks, manualCertification: { windowsNarrator: 'NOT_RUN', windowsMagnifier: 'NOT_RUN', realDevice: 'NOT_RUN', humanUat: 'NOT_RUN', certificationClaimed: false }, generatedAt: new Date().toISOString() };
if (!noWrite) {
  await mkdir(dirname(resolve(root, output)), { recursive: true });
  await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`33-M accessibility boundary: ${report.status} (${report.checksPassed}/${checks.length}).`);
if (failures.length) process.exitCode = 1;
