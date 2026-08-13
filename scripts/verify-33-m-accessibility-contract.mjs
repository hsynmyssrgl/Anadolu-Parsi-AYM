import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const output = 'artifacts/validation/33-M-accessibility-contract.json';
const requirements = Array.from({ length: 13 }, (_, index) => `B7-${String(index + 1).padStart(2, '0')}`);
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [scope, inventory, registry] = await Promise.all([
  readJson('config/33-m-accessibility-preference-center-scope.json'),
  readJson('config/33-m-accessibility-preference-center-inventory.json'),
  readJson('config/accepted-scope-registry.json')
]);
const [decision, threat, audit] = await Promise.all([
  readFile(resolve(root, 'docs/decisions/DEC-224-accessibility-preference-center.md'), 'utf8'),
  readFile(resolve(root, 'docs/security/THREAT_MODEL_33_M_ACCESSIBILITY_PREFERENCES.md'), 'utf8'),
  readFile(resolve(root, 'docs/audit/33-M_ACCESSIBILITY_PREFERENCE_CENTER_UST_KAPANIS.md'), 'utf8')
]);
const checks = [];
const check = (name, passed) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);

check('scope binds DEC-224 and exact B7-01 through B7-13', scope.decision === 'DEC-224' && exact(scope.requirements, requirements));
check('inventory binds exact requirement set', inventory.step === '33-M' && inventory.decision === 'DEC-224' && exact(inventory.requirements, requirements));
const activationState = scope.status === 'IN_PROGRESS' && scope.validation?.status === 'NOT_RUN' && inventory.status === 'IN_PROGRESS'
  && requirements.every((id) => registry.requirements?.some((item) => item.id === id && item.status !== 'COMPLETE'));
const preparedState = scope.status === 'COMPLETE' && scope.validation?.status === 'PASS' && inventory.status === 'COMPLETE'
  && requirements.every((id) => registry.requirements?.some((item) => item.id === id && item.status === 'COMPLETE'
    && Object.keys(item.chain ?? {}).length === 13 && Object.values(item.chain).every(Boolean)));
check('activation or validated receipt-pending state remains coherent and fail closed', activationState || preparedState);
check('registry state is coherent across every requirement', activationState || preparedState);
check('16px and 100-225 scale contract', scope.model?.minimumVisibleTextPx === 16 && scope.model?.textScalePercent?.minimum === 100 && scope.model?.textScalePercent?.maximum === 225);
check('100-400 DPI and viewport contract', scope.model?.dpiRangePercent?.minimum === 100 && scope.model?.dpiRangePercent?.maximum === 400 && scope.model?.viewportRange?.includes('small_window_reflow'));
check('44px target and five profiles', scope.model?.minimumInteractiveTargetPx === 44 && exact(scope.model?.profiles, ['youth', 'standard', 'senior', 'low-vision', 'caregiver']));
check('persistent personal PEP authority with local-only effects', scope.model?.persistentProfileAuthority === 'central_pep_uow_personal' && scope.model?.preferenceEffectsLocalApplicationOnly === true && inventory.networkChannels?.length === 0 && inventory.operatingSystemWrites?.length === 0);
check('optimistic idempotent persistence is required', scope.model?.idempotentOptimisticRevision === true && inventory.surfaces?.some((item) => item.id === 'migration-90') && inventory.surfaces?.some((item) => item.id === 'central-pep-uow'));
check('five-layer targeted evidence is declared', scope.validation?.targetedTests?.length === 5 && inventory.surfaces?.some((item) => item.id === 'runtime-tests' && item.paths?.length === 5));
check('decision covers all thirteen binding controls', requirements.every((id) => decision.includes(id === 'B7-01' ? 'B7-01…B7-13' : 'B7-01…B7-13')) && decision.includes('44 px') && decision.includes('forced-colors'));
check('threat model covers corrupt preference and hidden information', threat.includes('Bozuk veya değiştirilmiş tercih') && threat.includes('bilgi veya yetkili eylem saklar'));
check('threat model covers non-color, keyboard and local-only boundaries', threat.includes('Renk tek başına') && threat.toLocaleLowerCase('tr-TR').includes('klavye') && threat.includes('İşletim sistemi yazma ve ağ kanalı yoktur'));
check('manual certification is truthfully excluded', [decision, threat, audit, ...scope.excludedClaims].join('\n').includes('Narrator') && [decision, threat, audit, ...scope.excludedClaims].join('\n').includes('Magnifier') && [decision, threat, audit, ...scope.excludedClaims].join('\n').includes('UAT'));
check('audit truthfully matches activation or validated receipt-pending state', activationState
  ? audit.includes('IN_PROGRESS / FAIL-CLOSED') && audit.includes('Henüz üst kapanış yapılmamıştır')
  : (audit.includes('VALIDATED / RECEIPT_PENDING') || audit.includes('COMPLETED / PASS')) && audit.includes('Windows Narrator: NOT_RUN'));

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '33-M', decision: 'DEC-224', requirements, status: failures.length ? 'FAIL' : 'PASS', checksPassed: checks.length - failures.length, checksFailed: failures.length, checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(resolve(root, output)), { recursive: true });
await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`33-M accessibility contract: ${report.status} (${report.checksPassed}/${checks.length}).`);
if (failures.length) process.exitCode = 1;
