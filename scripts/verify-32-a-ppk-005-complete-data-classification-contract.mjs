import { mkdir, readFile, writeFile } from 'node:fs/promises';

const checks = [];
const failures = [];
const check = (name, condition, details = undefined) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  kernel: 'packages/platform-policy/src/policy-kernel.ts',
  enforcement: 'packages/platform-policy/src/policy-enforcement-point.ts',
  repositoryContext: 'packages/repository-contracts/src/repository-context.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  dispatcher: 'apps/core-service/src/core-service-method-dispatcher.ts',
  test: 'packages/platform-policy/policy-data-classification.test.ts',
  durableTest: 'apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts',
  universalApi: 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  decision: 'docs/decisions/DEC-186-ppk-005-complete-data-classification.md',
  audit: 'docs/audit/32-A_PPK-005_VERI_SINIFLANDIRMA_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-005');
const scope = JSON.parse(await readFile('config/32-a-ppk-005-complete-data-classification-scope.json', 'utf8'));
const dataClasses = [
  'general', 'personal', 'special', 'health', 'finance', 'child',
  'location', 'communication', 'biometric', 'legacy'
];

check('platform data-class domain type exists', sources.kernel.includes('export type PlatformDataClass'));
check('all ten accepted data classes are modeled', dataClasses.every((value) => sources.kernel.includes(`'${value}'`)), { classCount: dataClasses.length });
check('sensitivity level and data-class set are separate resource fields', sources.kernel.includes('readonly sensitivity: DataSensitivity') && sources.kernel.includes('readonly dataClasses?: readonly PlatformDataClass[]'));
check('classification authority distinguishes declared from policy default', sources.kernel.includes("export type PlatformDataClassificationSource = 'declared' | 'policy_default'"));
check('class normalization enforces non-empty unique supported values', sources.kernel.includes('export const normalizePlatformDataClasses') && sources.kernel.includes('new Set(values).size !== values.length'));
check('class normalization uses a stable canonical order', sources.kernel.includes('dataClassOrder') && sources.kernel.includes('sort((left, right)'));
check('legacy resolvers receive deterministic class inference', sources.kernel.includes('export const inferPlatformDataClasses') && dataClasses.slice(2).every((value) => sources.kernel.includes(`inferred.add('${value}')`)));
check('strict kernel requires classes and classification source', sources.kernel.includes('!Array.isArray(request.resource.dataClasses)') && sources.kernel.includes('validClassificationSources.has'));
check('non-canonical strict class sets fail request validation', sources.kernel.includes('stable(request.resource.dataClasses) !== stable(normalizePlatformDataClasses(request.resource.dataClasses))'));
check('domain-specific capability mismatch has a dedicated deny reason', sources.kernel.includes("'DATA_CLASS_CAPABILITY_MISMATCH'") && sources.kernel.includes('dataClassCapabilityCompatible'));
check('health, finance, location and communication capability boundaries are explicit', ['health', 'finance', 'location', 'communication'].every((value) => sources.kernel.includes(`dataClass === '${value}'`)));
check('data classes are included in the signed context snapshot', sources.kernel.includes('dataClasses: Object.freeze([...(request.resource.dataClasses ?? [])])'));
check('classification source is included in the signed context snapshot', sources.kernel.includes("classificationSource: request.resource.classificationSource ?? 'policy_default'"));
check('non-general special classes force high-detail audit', sources.kernel.includes("value !== 'general' && value !== 'personal'"));
check('child data forces no-AI and no-export obligations', sources.kernel.includes("dataClasses.includes('child')") && sources.kernel.includes("addObligation({ type: 'no_ai' })"));
check('biometric data forces local-only cache clipboard export and AI controls', sources.kernel.includes("dataClasses.includes('biometric')") && ['local_processing_only', 'no_cache', 'no_clipboard', 'no_export', 'no_ai'].every((value) => sources.kernel.includes(`type: '${value}'`)));
check('legacy data forces no-export obligation', sources.kernel.includes("dataClasses.includes('legacy')") && sources.kernel.includes("addObligation({ type: 'no_export' })"));
check('PEP distinguishes declared and policy-default classification', sources.enforcement.includes("classificationSource = 'declared'") && sources.enforcement.includes("classificationSource = 'policy_default'"));
check('PEP classifies before constructing the signed request', sources.enforcement.indexOf('inferPlatformDataClasses(intent.capability, resource.type)') < sources.enforcement.indexOf('const request: PlatformPolicyRequest'));
check('receipt record and active transaction carry exact classes', sources.enforcement.includes('readonly dataClasses: readonly PlatformDataClass[]') && sources.enforcement.includes('dataClasses: Object.freeze([...(effectiveRequest.resource.dataClasses ?? [])])'));
check('active context assertion binds request record and expected classes', sources.enforcement.includes('stable(context.dataClasses) !== stable(context.receiptRecord.request.resource.dataClasses)') && sources.enforcement.includes('stable(expected.dataClasses)'));
check('repository context forwards data-class expectations', sources.repositoryContext.includes('{ dataClasses: expectation.dataClasses }'));
check('repository persistence binding exposes data classes', sources.repository.includes('dataClasses: authorization.dataClasses'));
check('repository writes canonical data_classes_json beside the receipt', sources.repository.includes('context_hash,data_classes_json') && sources.repository.includes('JSON.stringify(record.dataClasses)'));
check('migration 70 is registered and adds the classification column', sources.migration.includes("createMigrationDefinition(70, 'ppk005_complete_data_classification'") && sources.migration.includes('ADD COLUMN data_classes_json TEXT'));
check('SQLite trigger validates all supported unique classes', sources.migration.includes('trg_ppk005_platform_policy_data_classes_insert') && dataClasses.every((value) => sources.migration.includes(`'${value}'`)));
check('SQLite trigger matches top-level and signed-request class sets', sources.migration.includes("$.dataClasses") && sources.migration.includes("$.request.resource.dataClasses"));
check('Core Service requires strict classified requests', sources.dispatcher.includes('Array.isArray(resource?.dataClasses)') && sources.dispatcher.includes('resource?.classificationSource'));
check('targeted and durable tests cover classes obligations inference and missing persistence', ['supports all ten accepted data classes', 'infers the %s class deterministically', 'applies no-AI and no-export controls to child data', 'combined child-health classification'].every((marker) => sources.test.includes(marker)) && sources.durableTest.includes('missing-classification'));
check('accepted scope, evidence, UI/menu confinement and no-cutover truth are closed', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true && sources.universalApi.includes('this.#enforcementPoint.execute') && sources.main.includes('universalApiPolicyEnforcement().execute') && sources.preload.includes("contextBridge.exposeInMainWorld('pardus'") && sources.decision.includes('DEC-171') && sources.audit.includes('Gerçek veri taşınmamıştır'));

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-A',
  requirement: 'PPK-005',
  phase: 'COMPLETE_DATA_CLASSIFICATION_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-A-ppk-005-complete-data-classification-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`32-A PPK-005 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-A PPK-005 contract: PASS (${checks.length}/${checks.length}).`);
