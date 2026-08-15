import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);

const noWrite = process.argv.includes('--no-write');
const output = 'artifacts/validation/33-S-health-care-coordination-elderly-support-ledger-boundary.json';
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const readText = async (path) => readFile(resolve(root, path), 'utf8');
const hasAll = (source, markers) => markers.every((marker) => source.includes(marker));

const [scope, inventory, registry, roadmap, plan, ledger, domain, application, repository, dataStore, ipc, panel] = await Promise.all([
  readJson('config/33-s-health-care-coordination-elderly-support-ledger-scope.json'),
  readJson('config/33-s-health-care-coordination-elderly-support-ledger-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readText('packages/domain/src/health-care-coordination.ts'),
  readText('packages/application/src/health-care-coordination-use-cases.ts'),
  readText('packages/repositories/src/health-repository.ts'),
  readText('apps/desktop/src/main/data-store.ts'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/renderer/HealthCareCoordinationPanel.tsx')
]);

const requirements = ['B5-01','B5-02','EXT-021','EXT-023','EXT-024','EXT-025','EXT-026','EXT-027','EXT-028','EXT-029'];
const roadmapItem = roadmap.packages?.find((item) => item.step === '33-S');
const registryItems = requirements.map((id) => registry.requirements?.find((item) => item.id === id));
const manualNotRun = Object.entries(scope.manualEvidence ?? {}).filter(([key]) => key !== 'certificationClaimed').every(([, value]) => value === 'NOT_RUN');

const definitions = [
  ['scope inventory and roadmap identities are exact', scope.step === '33-S' && scope.decision === 'DEC-230'
    && JSON.stringify(scope.requirements) === JSON.stringify(requirements)
    && JSON.stringify(inventory.requirements) === JSON.stringify(requirements)
    && roadmapItem?.status === 'PLANNED' && JSON.stringify(roadmapItem.dependsOn) === JSON.stringify(['33-O','33-N'])],
  ['registry plan and ledger remain intentionally open', registryItems.every((item) => item && item.status !== 'COMPLETE' && item.chain?.evidence === false)
    && plan.currentStep === '33-P' && ledger.activeMicroStep === '33-P'
    && scope.registrySemantics?.registryMutationPerformedByStarter === false],
  ['domain covers local care records scopes grants emergency summary and truth', hasAll(domain,
    ['HEALTH_CARE_ENTRY_KINDS', 'HEALTH_CARE_ACCESS_SCOPES', 'HealthCareAccessGrantView', 'HealthCareEmergencySummaryView', 'HealthCareCoordinationTruthView'])],
  ['application implements exact four governed use cases', hasAll(application,
    ['GetHealthCareCoordinationCenterUseCase', 'RecordHealthCareEntryUseCase', 'UpsertHealthCareAccessGrantUseCase', 'RevokeHealthCareAccessGrantUseCase'])],
  ['application uses minimum necessary grant without direct role authorization', hasAll(application,
    ['findActiveGrantForActor', "actions.includes('record')", 'allowedScopes.includes(accessScope)', 'authorizationRoleMatches'])
    && !application.includes("context.actor.role === 'family_admin'")],
  ['repository filters non-owner records through exact active grant scopes', hasAll(repository,
    ['Health care center has no active minimum-necessary caregiver grant', 'visibleScopes', "state='active'", 'json_each(?)'])],
  ['DataStore composes all four health coordination use cases', hasAll(dataStore,
    ['GetHealthCareCoordinationCenterUseCase', 'RecordHealthCareEntryUseCase', 'UpsertHealthCareAccessGrantUseCase', 'RevokeHealthCareAccessGrantUseCase'])],
  ['IPC exposes exact four channels with bounded safe results', hasAll(ipc,
    ["'healthCare:getCenter'", "'healthCare:recordEntry'", "'healthCare:upsertGrant'", "'healthCare:revokeGrant'", 'healthCareResult'])],
  ['renderer extends existing health screen and states local-only limits', hasAll(panel,
    ['Sağlık koordinasyonu ve yaşlı desteği', 'Tıbbi doğrulama veya sağlık kayıt sistemi sorgusu yapılmaz', 'Sensör, uzaktan yardım, acil servis araması', 'health-care-large-text'])],
  ['truth excludes medical sensor emergency and remote claims', scope.truth?.medicalVerificationPerformed === false
    && scope.truth?.externalHealthRegistryQueried === false && scope.truth?.sensorOrFallDetectorIntegrated === false
    && scope.truth?.emergencyServiceContacted === false && scope.truth?.remoteHelpDelivered === false],
  ['local tests cannot become requirement acceptance', scope.truth?.requirementsClosed === false
    && scope.truth?.countsAsRequirementPass === false && inventory.countsAsRequirementPass === false],
  ['manual evidence certification and persistent receipt remain closed', manualNotRun
    && scope.manualEvidence?.certificationClaimed === false && scope.persistentReceiptStatus === 'NOT_RUN']
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = {schemaVersion:1,step:'33-S',decision:'DEC-230',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if (!noWrite) { await mkdir(resolve(root, 'artifacts/validation'), {recursive:true}); await writeFile(resolve(root, output), `${JSON.stringify(report,null,2)}\n`, {flag:'w'}); }
if (failures.length) { console.error(`33-S boundary: FAIL (${failures.length}/${checks.length}).`); for (const failure of failures) console.error(failure.name); process.exit(1); }
console.log(`33-S boundary: PASS (${checks.length}/${checks.length}).`);
