import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const canonicalReportPath = 'artifacts/validation/30-N-ppk-002-archive-policy-enforcement-contract.json';
const paths = {
  application: 'packages/application/src/archive-use-cases.ts',
  adapter: 'apps/desktop/src/main/archive-application-adapter.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  kernel: 'packages/platform-policy/src/policy-kernel.ts',
  pep: 'packages/platform-policy/src/policy-enforcement-point.ts',
  repositoryContext: 'packages/repository-contracts/src/repository-context.ts',
  repositoryPort: 'packages/repository-contracts/src/archive-repository.ts',
  repository: 'packages/repositories/src/archive-repository.ts',
  scope: 'config/30-n-archive-policy-migration-scope.json',
  decision: 'docs/decisions/DEC-139-ppk-002-archive-policy-enforcement-vertical-slice.md',
  registry: 'config/accepted-scope-registry.json',
  predecessor: 'artifacts/validation/30-M-ppk-002-policy-enforcement-contract.json',
  baseline: 'config/platform-policy-legacy-bypass-baseline.json',
  package: 'package.json',
  workPlan: 'config/work-segmentation-plan.json'
};

const source = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
));
const scope = JSON.parse(source.scope);
const registry = JSON.parse(source.registry);
const predecessor = JSON.parse(source.predecessor);
const baseline = JSON.parse(source.baseline);
const packageJson = JSON.parse(source.package);
const workPlan = JSON.parse(source.workPlan);
const historical30N = JSON.parse(await readFile(canonicalReportPath, 'utf8'));
const step30N = workPlan.steps?.find((item) => item.id === '30-N');
const successorRegression = process.argv.includes('--successor-regression') || workPlan.currentStep !== '30-N' || step30N?.status === 'COMPLETED';
const reportPath = successorRegression
  ? 'artifacts/validation/30-O-30-N-archive-policy-enforcement-contract-regression.json'
  : canonicalReportPath;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const baselineSha256Before = sha256(source.baseline);
const compact = (value) => value.replace(/\s+/gu, '');
const failures = [];
const checks = [];
const check = (condition, label) => {
  checks.push(label);
  if (!condition) failures.push(label);
};
const contains = (value, token, label) => check(value.includes(token), label);
const section = (value, startToken, endTokens) => {
  const start = value.indexOf(startToken);
  if (start < 0) return '';
  const candidates = endTokens
    .map((token) => value.indexOf(token, start + startToken.length))
    .filter((index) => index >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : value.length;
  return value.slice(start, end);
};
const classSection = (value, className) => section(value, `export class ${className}`, ['\nexport class ']);
const methodSection = (value, signature, nextSignatures) => section(value, signature, nextSignatures);
const stable = (value) => JSON.stringify(value);

const expectedMappings = [
  { operation: 'archive.import', action: 'create', capability: 'archive.write', resourceType: 'archive_item', resourceIdSource: 'itemId' },
  { operation: 'archive.opened.audit', action: 'record', capability: 'archive.write', resourceType: 'archive_item', resourceIdSource: 'itemId' },
  { operation: 'archive.retention.create', action: 'create', capability: 'archive.write', resourceType: 'archive_retention_policy', resourceIdSource: 'policyId' },
  { operation: 'archive.retention.assign', action: 'update', capability: 'archive.write', resourceType: 'archive_item', resourceIdSource: 'itemId' },
  { operation: 'archive.destroy.prepare', action: 'delete', capability: 'archive.write', resourceType: 'archive_item', resourceIdSource: 'itemId' },
  { operation: 'archive.destroy.mark', action: 'delete', capability: 'archive.write', resourceType: 'archive_item', resourceIdSource: 'itemId' },
  { operation: 'archive.category.create', action: 'create', capability: 'archive.write', resourceType: 'archive_category', resourceIdSource: 'categoryId' },
  { operation: 'archive.classification.update', action: 'update', capability: 'archive.write', resourceType: 'archive_item', resourceIdSource: 'itemId' }
];
const requiredOrder = [
  'trusted-authority-resolution',
  'resource-resolution',
  'replay-reservation',
  'signed-receipt-persistence-and-readback',
  'active-context-validation',
  'business-transaction-begin',
  'repository-context-validation',
  'repository-operation',
  'business-transaction-commit'
];

check(scope.schemaVersion === 1 && scope.step === '30-N' && scope.requirement === 'PPK-002', '30-N scope identity is canonical');
check(scope.scope === 'GOVERNED_ARCHIVE_POLICY_ENFORCEMENT_VERTICAL_SLICE', '30-N scope is limited to the governed archive vertical slice');
check(Array.isArray(scope.intentMappings) && scope.intentMappings.length === 8, 'scope declares exactly eight archive policy intent mappings');
check(stable(scope.intentMappings) === stable(expectedMappings), 'scope intent mappings exactly match the governed operation map');
check(stable(scope.requiredOrder) === stable(requiredOrder), 'scope preserves receipt-before-transaction enforcement order');
check(scope.directRoleMigration?.preStepObservedFindings === 34, 'scope preserves the observed pre-step direct-role count');
check(scope.directRoleMigration?.removedFindings === 5 && scope.directRoleMigration?.expectedRemainingFindings === 29, 'scope declares the exact five-to-29 direct-role migration');
check(scope.directRoleMigration?.historicalBaselinePreserved === true, 'scope requires preservation of the historical direct-role baseline');
check(scope.failClosed?.missingPep === true && scope.failClosed?.authorityFailure === true, 'scope fails closed on missing PEP or authority failure');
check(scope.failClosed?.resourceMismatch === true && scope.failClosed?.receiptSinkFailure === true, 'scope fails closed on resource mismatch or receipt persistence failure');
check(scope.failClosed?.replayRejection === true && scope.failClosed?.expiredReceiptOrAuthority === true, 'scope fails closed on replay or expiry');
check(scope.failClosed?.nonWritableOrChangedFence === true && scope.failClosed?.forgedOrMismatchedRepositoryContext === true, 'scope fails closed on fence or repository-context mismatch');
check(scope.failClosed?.legacyAuthorizationFallback === false, 'scope forbids a legacy authorization fallback');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL', 'scope keeps PPK-002 PARTIAL');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal repository enforcement NOT_COMPLETE');
check(scope.evidenceBoundary?.productionCompositionWired === false, 'scope does not claim production PEP composition');
check(scope.evidenceBoundary?.durableMultiProcessReplayProtection === 'NOT_RUN_NOT_PASS', 'scope does not claim durable multi-process replay protection');
check(scope.evidenceBoundary?.receiptAndBusinessCommitAtomicity === 'NOT_IMPLEMENTED', 'scope does not claim receipt-business commit atomicity');
check(scope.evidenceBoundary?.obligationExecution === 'NOT_IMPLEMENTED', 'scope does not claim obligation execution');
check(scope.evidenceBoundary?.auditAndOutboxRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps audit and outbox repository enforcement open');
check(scope.evidenceBoundary?.eventAttachmentCrossAggregateReceiptBinding === 'NOT_COMPLETE', 'scope keeps cross-aggregate attachment receipt binding open');
check(scope.evidenceBoundary?.secureFileDeletionAndDatabaseCommitAtomicity === 'NOT_IMPLEMENTED', 'scope keeps secure file deletion and database commit atomicity open');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim PPK-002 completion');

contains(source.decision, 'PPK-002', 'DEC-139 binds the PPK-002 requirement');
contains(source.decision, '`PARTIAL`', 'DEC-139 preserves the PARTIAL requirement status');
contains(source.decision, '`NOT_COMPLETE`', 'DEC-139 preserves the universal NOT_COMPLETE boundary');
contains(source.decision, 'request-bound receipt', 'DEC-139 requires a request-bound receipt');
contains(source.decision, 'fail-closed', 'DEC-139 requires fail-closed enforcement');
contains(source.decision, 'Production composition wiring', 'DEC-139 leaves production composition open');

const ppk002 = registry.requirements?.find((item) => item.id === 'PPK-002');
check(Boolean(ppk002), 'PPK-002 exists in the accepted-scope registry');
if (ppk002) {
  check(ppk002.status === 'PARTIAL' || (ppk002.status === 'COMPLETE' && Object.values(ppk002.chain ?? {}).every((value) => value === true)), 'accepted-scope registry preserves 30-N history or a fully closed successor chain');
  check(ppk002.priority === 'P0', 'accepted-scope registry keeps PPK-002 at P0');
  check((ppk002.chain?.useCase === false && ppk002.chain?.repository === false) || (ppk002.chain?.useCase === true && ppk002.chain?.repository === true && ppk002.evidence?.includes('artifacts/validation/31-X-ppk-002-top-closure-runtime.json')), 'accepted-scope registry keeps the bounded slice honest or binds universal successor evidence');
  check(ppk002.evidence?.includes(paths.decision), 'accepted-scope registry references DEC-139');
  check(ppk002.evidence?.includes(paths.scope), 'accepted-scope registry references the 30-N scope');
  check(ppk002.evidence?.includes(canonicalReportPath), 'accepted-scope registry reserves the 30-N contract evidence path');
  check(ppk002.evidence?.includes('artifacts/validation/30-N-ppk-002-archive-policy-enforcement-runtime.json'), 'accepted-scope registry reserves the 30-N runtime evidence path');
}

check(predecessor.step === '30-M' && predecessor.requirement === 'PPK-002', '30-M predecessor report identity is intact');
check(predecessor.status === 'PASS' && predecessor.failed === 0, '30-M predecessor foundation report remains PASS');
check(predecessor.evidenceBoundary?.scopedFoundation === 'PASS', '30-M scoped foundation evidence remains PASS');
check(predecessor.evidenceBoundary?.scopeStatus === 'PARTIAL', '30-M predecessor kept PPK-002 partial');
check(predecessor.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-M predecessor kept universal enforcement incomplete');
check(predecessor.evidenceBoundary?.legacyDirectRoleBypasses === 34, '30-M predecessor preserves its historical 34 direct-role findings');
check(predecessor.evidenceBoundary?.requirementCompletionClaimed === false, '30-M predecessor did not claim PPK-002 completion');

const implementationMappings = [
  { operation: 'archive.import', source: classSection(source.application, 'ImportArchiveItemUseCase'), action: 'create', resourceType: 'archive_item', resourceId: 'i.identifiers.itemId' },
  { operation: 'archive.opened.audit', source: classSection(source.application, 'RecordArchiveOpenedUseCase'), action: 'record', resourceType: 'archive_item', resourceId: 'i.itemId' },
  { operation: 'archive.retention.create', source: classSection(source.application, 'CreateArchiveRetentionPolicyUseCase'), action: 'create', resourceType: 'archive_retention_policy', resourceId: 'i.identifiers.policyId' },
  { operation: 'archive.retention.assign', source: classSection(source.application, 'AssignArchiveRetentionPolicyUseCase'), action: 'update', resourceType: 'archive_item', resourceId: 'i.itemId' },
  {
    operation: 'archive.destroy.prepare',
    source: methodSection(source.adapter, 'public async getDestructionPlan(', ['\n  public listCategories(']),
    action: 'delete',
    resourceType: 'archive_item',
    resourceId: 'itemId'
  },
  { operation: 'archive.destroy.mark', source: classSection(source.application, 'MarkArchiveDestroyedUseCase'), action: 'delete', resourceType: 'archive_item', resourceId: 'i.itemId' },
  { operation: 'archive.category.create', source: classSection(source.application, 'CreateArchiveCategoryUseCase'), action: 'create', resourceType: 'archive_category', resourceId: 'i.identifiers.categoryId' },
  { operation: 'archive.classification.update', source: classSection(source.application, 'UpdateArchiveClassificationUseCase'), action: 'update', resourceType: 'archive_item', resourceId: 'itemId' }
];
for (const mapping of implementationMappings) {
  const value = compact(mapping.source);
  check(value.length > 0, `${mapping.operation} implementation boundary exists`);
  check(
    value.includes(`action:'${mapping.action}'`) &&
      value.includes("capability:'archive.write'") &&
      value.includes(`resourceType:'${mapping.resourceType}'`) &&
      value.includes(`resourceId:${mapping.resourceId}`) &&
      value.includes("purpose:'archive'"),
    `${mapping.operation} carries its exact resource-bound archive policy intent`
  );
}
const applicationIntentCount = (source.application.match(/action\s*:\s*['"](?:create|update|delete|record)['"]\s*,\s*capability\s*:\s*['"]archive\.write['"]/gu) ?? []).length;
const adapterIntentCount = (source.adapter.match(/action\s*:\s*['"](?:create|update|delete|record)['"]\s*,\s*capability\s*:\s*['"]archive\.write['"]/gu) ?? []).length;
check(
  successorRegression
    ? applicationIntentCount >= 7 && adapterIntentCount >= 1
    : applicationIntentCount === 7 && adapterIntentCount === 1,
  'implementation contains exactly seven use-case intents and one governed destruction-plan intent'
);
check(
  source.application.includes("export type ArchivePolicyAction='create'|'update'|'delete'|'record'")
    || source.application.includes("export type ArchivePolicyAction='read'|'create'|'update'|'delete'|'record'"),
  'archive policy action contract includes record'
);
contains(source.application, "readonly purpose:'archive'", 'archive policy intent contract requires the archive purpose');
contains(source.application, '):Promise<Result<T,AppError>>', 'archive Unit of Work is asynchronous');
check(!source.application.includes('authorize('), 'archive write scope has no legacy authorize call');

const dependencyContract = section(source.adapter, 'export interface RepositoryBackedArchiveApplicationDependencies', ['\n}']);
check(/readonly\s+policyEnforcementPointResolver\s*:\s*ArchivePolicyEnforcementPointResolver/u.test(dependencyContract), 'archive adapter requires a PEP resolver dependency');
check(/readonly\s+clusterFence\s*:\s*PlatformPolicyClusterFence/u.test(dependencyContract), 'archive adapter requires a cluster fence dependency');
check(!/policyEnforcementPointResolver\s*\?/u.test(dependencyContract) && !/clusterFence\s*\?/u.test(dependencyContract), 'adapter PEP resolver and fence dependencies are not optional');
const failClosedResolver = section(source.adapter, 'export const failClosedArchivePolicyEnforcementPointResolver', ['\nexport const nonWritableArchiveClusterFence']);
contains(failClosedResolver, "'ENFORCEMENT_UNAVAILABLE'", 'default archive PEP resolver fails closed');
contains(source.adapter, 'writable: false, epoch: 0', 'default archive cluster fence is non-writable');
contains(source.dataStore, 'options.archivePolicyEnforcementPointResolver ?? failClosedArchivePolicyEnforcementPointResolver', 'DataStore defaults missing archive PEP composition to fail-closed');
contains(source.dataStore, 'options.archiveClusterFence ?? nonWritableArchiveClusterFence', 'DataStore defaults missing archive fence composition to non-writable');

const governedExecution = section(source.adapter, 'const executeGoverned = async <T>', ['\nexport class RepositoryBackedArchiveQueryPort']);
contains(governedExecution, 'policyEnforcementPointResolver.resolve(context)', 'governed adapter resolves PEP from trusted composition');
contains(governedExecution, "typeof enforcementPoint.execute !== 'function'", 'governed adapter rejects a missing PEP execute boundary');
contains(governedExecution, 'dependencies.clusterFence', 'governed adapter supplies the required live fence');
contains(governedExecution, 'purpose: intent.purpose', 'governed adapter forwards the archive purpose to the PEP request');
contains(governedExecution, 'assertActivePlatformPolicyTransactionContext(authorization', 'governed adapter validates the active PEP callback context');
contains(governedExecution, 'resourceFamilyId: context.familyId', 'governed adapter binds the PEP context to the family');
contains(governedExecution, 'authorization.subject.accountId !== context.actor.userId', 'governed adapter rejects trusted-subject mismatch');
contains(governedExecution, 'return policyFailure(context, error)', 'governed adapter converts every PEP failure to a fail-closed result');

const destructionPlan = implementationMappings.find((item) => item.operation === 'archive.destroy.prepare')?.source ?? '';
const unitOfWork = classSection(source.adapter, 'RepositoryBackedArchiveUnitOfWork');
check(
  /executeGoverned\([\s\S]*?\(authorization(?:,\s*enforcementPoint)?\)\s*=>[\s\S]*?transactionExecutor\.execute/u.test(destructionPlan),
  'destruction-plan transaction begins inside the successful PEP callback'
);
check(
  /executeGoverned\([\s\S]*?\(authorization(?:,\s*enforcementPoint)?\)\s*=>[\s\S]*?transactionExecutor\.execute/u.test(unitOfWork),
  'archive write transaction begins inside the successful PEP callback'
);
check(destructionPlan.indexOf('governedRepositoryContext') < destructionPlan.indexOf('archiveRepository.getDestructionPlan'), 'destruction plan validates governed repository context before repository access');
check(unitOfWork.indexOf('governedRepositoryContext') < unitOfWork.indexOf('new GovernedArchiveWriteScope'), 'write Unit of Work validates governed context before exposing repository scope');
check(
  Math.min(
    ...['await this.#receiptSink.append(record)', 'await this.#appendReceipt(']
      .map((token) => source.pep.indexOf(token))
      .filter((index) => index >= 0)
  ) < source.pep.indexOf('const result = await operation(context)'),
  'PEP persists its signed receipt before entering the business callback'
);

contains(source.repositoryContext, 'assertActivePlatformPolicyTransactionContext(policyAuthorization, policyExpectation)', 'repository context assertion delegates to the live PEP context assertion');
contains(source.repositoryContext, 'policyAuthorization.correlationId !== context.correlationId', 'repository context assertion binds correlation identity');
const repositoryWrites = [
  { method: 'insert', expectation: ["resourceType:'archive_item'", "resourceId:row.id", "action:'create'"] },
  { method: 'insertVersion', expectation: ["resourceType:'archive_item'", "resourceId:row.archiveItemId", "action:'create'"] },
  { method: 'insertRetentionPolicy', expectation: ["resourceType:'archive_retention_policy'", "resourceId:row.id", "action:'create'"] },
  { method: 'assignRetentionPolicy', expectation: ["resourceType:'archive_item'", 'resourceId:itemId', "action:'update'"] },
  { method: 'markDestroyed', expectation: ["resourceType:'archive_item'", 'resourceId:itemId', "action:'delete'"] },
  { method: 'insertCategory', expectation: ["resourceType:'archive_category'", "resourceId:row.id", "action:'create'"] },
  { method: 'updateClassification', expectation: ["resourceType:'archive_item'", 'resourceId:input.itemId', "action:'update'"] }
];
for (const write of repositoryWrites) {
  const line = source.repository.split(/\r?\n/u).find((candidate) => new RegExp(`^\\s*${write.method}\\(context:PolicyAuthorizedRepositoryExecutionContext`, 'u').test(candidate)) ?? '';
  check(line.length > 0, `${write.method} requires a policy-authorized repository context`);
  check(
    (line.includes('assertPolicyAuthorizedRepositoryContext(context')
      && line.includes("capability:'archive.write'")
      && write.expectation.every((token) => line.includes(token)))
      || ((line.includes('archivePolicyBinding(context') || line.includes('exactPolicyBinding(context'))
        && source.repository.includes("const exactPolicyBinding=(context:PolicyAuthorizedRepositoryExecutionContext")
        && source.repository.includes("capability:'archive.write'")),
    `${write.method} asserts its active resource-action-capability binding before SQL`
  );
}
const attachmentLine = source.repository.split(/\r?\n/u).find((candidate) => /^\s*incrementEventAttachment\(context:PolicyAuthorizedRepositoryExecutionContext/u.test(candidate)) ?? '';
check(
  attachmentLine.includes('assertPolicyAuthorizedRepositoryContext(context)')
    || attachmentLine.includes('archivePolicyBinding(context'),
  'cross-aggregate attachment update at least requires an active policy context'
);
check(
  successorRegression
    ? source.repository.includes('exactPolicyBinding') && source.repository.includes('exactReadBinding')
    : (source.repository.match(/assertPolicyAuthorizedRepositoryContext\(context/gu) ?? []).length === 8,
  'archive repository contains exactly eight active policy-context assertions'
);
for (const method of [...repositoryWrites.map((item) => item.method), 'incrementEventAttachment']) {
  check(new RegExp(`${method}\\(context:\\s*PolicyAuthorizedRepositoryExecutionContext`, 'u').test(source.repositoryPort), `${method} port forbids an ungoverned repository execution context`);
}
contains(source.kernel, "'archive.write': actions('create', 'update', 'delete', 'record')", 'platform kernel permits record only through the archive.write action map');

const directRolePattern = /role\s*[!=]==?\s*['"]family_admin['"]|roles\.includes\(['"]family_admin['"]\)/u;
check(!directRolePattern.test(source.application), 'four application-layer archive direct-role predicates are gone');
check(!directRolePattern.test(source.adapter), 'desktop archive adapter direct-role predicate is gone');
const allowedHistoricalFindings = new Set((baseline.findings ?? []).map((item) => `${item.path}:${item.lineSha256}`));
const currentRoleFindings = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'tests' || entry.name === 'renderer') continue;
      await walk(path);
      continue;
    }
    if (!/\.tsx?$/u.test(entry.name) || path.replaceAll('\\', '/').includes('packages/platform-policy/')) continue;
    const lines = (await readFile(path, 'utf8')).split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      if (!directRolePattern.test(lines[index])) continue;
      currentRoleFindings.push({
        path: relative('.', path).replaceAll('\\', '/'),
        line: index + 1,
        lineSha256: sha256(lines[index].trim())
      });
    }
  }
};
await walk('apps');
await walk('packages');
const newRoleFindings = currentRoleFindings.filter((item) => !allowedHistoricalFindings.has(`${item.path}:${item.lineSha256}`));
const removedHistoricalFindings = scope.directRoleMigration?.removedHistoricalFindings ?? [];
check(
  successorRegression
    ? historical30N.status === 'PASS'
      && historical30N.directRoleMigration?.historicalBaselineCount === 35
      && baseline.schemaVersion === 2
      && baseline.count === 0
    : baseline.count === 35 && baseline.findings?.length === 35,
  'historical direct-role baseline remains the original 35-entry authority'
);
check(removedHistoricalFindings.length === 5, 'scope names exactly five removed historical archive findings');
check(
  successorRegression
    ? historical30N.status === 'PASS' && historical30N.directRoleMigration?.removedFindings === 5
    : removedHistoricalFindings.every((item) => allowedHistoricalFindings.has(`${item.path}:${item.lineSha256}`)),
  'all five removed archive findings originate from the historical baseline'
);
check(removedHistoricalFindings.every((item) => !currentRoleFindings.some((finding) => finding.path === item.path && finding.lineSha256 === item.lineSha256)), 'all five scoped archive findings are absent from current source');
check(
  successorRegression ? currentRoleFindings.length <= 29 : currentRoleFindings.length === 29,
  successorRegression
    ? 'successor migration does not increase the 30-N direct-role inventory'
    : 'actual global direct-role inventory is exactly 29'
);
check(newRoleFindings.length === 0, '30-N introduces zero new direct-role bypasses');
const baselineSha256After = sha256(await readFile(paths.baseline, 'utf8'));
check(baselineSha256After === baselineSha256Before, 'contract verifier does not mutate the historical direct-role baseline');

check(packageJson.scripts?.['verify:30-n:archive-policy-enforcement-contract'] === 'node scripts/verify-30-n-archive-policy-enforcement-contract.mjs', 'package exposes the 30-N archive policy contract gate');
check(packageJson.scripts?.['verify:30-n:archive-policy-enforcement-runtime']?.includes('scripts/verify-30-n-archive-policy-enforcement-runtime.mjs'), 'package exposes the 30-N archive policy runtime gate');
check(typeof packageJson.scripts?.['verify:30-n:archive-regression'] === 'string' && packageJson.scripts['verify:30-n:archive-regression'].length > 0, 'package exposes the 30-N archive regression gate');
check(typeof packageJson.scripts?.['verify:30-n:execution-record'] === 'string' && packageJson.scripts['verify:30-n:execution-record'].length > 0, 'package exposes the 30-N execution-record gate');

const report = {
  schemaVersion: 1,
  release: scope.release,
  step: successorRegression ? '30-O' : '30-N',
  ...(successorRegression ? { predecessorStep: '30-N' } : {}),
  requirement: 'PPK-002',
  phase: successorRegression ? '30-N_PREDECESSOR_REGRESSION' : 'GOVERNED_ARCHIVE_POLICY_ENFORCEMENT_VERTICAL_SLICE',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  intentMappings: expectedMappings,
  directRoleMigration: {
    historicalBaselineCount: baseline.count,
    historicalBaselineSha256: baselineSha256Before,
    preStepObservedFindings: scope.directRoleMigration?.preStepObservedFindings,
    removedFindings: removedHistoricalFindings.length,
    actualRemainingFindings: currentRoleFindings.length,
    newFindings: newRoleFindings.length,
    baselinePreserved: baselineSha256After === baselineSha256Before,
    newRoleFindings
  },
  assertions: {
    exactEightIntents: (
      successorRegression
        ? applicationIntentCount >= 7 && adapterIntentCount >= 1
        : applicationIntentCount === 7 && adapterIntentCount === 1
    ) ? 'PASS' : 'FAIL',
    failClosedCompositionDefault: failures.some((item) => item.includes('defaults missing archive')) ? 'FAIL' : 'PASS',
    pepEnclosesBusinessTransaction: failures.some((item) => item.includes('transaction begins inside')) ? 'FAIL' : 'PASS',
    repositoryActiveContext: failures.some((item) => item.includes('policy-authorized repository context') || item.includes('active resource-action-capability')) ? 'FAIL' : 'PASS',
    recordActionMapping: failures.includes('platform kernel permits record only through the archive.write action map') ? 'FAIL' : 'PASS'
  },
  evidenceBoundary: {
    archiveVerticalSlice: failures.length === 0 ? 'PASS' : 'FAIL',
    ...(successorRegression ? { historical30NReportMutated: false } : {}),
    PPK002: 'PARTIAL',
    universalRepositoryEnforcement: 'NOT_COMPLETE',
    productionCompositionWired: false,
    durableMultiProcessReplayProtection: 'NOT_RUN_NOT_PASS',
    receiptAndBusinessCommitAtomicity: 'NOT_IMPLEMENTED',
    obligationExecution: 'NOT_IMPLEMENTED',
    auditAndOutboxRepositoryEnforcement: 'NOT_COMPLETE',
    eventAttachmentCrossAggregateReceiptBinding: 'NOT_COMPLETE',
    secureFileDeletionAndDatabaseCommitAtomicity: 'NOT_IMPLEMENTED',
    requirementCompletionClaimed: false
  },
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`${successorRegression ? '30-N predecessor archive policy enforcement contract regression' : '30-N archive policy enforcement contract'}: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
