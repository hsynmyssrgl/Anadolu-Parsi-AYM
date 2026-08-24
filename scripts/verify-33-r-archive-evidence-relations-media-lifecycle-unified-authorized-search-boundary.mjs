import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);

const noWrite = process.argv.includes('--no-write');
const output = 'artifacts/validation/33-R-archive-evidence-relations-media-lifecycle-unified-authorized-search-boundary.json';
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const readText = async (path) => readFile(resolve(root, path), 'utf8');
const hasAll = (source, markers) => markers.every((marker) => source.includes(marker));

const [scope, inventory, registry, roadmap, plan, ledger, domainEvidence, domainSearch,
  evidenceUseCases, searchUseCase, repository, dataStore, ipcPolicy, renderer] = await Promise.all([
  readJson('config/33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-scope.json'),
  readJson('config/33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readText('packages/domain/src/archive-evidence-media.ts'),
  readText('packages/domain/src/unified-authorized-search.ts'),
  readText('packages/application/src/archive-evidence-media-use-cases.ts'),
  readText('packages/application/src/unified-authorized-search-use-cases.ts'),
  readText('packages/repositories/src/archive-repository.ts'),
  readText('apps/desktop/src/main/data-store.ts'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/renderer/App.tsx')
]);

const requirements = ['B3-01', 'B3-03', 'B3-05'];
const roadmapItem = roadmap.packages?.find((item) => item.step === '33-R');
const registryItems = requirements.map((id) => registry.requirements?.find((item) => item.id === id));
const manualNotRun = Object.entries(scope.manualEvidence ?? {})
  .filter(([key]) => key !== 'certificationClaimed')
  .every(([, value]) => value === 'NOT_RUN');

const definitions = [
  ['scope and inventory identities are exact', scope.step === '33-R' && scope.decision === 'DEC-229'
    && JSON.stringify(scope.requirements) === JSON.stringify(requirements)
    && inventory.step === '33-R' && inventory.decision === 'DEC-229'],
  ['roadmap keeps 33-R planned behind 33-Q', roadmapItem?.status === 'PLANNED'
    && JSON.stringify(roadmapItem.dependsOn) === JSON.stringify(['33-Q'])
    && JSON.stringify(roadmapItem.requirementIds) === JSON.stringify(requirements)],
  ['registry plan and ledger remain intentionally open', registryItems.every((item) => item && item.status !== 'COMPLETE' && item.chain?.evidence === false)
    && plan.currentStep === '33-P' && ledger.activeMicroStep === '33-P'
    && scope.registrySemantics?.registryMutationPerformedByStarter === false],
  ['domain binds evidence confidence status history and version input', hasAll(domainEvidence,
    ['ArchiveRelationEvidenceConfidence', 'ArchiveRelationEvidenceHistoryView', 'evidence_create', 'evidence_remove', 'AddArchiveItemVersionInput'])],
  ['unified search domain is bounded and covers six modules', hasAll(domainSearch,
    ['UNIFIED_AUTHORIZED_SEARCH_MODULES', "'family'", "'event'", "'archive'", "'finance'", "'health'", "'life'",
      'UNIFIED_AUTHORIZED_SEARCH_MAX_QUERY_CHARACTERS = 80', 'UNIFIED_AUTHORIZED_SEARCH_MAX_RESULTS = 25'])],
  ['application implements evidence and media mutations', hasAll(evidenceUseCases,
    ['ListArchiveRelationEvidenceUseCase', 'AddArchiveRelationEvidenceUseCase', 'RemoveArchiveRelationEvidenceUseCase', 'AddArchiveItemVersionUseCase'])],
  ['application unified search uses authorized source port', hasAll(searchUseCase,
    ['UnifiedAuthorizedSearchSourcePort', 'SearchUnifiedAuthorizedRecordsUseCase', 'queryEchoed: false'])],
  ['repository keeps exact evidence current and immutable history operations', hasAll(repository,
    ['listRelationEvidenceHistory', 'insertRelationEvidence', 'removeRelationEvidence', "status='removed'", 'evidenceStateFingerprint'])],
  ['DataStore composes all five archive operations and unified search', hasAll(dataStore,
    ['ListArchiveRelationEvidenceUseCase', 'AddArchiveRelationEvidenceUseCase', 'RemoveArchiveRelationEvidenceUseCase',
      'AddArchiveItemVersionUseCase', 'SearchUnifiedAuthorizedRecordsUseCase'])],
  ['IPC has five archive channels and one unified search channel', hasAll(ipcPolicy,
    ["'archive:listRelationEvidence'", "'archive:listRelationEvidenceHistory'", "'archive:addRelationEvidence'",
      "'archive:removeRelationEvidence'", "'archive:addVersion'", "'unifiedSearch:search'"])],
  ['renderer discloses immutable history and no filesystem authority', hasAll(renderer,
    ['Kaldırma işlemi önceki kopyaları kendiliğinden yok etmez', 'Hesap, sahip ve dosya konumu gibi özel bilgiler bu ekrana aktarılmaz', 'politika filtreli ve tam kaynak yanıtı'])],
  ['truth and manual evidence remain fail honest', scope.truth?.requirementsClosed === false
    && scope.truth?.countsAsRequirementPass === false && inventory.countsAsRequirementPass === false
    && manualNotRun && scope.manualEvidence?.certificationClaimed === false && scope.persistentReceiptStatus === 'NOT_RUN']
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  step: '33-R',
  decision: 'DEC-229',
  status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED',
  localImplementationStatus: scope.localImplementationStatus,
  countsAsRequirementPass: false,
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
  console.error(`33-R boundary: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(failure.name);
  process.exit(1);
}
console.log(`33-R boundary: PASS (${checks.length}/${checks.length}).`);
