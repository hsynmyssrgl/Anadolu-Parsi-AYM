import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';

export const FIXED_EXTERNAL_BASELINE_CHAIN_ROOT = resolve(
  'D:\\AYM_LIBRARY\\ParsYuva\\ParsYuva Aile Yasam Merkezi\\governance\\PR-235\\Bronze\\mutation-baseline-chain'
);
export const BOOTSTRAP_ADOPTION_BASE_COMMIT = '440d5c7a9fbbd840faef58d1e1ef2048f8a989b4';
const ZERO_SHA256 = '0'.repeat(64);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GIT_OBJECT_PATTERN = /^[a-f0-9]{40,64}$/u;
const RECORD_NAME_PATTERN = /^(\d{8})-([a-f0-9]{40,64})-(PRE_MUTATION|BOOTSTRAP_ADOPTION)\.json$/u;
const ALLOWED_REASON_CODES = new Set([
  'NO_MATCHING_CHANGED_PATH', 'COVERED_BY_EXISTING_CONTRACT', 'FRESH_INSTALLED_EXE_UAT_REQUIRED',
  'DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED'
]);
const CANONICAL_DEPENDENCY_REGISTRY_ID = 'PPT-CHANGE-IMPACT-DEPENDENCY-REGISTRY-V1';
export const CANONICAL_MUTATION_IMPACT_AREAS = Object.freeze([
  'mainSource', 'channelSources', 'canonicalRules', 'decisions', 'activeDocuments',
  'commercialRecords', 'workList', 'scopesInventoriesRatchets', 'manifestsIndexes',
  'masterDocumentation', 'ratchets', 'tests', 'uat'
]);
export const CANONICAL_UNIVERSAL_DEPENDENT_RECORDS = Object.freeze([
  'SHA256SUMS.txt',
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.csv',
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.json',
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.md',
  'docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md',
  'docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.docx',
  'docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.pdf',
  'docs/ticari-urun-temeli/00_TEMEL_SURUM_MANIFESTOSU.json',
  'docs/ticari-urun-temeli/01_YONETIM/05_DEGISIKLIK_SICILI.json',
  'docs/ticari-urun-temeli/05_KALITE_TEST_KANIT/04_TICARI_TEMEL_DOGRULAMA_KANITI.json',
  'docs/ticari-urun-temeli/08_IS_LISTESI/01_ANA_IS_LISTESI.md',
  'docs/ticari-urun-temeli/08_IS_LISTESI/03_ANA_IS_SICILI.json',
  'manifest.json'
]);
export const CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES = Object.freeze([
  'apps/desktop/tests/mutation-release-evidence-producers.test.ts',
  'apps/desktop/tests/mutation-release-readiness-contract.test.ts',
  'apps/desktop/tests/operation-rule-check-policy.test.ts'
]);
const CANONICAL_SAFETY_NET_RULE_ID = 'governed-source-safety-net';
const CANONICAL_SAFETY_NET_RECORDS = Object.freeze(['SHA256SUMS.txt', 'manifest.json']);
export const CANONICAL_CHANGE_IMPACT_COMMAND_MATRIX = Object.freeze({
  targetedVitest: Object.freeze({
    phase: 'targeted', mode: 'AFFECTED_EXACT_FILES', executable: 'node',
    argumentPrefix: Object.freeze(['node_modules/vitest/vitest.mjs', 'run']),
    fixedArguments: Object.freeze(['--maxWorkers=1', '--reporter=json']), nonMutating: true
  }),
  fullVitest: Object.freeze({
    phase: 'full', mode: 'UNFILTERED', executable: 'node',
    arguments: Object.freeze(['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', '--reporter=json']), nonMutating: true
  }),
  rootTypecheck: Object.freeze({
    phase: 'full', mode: 'ALWAYS', executable: 'node',
    arguments: Object.freeze(['node_modules/typescript/bin/tsc', '--noEmit']), nonMutating: true
  }),
  changedMjsSyntax: Object.freeze({
    phase: 'full', mode: 'EACH_CHANGED_SUFFIX', pathSuffix: '.mjs', executable: 'node',
    argumentPrefix: Object.freeze(['--check']), nonMutating: true
  }),
  changedPs1Parser: Object.freeze({
    phase: 'full', mode: 'EACH_CHANGED_SUFFIX', pathSuffix: '.ps1', executable: 'powershell.exe',
    arguments: Object.freeze([
      '-NoProfile', '-NonInteractive', '-Command',
      "& { param([string]$Target) $ErrorActionPreference='Stop'; $tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($Target,[ref]$tokens,[ref]$errors); if($errors.Count -ne 0){$errors | ForEach-Object { [Console]::Error.WriteLine($_.Message) }; exit 1} }",
      '{changedPath}'
    ]),
    nonMutating: true
  })
});
export const CANONICAL_AFFECTED_COMMAND_CATALOG = Object.freeze({
  dataStoreSmoke: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/run-data-store-smoke-regression.mjs', '--no-write']), nonMutating: true
  }),
  platformPolicyAstRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-32-q-ppk-021-platform-policy-ast-gate-runtime.mjs', '--no-write']), nonMutating: true
  }),
  ppk015NetworkEgressContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-32-k-ppk-015-network-egress-contract.mjs', '--no-write']), nonMutating: true
  }),
  ppk015NetworkEgressRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-32-k-ppk-015-network-egress-runtime.mjs', '--no-write']), nonMutating: true
  }),
  e2eeFileSharingRemainingBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-G', 'boundary', '--no-write']), nonMutating: true
  }),
  e2eeFileSharingRemainingContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-G', 'contract', '--no-write']), nonMutating: true
  }),
  e2eeFileSharingRemainingRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-G', 'runtime', '--no-write']), nonMutating: true
  }),
  communicationAuditArchiveBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-H', 'boundary', '--no-write']), nonMutating: true
  }),
  communicationAuditArchiveContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-H', 'contract', '--no-write']), nonMutating: true
  }),
  communicationAuditArchiveRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-H', 'runtime', '--no-write']), nonMutating: true
  }),
  distributedCoreConsensusTenancyBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-I', 'boundary', '--no-write']), nonMutating: true
  }),
  distributedCoreConsensusTenancyContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-I', 'contract', '--no-write']), nonMutating: true
  }),
  distributedCoreConsensusTenancyRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-I', 'runtime', '--no-write']), nonMutating: true
  }),
  distributedClientsOperationsDrBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-J', 'boundary', '--no-write']), nonMutating: true
  }),
  distributedClientsOperationsDrContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-J', 'contract', '--no-write']), nonMutating: true
  }),
  distributedClientsOperationsDrRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-J', 'runtime', '--no-write']), nonMutating: true
  }),
  windowsResilienceUniversalUxBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-K', 'boundary', '--no-write']), nonMutating: true
  }),
  windowsResilienceUniversalUxContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-K', 'contract', '--no-write']), nonMutating: true
  }),
  windowsResilienceUniversalUxRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-remaining-package-local-foundation.mjs', '34-K', 'runtime', '--no-write']), nonMutating: true
  }),
  ppk022CapabilityManifestContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-32-r-ppk-022-capability-manifest-gate-contract.mjs', '--no-write']), nonMutating: true
  }),
  localGovernedOcrBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-q-local-governed-ocr-derived-data-pipeline-boundary.mjs', '--no-write']), nonMutating: true
  }),
  localGovernedOcrContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-q-local-governed-ocr-derived-data-pipeline-contract.mjs', '--no-write']), nonMutating: true
  }),
  localGovernedOcrRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-q-local-governed-ocr-derived-data-pipeline-runtime.mjs', '--no-write']), nonMutating: true
  }),
  archiveEvidenceRelationsBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-boundary.mjs', '--no-write']), nonMutating: true
  }),
  archiveEvidenceRelationsContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-contract.mjs', '--no-write']), nonMutating: true
  }),
  archiveEvidenceRelationsRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-runtime.mjs', '--no-write']), nonMutating: true
  }),
  smartHomeEnergyBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-y-local-first-smart-home-energy-boundary.mjs', '--no-write']), nonMutating: true
  }),
  smartHomeEnergyContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-y-local-first-smart-home-energy-contract.mjs', '--no-write']), nonMutating: true
  }),
  smartHomeEnergyRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-y-local-first-smart-home-energy-runtime.mjs', '--no-write']), nonMutating: true
  }),
  signedPluginProviderBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-z-signed-plugin-external-provider-platform-boundary.mjs', '--no-write']), nonMutating: true
  }),
  signedPluginProviderContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-z-signed-plugin-external-provider-platform-contract.mjs', '--no-write']), nonMutating: true
  }),
  signedPluginProviderRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-33-z-signed-plugin-external-provider-platform-runtime.mjs', '--no-write']), nonMutating: true
  }),
  communicationPolicyMlsBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-a-communication-policy-mls-foundation-boundary.mjs', '--no-write']), nonMutating: true
  }),
  communicationPolicyMlsContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-a-communication-policy-mls-foundation-contract.mjs', '--no-write']), nonMutating: true
  }),
  communicationPolicyMlsRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-a-communication-policy-mls-foundation-runtime.mjs', '--no-write']), nonMutating: true
  }),
  communicationMessagingBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-b-communication-messaging-lifecycle-privacy-presence-boundary.mjs', '--no-write']), nonMutating: true
  }),
  communicationMessagingContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-b-communication-messaging-lifecycle-privacy-presence-contract.mjs', '--no-write']), nonMutating: true
  }),
  communicationMessagingRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-b-communication-messaging-lifecycle-privacy-presence-runtime.mjs', '--no-write']), nonMutating: true
  }),
  realtimeCallingBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-c-realtime-calling-media-accessible-ux-boundary.mjs', '--no-write']), nonMutating: true
  }),
  realtimeCallingContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-c-realtime-calling-media-accessible-ux-contract.mjs', '--no-write']), nonMutating: true
  }),
  realtimeCallingRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-c-realtime-calling-media-accessible-ux-runtime.mjs', '--no-write']), nonMutating: true
  }),
  recordingRetentionBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-d-explicit-consent-recording-media-retention-boundary.mjs', '--no-write']), nonMutating: true
  }),
  recordingRetentionContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-d-explicit-consent-recording-media-retention-contract.mjs', '--no-write']), nonMutating: true
  }),
  recordingRetentionRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-d-explicit-consent-recording-media-retention-runtime.mjs', '--no-write']), nonMutating: true
  }),
  familyMeetingsBoundary: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-f-family-meetings-decisions-consent-minutes-boundary.mjs', '--no-write']), nonMutating: true
  }),
  familyMeetingsContract: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-f-family-meetings-decisions-consent-minutes-contract.mjs', '--no-write']), nonMutating: true
  }),
  familyMeetingsRuntime: Object.freeze({
    phase: 'full', mode: 'EXACT_NODE_SCRIPT', executable: 'node',
    arguments: Object.freeze(['scripts/verify-34-f-family-meetings-decisions-consent-minutes-runtime.mjs', '--no-write']), nonMutating: true
  })
});
const fail = (message) => { throw new Error(message); };
export const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const portable = (value) => value.split(sep).join('/');
const exactJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const assertPortableRepositoryPath = (value, label) => {
  if (typeof value !== 'string' || value.length === 0 || isAbsolute(value) || value.includes('\\') || value.startsWith('/')) {
    fail(`${label} must be a portable repository-relative path.`);
  }
  if (value.split('/').some((segment) => !segment || segment === '.' || segment === '..')) fail(`${label} is unsafe.`);
  return value;
};

const sortedUniquePaths = (values, label) => {
  if (!Array.isArray(values)) fail(`${label} must be an array.`);
  const normalized = values.map((value) => assertPortableRepositoryPath(value, label));
  if (new Set(normalized).size !== normalized.length) fail(`${label} contains a duplicate path.`);
  return Object.freeze([...normalized].sort((a, b) => a.localeCompare(b, 'en')));
};

const sortedUniquePathPrefixes = (values, label) => {
  if (!Array.isArray(values)) fail(`${label} must be an array.`);
  const normalized = values.map((value) => {
    if (typeof value !== 'string' || value.length < 2
      || isAbsolute(value) || value.includes('\\') || value.startsWith('/')) fail(`${label} is unsafe.`);
    assertPortableRepositoryPath(value.endsWith('/') ? value.slice(0, -1) : value, label);
    return value;
  });
  if (new Set(normalized).size !== normalized.length) fail(`${label} contains a duplicate path prefix.`);
  return Object.freeze([...normalized].sort((a, b) => a.localeCompare(b, 'en')));
};

export const validateChangeImpactDependencyRegistry = (registry) => {
  if (registry?.schemaVersion !== 1 || registry.id !== CANONICAL_DEPENDENCY_REGISTRY_ID
    || registry.requirement !== 'PR-235' || registry.decision !== 'DEC-270'
    || registry.strengthenedByRequirement !== 'PR-240' || registry.strengthenedByDecision !== 'DEC-275'
    || registry.failClosed !== true || registry.unmatchedChangedPathEffect !== 'BLOCK'
    || !exactJson(registry.affectedCommandCatalog, CANONICAL_AFFECTED_COMMAND_CATALOG)
    || !exactJson(registry.commandMatrix, CANONICAL_CHANGE_IMPACT_COMMAND_MATRIX)) {
    fail('PR-235 change-impact dependency registry is invalid or weakened.');
  }
  const universalRecords = sortedUniquePaths(registry.universalDependentRecords, 'universal dependent record');
  const universalTests = validateTargetedTestFiles(registry.universalAffectedVitestFiles);
  const canonicalUniversalRecords = [...CANONICAL_UNIVERSAL_DEPENDENT_RECORDS].sort((a,b)=>a.localeCompare(b,'en'));
  const canonicalUniversalTests = [...CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES].sort((a,b)=>a.localeCompare(b,'en'));
  if (!exactJson(universalRecords, canonicalUniversalRecords)
    || !exactJson(universalTests, canonicalUniversalTests)) {
    fail('PR-240 canonical universal record/test closure set is missing or weakened.');
  }
  if (!Array.isArray(registry.pathRules) || registry.pathRules.length === 0) fail('Change-impact dependency path rules are missing.');
  const ids = new Set();
  for (const rule of registry.pathRules) {
    if (typeof rule?.id !== 'string' || !/^[a-z0-9-]+$/u.test(rule.id) || ids.has(rule.id)) {
      fail('Change-impact dependency rule identity is invalid or duplicate.');
    }
    ids.add(rule.id);
    const exactPaths = sortedUniquePaths(rule.match?.exactPaths, `${rule.id} exact path`);
    const pathPrefixes = sortedUniquePathPrefixes(rule.match?.pathPrefixes, `${rule.id} path prefix`);
    const pathSuffixes = sortedUniquePaths(rule.match?.pathSuffixes, `${rule.id} path suffix`);
    if (exactPaths.length + pathPrefixes.length + pathSuffixes.length === 0) fail(`${rule.id} has no path matcher.`);
    sortedUniquePaths(rule.dependentRecords, `${rule.id} dependent record`);
    const affectedCommandIds = rule.affectedCommandIds ?? [];
    if (!Array.isArray(affectedCommandIds) || new Set(affectedCommandIds).size !== affectedCommandIds.length
      || affectedCommandIds.some((id) => !Object.hasOwn(registry.affectedCommandCatalog, id))) {
      fail(`${rule.id} affected command identities are invalid.`);
    }
    if (rule.affectedVitestFiles.length > 0) validateTargetedTestFiles(rule.affectedVitestFiles);
    if (typeof rule.includeChangedTestFile !== 'boolean') fail(`${rule.id} includeChangedTestFile must be boolean.`);
  }
  const safetyNetRules = registry.pathRules.filter((rule) => rule.id === CANONICAL_SAFETY_NET_RULE_ID);
  const safetyNet = safetyNetRules[0];
  if (safetyNetRules.length !== 1
    || !exactJson([...safetyNet.dependentRecords].sort(), CANONICAL_SAFETY_NET_RECORDS)
    || !exactJson([...safetyNet.affectedVitestFiles].sort(), CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES)
    || safetyNet.includeChangedTestFile !== true) {
    fail('PR-240 governed-source safety-net dependency rule is missing, empty, or weakened.');
  }
  return registry;
};

const pathMatchesRule = (path, rule) => {
  if (rule.match.exactPaths.includes(path)) return true;
  const prefixes = rule.match.pathPrefixes;
  const suffixes = rule.match.pathSuffixes;
  if (prefixes.length === 0 && suffixes.length === 0) return false;
  return (prefixes.length === 0 || prefixes.some((prefix) => path.startsWith(prefix)))
    && (suffixes.length === 0 || suffixes.some((suffix) => path.endsWith(suffix)));
};

export const resolveChangeImpactDependencies = ({ registry, changedFiles }) => {
  validateChangeImpactDependencyRegistry(registry);
  const paths = sortedUniquePaths([...new Set(changedFiles ?? [])], 'changed path');
  if (paths.length === 0) fail('Change-impact dependency resolution requires changed paths.');
  const universalRecords = [...registry.universalDependentRecords];
  const universalTests = [...registry.universalAffectedVitestFiles];
  const changedPathDependencies = [];
  const allRecords = new Set(universalRecords);
  const allTests = new Set(universalTests);
  const allAffectedCommandIds = new Set();
  for (const path of paths) {
    const matches = registry.pathRules.filter((rule) => pathMatchesRule(path, rule));
    if (matches.length === 0) fail(`Changed path has no fail-closed dependency mapping: ${path}`);
    const records = new Set(universalRecords);
    const tests = new Set(universalTests);
    const affectedCommandIds = new Set();
    for (const rule of matches) {
      for (const record of rule.dependentRecords) records.add(record);
      for (const testFile of rule.affectedVitestFiles) tests.add(testFile);
      for (const commandId of rule.affectedCommandIds ?? []) {
        affectedCommandIds.add(commandId);
        allAffectedCommandIds.add(commandId);
      }
      if (rule.includeChangedTestFile && path.endsWith('.test.ts')) tests.add(path);
    }
    for (const record of records) allRecords.add(record);
    for (const testFile of tests) allTests.add(testFile);
    changedPathDependencies.push(Object.freeze({
      path,
      ruleIds: Object.freeze(matches.map((rule) => rule.id).sort()),
      dependentRecords: Object.freeze([...records].sort()),
      affectedVitestFiles: Object.freeze([...tests].sort()),
      affectedCommandIds: Object.freeze([...affectedCommandIds].sort())
    }));
  }
  const dependentRecords = Object.freeze([...allRecords].sort());
  const affectedVitestFiles = validateTargetedTestFiles([...allTests]);
  const requiredCommands = Object.freeze([
    'targetedVitest', 'fullVitest', 'rootTypecheck',
    ...[...allAffectedCommandIds].sort().map((id) => `affectedCommand:${id}`),
    ...paths.filter((path) => path.endsWith('.mjs')).map((path) => `changedMjsSyntax:${path}`),
    ...paths.filter((path) => path.endsWith('.ps1')).map((path) => `changedPs1Parser:${path}`)
  ]);
  return Object.freeze({
    changedPathDependencies: Object.freeze(changedPathDependencies),
    dependentRecords,
    affectedVitestFiles,
    requiredCommands,
    commandMatrixSha256: sha256Bytes(Buffer.from(JSON.stringify(registry.commandMatrix)))
  });
};

export const createDependencyAssessmentContract = ({ plan, registryBinding }) => Object.freeze({
  registry: Object.freeze({
    path: registryBinding.path, sizeBytes: registryBinding.sizeBytes, sha256: registryBinding.sha256,
    schemaVersion: registryBinding.value.schemaVersion, id: registryBinding.value.id
  }),
  changedPathDependencies: plan.changedPathDependencies,
  dependentRecords: plan.dependentRecords,
  affectedVitestFiles: plan.affectedVitestFiles,
  requiredCommands: plan.requiredCommands,
  commandMatrixSha256: plan.commandMatrixSha256
});

const assertNoReparseAncestors = async (target) => {
  const absolute = resolve(target);
  const parsed = parse(absolute);
  let cursor = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(sep).filter(Boolean)) {
    cursor = join(cursor, segment);
    let item;
    try { item = await lstat(cursor); }
    catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    if (item.isSymbolicLink()) fail(`Reparse/symbolic-link path component is forbidden: ${cursor}`);
  }
};

const resolveGovernedPath = async (root, value, label, { createParent = false } = {}) => {
  if (typeof value !== 'string' || value.length === 0 || isAbsolute(value) || value.includes('\\')) {
    fail(`${label} must be a portable repository-relative path.`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) fail(`${label} is unsafe.`);
  const absoluteRoot = resolve(root);
  const target = resolve(absoluteRoot, ...segments);
  const local = relative(absoluteRoot, target);
  if (!local || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) fail(`${label} escapes repository root.`);
  await assertNoReparseAncestors(absoluteRoot);
  if (createParent) await mkdir(dirname(target), { recursive: true });
  await assertNoReparseAncestors(dirname(target));
  const realRoot = await realpath(absoluteRoot);
  const realParent = await realpath(dirname(target));
  const realLocal = relative(realRoot, realParent);
  if (realLocal === '..' || realLocal.startsWith(`..${sep}`) || isAbsolute(realLocal)) fail(`${label} parent escapes repository root.`);
  return target;
};

export const readEvidenceBinding = async (root, path, label) => {
  const fullPath = await resolveGovernedPath(root, path, label);
  const item = await lstat(fullPath);
  if (!item.isFile() || item.isSymbolicLink()) fail(`${label} must be a regular non-link file.`);
  const bytes = await readFile(fullPath);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); }
  catch { fail(`${label} is not valid JSON.`); }
  return Object.freeze({ path, fullPath, sizeBytes: bytes.length, sha256: sha256Bytes(bytes), value });
};

export const readRepoFileBinding = async (root, path, label) => {
  const fullPath = await resolveGovernedPath(root, path, label);
  const item = await lstat(fullPath);
  if (!item.isFile() || item.isSymbolicLink()) fail(`${label} must be a regular non-link file.`);
  const bytes = await readFile(fullPath);
  return Object.freeze({ path, fullPath, sizeBytes: bytes.length, sha256: sha256Bytes(bytes) });
};

export const writeEvidenceReceipt = async (root, path, value) => {
  if (!path.startsWith('artifacts/validation/')) fail('Evidence receipt output must stay under artifacts/validation/.');
  const fullPath = await resolveGovernedPath(root, path, 'evidence receipt output', { createParent: true });
  try {
    const existing = await lstat(fullPath);
    if (!existing.isFile() || existing.isSymbolicLink()) fail('Existing evidence receipt is not a regular non-link file.');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const temporary = `${fullPath}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx');
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, fullPath);
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporary, { force: true });
  }
  return fullPath;
};

export const loadMutationEvidencePolicy = async (root = process.cwd()) => {
  const [policy, registry] = await Promise.all([
    readFile(resolve(root, 'config/mutation-release-readiness-policy.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'config/canonical-rule-registry.json'), 'utf8').then(JSON.parse)
  ]);
  const dependencyRegistryBinding = await readEvidenceBinding(
    root, policy?.dependencyRegistry?.path, 'change-impact dependency registry'
  );
  if (policy?.schemaVersion !== 2 || policy.id !== 'PPT-MUTATION-RELEASE-READINESS-V2'
    || policy.requirement !== 'PR-235' || policy.decision !== 'DEC-270'
    || policy.strengthenedByRequirement !== 'PR-240' || policy.strengthenedByDecision !== 'DEC-275'
    || !exactJson(policy.impactAreas, CANONICAL_MUTATION_IMPACT_AREAS)
    || policy.failClosed !== true || policy.waiverAllowed !== false
    || policy.dependencyRegistry?.schemaVersion !== 1
    || policy.dependencyRegistry?.id !== CANONICAL_DEPENDENCY_REGISTRY_ID
    || policy.dependencyRegistry?.sha256 !== dependencyRegistryBinding.sha256
    || policy.dependencyRegistry?.unmatchedChangedPathEffect !== 'BLOCK'
    || policy.dependencyRegistry?.dependentRecordsMustBeChanged !== true
    || policy.dependencyRegistry?.dependentRecordNotAffected?.allowed !== true
    || policy.dependencyRegistry?.dependentRecordNotAffected?.status !== 'NOT_AFFECTED_WITH_BASELINE_IDENTITY'
    || policy.dependencyRegistry?.dependentRecordNotAffected?.reasonCode !== 'DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED'
    || policy.dependencyRegistry?.dependentRecordNotAffected?.sha256Required !== true
    || policy.dependencyRegistry?.dependentRecordNotAffected?.baselineDiffAbsenceRequired !== true
    || policy.dependencyRegistry?.dependentRecordNotAffected?.evidencePathsRequired !== true
    || policy.dependencyRegistry?.targetedVitestMustEqualAffectedFiles !== true
    || policy.evidenceExecution?.fullRegressionRootTypecheckRequired !== true
    || policy.evidenceExecution?.fullRegressionChangedMjsNodeCheckRequired !== true
    || policy.evidenceExecution?.fullRegressionChangedPs1ParserRequired !== true
    || policy.evidenceExecution?.commandMatrixMustMatchDependencyRegistry !== true
    || policy.externalBaselineChain?.bootstrapAdoption?.baseCommit !== BOOTSTRAP_ADOPTION_BASE_COMMIT
    || policy.externalBaselineChain?.bootstrapAdoption?.historicalBaseCommitPreservedAsImpactBase !== true
    || policy.externalBaselineChain?.bootstrapAdoption?.producerCommitSource !== 'REPOSITORY_POINTER_SOURCE_COMMIT'
    || policy.externalBaselineChain?.bootstrapAdoption?.producerCommitMustDifferFromBaseCommit !== true
    || policy.externalBaselineChain?.bootstrapAdoption?.producerCommitAncestry !== 'BASE_COMMIT_TO_POINTER_SOURCE_COMMIT_TO_CURRENT_HEAD'
    || policy.externalBaselineChain?.bootstrapAdoption?.producerBindingReadback !== 'GIT_SHOW_EXACT_PATH_SIZE_SHA256'
    || policy.baseline?.preMutationProducerBoundToBaselineCommit !== true
    || policy.externalBaselineChain?.bootstrapAdoption?.generalWaiver !== false) {
    fail('PR-235 mutation-release readiness policy is invalid or weakened.');
  }
  const dependencyRegistry = validateChangeImpactDependencyRegistry(dependencyRegistryBinding.value);
  return Object.freeze({ policy, registry, dependencyRegistry, dependencyRegistryBinding });
};

export const currentEvidenceIdentity = ({ provenance, registry }) => Object.freeze({
  sourceCommit: provenance.headCommit,
  governedSourceFingerprintSha256: provenance.governedSourceFingerprint.sha256,
  canonicalRuleRegistrySha256: registry.rulesSha256
});

const classifiedAreasForPath = (path) => {
  const areas = new Set();
  if (path.startsWith('apps/') || path.startsWith('packages/') || path.startsWith('scripts/')
    || path === 'package.json' || path === 'pnpm-workspace.yaml') areas.add('mainSource');
  if (path === 'config/canonical-rule-registry.json' || path === 'config/rule-acknowledgement.json'
    || path === 'config/rule-enforcement-registry.json' || path === 'config/project-constitution.json'
    || path === 'scripts/verify-operation-rule-check.mjs') areas.add('canonicalRules');
  if (path === 'config/user-decision-ledger.json' || path.startsWith('docs/decisions/')
    || path === 'docs/10_MASTER_DECISION_REGISTER.md') areas.add('decisions');
  if (path.startsWith('docs/current/') || path === 'config/active-document-set.json'
    || /(^|\/)(README|CONTRIBUTING|SECURITY|BUILD_STATUS|START_HERE|DELIVERY|PAKET|VERIFICATION).*\.md$/iu.test(path)) areas.add('activeDocuments');
  if (path.startsWith('docs/ticari-urun-temeli/')) areas.add('commercialRecords');
  if (path.includes('/08_IS_LISTESI/') || path === 'config/work-segmentation-plan.json') areas.add('workList');
  if (/scope|inventory|ratchet/iu.test(path) || path === 'config/accepted-scope-registry.json'
    || path === 'config/active-file-classification.json') areas.add('scopesInventoriesRatchets');
  if (path === 'docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.docx'
    || path === 'docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.pdf'
    || path === 'scripts/generate-current-master-documentation.py') areas.add('masterDocumentation');
  if (path === 'manifest.json' || path === 'SHA256SUMS.txt' || path.startsWith('artifacts/manifests/')
    || path.startsWith('config/') || path.endsWith('/package.json') || path === 'package.json') areas.add('manifestsIndexes');
  if (/ratchet/iu.test(path) || path === 'config/active-file-classification.json') areas.add('ratchets');
  if (path.endsWith('.test.ts') || path.endsWith('.test.tsx') || path.startsWith('scripts/verify-')
    || path.startsWith('apps/') || path.startsWith('packages/') || path.startsWith('scripts/') || path === 'package.json') areas.add('tests');
  if (path.startsWith('apps/desktop/src/renderer/') || path.startsWith('apps/desktop/src/main/')
    || path.startsWith('apps/desktop/build/') || /installer|uat/iu.test(path)) areas.add('uat');
  if (areas.size === 0) areas.add('activeDocuments');
  return [...areas].sort();
};

export const classifyChangedFiles = (changedFiles) => Object.freeze(Object.fromEntries(
  [...new Set(changedFiles)].sort().map((path) => [path, classifiedAreasForPath(path)])
));

export const validateImpactAssessment = ({
  policy, assessment, changedFiles, dependencyRegistry, dependencyRegistryBinding,
  expectedSourceCommit, expectedBaselineCommit
}) => {
  if (assessment?.schemaVersion !== 2 || assessment.requirement !== 'PR-235' || assessment.decision !== 'DEC-270'
    || assessment.strengthenedByRequirement !== 'PR-240' || assessment.strengthenedByDecision !== 'DEC-275') {
    fail('Mutation impact assessment contract is invalid.');
  }
  if (!GIT_OBJECT_PATTERN.test(String(expectedSourceCommit ?? ''))
    || !GIT_OBJECT_PATTERN.test(String(expectedBaselineCommit ?? ''))
    || assessment.sourceCommit !== expectedSourceCommit
    || assessment.baselineCommit !== expectedBaselineCommit) {
    fail('Mutation impact assessment source/baseline commit identity is missing, invalid or stale.');
  }
  const fileImpacts = classifyChangedFiles(changedFiles);
  if (JSON.stringify(assessment.changedFileImpacts) !== JSON.stringify(fileImpacts)) {
    fail('Mutation impact assessment changed-file path classification is missing or not exact.');
  }
  const dependencyPlan = resolveChangeImpactDependencies({ registry: dependencyRegistry, changedFiles });
  let dependentRecordImpacts;
  if (policy.dependencyRegistry?.dependentRecordNotAffected?.allowed === true) {
    const dependentRecordImpactKeys = Object.keys(assessment.dependentRecordImpacts ?? {}).sort((a, b) => a.localeCompare(b, 'en'));
    if (dependentRecordImpactKeys.length !== dependencyPlan.dependentRecords.length
      || !dependentRecordImpactKeys.every((path) => dependencyPlan.dependentRecords.includes(path))) {
      fail('Mutation dependent-record impact inventory is missing or not exact.');
    }
    dependentRecordImpacts = {};
    for (const path of dependencyPlan.dependentRecords) {
      const value = assessment.dependentRecordImpacts[path];
      if (!SHA256_PATTERN.test(String(value?.sha256 ?? ''))) {
        fail(`Mutation dependent-record impact SHA-256 is missing or invalid: ${path}`);
      }
      if (changedFiles.includes(path)) {
        if (value.status !== 'UPDATED' || !exactJson(value.evidencePaths, [path])) {
          fail(`Changed mutation dependent record is not marked UPDATED with exact evidence: ${path}`);
        }
      } else if (value.status !== 'NOT_AFFECTED_WITH_BASELINE_IDENTITY'
        || value.reasonCode !== 'DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED'
        || !Array.isArray(value.evidencePaths) || value.evidencePaths.length === 0) {
        fail(`Unchanged mutation dependent record lacks governed baseline-identity evidence: ${path}`);
      }
      dependentRecordImpacts[path] = value;
    }
  } else {
    const missingDependentRecords = dependencyPlan.dependentRecords.filter((path) => !changedFiles.includes(path));
    if (missingDependentRecords.length > 0) {
      fail(`Mutation dependency records were not updated in the exact changed-file inventory: ${missingDependentRecords.join(', ')}`);
    }
  }
  const dependencyAssessment = createDependencyAssessmentContract({ plan: dependencyPlan, registryBinding: dependencyRegistryBinding });
  if (!exactJson(assessment.dependencyPlan, dependencyAssessment)) {
    fail('Mutation impact assessment dependency plan is missing or not exact.');
  }
  const allowed = new Set(policy.allowedImpactStatus ?? []);
  const result = {};
  for (const area of policy.impactAreas ?? []) {
    const value = assessment.impactAreas?.[area];
    const expectedPaths = Object.entries(fileImpacts).filter(([, areas]) => areas.includes(area)).map(([path]) => path).sort();
    if (!value || !allowed.has(value.status)) fail(`Mutation impact assessment is missing or invalid: ${area}`);
    if (value.status === 'UPDATED') {
      const claimed = [...new Set(value.paths ?? [])].sort();
      if (expectedPaths.length === 0 || JSON.stringify(claimed) !== JSON.stringify(expectedPaths)) {
        fail(`Mutation impact assessment updated paths are not exact: ${area}`);
      }
    } else {
      if (expectedPaths.length > 0 && !(area === 'uat' && value.status === 'DEFERRED_TO_FRESH_INSTALLED_EXE_UAT')) {
        fail(`Mutation impact area with changed paths cannot be marked unaffected: ${area}`);
      }
      if (!ALLOWED_REASON_CODES.has(value.reasonCode) || !Array.isArray(value.evidencePaths) || value.evidencePaths.length === 0) {
        fail(`Mutation impact area requires a governed reason code and evidence paths: ${area}`);
      }
      if (value.status === 'DEFERRED_TO_FRESH_INSTALLED_EXE_UAT'
        && (area !== 'uat' || value.reasonCode !== 'FRESH_INSTALLED_EXE_UAT_REQUIRED')) {
        fail(`Only UAT may be deferred with its exact reason code: ${area}`);
      }
    }
    result[area] = value;
  }
  return Object.freeze({
    impactAreas: result,
    changedFileImpacts: fileImpacts,
    dependencyPlan,
    dependencyAssessment,
    dependentRecordImpacts: dependentRecordImpacts ? Object.freeze(dependentRecordImpacts) : undefined
  });
};

export const validateTargetedTestFiles = (values) => {
  if (!Array.isArray(values) || values.length === 0) fail('At least one targeted test file is required.');
  const normalized = [...new Set(values)];
  for (const value of normalized) {
    if (typeof value !== 'string' || isAbsolute(value) || value.includes('\\') || value.startsWith('/')
      || value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
      || !value.endsWith('.test.ts') || !(value.startsWith('apps/') || value.startsWith('packages/'))) {
      fail(`Forbidden targeted Vitest argument or path: ${value}`);
    }
  }
  return Object.freeze(normalized.sort());
};

export const parseVitestJsonSummary = (value) => {
  const number = (field) => {
    const result = Number(value?.[field]);
    if (!Number.isSafeInteger(result) || result < 0) fail(`Vitest JSON field is invalid: ${field}`);
    return result;
  };
  return Object.freeze({
    testFilesPassed: number('numPassedTestSuites'), testFilesFailed: number('numFailedTestSuites'),
    testsPassed: number('numPassedTests'), testsFailed: number('numFailedTests'), testsSkipped: number('numPendingTests')
  });
};

export const parseVitestJsonFailureInventory = (value, { root }) => {
  if (!Array.isArray(value?.testResults)) fail('Vitest JSON testResults inventory is invalid.');
  const normalizedRoot = resolve(root);
  const normalizeFile = (name) => {
    if (typeof name !== 'string' || !name.trim()) fail('Vitest failed-suite file is invalid.');
    const absolute = isAbsolute(name) ? resolve(name) : resolve(normalizedRoot, name);
    const repoRelative = relative(normalizedRoot, absolute).replaceAll('\\', '/');
    if (!repoRelative || repoRelative.startsWith('../') || isAbsolute(repoRelative)
      || !repoRelative.endsWith('.test.ts')) fail('Vitest failed-suite file is outside the governed repository.');
    return repoRelative;
  };
  const normalizeTestName = (name) => {
    if (typeof name !== 'string' || !name.trim() || name.length > 1000 || /[\u0000-\u001f\u007f]/u.test(name)) {
      fail('Vitest failed-test name is invalid.');
    }
    return name.trim();
  };
  const failures = [];
  for (const suite of value.testResults) {
    if (suite?.status !== 'failed') continue;
    const file = normalizeFile(suite.name);
    const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : [];
    const failedAssertions = assertions.filter((item) => item?.status === 'failed');
    if (failedAssertions.length === 0) {
      failures.push(Object.freeze({ file, failureKind: 'SUITE_IMPORT', testName: null }));
      continue;
    }
    for (const assertion of failedAssertions) {
      failures.push(Object.freeze({ file, failureKind: 'TEST', testName: normalizeTestName(assertion.fullName) }));
    }
  }
  return Object.freeze(failures.sort((left, right) => left.file.localeCompare(right.file)
    || left.failureKind.localeCompare(right.failureKind)
    || String(left.testName ?? '').localeCompare(String(right.testName ?? ''))));
};

export const renderCommand = (executable, args) => [executable, ...args]
  .map((value) => /[\s"]/u.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value).join(' ');

const validateMeasuredNonMutatingCommand = (actual, expected) => {
  if (actual?.id !== expected.id || actual.status !== 'PASS' || actual.exitCode !== 0
    || actual.executable !== expected.executable || !exactJson(actual.arguments, expected.arguments)
    || actual.changedPath !== expected.changedPath
    || actual.command !== renderCommand(expected.executable, expected.arguments)
    || !Number.isSafeInteger(actual.stdout?.sizeBytes) || actual.stdout.sizeBytes < 0
    || !SHA256_PATTERN.test(String(actual.stdout?.sha256 ?? ''))
    || !Number.isSafeInteger(actual.stderr?.sizeBytes) || actual.stderr.sizeBytes < 0
    || !SHA256_PATTERN.test(String(actual.stderr?.sha256 ?? ''))
    || !Number.isFinite(Date.parse(actual.startedAt)) || !Number.isFinite(Date.parse(actual.completedAt))
    || Date.parse(actual.completedAt) < Date.parse(actual.startedAt)) {
    fail(`Non-mutating affected command result is missing or forged: ${expected.id}`);
  }
};

export const validateFullEvidenceCommandResults = ({ receipt, registry, changedFiles }) => {
  validateChangeImpactDependencyRegistry(registry);
  const matrix = registry.commandMatrix;
  const expected = [{
    id: 'rootTypecheck', executable: matrix.rootTypecheck.executable,
    arguments: matrix.rootTypecheck.arguments, changedPath: null
  }];
  const plan = resolveChangeImpactDependencies({ registry, changedFiles });
  for (const requiredId of plan.requiredCommands.filter((id) => id.startsWith('affectedCommand:'))) {
    const commandId = requiredId.slice('affectedCommand:'.length);
    const command = registry.affectedCommandCatalog[commandId];
    expected.push({ id: requiredId, executable: command.executable, arguments: command.arguments, changedPath: null });
  }
  for (const path of [...changedFiles].filter((value) => value.endsWith('.mjs')).sort()) {
    expected.push({
      id: `changedMjsSyntax:${path}`, executable: matrix.changedMjsSyntax.executable,
      arguments: [...matrix.changedMjsSyntax.argumentPrefix, path], changedPath: path
    });
  }
  for (const path of [...changedFiles].filter((value) => value.endsWith('.ps1')).sort()) {
    expected.push({
      id: `changedPs1Parser:${path}`, executable: matrix.changedPs1Parser.executable,
      arguments: matrix.changedPs1Parser.arguments.map((value) => value === '{changedPath}' ? path : value),
      changedPath: path
    });
  }
  if (!Array.isArray(receipt?.additionalCommands) || receipt.additionalCommandCount !== expected.length
    || receipt.additionalCommands.length !== expected.length
    || receipt.additionalCommandsSha256 !== sha256Bytes(Buffer.from(JSON.stringify(receipt.additionalCommands)))) {
    fail('Full regression non-mutating affected command matrix is missing or stale.');
  }
  expected.forEach((entry, index) => validateMeasuredNonMutatingCommand(receipt.additionalCommands[index], entry));
  return Object.freeze({ count: expected.length, ids: Object.freeze(expected.map((entry) => entry.id)) });
};

const walkBindings = async (root, directory, prefix = '') => {
  const target = resolve(root, directory);
  await assertNoReparseAncestors(target);
  const result = [];
  for (const entry of (await readdir(target, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = resolve(target, entry.name);
    if (entry.isSymbolicLink()) fail(`Snapshot contains a reparse/symbolic-link entry: ${path}`);
    if (entry.isDirectory()) result.push(...await walkBindings(target, entry.name, path));
    else if (entry.isFile()) {
      const bytes = await readFile(fullPath);
      result.push({ path, sizeBytes: bytes.length, sha256: sha256Bytes(bytes) });
    } else fail(`Snapshot contains an unsupported entry: ${path}`);
  }
  return result;
};

export const snapshotMutationEvidenceAndToolchain = async (root) => {
  const validation = await walkBindings(root, 'artifacts/validation').catch((error) => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
  const toolchainPaths = [
    'package-lock.json', 'node_modules/vitest/vitest.mjs', 'node_modules/vitest/package.json',
    'node_modules/vite/package.json', 'node_modules/@vitest/runner/package.json',
    'node_modules/typescript/bin/tsc', 'node_modules/typescript/package.json'
  ];
  const toolchain = await Promise.all(toolchainPaths.map((path) => readRepoFileBinding(root, path, `toolchain ${path}`)));
  const payload = { validation, toolchain: toolchain.map(({ path, sizeBytes, sha256 }) => ({ path, sizeBytes, sha256 })) };
  return Object.freeze({ ...payload, sha256: sha256Bytes(Buffer.from(JSON.stringify(payload))) });
};

export const loadCanonicalProducerBindings = async (root, policy) => Object.freeze(Object.fromEntries(
  await Promise.all(Object.entries(policy.canonicalProducers).map(async ([id, path]) => {
    const binding = await readRepoFileBinding(root, path, `${id} producer`);
    return [id, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
  }))
));

export const readExternalBaselineChain = async ({ externalRoot = FIXED_EXTERNAL_BASELINE_CHAIN_ROOT } = {}) => {
  await assertNoReparseAncestors(externalRoot);
  const rootItem = await lstat(externalRoot);
  if (!rootItem.isDirectory() || rootItem.isSymbolicLink()) fail('External baseline chain root is not a regular directory.');
  const names = (await readdir(externalRoot)).sort();
  if (names.some((name) => !RECORD_NAME_PATTERN.test(name))) fail('External baseline chain contains an unexpected entry.');
  let previousSha256 = ZERO_SHA256;
  const records = [];
  for (const [index, name] of names.entries()) {
    const expectedSequence = index + 1;
    const match = RECORD_NAME_PATTERN.exec(name);
    if (Number(match[1]) !== expectedSequence) fail('External baseline chain sequence is not contiguous.');
    const fullPath = resolve(externalRoot, name);
    const item = await lstat(fullPath);
    if (!item.isFile() || item.isSymbolicLink()) fail('External baseline chain record is not a regular file.');
    const bytes = await readFile(fullPath);
    const value = JSON.parse(bytes.toString('utf8'));
    const digest = sha256Bytes(bytes);
    if (value?.chain?.sequence !== expectedSequence || value.chain.previousRecordSha256 !== previousSha256
      || value.chain.previousRecordFile !== (records.at(-1)?.name ?? null)) fail('External baseline chain hash link is broken.');
    if (value?.sourceProvenance?.headCommit !== match[2] || value.baselineType !== match[3]) {
      fail('External baseline chain filename/receipt identity mismatch.');
    }
    records.push({ name, fullPath, sizeBytes: bytes.length, sha256: digest, value });
    previousSha256 = digest;
  }
  return Object.freeze({ records: Object.freeze(records), tipSha256: previousSha256 });
};

export const appendExternalBaselineRecord = async ({ record, externalRoot = FIXED_EXTERNAL_BASELINE_CHAIN_ROOT }) => {
  await assertNoReparseAncestors(externalRoot);
  await mkdir(externalRoot, { recursive: true });
  await assertNoReparseAncestors(externalRoot);
  const chain = await readExternalBaselineChain({ externalRoot });
  const sequence = chain.records.length + 1;
  if (record?.schemaVersion !== 2 || record.id !== 'PPT-MUTATION-BASELINE-EXTERNAL-V2'
    || record.requirement !== 'PR-235' || record.decision !== 'DEC-270'
    || record.strengthenedByRequirement !== 'PR-240' || record.strengthenedByDecision !== 'DEC-275'
    || record.evidenceKind !== 'PRE_MUTATION_BASELINE_EXTERNAL' || record.status !== 'PASS'
    || !new Set(['PRE_MUTATION', 'BOOTSTRAP_ADOPTION']).has(record.baselineType)
    || !GIT_OBJECT_PATTERN.test(String(record.sourceProvenance?.headCommit ?? ''))
    || record.operationRuleBinding?.status !== 'PASS' || record.operationRuleBinding?.kind !== 'mutation'
    || record.operationRuleBinding?.operation !== 'record-pre-mutation-baseline'
    || !SHA256_PATTERN.test(String(record.operationRuleBinding?.sha256 ?? ''))
    || record.producer?.path !== 'scripts/record-mutation-baseline.mjs'
    || !SHA256_PATTERN.test(String(record.producer?.sha256 ?? ''))) {
    fail('External baseline record contract is invalid.');
  }
  if (record.baselineType === 'BOOTSTRAP_ADOPTION' && sequence !== 1) fail('Bootstrap adoption is allowed only as the first external baseline record.');
  if (record.baselineType === 'BOOTSTRAP_ADOPTION'
    && (record.sourceProvenance.headCommit !== BOOTSTRAP_ADOPTION_BASE_COMMIT
      || record.bootstrapDecision !== 'DEC-270_INITIAL_ACTIVATION_ONLY' || record.fullDiffRequired !== true)) {
    fail('Bootstrap adoption identity is invalid.');
  }
  const value = {
    ...record,
    chain: { algorithm: 'SHA-256', sequence, previousRecordFile: chain.records.at(-1)?.name ?? null, previousRecordSha256: chain.tipSha256 }
  };
  const name = `${String(sequence).padStart(8, '0')}-${record.sourceProvenance.headCommit}-${record.baselineType}.json`;
  const fullPath = resolve(externalRoot, name);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  const handle = await open(fullPath, 'wx');
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  const readback = await readFile(fullPath);
  if (!readback.equals(bytes)) fail('External baseline exclusive append readback mismatch.');
  await readExternalBaselineChain({ externalRoot });
  return Object.freeze({ name, fullPath, sizeBytes: bytes.length, sha256: sha256Bytes(bytes), value });
};

export const readExternalBaselineFromPointer = async ({ pointer, externalRoot = FIXED_EXTERNAL_BASELINE_CHAIN_ROOT }) => {
  if (pointer?.schemaVersion !== 2 || pointer.id !== 'PPT-MUTATION-BASELINE-POINTER-V2'
    || pointer.evidenceKind !== 'PRE_MUTATION_BASELINE_POINTER' || pointer.status !== 'PASS'
    || pointer.requirement !== 'PR-235' || pointer.decision !== 'DEC-270'
    || pointer.strengthenedByRequirement !== 'PR-240' || pointer.strengthenedByDecision !== 'DEC-275'
    || pointer.external?.channel !== 'Bronze' || pointer.external.root !== portable(FIXED_EXTERNAL_BASELINE_CHAIN_ROOT)
    || !RECORD_NAME_PATTERN.test(pointer.external.recordFile ?? '') || !SHA256_PATTERN.test(pointer.external.sha256 ?? '')) {
    fail('Repository baseline pointer is invalid.');
  }
  const chain = await readExternalBaselineChain({ externalRoot });
  const record = chain.records.find((item) => item.name === pointer.external.recordFile);
  if (!record || record.sha256 !== pointer.external.sha256 || record.sizeBytes !== pointer.external.sizeBytes
    || record.value.chain.sequence !== pointer.external.sequence) fail('External baseline pointer readback mismatch.');
  return Object.freeze({ record, chain });
};
