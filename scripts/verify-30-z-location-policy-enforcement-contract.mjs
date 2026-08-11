import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const predecessorRegression = process.argv.slice(2).includes('--predecessor-regression');
const REPORT_PATH = predecessorRegression
  ? 'artifacts/validation/30-Z_30-Y_LIFE_POLICY_ENFORCEMENT_REGRESSION.json'
  : 'artifacts/validation/30-Z-location-policy-enforcement-contract.json';
const FIRST_FAILURE_PATH = 'artifacts/validation/30-Z_LOCATION_POLICY_ENFORCEMENT_CONTRACT_ATTEMPT_1_FAILURE.json';
const EXPECTED_MIGRATION_CHECKSUM = 'e55b15e48f504fc65452556f6c907b8845bb81b6b6d65caa5c243410d11c9609';
const PREDECESSOR_COMPLETED_AT = '2026-08-08T03:00:15.638932+03:00';
const HISTORICAL_NODE_PATH = 'C:\\Users\\Husey\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe';

// These byte bindings are the immutable trust root for the completed 30-Y
// predecessor. A newly generated document that merely preserves selected PASS
// fields is not an acceptable substitute for any member of this chain.
const PREDECESSOR_TRUST_ROOT = Object.freeze({
  canonicalProof: Object.freeze({
    path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_CANONICAL_BINDING_VERIFICATION.json',
    bytes: 5905,
    sha256: '346453f9293994f6abb3a3a916158cb6eeecbbb3943f4622250b707a5ea4f9ee'
  }),
  transition: Object.freeze({
    path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_VALIDATION.json',
    bytes: 8207,
    sha256: '3db8c34ac8aa8bb149febae55c72dad3343cdbcb7b4476e8ebac33d4043feee3'
  }),
  transitionAttempt1Failure: Object.freeze({
    path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_ATTEMPT_1_FAILURE.json',
    bytes: 537,
    sha256: 'c3dde49c040dcc4b418cd5a5e55b6eb0bf0893da8ef9326a6d0e9a26879078a0'
  }),
  completion: Object.freeze({
    path: 'artifacts/checkpoints/30-Y_COMPLETION_RECORD.json',
    bytes: 18365,
    sha256: '20e0679844cfd7239c5f06ace3f385515fc88991fd7426df9d49c61c75f88f48'
  }),
  receipt: Object.freeze({
    path: 'artifacts/checkpoints/30-Y_LIBRARY_RECEIPT.json',
    bytes: 19835,
    sha256: '4bf7c460c93ba12b12dd3be62aaa9a46c0509db1632d660e88a0ba8aa77b2034'
  }),
  libraryReadback: Object.freeze({
    path: 'artifacts/validation/30-Y_LIBRARY_READBACK_VERIFICATION.json',
    bytes: 13000,
    sha256: 'a81fb8bc685259b36d7e3d9b2f61eb8c8ac9035f6a7e068e9d791c621779ba6b'
  }),
  receiptReadback: Object.freeze({
    path: 'artifacts/validation/30-Y_RECEIPT_READBACK_VERIFICATION.json',
    bytes: 3788,
    sha256: 'e52ffcb6613abdf10817e21a252a1220b0db74b07a9f380094370d13064f93d9'
  }),
  receiptReadbackSidecar: Object.freeze({
    path: 'artifacts/validation/30-Y_RECEIPT_READBACK_VERIFICATION.json.sha256',
    bytes: 107,
    sha256: 'f0928054cf27d391536f36c87cdf4b6ece23a3acdfbd33de97172e7bb01e99f8'
  }),
  receiptReadbackPersistence: Object.freeze({
    path: 'artifacts/validation/30-Y_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
    bytes: 1755,
    sha256: 'ae64038f2f3012deb1bc265849a79dc8528e8c97647e780fac257b633be265bb'
  }),
  localPackageVerification: Object.freeze({
    path: 'artifacts/validation/30-Y_LOCAL_PACKAGE_INDEPENDENT_VERIFICATION.json',
    bytes: 6636,
    sha256: 'f9cd942f30dd1c4c3e9e8bd3fc832ff8f6e5c4d12a026536bd2eaaa7153d0786'
  }),
  executionRecord: Object.freeze({
    path: 'artifacts/checkpoints/30-Y_EXECUTION_RECORD.json',
    bytes: 11686,
    sha256: 'b2b39a00128bb5cddb5f71e07249e1ad173218f6bde9738d73d6ad46e0bb8c0b'
  }),
  finalInventory: Object.freeze({
    path: 'artifacts/validation/30-Y_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
    bytes: 18909,
    sha256: '9b0271a168c85173f1f353e7045fc792ccfe3db49def10f41bee5ee8ec39b66d'
  })
});
const PREDECESSOR_POSTCOMMIT = Object.freeze([
  Object.freeze({
    sequence: 6,
    name: 'postcommit-artifact-index-generate',
    command: Object.freeze([HISTORICAL_NODE_PATH, 'scripts/generate-project-artifact-index-v2.mjs']),
    stdout: Object.freeze({
      path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_POSTCOMMIT_LOGS/06-postcommit-artifact-index-generate.stdout.txt',
      bytes: 58,
      sha256: 'cae703cd7abc6a5bdd6501da381d969b9f5d2c352d10529701c408f9e5b49712'
    }),
    stderr: Object.freeze({
      path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_POSTCOMMIT_LOGS/06-postcommit-artifact-index-generate.stderr.txt',
      bytes: 0,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    })
  }),
  Object.freeze({
    sequence: 7,
    name: 'postcommit-artifact-index-verify',
    command: Object.freeze([HISTORICAL_NODE_PATH, 'scripts/verify-project-artifact-index-v2.mjs']),
    stdout: Object.freeze({
      path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_POSTCOMMIT_LOGS/07-postcommit-artifact-index-verify.stdout.txt',
      bytes: 86,
      sha256: '106b4212765cbb451359e5ce7f44d39b86b7dd5f1161a278a2d56ef4ca4cb95d'
    }),
    stderr: Object.freeze({
      path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_POSTCOMMIT_LOGS/07-postcommit-artifact-index-verify.stderr.txt',
      bytes: 0,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    })
  }),
  Object.freeze({
    sequence: 8,
    name: 'postcommit-governed-preflight',
    command: Object.freeze([HISTORICAL_NODE_PATH, 'scripts/run-governed-preflight.mjs']),
    stdout: Object.freeze({
      path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_POSTCOMMIT_LOGS/08-postcommit-governed-preflight.stdout.txt',
      bytes: 3438,
      sha256: '1f67bf9a56f8be771c83133ac17cf4807f86b35b7c29839d26cd97992bba70fd'
    }),
    stderr: Object.freeze({
      path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_POSTCOMMIT_LOGS/08-postcommit-governed-preflight.stderr.txt',
      bytes: 0,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    })
  }),
  Object.freeze({
    sequence: 9,
    name: 'postcommit-preflight-freshness',
    command: Object.freeze([HISTORICAL_NODE_PATH, 'scripts/require-current-governed-preflight.mjs']),
    stdout: Object.freeze({
      path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_POSTCOMMIT_LOGS/09-postcommit-preflight-freshness.stdout.txt',
      bytes: 117,
      sha256: '41cae69d0e61b83f2f38d92c4857e899508b440976b5fb1e449f2347cfdb9080'
    }),
    stderr: Object.freeze({
      path: 'artifacts/validation/30-Y_COMPLETION_TRANSITION_POSTCOMMIT_LOGS/09-postcommit-preflight-freshness.stderr.txt',
      bytes: 0,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    })
  })
]);
const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';

const LEGACY_IPC_FAILURE = Object.freeze({
  path: 'artifacts/validation/30-Z_IPC_READ_SHARING_RUNTIME_ATTEMPT_1_FAILURE.json',
  bytes: 1116,
  sha256: '010af9e8640591922d6d0f1e2935b797a84a0188dcb5300ee01d89dca4e5032e'
});
const LEGACY_IPC_NORMALIZATION = Object.freeze({
  path: 'artifacts/validation/30-Z_IPC_READ_SHARING_RUNTIME_ATTEMPT_1_NORMALIZATION_BINDING.json',
  bytes: 1421,
  sha256: '831a808b1c2cef3267f8df5ee7b0238431d31a53a98446d7887532100622ddd5'
});
const LEGACY_IPC_CANONICAL = Object.freeze({
  path: 'artifacts/validation/30-Z_IPC_READ_SHARING_RUNTIME_ATTEMPT_1_CANONICAL_BINDING.json',
  bytes: 1411,
  sha256: '8cfd8e807f8579544f111ef3f9420747ea001a597927f94cabaf9949699fe51c'
});
const LEGACY_IPC_RAW_DIAGNOSTIC = Object.freeze({
  path: 'artifacts/validation/30-Z_IPC_READ_SHARING_RUNTIME_ATTEMPT_1_RAW_DIAGNOSTIC.json',
  bytes: 1630,
  sha256: '52f6f8ec046afb905efcc68327c386efeccb59b83772dbdbc2e41876de078dd3'
});
const LEGACY_PACKAGE_TOOL_FAILURES = Object.freeze([
  Object.freeze({
    attempt: 2,
    executedTests: 21,
    failedTests: 0,
    errorTests: 2,
    original: Object.freeze({
      path: 'artifacts/validation/30-Z_PACKAGE_TOOL_UNIT_TEST_ATTEMPT_2_FAILURE.json',
      bytes: 1348,
      sha256: '7f6f07d60e576d6043650c988a45b578f4976d0650cbf9e126c34b511e7780bb'
    }),
    normalization: Object.freeze({
      path: 'artifacts/validation/30-Z_PACKAGE_TOOL_UNIT_TEST_ATTEMPT_2_NORMALIZATION_BINDING.json',
      bytes: 1141,
      sha256: '24824afe85203ae741ef9e0bf4aed74cc884a335494e4705becddc2912e01033'
    }),
    canonical: Object.freeze({
      path: 'artifacts/validation/30-Z_PACKAGE_TOOL_UNIT_TEST_ATTEMPT_2_CANONICAL_BINDING.json',
      bytes: 983,
      sha256: '18b9163200d279165d4be89bdaceb93bef778de58e28f11b724f5758c1566dd0'
    })
  }),
  Object.freeze({
    attempt: 3,
    executedTests: 31,
    failedTests: 1,
    errorTests: 1,
    original: Object.freeze({
      path: 'artifacts/validation/30-Z_PACKAGE_TOOL_UNIT_TEST_ATTEMPT_3_FAILURE.json',
      bytes: 1261,
      sha256: '329cdc790455e101a74a94da4361166251e6a9571be842334bb915e5b96346db'
    }),
    normalization: Object.freeze({
      path: 'artifacts/validation/30-Z_PACKAGE_TOOL_UNIT_TEST_ATTEMPT_3_NORMALIZATION_BINDING.json',
      bytes: 1141,
      sha256: '401e7d1ee749537f32ed027fc2d9db8851d51aff24e852048ef7089904345ffc'
    }),
    canonical: Object.freeze({
      path: 'artifacts/validation/30-Z_PACKAGE_TOOL_UNIT_TEST_ATTEMPT_3_CANONICAL_BINDING.json',
      bytes: 998,
      sha256: '55e8bc4ee7fd76552cda3021ce8c7c52cd0d09891f773b4d924b5332d1a7d8b8'
    })
  })
]);
const LOCATION_POLICY_SENSITIVE_IPC_CHANNELS = Object.freeze([
  'data:getSnapshot',
  'data:getSnapshotSections',
  'dashboard:getOverview',
  'largeData:timeline',
  'timeline:listArchived'
]);

const paths = {
  authority: 'artifacts/authority/30-Z_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  selection: 'artifacts/validation/30-Z_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/30-z-location-policy-enforcement-scope.json',
  statusReport: 'artifacts/inventory/30-Z_SCOPE_AND_STATUS_REPORT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decision: 'docs/decisions/DEC-151-ppk-002-location-policy-enforcement.md',
  predecessorCanonicalProof: PREDECESSOR_TRUST_ROOT.canonicalProof.path,
  predecessorCompletion: PREDECESSOR_TRUST_ROOT.completion.path,
  predecessorReceipt: PREDECESSOR_TRUST_ROOT.receipt.path,
  predecessorTransition: PREDECESSOR_TRUST_ROOT.transition.path,
  predecessorTransitionAttempt1Failure: PREDECESSOR_TRUST_ROOT.transitionAttempt1Failure.path,
  predecessorExecutionRecord: PREDECESSOR_TRUST_ROOT.executionRecord.path,
  predecessorLibraryReadback: PREDECESSOR_TRUST_ROOT.libraryReadback.path,
  predecessorReceiptReadback: PREDECESSOR_TRUST_ROOT.receiptReadback.path,
  predecessorReceiptReadbackSidecar: PREDECESSOR_TRUST_ROOT.receiptReadbackSidecar.path,
  predecessorReceiptReadbackPersistence: PREDECESSOR_TRUST_ROOT.receiptReadbackPersistence.path,
  predecessorLocalPackageVerification: PREDECESSOR_TRUST_ROOT.localPackageVerification.path,
  predecessorFinalInventory: PREDECESSOR_TRUST_ROOT.finalInventory.path,
  predecessorPostcommit06Stdout: PREDECESSOR_POSTCOMMIT[0].stdout.path,
  predecessorPostcommit06Stderr: PREDECESSOR_POSTCOMMIT[0].stderr.path,
  predecessorPostcommit07Stdout: PREDECESSOR_POSTCOMMIT[1].stdout.path,
  predecessorPostcommit07Stderr: PREDECESSOR_POSTCOMMIT[1].stderr.path,
  predecessorPostcommit08Stdout: PREDECESSOR_POSTCOMMIT[2].stdout.path,
  predecessorPostcommit08Stderr: PREDECESSOR_POSTCOMMIT[2].stderr.path,
  predecessorPostcommit09Stdout: PREDECESSOR_POSTCOMMIT[3].stdout.path,
  predecessorPostcommit09Stderr: PREDECESSOR_POSTCOMMIT[3].stderr.path,
  locationApplication: 'packages/application/src/location-use-cases.ts',
  locationContract: 'packages/repository-contracts/src/location-repository.ts',
  locationRepository: 'packages/repositories/src/location-repository.ts',
  locationAdapter: 'apps/desktop/src/main/location-application-adapter.ts',
  locationRuntime: 'apps/desktop/src/main/location-production-policy-runtime.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  migrationManifest: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  authorizationApplication: 'packages/application/src/authorization-use-cases.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  coreService: 'apps/core-service/src/main.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  ipcMain: 'apps/desktop/src/main/main.ts',
  compositionRoot: 'apps/desktop/src/main/repository-composition-root.ts',
  timelineApplication: 'packages/application/src/timeline-use-cases.ts',
  timelineAdapter: 'apps/desktop/src/main/timeline-application-adapter.ts',
  dashboardContract: 'packages/repository-contracts/src/dashboard-repository.ts',
  dashboardApplication: 'packages/application/src/dashboard-use-cases.ts',
  dashboardAdapter: 'apps/desktop/src/main/dashboard-application-adapter.ts',
  dashboardRepository: 'packages/repositories/src/dashboard-repository.ts',
  bootstrapApplication: 'packages/application/src/bootstrap-use-cases.ts',
  bootstrapContract: 'packages/repository-contracts/src/bootstrap-repository.ts',
  bootstrapRepository: 'packages/repositories/src/bootstrap-repository.ts',
  importService: 'apps/desktop/src/main/family-data-import-service.ts',
  importContract: 'packages/repository-contracts/src/family-data-import-repository.ts',
  importRepository: 'packages/repositories/src/family-data-import-repository.ts',
  repositoryTest: 'packages/repositories/location-repository-policy.test.ts',
  runtimeTest: 'apps/desktop/tests/location-policy-enforcement-runtime.test.ts',
  crossSurfaceTest: 'apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts',
  largeReadContract: 'packages/repository-contracts/src/large-family-read-model-repository.ts',
  largeReadRepository: 'packages/repositories/src/large-family-read-model-repository.ts',
  largeReadService: 'apps/desktop/src/main/large-family-read-model-service.ts',
  largeTimelineTest: 'apps/desktop/tests/large-timeline-location-privacy-runtime.test.ts',
  ipcReadSharing: 'apps/desktop/src/main/ipc-read-sharing.ts',
  ipcSensitiveTest: 'apps/desktop/tests/location-sensitive-ipc-cache-policy-runtime.test.ts',
  ipcRuntimeReport: 'artifacts/validation/build162-ipc-read-sharing-runtime.json',
  ipcContractReport: 'artifacts/validation/build162-ipc-read-sharing-contract.json',
  contractSelf: 'scripts/verify-30-z-location-policy-enforcement-contract.mjs',
  packageJson: 'package.json'
};

const sourceEntries = await Promise.all(Object.entries(paths).map(async ([key, path]) => {
  try {
    const bytes = await readFile(path);
    return [key, bytes.toString('utf8'), bytes, undefined];
  } catch (error) {
    return [key, '', Buffer.alloc(0), error instanceof Error ? error.message : String(error)];
  }
}));
const source = Object.fromEntries(sourceEntries.map(([key, value]) => [key, value]));
const sourceBytes = Object.fromEntries(sourceEntries.map(([key, , bytes]) => [key, bytes]));
const sourceReadErrors = Object.fromEntries(
  sourceEntries.filter(([, , , error]) => error !== undefined).map(([key, , , error]) => [key, error])
);

const checks = [];
const failures = [];
const check = (condition, name, details) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};
const all = (key, markers, name) => check(
  markers.every((marker) => source[key].includes(marker)),
  name,
  { path: paths[key], markers }
);
const none = (key, markers, name) => check(
  markers.every((marker) => !source[key].includes(marker)),
  name,
  { path: paths[key], prohibitedMarkers: markers }
);
const parseJson = (key) => {
  try {
    return JSON.parse(source[key]);
  } catch {
    return undefined;
  }
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const exactObjectKeys = (value, expected) => (
  value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
);
const sourceKeyByPath = new Map(Object.entries(paths).map(([key, path]) => [path, key]));
const immutablePredecessorSpecifications = [
  ...Object.values(PREDECESSOR_TRUST_ROOT),
  ...PREDECESSOR_POSTCOMMIT.flatMap(({ stdout, stderr }) => [stdout, stderr])
];
const exactCurrentBytes = (specification) => {
  const key = sourceKeyByPath.get(specification.path);
  const bytes = key === undefined ? undefined : sourceBytes[key];
  return Buffer.isBuffer(bytes)
    && bytes.length === specification.bytes
    && sha256(bytes) === specification.sha256;
};
const exactImmutablePredecessorSource = () => (
  immutablePredecessorSpecifications.length === 20
    && new Set(immutablePredecessorSpecifications.map(({ path }) => path)).size === 20
    && immutablePredecessorSpecifications.every(exactCurrentBytes)
);
const exactPassBinding = (value, specification) => (
  exactObjectKeys(value, ['path', 'sizeBytes', 'sha256', 'status'])
    && value.path === specification.path
    && value.sizeBytes === specification.bytes
    && value.sha256 === specification.sha256
    && value.status === 'PASS'
);
const exactThreeFieldBinding = (value, specification) => (
  exactObjectKeys(value, ['path', 'sizeBytes', 'sha256'])
    && value.path === specification.path
    && value.sizeBytes === specification.bytes
    && value.sha256 === specification.sha256
);
const matchingPassBinding = (value, specification) => (
  value?.path === specification.path
    && value.sizeBytes === specification.bytes
    && value.sha256 === specification.sha256
    && value.status === 'PASS'
);
const exactPostcommitLogBinding = (value, specification) => (
  exactObjectKeys(value, ['path', 'sizeBytes', 'sha256', 'status'])
    && matchingPassBinding(value, specification)
);
const exactPostcommitCommands = (commands) => (
  Array.isArray(commands)
    && commands.length === PREDECESSOR_POSTCOMMIT.length
    && commands.every((command, index) => {
      const expected = PREDECESSOR_POSTCOMMIT[index];
      return exactObjectKeys(command, [
        'sequence',
        'name',
        'command',
        'exitCode',
        'realExitCodeObserved',
        'stdout',
        'stderr'
      ])
        && command.sequence === expected.sequence
        && command.name === expected.name
        && JSON.stringify(command.command) === JSON.stringify(expected.command)
        && Number.isInteger(command.exitCode)
        && command.exitCode === 0
        && command.realExitCodeObserved === true
        && exactPostcommitLogBinding(command.stdout, expected.stdout)
        && exactPostcommitLogBinding(command.stderr, expected.stderr);
    })
);
const exactCanonicalPredecessorProof = (value) => {
  const semanticCheckNames = [
    'postcommitProcesses',
    'canonicalReportExactCopy',
    'canonicalReportIndexedByExactHashAndSize',
    'completionCommittedExactlyOnce',
    'planCommitted',
    'ledgerCommitted',
    'registryRemainsPartial',
    'failureSetsStillExactUniqueDisjoint',
    'receiptChainStillExact',
    'dec137SuccessorAuthority',
    'openBoundariesPreserved',
    'progressPreserved',
    'governedPreflightPass'
  ];
  return Boolean(
    value?.schemaVersion === 1
      && value.release === 'Bronze 04.08.2026.29'
      && value.step === '30-Y'
      && value.requirement === 'PPK-002'
      && value.phase === 'COMPLETION_TRANSITION_CANONICAL_BINDING_VERIFICATION'
      && value.publicationState === 'CANONICAL_SOURCE_POSTCOMMIT_PROOF'
      && value.status === 'PASS'
      && value.completedAt === PREDECESSOR_COMPLETED_AT
      && value.mandatoryTruthSentence === TRUTH
      && exactThreeFieldBinding(value.canonicalTransition, PREDECESSOR_TRUST_ROOT.transition)
      && value.postcommitProcessExpected === 4
      && value.postcommitProcessExecuted === 4
      && value.postcommitProcessPassed === 4
      && value.postcommitProcessFailed === 0
      && exactPostcommitCommands(value.postcommitCommands)
      && exactObjectKeys(value.finalSemanticChecks, semanticCheckNames)
      && semanticCheckNames.every((name) => value.finalSemanticChecks[name] === true)
      && value.finalSemanticExpected === 13
      && value.finalSemanticPassed === 13
      && value.finalSemanticFailed === 0
      && value.failureSetsUniqueAndDisjoint === true
      && value.successorSelectionAuthorityDecision === 'DEC-137'
      && value.bronzeCompletedPercent === 25.0
      && value.silverStatus === 'FORBIDDEN_NOT_READY'
      && value.goldStatus === 'FORBIDDEN_NOT_READY'
      && value.officialCompletionClaimed === true
      && exactObjectKeys(value.immutableCompletion, ['path', 'sizeBytes', 'sha256', 'completedAt', 'status'])
      && matchingPassBinding(value.immutableCompletion, PREDECESSOR_TRUST_ROOT.completion)
      && value.immutableCompletion.completedAt === PREDECESSOR_COMPLETED_AT
  );
};
const exactPredecessorTransition = (value) => Boolean(
  value?.schemaVersion === 1
    && value.release === 'Bronze 04.08.2026.29'
    && value.step === '30-Y'
    && value.requirement === 'PPK-002'
    && value.phase === 'COMPLETION_TRANSITION_GOVERNANCE_VALIDATION'
    && value.publicationState === 'FINAL_CANONICAL_PASS'
    && value.semanticExpected === 34
    && value.semanticPassed === 34
    && value.semanticFailed === 0
    && value.semanticStatus === 'PASS'
    && exactObjectKeys(value.semanticChecks, Object.keys(value.semanticChecks ?? {}))
    && Object.keys(value.semanticChecks ?? {}).length === 34
    && Object.values(value.semanticChecks ?? {}).every((result) => result === true)
    && value.processExpected === 5
    && value.processExecuted === 5
    && value.processPassed === 5
    && value.processFailed === 0
    && value.processNotRun === 0
    && Array.isArray(value.commands)
    && value.commands.length === 5
    && value.commands.every((command, index) => (
      command?.sequence === index + 1
        && Number.isInteger(command.exitCode)
        && command.exitCode === 0
        && command.realExitCodeObserved === true
    ))
    && value.totalPreservedFailedAttempts === 16
    && value.failedAttemptsCountedAsPass === 0
    && value.status === 'PASS'
    && value.countsAsPass === true
    && value.completedAt === PREDECESSOR_COMPLETED_AT
    && value.mandatoryTruthSentence === TRUTH
);
const exactCompletionReceiptChain = (value) => {
  const exactBindings = value?.exactReceiptChainBindings;
  const exactBindingKeys = [
    'executionRecord',
    'libraryReceipt',
    'libraryReadback',
    'receiptReadback',
    'libraryReceiptSidecar',
    'libraryReadbackSidecar',
    'receiptReadbackSidecar',
    'receiptReadbackPersistence',
    'localPackageVerification',
    'checkpointArchive',
    'singleUploadBundle',
    'payloadArtifactCount',
    'payloadArtifacts'
  ];
  return Boolean(
    value?.schemaVersion === 1
      && value.release === 'Bronze 04.08.2026.29'
      && value.step === '30-Y'
      && value.requirement === 'PPK-002'
      && value.status === 'PASS'
      && value.officialStepStatus === 'COMPLETED'
      && value.validationStatus === 'PASS'
      && value.persistentReceiptStatus === 'PASS'
      && value.officialCompletionClaimed === true
      && value.totalPreservedFailedAttempts === 16
      && value.failedAttemptsCountedAsPass === 0
      && value.completedAt === PREDECESSOR_COMPLETED_AT
      && value.mandatoryTruthSentence === TRUTH
      && exactObjectKeys(exactBindings, exactBindingKeys)
      && exactPassBinding(exactBindings.executionRecord, PREDECESSOR_TRUST_ROOT.executionRecord)
      && exactPassBinding(exactBindings.libraryReceipt, PREDECESSOR_TRUST_ROOT.receipt)
      && exactPassBinding(exactBindings.libraryReadback, PREDECESSOR_TRUST_ROOT.libraryReadback)
      && exactPassBinding(exactBindings.receiptReadback, PREDECESSOR_TRUST_ROOT.receiptReadback)
      && exactPassBinding(exactBindings.receiptReadbackSidecar, PREDECESSOR_TRUST_ROOT.receiptReadbackSidecar)
      && exactPassBinding(exactBindings.receiptReadbackPersistence, PREDECESSOR_TRUST_ROOT.receiptReadbackPersistence)
      && exactPassBinding(exactBindings.localPackageVerification, PREDECESSOR_TRUST_ROOT.localPackageVerification)
      && exactBindings.payloadArtifactCount === 20
      && Array.isArray(exactBindings.payloadArtifacts)
      && exactBindings.payloadArtifacts.length === 20
      && new Set(exactBindings.payloadArtifacts.map(({ name }) => name)).size === 20
      && exactBindings.payloadArtifacts.every((artifact) => (
        Number.isInteger(artifact?.sizeBytes)
          && artifact.sizeBytes >= 0
          && Number.isInteger(artifact.roundTripSizeBytes)
          && artifact.roundTripSizeBytes === artifact.sizeBytes
          && typeof artifact.sha256 === 'string'
          && artifact.sha256 === artifact.roundTripSha256
          && artifact.roundTripMatch === 'PASS'
      ))
      && matchingPassBinding(value.libraryReceipt, PREDECESSOR_TRUST_ROOT.receipt)
      && matchingPassBinding(value.libraryReadback, PREDECESSOR_TRUST_ROOT.libraryReadback)
      && matchingPassBinding(value.receiptReadback, PREDECESSOR_TRUST_ROOT.receiptReadback)
      && matchingPassBinding(value.receiptReadbackPersistence, PREDECESSOR_TRUST_ROOT.receiptReadbackPersistence)
      && matchingPassBinding(value.localPackageVerification, PREDECESSOR_TRUST_ROOT.localPackageVerification)
      && matchingPassBinding(value.finalLibraryInventory, PREDECESSOR_TRUST_ROOT.finalInventory)
      && exactThreeFieldBinding(value.implementationValidation?.executionRecord, PREDECESSOR_TRUST_ROOT.executionRecord)
      && value.implementationValidation?.status === 'PASS'
      && value.implementationValidation.finalProcesses === 28
      && value.implementationValidation.postRecordProcesses === 5
      && value.implementationValidation.contractChecks === 68
      && value.implementationValidation.contractPassed === 68
      && value.implementationValidation.controlledRuntimeChecks === 35
      && value.implementationValidation.controlledRuntimePassed === 35
      && value.implementationValidation.combinedRegressionTests === 61
      && value.implementationValidation.combinedRegressionPassed === 61
      && value.implementationValidation.fullVitestTests === 130
      && value.implementationValidation.fullVitestPassed === 130
      && value.implementationValidation.executionRecordChecks === 73
      && value.implementationValidation.executionRecordPassed === 73
      && value.implementationValidation.localPackageChecks === 23
      && value.implementationValidation.localPackagePassed === 23
      && value.implementationValidation.fullBuild === 'PASS'
  );
};
const exactLinkedPredecessorSemantics = (documents) => Boolean(
  documents.transitionAttempt1Failure?.step === '30-Y'
    && documents.transitionAttempt1Failure.phase === 'COMPLETION_TRANSITION'
    && documents.transitionAttempt1Failure.status === 'FAIL'
    && documents.transitionAttempt1Failure.countsAsPass === false
    && documents.transitionAttempt1Failure.processExitCode === 1
    && documents.transitionAttempt1Failure.realExitCodeObserved === true
    && documents.transitionAttempt1Failure.mandatoryTruthSentence === TRUTH
    && documents.receipt?.step === '30-Y'
    && documents.receipt.status === 'PASS'
    && documents.receipt.validationStatus === 'PASS'
    && documents.receipt.persistentReceiptStatus === 'PASS'
    && documents.receipt.officialStepCompletionClaimed === false
    && documents.receipt.prePackagePreservedFailures === 15
    && documents.receipt.postPackagePreservedFailures === 0
    && documents.receipt.totalPreservedFailures === 15
    && documents.receipt.failuresCountedAsPass === 0
    && documents.receipt.mandatoryTruthSentence === TRUTH
    && documents.libraryReadback?.status === 'PASS'
    && documents.libraryReadback.expected === 20
    && documents.libraryReadback.executed === 20
    && documents.libraryReadback.matched === 20
    && documents.libraryReadback.failed === 0
    && documents.libraryReadback.zipExecuted === 3
    && documents.libraryReadback.zipPassed === 3
    && documents.libraryReadback.zipFailed === 0
    && documents.libraryReadback.mandatoryTruthSentence === TRUTH
    && documents.receiptReadback?.status === 'PASS'
    && documents.receiptReadback.expected === 4
    && documents.receiptReadback.executed === 4
    && documents.receiptReadback.matched === 4
    && documents.receiptReadback.failed === 0
    && documents.receiptReadback.mandatoryTruthSentence === TRUTH
    && documents.receiptReadbackPersistence?.status === 'PASS'
    && documents.receiptReadbackPersistence.expected === 2
    && documents.receiptReadbackPersistence.executed === 2
    && documents.receiptReadbackPersistence.matched === 2
    && documents.receiptReadbackPersistence.failed === 0
    && documents.receiptReadbackPersistence.mandatoryTruthSentence === TRUTH
    && documents.localPackageVerification?.status === 'PASS'
    && documents.localPackageVerification.countsAsPass === true
    && documents.localPackageVerification.processExitCode === 0
    && documents.localPackageVerification.realExitCodeObserved === true
    && documents.localPackageVerification.expected === 23
    && documents.localPackageVerification.executed === 23
    && documents.localPackageVerification.passed === 23
    && documents.localPackageVerification.failed === 0
    && documents.localPackageVerification.payloadFileCount === 20
    && documents.localPackageVerification.preservedFailedAttempts === 15
    && documents.localPackageVerification.failedAttemptsCountedAsPass === 0
    && documents.localPackageVerification.mandatoryTruthSentence === TRUTH
    && documents.executionRecord?.step === '30-Y'
    && documents.executionRecord.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'
    && documents.executionRecord.persistentReceiptStatus === 'PENDING'
    && documents.executionRecord.officialCompletionClaimed === false
    && documents.executionRecord.preservedFailedAttempts === 15
    && documents.executionRecord.failedAttemptsCountedAsPass === 0
    && documents.executionRecord.mandatoryTruthSentence === TRUTH
    && documents.finalInventory?.status === 'PASS'
    && documents.finalInventory.countsAsPass === true
    && documents.finalInventory.processExitCode === 0
    && documents.finalInventory.realExitCodeObserved === true
    && documents.finalInventory.expectedFiles === 27
    && documents.finalInventory.actualFiles === 27
    && documents.finalInventory.executed === 27
    && documents.finalInventory.matched === 27
    && documents.finalInventory.failed === 0
    && documents.finalInventory.sidecarExpected === 13
    && documents.finalInventory.sidecarExecuted === 13
    && documents.finalInventory.sidecarFailed === 0
    && documents.finalInventory.zipExpected === 3
    && documents.finalInventory.zipExecuted === 3
    && documents.finalInventory.zipFailed === 0
    && documents.finalInventory.totalPreservedFailures === 15
    && documents.finalInventory.failuresCountedAsPass === 0
    && documents.finalInventory.mandatoryTruthSentence === TRUTH
);
const cloneJson = (value) => JSON.parse(JSON.stringify(value));

check(Object.keys(sourceReadErrors).length === 0, 'all governed static contract sources are readable', sourceReadErrors);

const authority = parseJson('authority');
const selection = parseJson('selection');
const scope = parseJson('scope');
const statusReport = parseJson('statusReport');
const plan = parseJson('plan');
const ledger = parseJson('ledger');
const registry = parseJson('registry');
const predecessorCanonicalProof = parseJson('predecessorCanonicalProof');
const predecessorCompletion = parseJson('predecessorCompletion');
const predecessorReceipt = parseJson('predecessorReceipt');
const predecessorTransition = parseJson('predecessorTransition');
const predecessorTransitionAttempt1Failure = parseJson('predecessorTransitionAttempt1Failure');
const predecessorExecutionRecord = parseJson('predecessorExecutionRecord');
const predecessorLibraryReadback = parseJson('predecessorLibraryReadback');
const predecessorReceiptReadback = parseJson('predecessorReceiptReadback');
const predecessorReceiptReadbackPersistence = parseJson('predecessorReceiptReadbackPersistence');
const predecessorLocalPackageVerification = parseJson('predecessorLocalPackageVerification');
const predecessorFinalInventory = parseJson('predecessorFinalInventory');
const migrationManifest = parseJson('migrationManifest');
const ipcRuntimeReport = parseJson('ipcRuntimeReport');
const ipcContractReport = parseJson('ipcContractReport');
const packageJson = parseJson('packageJson');

check(
  authority?.step === '30-Z'
    && authority.status === 'PASS'
    && authority.selectionClass === 'CONTINUING_STARTED_P0_LOCATION_PRIVACY_SECURITY_AND_DATA_INTEGRITY_SLICE'
    && authority.selectedOpenFinding === 'UNIVERSAL_REPOSITORY_ENFORCEMENT_LOCATION_VERTICAL_SLICE'
    && authority.targetedBoundary === 'locationPolicyEnforcementVerticalSlice',
  'selection authority binds the exact 30-Z LOCATION slice'
);
check(
  authority?.predecessor?.step === '30-Y'
    && authority.predecessor.status === 'COMPLETED'
    && authority.predecessor.persistentReceiptStatus === 'PASS',
  'selection authority binds the completed 30-Y receipt chain'
);
check(
  selection?.status === 'PASS'
    && selection.semanticPassed === selection.semanticExpected
    && selection.processPassed === selection.processExpected
    && selection.processFailed === 0,
  'priority selection remains clean semantic and process PASS'
);
check(
  scope?.step === '30-Z'
    && scope.targets?.productionIpc?.join(',') === 'location:create'
    && scope.targets?.repositoryOperations?.join(',') === 'findById,insert,listByFamily'
    && scope.targets?.writeTables?.join(',') === 'locations',
  'scope binds the exact LOCATION IPC, repository operations and write table'
);
check(
  scope?.targets?.policyIntent?.read?.action === 'read'
    && scope.targets.policyIntent.read.capability === 'location.read'
    && scope.targets.policyIntent.create?.action === 'create'
    && scope.targets.policyIntent.create.capability === 'family.write'
    && scope.targets.policyIntent.resourceType === 'location'
    && scope.targets.policyIntent.purpose === 'general'
    && scope.targets.policyIntent.familyReadForLocationReads === 'PROHIBITED',
  'scope binds location.read read and family.write create with location/general semantics'
);
check(
  scope?.targets?.policyIntent?.savedRowSecurityClassification?.policySensitivity === 'FIXED_HIGHLY_SENSITIVE'
    && scope.targets.policyIntent.savedRowSecurityClassification.privacyColumn === 'PROHIBITED_NOT_AUTHORIZED'
    && scope.targets.policyIntent.savedRowSecurityClassification.aiProcessingAllowedColumn === 'PROHIBITED_NOT_AUTHORIZED'
    && scope.targets.policyIntent.savedRowSecurityClassification.legacyRepairOrClaimWorkflow === 'REQUIRED_BEFORE_VISIBILITY_NOT_IN_SCOPE',
  'scope preserves fixed classification and the legacy quarantine boundary'
);
check(
  scope?.targets?.policyIntent?.readGrantDuration?.nonOwnerAllow === 'FINITE_ENDS_AT_REQUIRED'
    && scope.targets.policyIntent.readGrantDuration.deny === 'OPEN_END_ALLOWED'
    && scope.targets.policyIntent.readGrantDuration.eligibleTargetRows === 'GOVERNED_RECEIPT_BEARING_OWNED_BY_ANOTHER_ACTIVE_PERSON_ONLY',
  'scope preserves finite non-owner grants and open-ended deny semantics'
);

const activeSteps = Array.isArray(plan?.steps) ? plan.steps.filter((step) => step.status === 'IN_PROGRESS') : [];
const step30Z = Array.isArray(plan?.steps) ? plan.steps.find((step) => step.id === '30-Z') : undefined;
const step30Y = Array.isArray(plan?.steps) ? plan.steps.find((step) => step.id === '30-Y') : undefined;
const successor31AActive = plan?.currentStep === '31-A'
  && activeSteps.length === 1
  && activeSteps[0]?.id === '31-A'
  && activeSteps[0]?.status === 'IN_PROGRESS'
  && activeSteps[0]?.persistentReceiptStatus === 'PENDING';
const step31A = Array.isArray(plan?.steps) ? plan.steps.find((step) => step.id === '31-A') : undefined;
const successor31ACompleted = plan?.currentStep === '31-A'
  && activeSteps.length === 0
  && step31A?.status === 'COMPLETED'
  && step31A.validationStatus === 'PASS'
  && step31A.persistentReceiptStatus === 'PASS';
const step31B = Array.isArray(plan?.steps) ? plan.steps.find((step) => step.id === '31-B') : undefined;
const successor31BActive = plan?.currentStep === '31-B' && activeSteps.length === 1 && activeSteps[0]?.id === '31-B' && activeSteps[0]?.persistentReceiptStatus === 'PENDING';
const successor31BCompleted = plan?.currentStep === '31-B' && activeSteps.length === 0 && step31B?.status === 'COMPLETED' && step31B.validationStatus === 'PASS' && step31B.persistentReceiptStatus === 'PASS';
const step31C = Array.isArray(plan?.steps) ? plan.steps.find((step) => step.id === '31-C') : undefined;
const successor31CActive = plan?.currentStep === '31-C' && activeSteps.length === 1 && activeSteps[0]?.id === '31-C' && activeSteps[0]?.persistentReceiptStatus === 'PENDING' && step31B?.status === 'COMPLETED';
const successor31CCompleted = plan?.currentStep === '31-C' && activeSteps.length === 0 && step31B?.status === 'COMPLETED' && step31C?.status === 'COMPLETED' && step31C.validationStatus === 'PASS' && step31C.persistentReceiptStatus === 'PASS';
const step31D = Array.isArray(plan?.steps) ? plan.steps.find((step) => step.id === '31-D') : undefined;
const successor31DCompleted = plan?.currentStep === '31-D' && activeSteps.length === 0 && step31C?.status === 'COMPLETED' && step31D?.status === 'COMPLETED' && step31D.validationStatus === 'PASS' && step31D.persistentReceiptStatus === 'PASS';
const step31E = Array.isArray(plan?.steps) ? plan.steps.find((step) => step.id === '31-E') : undefined;
const successor31ECompleted = plan?.currentStep === '31-E' && activeSteps.length === 0 && step31D?.status === 'COMPLETED' && step31E?.status === 'COMPLETED' && step31E.validationStatus === 'PASS' && step31E.persistentReceiptStatus === 'PASS';
const step31F = Array.isArray(plan?.steps) ? plan.steps.find((step) => step.id === '31-F') : undefined;
const successor31FCompleted = plan?.currentStep === '31-F' && activeSteps.length === 0 && step31E?.status === 'COMPLETED' && step31F?.status === 'COMPLETED' && step31F.validationStatus === 'PASS' && step31F.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-F' });
const completed30Z = step30Z?.status === 'COMPLETED'
  && step30Z.validationStatus === 'PASS'
  && step30Z.persistentReceiptStatus === 'PASS'
  && step30Z.persistentReceiptPath === 'artifacts/checkpoints/30-Z_LIBRARY_RECEIPT.json'
  && step30Z.completionTransitionStatus === 'PASS'
  && ((plan?.currentStep === '30-Z' && activeSteps.length === 0) || successor31AActive || successor31ACompleted || successor31BActive || successor31BCompleted || successor31CActive || successor31CCompleted || successor31DCompleted || successor31ECompleted || successor31FCompleted || laterSuccessor.planValid);
const pending30Z = plan?.currentStep === '30-Z'
  && activeSteps.length === 1
  && activeSteps[0]?.id === '30-Z'
  && step30Z?.status === 'IN_PROGRESS'
  && step30Z.persistentReceiptStatus === 'PENDING';
check(
  pending30Z || completed30Z,
  'work plan has a valid pending or completed receipt-bounded 30-Z lifecycle'
);
check(
  step30Y?.status === 'COMPLETED'
    && step30Y.validationStatus === 'PASS'
    && step30Y.persistentReceiptStatus === 'PASS',
  'work plan preserves completed 30-Y'
);
check(
  (pending30Z
    && ledger?.activeMicroStep === '30-Z'
    && String(ledger?.nextOfficialTask ?? '').startsWith('30-Z'))
  || (completed30Z
    && ((ledger?.activeMicroStep === null
      && ledger?.libraryUploadStatus === '30-Z_COMPLETED_RECEIPT_PASS'
      && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_30-Z_PERSISTENT_RECEIPT')
    || (successor31AActive
      && ledger?.activeMicroStep === '31-A'
      && ledger?.libraryUploadStatus === '31-A_IN_PROGRESS_PREDECESSOR_30-Z_RECEIPT_CHAIN_PASS'
      && String(ledger?.nextOfficialTask ?? '').startsWith('31-A'))
    || (successor31ACompleted
      && ledger?.activeMicroStep === null
      && ledger?.libraryUploadStatus === '31-A_COMPLETED_RECEIPT_PASS'
      && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-A_PERSISTENT_RECEIPT')
    || (successor31BActive
      && ledger?.activeMicroStep === '31-B'
      && ['31-B_IN_PROGRESS_PREDECESSOR_31-A_RECEIPT_CHAIN_PASS', '31-B_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger?.libraryUploadStatus)
      && String(ledger?.nextOfficialTask ?? '').startsWith('31-B'))
    || (successor31BCompleted
      && ledger?.activeMicroStep === null
      && ledger?.libraryUploadStatus === '31-B_COMPLETED_RECEIPT_PASS'
      && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-B_PERSISTENT_RECEIPT')
    || (successor31CActive
      && ledger?.activeMicroStep === '31-C'
      && ['31-C_IN_PROGRESS_PREDECESSOR_31-B_RECEIPT_CHAIN_PASS', '31-C_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger?.libraryUploadStatus)
      && String(ledger?.nextOfficialTask ?? '').startsWith('31-C'))
    || (successor31CCompleted
      && ledger?.activeMicroStep === null
      && ledger?.libraryUploadStatus === '31-C_COMPLETED_RECEIPT_PASS'
      && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-C_PERSISTENT_RECEIPT')
    || (successor31DCompleted
      && ledger?.activeMicroStep === null
      && ledger?.libraryUploadStatus === '31-D_COMPLETED_RECEIPT_PASS'
      && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-D_PERSISTENT_RECEIPT')
    || (successor31ECompleted
      && ledger?.activeMicroStep === null
      && ledger?.libraryUploadStatus === '31-E_COMPLETED_RECEIPT_PASS'
      && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-E_PERSISTENT_RECEIPT')
    || (successor31FCompleted
      && ledger?.activeMicroStep === null
      && ledger?.libraryUploadStatus === '31-F_COMPLETED_RECEIPT_PASS'
      && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-F_PERSISTENT_RECEIPT')
    || (laterSuccessor.ledgerValid && laterSuccessor.nextTaskValid))),
  'governance ledger matches the pending or completed 30-Z lifecycle'
);
const ppk002 = registry?.requirements?.find((item) => item.id === 'PPK-002');
check(
  ppk002?.status === 'PARTIAL'
    && ppk002.chain?.repository === false
    && ppk002.evidence?.includes('artifacts/authority/30-Z_AUTO_PRIORITY_SELECTION_AUTHORITY.json'),
  'accepted scope keeps PPK-002 PARTIAL without a universal repository claim'
);
const predecessorDocuments = Object.freeze({
  transitionAttempt1Failure: predecessorTransitionAttempt1Failure,
  receipt: predecessorReceipt,
  libraryReadback: predecessorLibraryReadback,
  receiptReadback: predecessorReceiptReadback,
  receiptReadbackPersistence: predecessorReceiptReadbackPersistence,
  localPackageVerification: predecessorLocalPackageVerification,
  executionRecord: predecessorExecutionRecord,
  finalInventory: predecessorFinalInventory
});
check(
  exactImmutablePredecessorSource(),
  '30-Y immutable post-receipt trust root is exact for all 20 current source artifacts',
  {
    count: immutablePredecessorSpecifications.length,
    bindings: immutablePredecessorSpecifications.map(({ path, bytes, sha256: digest }) => ({
      path,
      sizeBytes: bytes,
      sha256: digest
    }))
  }
);
check(
  exactCanonicalPredecessorProof(predecessorCanonicalProof),
  '30-Y canonical proof binds exact transition, completion, four postcommit processes and eight immutable logs'
);
check(
  exactPredecessorTransition(predecessorTransition),
  '30-Y canonical transition remains exact 34/34 semantic and 5/5 real-process PASS at the immutable completion time'
);
check(
  exactCompletionReceiptChain(predecessorCompletion),
  '30-Y completion exactReceiptChainBindings match current receipt, readbacks, persistence, package, execution and final inventory evidence'
);
check(
  exactLinkedPredecessorSemantics(predecessorDocuments),
  '30-Y linked predecessor evidence preserves exact semantic counts, pending-before-receipt states and failed-attempt truth'
);

const mutatedCanonicalTransition = cloneJson(predecessorCanonicalProof);
mutatedCanonicalTransition.canonicalTransition.sha256 = '0'.repeat(64);
const mutatedCanonicalArgv = cloneJson(predecessorCanonicalProof);
mutatedCanonicalArgv.postcommitCommands[0].command[1] = 'scripts/forged.mjs';
const mutatedCanonicalExit = cloneJson(predecessorCanonicalProof);
mutatedCanonicalExit.postcommitCommands[1].exitCode = true;
const mutatedCanonicalLog = cloneJson(predecessorCanonicalProof);
mutatedCanonicalLog.postcommitCommands[2].stdout.sha256 = 'f'.repeat(64);
const mutatedTransition = cloneJson(predecessorTransition);
mutatedTransition.semanticPassed = 33;
const mutatedCompletionReceipt = cloneJson(predecessorCompletion);
mutatedCompletionReceipt.exactReceiptChainBindings.libraryReceipt.sha256 = '1'.repeat(64);
const mutatedCompletionInventory = cloneJson(predecessorCompletion);
mutatedCompletionInventory.finalLibraryInventory.sha256 = '2'.repeat(64);
const mutatedLinkedDocuments = cloneJson(predecessorDocuments);
mutatedLinkedDocuments.finalInventory.status = 'FAIL';
const predecessorMutationRejections = [
  !exactCanonicalPredecessorProof(mutatedCanonicalTransition),
  !exactCanonicalPredecessorProof(mutatedCanonicalArgv),
  !exactCanonicalPredecessorProof(mutatedCanonicalExit),
  !exactCanonicalPredecessorProof(mutatedCanonicalLog),
  !exactPredecessorTransition(mutatedTransition),
  !exactCompletionReceiptChain(mutatedCompletionReceipt),
  !exactCompletionReceiptChain(mutatedCompletionInventory),
  !exactLinkedPredecessorSemantics(mutatedLinkedDocuments),
  !exactCurrentBytes({
    ...PREDECESSOR_TRUST_ROOT.completion,
    sha256: '3'.repeat(64)
  }),
  !exactCurrentBytes({
    ...PREDECESSOR_TRUST_ROOT.canonicalProof,
    bytes: PREDECESSOR_TRUST_ROOT.canonicalProof.bytes + 1
  })
];
check(
  predecessorMutationRejections.length === 10
    && predecessorMutationRejections.every((rejected) => rejected === true),
  '30-Y predecessor mutation self-test rejects SHA, size, argv, exit, log, semantic and receipt-chain drift',
  { negativeCases: predecessorMutationRejections.length, rejected: predecessorMutationRejections.filter(Boolean).length }
);
all('decision', [
  '# DEC-151',
  '`location.read`',
  '`family.write`',
  '`family.read`',
  '`location.share`',
  '`highly_sensitive`',
  '`NOT_COMPLETE_MULTI_RECEIPT_BATCH_REQUIRED`',
  '`NOT_COMPLETE_GOVERNED_DELETION_REQUIRED`'
], 'DEC-151 binds policy semantics and explicitly open boundaries');

all('locationApplication', [
  "readonly action: 'read' | 'create'",
  "readonly capability: 'location.read' | 'family.write'",
  "readonly resourceType: 'location'",
  "readonly purpose: 'general'",
  "readonly sensitivity: 'highly_sensitive'",
  "action: 'create'",
  "capability: 'family.write'",
  "action: 'location.created'",
  "eventType: 'location.created'",
  'payload: { locationId: record.id, kind: record.kind }'
], 'LOCATION use case binds exact create, audit and metadata-minimized outbox semantics');
none('locationApplication', ["'family.read'", "'location.share'", 'privacy', 'ai_processing_allowed'], 'saved LOCATION use case has no stale or unauthorized policy vocabulary');

const locationPortMatch = source.locationContract.match(/export interface LocationRepositoryPort \{([\s\S]*?)\n\}/u);
const locationPortBody = locationPortMatch?.[1] ?? '';
const locationPortOperations = [...locationPortBody.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\(/gmu)].map((match) => match[1]);
check(
  locationPortOperations.join(',') === 'findById,insert,listByFamily'
    && (locationPortBody.match(/context: PolicyAuthorizedRepositoryExecutionContext/gu) ?? []).length === 3
    && !locationPortBody.includes('context: RepositoryExecutionContext'),
  'exactly three LOCATION business repository operations require PolicyAuthorized context',
  { operations: locationPortOperations }
);
check(
  !/\b(update|delete|remove)\s*\(/u.test(locationPortBody),
  'LOCATION business repository contract exposes no update or delete operation'
);
all('locationContract', [
  'readonly ownerPersonId: PersonId',
  'findLocationForPolicyResolution(',
  'context: RepositoryExecutionContext'
], 'narrow policy resource resolver remains separate from the three business operations');

all('locationRepository', [
  "resourceType: 'location'",
  "action: 'read'",
  "capability: 'location.read'",
  "capability: 'family.write'",
  "request.purpose !== 'general'",
  "request.resource.sensitivity !== 'highly_sensitive'",
  'WHERE id=? AND family_id=?',
  'WHERE family_id=?',
  'locations.owner_person_id IS NOT NULL',
  'create_receipt.receipt_hash=locations.policy_receipt_hash',
  'create_projection.receipt_hash=create_receipt.receipt_hash',
  "location_owner.status='active'",
  "denied.effect='deny'",
  "allowed.effect='allow'",
  'allowed.ends_at IS NOT NULL',
  "action.value='read'",
  "platformPolicyPersistenceBinding(context, 'location', location.id)",
  'policy_receipt_hash,policy_receipt_version,policy_receipt_nonce'
], 'LOCATION repository enforces family, provenance, quarantine, deny precedence and finite grants');
none('locationRepository', ["'family.read'", "'location.share'", 'privacy', 'ai_processing_allowed'], 'saved LOCATION repository has no stale or unauthorized policy vocabulary');

all('locationAdapter', [
  'export class RepositoryBackedLocationPolicyTransactionRunner',
  'PolicyAuthorizedRepositoryExecutionContext',
  'assertActivePlatformPolicyTransactionContext',
  "capability: 'location.read'",
  "resourceType: 'location'",
  "purpose: 'general'",
  "sensitivity: 'highly_sensitive'",
  'locationCollectionReadIntent()',
  'locationExactReadIntent(locationId)',
  'export class RepositoryBackedLocationUnitOfWork'
], 'LOCATION adapter shares the governed same-transaction runner across reads and writes');
none('locationAdapter', ["'family.read'", "'location.share'", 'privacy', 'ai_processing_allowed'], 'saved LOCATION adapter has no stale or unauthorized policy vocabulary');

all('locationRuntime', [
  "locationResourceTypes = new Set<LocationPolicyIntent['resourceType']>(['location'])",
  "row.actions.length === 1",
  "row.actions[0] === 'read'",
  "row.purpose === 'general'",
  'row.familyBranchId === undefined',
  "row.effect !== 'allow' || endsAt !== undefined",
  "requestedIntent.purpose !== 'general'",
  "requestedIntent.sensitivity !== 'highly_sensitive'",
  "requestedIntent.capability !== 'location.read'",
  "requestedIntent.capability !== 'family.write'",
  'findLocationForPolicyResolution(',
  'revalidateProductionTransaction(',
  'recordAuthorizedTransaction',
  'deferAllowedReceiptPersistence: true'
], 'production LOCATION runtime validates exact intents, finite grants and transaction revalidation');
none('locationRuntime', ["'family.read'", "'location.share'", 'privacy', 'ai_processing_allowed'], 'production saved LOCATION runtime has no stale LIFE or live-share branch');

const locationSqlMatch = source.migration.match(/const locationPolicyReceiptFenceSql = `([\s\S]*?)`;/u);
const normalizedLocationSql = locationSqlMatch
  ? locationSqlMatch[1].replace(/\r\n/gu, '\n').trim() + '\n'
  : '';
const computedMigrationChecksum = normalizedLocationSql ? sha256(normalizedLocationSql) : 'UNAVAILABLE';
const manifestMigration66 = migrationManifest?.migrationVersions?.find?.((item) => item.version === 66);
check(
  computedMigrationChecksum === EXPECTED_MIGRATION_CHECKSUM
    && manifestMigration66?.name === 'location_policy_receipt_fence'
    && manifestMigration66.checksum === EXPECTED_MIGRATION_CHECKSUM,
  'migration 66 source and manifest retain the exact governed checksum',
  { expected: EXPECTED_MIGRATION_CHECKSUM, computed: computedMigrationChecksum, manifest: manifestMigration66 }
);
check(
  [
    'ADD COLUMN owner_person_id TEXT REFERENCES people(id) ON DELETE RESTRICT',
    'ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts(receipt_hash) ON DELETE RESTRICT',
    'ADD COLUMN policy_receipt_version INTEGER',
    'ADD COLUMN policy_receipt_nonce TEXT',
    'ADD COLUMN policy_correlation_id TEXT',
    'ADD COLUMN policy_resource_type TEXT',
    'ADD COLUMN policy_resource_id TEXT',
    'ADD COLUMN policy_action TEXT',
    'ADD COLUMN policy_capability TEXT',
    'CREATE TRIGGER trg_platform_policy_location_insert',
    "receipt.resource_type='location'",
    "receipt.action='create'",
    "receipt.capability='family.write'",
    "json_extract(receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'",
    "json_extract(receipt.record_json,'$.request.purpose')='general'",
    'CREATE TRIGGER trg_platform_policy_location_update',
    "RAISE(ABORT,'GOVERNED_UPDATE_WORKFLOW_REQUIRED')",
    'CREATE TRIGGER trg_platform_policy_location_delete',
    'WHEN OLD.policy_receipt_hash IS NOT NULL',
    "RAISE(ABORT,'GOVERNED_DELETION_WORKFLOW_REQUIRED')",
    'REVISION-30-Z-PPK-002-LOCATION-POLICY-RECEIPT-FENCE'
  ].every((marker) => normalizedLocationSql.includes(marker)),
  'migration 66 binds nullable owner, exact receipt fields, direct-write fence and incomplete mutations'
);
check(
  !normalizedLocationSql.includes('privacy')
    && !normalizedLocationSql.includes('ai_processing_allowed')
    && !normalizedLocationSql.includes('location.share')
    && !normalizedLocationSql.includes('family.read'),
  'migration 66 adds no unauthorized saved-location policy columns or capabilities'
);

all('authorizationApplication', [
  "resourceType === 'location'",
  "actions.length !== 1",
  "actions[0] !== 'read'",
  "(input.command.purpose ?? 'general') !== 'general'",
  'input.command.familyBranchId !== undefined',
  "input.command.effect === 'allow'",
  '&& !endsAt'
], 'server permission boundary requires finite general branchless read-only LOCATION allow grants');
all('renderer', [
  "const locationResourceSelected=resourceType==='location'",
  "if(value==='location'){setPurpose('general');setActions(['read']);setFamilyBranchId('');}",
  "if(resourceType==='location'&&familyBranchId)",
  "if(resourceType==='location'&&effect==='allow'&&!endsOn)",
  "required={locationResourceSelected&&effect==='allow'}",
  "disabled={locationResourceSelected&&a!=='read'}",
  'Konum erişimi süresiz verilemez.'
], 'permission UI mirrors finite, general, branchless and read-only LOCATION grant rules');

const windowsDesktopCapabilities = source.coreService.match(/'windows-desktop':\s*\[([^\]]*)\]/u)?.[1] ?? '';
check(
  windowsDesktopCapabilities.includes("'location.read'")
    && !windowsDesktopCapabilities.includes("'location.share'")
    && (windowsDesktopCapabilities.match(/'location\.read'/gu) ?? []).length === 1,
  'windows-desktop exposes saved-location read only, without live-share capability',
  { sourceFragment: windowsDesktopCapabilities.trim() }
);

all('compositionRoot', [
  'LocationPolicyResourceRepositoryPort',
  'readonly locationRepository: LocationRepositoryPort & LocationPolicyResourceRepositoryPort',
  'locationRepository: new SqliteLocationRepository()'
], 'composition root exposes one repository for governed LOCATION business and resolution paths');
all('dataStore', [
  'createLocationProductionPolicyEnforcementPointResolver({',
  'locationPolicyResourceRepository: this.#repositories.locationRepository',
  'const locationPolicyTransactionRunner = new RepositoryBackedLocationPolicyTransactionRunner(',
  'new RepositoryBackedLocationUnitOfWork(',
  'locationPolicyTransactionRunner',
  'const timelinePolicyTransactionRunner = new RepositoryBackedTimelinePolicyTransactionRunner(',
  'new RepositoryBackedTimelineQueryPort(',
  'timelinePolicyTransactionRunner',
  'new RepositoryBackedDashboardQueryPort({',
  'public async getDashboardOverview(): Promise<DashboardOverviewView>',
  'public async getSnapshotSections(input: FamilySnapshotSectionsInput): Promise<FamilySnapshotPatchView>',
  'public async getSnapshot(): Promise<FamilyAppSnapshot>',
  'public async createLocation(input: CreateFamilyLocationInput): Promise<FamilyMutationResultView>',
  'public async createEvent(input: CreateFamilyEventInput): Promise<FamilyMutationResultView>',
  'public async updateFamilyEvent(input: UpdateFamilyEventInput): Promise<FamilyMutationResultView>'
], 'DataStore composes one shared LOCATION runner and asynchronous governed surfaces');
const locationContextMatch = source.dataStore.match(/#locationApplicationContext\(prefix: string\): LocationApplicationContext \{([\s\S]*?)\n\s*\}\n\s*#timelineApplicationContext/u);
const locationContextSource = locationContextMatch?.[1] ?? '';
check(
  locationContextSource.includes('personRepository.findById')
    && locationContextSource.includes("person.value.status !== 'active'")
    && locationContextSource.includes('familyId: person.value.familyId')
    && !locationContextSource.includes('family-main'),
  'DataStore derives LOCATION family context from the actual active person membership'
);
check(
  /#timelineApplicationContext[\s\S]*?const location = this\.#locationApplicationContext\(prefix\)/u.test(source.dataStore)
    && /#dashboardApplicationContext[\s\S]*?const location = this\.#locationApplicationContext\(prefix\)/u.test(source.dataStore),
  'timeline and dashboard contexts reuse the actual LOCATION family binding'
);
for (const [channel, awaitedCall] of [
  ['timeline:createImportantDay', 'await store().createEvent(input)'],
  ['timeline:updateEvent', 'await store().updateFamilyEvent(input)'],
  ['location:create', 'await store().createLocation(input)']
]) {
  check(
    source.ipcMain.includes(`registerIpcHandler('${channel}', async`)
      && source.ipcMain.includes(awaitedCall),
    `IPC ${channel} awaits the asynchronous governed DataStore operation`
  );
}

all('timelineApplication', [
  'governedLocationReadId?: string',
  'scope.findLocation(input.command.locationId)',
  '...(input.command.locationId ? { governedLocationReadId: input.command.locationId } : {})',
  'Promise<Result<TimelineEventRecord | null, AppError>>'
], 'timeline application requires governed exact lookup for linked saved locations');
all('timelineAdapter', [
  'locationCollectionReadIntent()',
  'locationExactReadIntent(options.governedLocationReadId)',
  'private readonly locationProof: TimelineLocationProof | undefined',
  'this.dependencies.locationRepository.findById(',
  'options.governedLocationReadId!',
  'receiptHash: computePlatformPolicyReceiptHash(authorization.receiptRecord.receipt)',
  'sourceLocationReceiptHash',
  'const { locationId: _locationId, locationLabel: _locationLabel, ...redacted } = event',
  'locationPolicyTransactionRunner.execute(',
  'operation(new RepositoryBackedTimelineWriteScope('
], 'timeline uses same-transaction exact lookup and redacts cached location identity and label');
all('dashboardApplication', [
  'Promise<Result<DashboardQueryRecord, AppError>>',
  'public async execute('
], 'dashboard application contract is asynchronous');
all('dashboardAdapter', [
  'locationCollectionReadIntent()',
  'locationPolicyTransactionRunner.execute(',
  'locationRepository.listByFamily(repository, context.familyId)',
  'dashboardRepository.loadSummary(repository, context.familyId, locations.value)'
], 'dashboard loads its LOCATION projection inside the governed collection transaction');
all('dashboardRepository', [
  'visibleLocations.length',
  'sanitizeEventLocations(',
  'const {locationId:_locationId,locationLabel:_locationLabel,...redacted}=event'
], 'dashboard count and cached event location data derive only from governed visible locations');
none('dashboardRepository', ['SELECT COUNT(*) AS value FROM locations', 'FROM locations WHERE'], 'dashboard has no raw saved-location count or projection query');

all('bootstrapApplication', [
  "input.seed.locations.length > 0 || input.seed.events.some((event) => event.locationId !== undefined)",
  "status: 'FAIL_CLOSED'",
  "Omit<BootstrapSeedData, 'locations' | 'events'>",
  "Omit<BootstrapSeedEvent, 'locationId'>"
], 'bootstrap rejects locations and event.locationId before its write unit of work');
none('bootstrapRepository', ['INSERT INTO locations'], 'bootstrap repository has no raw LOCATION insert path');
all('importService', [
  "'import.location_policy_batch_required'",
  "'import.event_location_policy_batch_required'",
  "kind: 'created-location-read'",
  'createKey: `location:${row.targetLocationId}`',
  "key: `event-location-read:${row.targetId}`",
  'sourceLocationReceiptHash: locationBinding.receiptHash'
], 'family import governs reused and newly-created location reads through receipt-bound batch requests');
check(source.importService.includes('locationRepository.insert(governedRepository') && !source.importService.includes('locationRepository.insert(repository') && !source.importService.includes('INSERT INTO locations'), 'family import service has only receipt-authorized LOCATION repository writes and no raw SQL writer');
none('importRepository', ['INSERT INTO locations', 'SELECT id,label,address,latitude,longitude,kind FROM locations'], 'family import repository has no raw LOCATION projection or writer');
all('importRepository', [
  "AND policy_receipt_hash IS NOT NULL",
  'Governed policy receipt',
  'hasGovernedRollbackFence',
  '!hasGovernedRollbackFence',
  'policyContexts.get',
  'family_data_import_rollback_deletions'
], 'family import rollback preserves null-receipt legacy rows and requires exact governed delete receipts');

all('repositoryTest', [
  'quarantines legacy rows and enforces family, finite allow, deny and lifecycle filters',
  "addPermission(database, 'allow-legacy'",
  "expect(repository).not.toHaveProperty('update')",
  "expect(repository).not.toHaveProperty('delete')",
  'migration 66 LOCATION durable policy receipt fence',
  "expect(columns).not.toContain('privacy')",
  "expect(columns).not.toContain('ai_processing_allowed')",
  'GOVERNED_UPDATE_WORKFLOW_REQUIRED',
  'GOVERNED_DELETION_WORKFLOW_REQUIRED'
], 'repository and migration tests encode quarantine, direct-write and incomplete mutation boundaries');
all('runtimeTest', [
  'uses location.read with a fixed highly-sensitive collection envelope',
  'requires a finite explicit grant for a cross-owner exact read and honors expiry and revocation',
  'fails closed for open-ended, branch-scoped or multi-action location permission rows',
  'revalidates authority inside the transaction and blocks a grant revoked after receipt issuance',
  'keeps the location-created outbox payload free of personal metadata',
  'has no stale privacy, family.read or location.share production branches in the runtime source'
], 'runtime tests statically cover exact policy, expiry, revocation, revalidation and metadata minimization');
all('crossSurfaceTest', [
  'redacts cached event location data after revocation',
  'keeps linked writes in the same SQLite transaction',
  'derives dashboard location count and cached-event redaction only from the governed visible-location set',
  'rejects non-empty bootstrap locations before opening a write transaction',
  'rejects bootstrap events that reference a saved location before opening a write transaction',
  'rejects import documents containing locations or locationId without a raw location repository dependency',
  'blocks governed imported-location rollback while preserving eligible null-receipt legacy rollback'
], 'cross-surface tests statically cover timeline, dashboard, bootstrap, import and rollback boundaries');
all('largeReadContract', [
  "extends Omit<FamilyEventView, 'locationId' | 'locationLabel'>",
  'readonly linkedLocationId?: string',
  'readonly freeformLocationLabel?: string',
  'listTimelinePage(context:PolicyAuthorizedRepositoryExecutionContext',
  'visibleLocationIds:readonly string[]',
  'locationIdsMatchingQuery?:readonly string[]'
], 'large timeline contract treats cached linked-location data as an untrusted internal projection');
all('largeReadRepository', [
  'assertTimelineLocationReadBinding(context,input.familyId)',
  "resourceType:'location',resourceId:'*',action:'read',capability:'location.read'",
  "e.location_id IS NULL AND COALESCE(e.location_label,'') LIKE",
  'location search ids must be a subset of the governed visible-location snapshot',
  'THEN e.location_id ELSE NULL END governed_location_id',
  'locationIdsMatchingQuery',
  'CASE WHEN e.location_id IS NULL THEN e.location_label ELSE NULL END freeform_location_label'
], 'large timeline SQL binds the governed family/person envelope and never searches or projects cached saved-location labels');
all('largeReadService', [
  'locationPolicyTransactionRunner.execute(applicationContext,locationCollectionReadIntent()',
  'locationRepository.listByFamily(repository,applicationContext.familyId)',
  'const visibleLocationIds=[...visibleLocationsById.keys()]',
  'familyId:applicationContext.familyId',
  'visibleLocationsById.get(linkedLocationId)',
  'locationLabel:location.label'
], 'large timeline projection uses the governed location set, actual family context and authoritative labels');
all('largeTimelineTest', [
  'uses one governed collection transaction, authoritative labels and revocation-safe redaction',
  'does not turn a denied or expired location decision into a generic-read fallback',
  'keeps cached saved-location labels out of SQL search and projection',
  'rejects a forged repository context before any raw timeline SQL can run',
  "governed_location_id:'location-visible'",
  "governed_location_id:null"
], 'large timeline adversarial tests cover same-transaction binding, denial, redaction and raw-SQL fencing');

const sensitiveIpcDeclaration = source.ipcReadSharing.match(
  /export const IPC_POLICY_SENSITIVE_READ_CHANNELS = Object\.freeze\(\[([\s\S]*?)\]\s+as const\);/u
)?.[1] ?? '';
const declaredSensitiveIpcChannels = [...sensitiveIpcDeclaration.matchAll(/'([^']+)'/gu)]
  .map(([, channel]) => channel);
check(
  JSON.stringify(declaredSensitiveIpcChannels) === JSON.stringify(LOCATION_POLICY_SENSITIVE_IPC_CHANNELS)
    && source.ipcReadSharing.includes('const policySensitiveChannels = new Set<string>(IPC_POLICY_SENSITIVE_READ_CHANNELS)')
    && source.ipcReadSharing.includes('if (policySensitiveChannels.has(channel)) return disabledPolicy;')
    && source.ipcReadSharing.includes('enabled: false')
    && source.ipcReadSharing.includes('ttlMs: 0')
    && source.ipcReadSharing.includes('maxEntries: 0')
    && source.ipcReadSharing.includes('maxResultBytes: 0'),
  'the exact five location-bearing production IPC reads are cache disabled before cacheable classes',
  { path: paths.ipcReadSharing, channels: declaredSensitiveIpcChannels }
);
const sensitiveIpcTestDeclaration = source.ipcSensitiveTest.match(
  /expect\(IPC_POLICY_SENSITIVE_READ_CHANNELS\)\.toEqual\(\[([\s\S]*?)\]\);/u
)?.[1] ?? '';
const testedSensitiveIpcChannels = [...sensitiveIpcTestDeclaration.matchAll(/'([^']+)'/gu)]
  .map(([, channel]) => channel);
check(
  JSON.stringify(testedSensitiveIpcChannels) === JSON.stringify(LOCATION_POLICY_SENSITIVE_IPC_CHANNELS)
    && source.ipcSensitiveTest.includes('for(const channel of IPC_POLICY_SENSITIVE_READ_CHANNELS)')
    && source.ipcSensitiveTest.includes("expect(resolveIpcReadSharingPolicy(channel)).toEqual({enabled:false,priority:'standard',ttlMs:0,maxEntries:0,maxResultBytes:0})")
    && source.ipcSensitiveTest.includes('expect(pepInvocations).toBe(IPC_POLICY_SENSITIVE_READ_CHANNELS.length*2)')
    && source.ipcSensitiveTest.includes('expect(client.cacheCount()).toBe(0)')
    && source.ipcSensitiveTest.includes('expect(registry.store(7,key,{locationId:')
    && source.ipcSensitiveTest.includes('expect(registry.lookup(7,key,2_001)).toEqual({hit:false})'),
  'adversarial IPC tests bind all five channels to expiry re-evaluation and zero stale cache replay',
  { path: paths.ipcSensitiveTest, channels: testedSensitiveIpcChannels }
);
check(
  ipcRuntimeReport?.schemaVersion === 1
    && ipcRuntimeReport.featureBuild === 162
    && ipcRuntimeReport.status === 'PASS'
    && ipcRuntimeReport.checks === 37
    && Array.isArray(ipcRuntimeReport.checkLabels)
    && ipcRuntimeReport.checkLabels.length === 37
    && new Set(ipcRuntimeReport.checkLabels).size === 37
    && ipcRuntimeReport.checkLabels.includes('policy-sensitive channel list is exact')
    && ipcRuntimeReport.checkLabels.includes('policy-sensitive channels are cache disabled')
    && ipcRuntimeReport.checkLabels.includes('policy-sensitive preload reads execute after expiry or revocation instead of replaying cache')
    && ipcRuntimeReport.checkLabels.includes('policy-sensitive main reads cannot be stored for stale replay'),
  'Build 162 IPC read-sharing runtime evidence is exact PASS 37/37 with location cache-replay fences',
  { path: paths.ipcRuntimeReport, expectedChecks: 37 }
);
check(
  ipcContractReport?.schemaVersion === 1
    && ipcContractReport.featureBuild === 162
    && ipcContractReport.status === 'PASS'
    && ipcContractReport.assertions === 49
    && Array.isArray(ipcContractReport.failures)
    && ipcContractReport.failures.length === 0,
  'Build 162 IPC read-sharing source contract evidence is exact PASS 49/49',
  { path: paths.ipcContractReport, expectedAssertions: 49 }
);

check(scope?.evidenceBoundary?.PPK002 === 'PARTIAL', 'PPK-002 remains PARTIAL');
check(scope?.evidenceBoundary?.timelineEventPolicyEnforcementVerticalSlice === 'NOT_COMPLETE', 'timeline-event enforcement remains open');
check(scope?.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'universal repository enforcement remains open');
check(
  scope?.evidenceBoundary?.locationDeleteAndImportRollbackWorkflow === 'NOT_COMPLETE_GOVERNED_DELETION_REQUIRED'
    && scope.evidenceBoundary.locationImportBatchPolicyWorkflow === 'NOT_COMPLETE_MULTI_RECEIPT_BATCH_REQUIRED',
  'LOCATION delete and batch import workflows remain explicitly NOT_COMPLETE'
);
check(
  scope?.evidenceBoundary?.lifeDeleteAndPurgeWorkflow === 'NOT_COMPLETE_GOVERNED_DELETION_WORKFLOW_REQUIRED'
    && scope.evidenceBoundary.dashboardLifeCrossSurface === 'NOT_COMPLETE'
    && scope.evidenceBoundary.dataLifecycleLifeCrossSurface === 'NOT_COMPLETE',
  'predecessor LIFE open boundaries remain unchanged'
);
check(
  statusReport?.bronzeCompletedPercent === 25.0
    && statusReport.silverStatus === 'FORBIDDEN_NOT_READY'
    && statusReport.goldStatus === 'FORBIDDEN_NOT_READY'
    && statusReport.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS'
    && statusReport.installerBuild === 'NOT_RUN_NOT_PASS'
    && statusReport.officialCompletionClaimed === completed30Z
    && statusReport.persistentReceiptStatus === (completed30Z ? 'PASS' : 'PENDING'),
  'Bronze progress, Silver/Gold and native hardware/installer boundaries remain fail-closed'
);
check(
  packageJson?.scripts?.['verify:30-z:location-policy-enforcement-contract']
    === 'node scripts/verify-30-z-location-policy-enforcement-contract.mjs',
  'package exposes the governed static 30-Z contract gate'
);

const inventoryEvidence = async (pattern) => {
  const names = (await readdir('artifacts/validation'))
    .filter((name) => pattern.test(name))
    .sort();
  return Promise.all(names.map(async (name) => {
    const bytes = await readFile(`artifacts/validation/${name}`);
    let value;
    try {
      value = JSON.parse(bytes.toString('utf8'));
    } catch {
      value = undefined;
    }
    return {
      name,
      path: `artifacts/validation/${name}`,
      bytes: bytes.length,
      sha256: sha256(bytes),
      value
    };
  }));
};
const failurePattern = /^30-Z.*FAILURES?\.json$/u;
const diagnosticPattern = /^30-Z.*DIAGNOSTIC.*\.json$/u;
const exactAdapterArtifact = async (binding) => {
  try {
    const bytes = await readFile(binding.path);
    return bytes.length === binding.bytes && sha256(bytes) === binding.sha256
      ? { value: JSON.parse(bytes.toString('utf8')) }
      : undefined;
  } catch {
    return undefined;
  }
};
const [legacyNormalizationArtifact, legacyCanonicalArtifact, legacyRawArtifact] = await Promise.all([
  exactAdapterArtifact(LEGACY_IPC_NORMALIZATION),
  exactAdapterArtifact(LEGACY_IPC_CANONICAL),
  exactAdapterArtifact(LEGACY_IPC_RAW_DIAGNOSTIC)
]);
const normalization = legacyNormalizationArtifact?.value;
const canonicalView = legacyCanonicalArtifact?.value;
const rawDiagnostic = legacyRawArtifact?.value;
const legacyAdapterIsExact = Boolean(
  normalization?.evidenceType === 'IMMUTABLE_ORIGINAL_TO_CANONICAL_BINDING'
    && normalization.status === 'BOUND_FAILURE_NOT_PASS'
    && normalization.countsAsPass === false
    && normalization.processExitCode === 1
    && normalization.realExitCodeObserved === true
    && normalization.originalEvidence?.path === LEGACY_IPC_FAILURE.path
    && normalization.originalEvidence?.sizeBytes === LEGACY_IPC_FAILURE.bytes
    && normalization.originalEvidence?.sha256 === LEGACY_IPC_FAILURE.sha256
    && normalization.originalEvidence?.mustRemainByteExact === true
    && normalization.canonicalView?.path === LEGACY_IPC_CANONICAL.path
    && normalization.canonicalView?.sizeBytes === LEGACY_IPC_CANONICAL.bytes
    && normalization.canonicalView?.sha256 === LEGACY_IPC_CANONICAL.sha256
    && normalization.canonicalView?.step === '30-Z'
    && normalization.canonicalView?.status === 'FAIL'
    && normalization.canonicalView?.countsAsPass === false
    && normalization.canonicalView?.processExitCode === 1
    && normalization.canonicalView?.realExitCodeObserved === true
    && normalization.rawDiagnostic?.path === LEGACY_IPC_RAW_DIAGNOSTIC.path
    && normalization.rawDiagnostic?.sha256 === LEGACY_IPC_RAW_DIAGNOSTIC.sha256
    && normalization.outcomeChanged === false
    && normalization.passClaim === false
    && normalization.mandatoryTruthSentence === TRUTH
    && canonicalView?.step === '30-Z'
    && canonicalView.status === 'FAIL'
    && canonicalView.countsAsPass === false
    && canonicalView.processExitCode === 1
    && canonicalView.realExitCodeObserved === true
    && canonicalView.mandatoryTruthSentence === TRUTH
    && rawDiagnostic?.step === '30-Z'
    && rawDiagnostic.status === 'DIAGNOSTIC_RAW_CAPTURE_NOT_PASS'
    && rawDiagnostic.countsAsPass === false
    && rawDiagnostic.processExitCode === 1
    && rawDiagnostic.realExitCodeObserved === true
    && rawDiagnostic.mandatoryTruthSentence === TRUTH
);
const packageToolAdapters = await Promise.all(LEGACY_PACKAGE_TOOL_FAILURES.map(async (specification) => {
  const [normalizationArtifact, canonicalArtifact] = await Promise.all([
    exactAdapterArtifact(specification.normalization),
    exactAdapterArtifact(specification.canonical)
  ]);
  const packageNormalization = normalizationArtifact?.value;
  const packageCanonical = canonicalArtifact?.value;
  const exact = Boolean(
    packageNormalization?.step === '30-Z'
      && packageNormalization.evidenceType === 'IMMUTABLE_ORIGINAL_TO_CANONICAL_BINDING'
      && packageNormalization.status === 'BOUND_FAILURE_NOT_PASS'
      && packageNormalization.countsAsPass === false
      && packageNormalization.processExitCode === 1
      && packageNormalization.realExitCodeObserved === true
      && packageNormalization.originalEvidence?.path === specification.original.path
      && packageNormalization.originalEvidence?.sizeBytes === specification.original.bytes
      && packageNormalization.originalEvidence?.sha256 === specification.original.sha256
      && packageNormalization.originalEvidence?.mustRemainByteExact === true
      && packageNormalization.originalEvidence?.mandatoryTruthEncoding === 'NON_CANONICAL_PRESERVED_BYTE_EXACT'
      && packageNormalization.canonicalView?.path === specification.canonical.path
      && packageNormalization.canonicalView?.sizeBytes === specification.canonical.bytes
      && packageNormalization.canonicalView?.sha256 === specification.canonical.sha256
      && packageNormalization.canonicalView?.step === '30-Z'
      && packageNormalization.canonicalView?.status === 'FAIL'
      && packageNormalization.canonicalView?.countsAsPass === false
      && packageNormalization.canonicalView?.processExitCode === 1
      && packageNormalization.canonicalView?.realExitCodeObserved === true
      && packageNormalization.outcomeChanged === false
      && packageNormalization.passClaim === false
      && packageNormalization.mandatoryTruthSentence === TRUTH
      && packageCanonical?.step === '30-Z'
      && packageCanonical.evidenceType === 'IMMUTABLE_FAILED_ATTEMPT_CANONICAL_VIEW'
      && packageCanonical.attempt === specification.attempt
      && packageCanonical.status === 'FAIL'
      && packageCanonical.countsAsPass === false
      && packageCanonical.processExitCode === 1
      && packageCanonical.realExitCodeObserved === true
      && packageCanonical.executedTests === specification.executedTests
      && packageCanonical.failedTests === specification.failedTests
      && packageCanonical.errorTests === specification.errorTests
      && packageCanonical.originalEvidence?.path === specification.original.path
      && packageCanonical.originalEvidence?.sizeBytes === specification.original.bytes
      && packageCanonical.originalEvidence?.sha256 === specification.original.sha256
      && packageCanonical.originalEvidence?.mustRemainByteExact === true
      && packageCanonical.canonicalTruthAppliedOnlyInThisSeparateView === true
      && packageCanonical.outcomeChanged === false
      && packageCanonical.passClaim === false
      && packageCanonical.mandatoryTruthSentence === TRUTH
  );
  return { specification, canonicalView: packageCanonical, exact };
}));
const canonicalFailureEvidence = (item) => (
  item.value?.status === 'FAIL'
    && (item.value.step === '30-Z' || item.value.stepId === '30-Z')
    && Number.isInteger(item.value.processExitCode)
    && item.value.processExitCode !== 0
    && item.value.countsAsPass === false
    && item.value.realExitCodeObserved === true
    && item.value.mandatoryTruthSentence === TRUTH
);
const exactLegacyFailureEvidence = (item) => (
  legacyAdapterIsExact
    && item.path === LEGACY_IPC_FAILURE.path
    && item.bytes === LEGACY_IPC_FAILURE.bytes
    && item.sha256 === LEGACY_IPC_FAILURE.sha256
    && item.value?.evidenceType === 'IMMUTABLE_FAILED_ATTEMPT'
    && item.value.workItem === '30-Z_IPC_LOCATION_CACHE_SECURITY'
    && item.value.gate === 'verify-build162-ipc-read-sharing-runtime'
    && item.value.attempt === 1
    && item.value.status === 'FAIL'
    && item.value.exitCode === 1
    && item.value.assertionsExecuted === 0
    && item.value.passClaim === false
    && item.value.step === undefined
    && item.value.countsAsPass === undefined
    && item.value.processExitCode === undefined
    && item.value.realExitCodeObserved === undefined
);
const exactPackageToolFailureAdapter = (item) => packageToolAdapters.find(({ specification, exact }) => (
  exact
    && item.path === specification.original.path
    && item.bytes === specification.original.bytes
    && item.sha256 === specification.original.sha256
    && item.value?.step === '30-Z'
    && item.value.attempt === specification.attempt
    && item.value.status === 'FAIL'
    && item.value.countsAsPass === false
    && item.value.processExitCode === 1
    && item.value.realExitCodeObserved === true
    && item.value.executedTests === specification.executedTests
    && item.value.failedTests === specification.failedTests
    && item.value.errorTests === specification.errorTests
    && item.value.mandatoryTruthSentence !== TRUTH
));
const validFailureEvidence = (item) => (
  canonicalFailureEvidence(item)
    || exactLegacyFailureEvidence(item)
    || Boolean(exactPackageToolFailureAdapter(item))
);
const normalizedFailureValue = (item) => {
  if (exactLegacyFailureEvidence(item)) {
    return canonicalView;
  }
  return exactPackageToolFailureAdapter(item)?.canonicalView ?? item.value;
};
const validDiagnosticEvidence = (item) => (
  typeof item.value?.status === 'string'
    && item.value.status.startsWith('DIAGNOSTIC')
    && (item.value.step === '30-Z' || item.value.stepId === '30-Z')
    && item.value.countsAsPass === false
    && Number.isInteger(item.value.processExitCode)
    && item.value.processExitCode !== 0
    && item.value.realExitCodeObserved === true
    && item.value.mandatoryTruthSentence === TRUTH
);

const initialFailures = await inventoryEvidence(failurePattern);
const diagnostics = await inventoryEvidence(diagnosticPattern);
const provisionalInventoryFailure = initialFailures.some((item) => !validFailureEvidence(item))
  || diagnostics.some((item) => !validDiagnosticEvidence(item));
if (failures.length > 0 || provisionalInventoryFailure) {
  const firstFailureEvidence = {
    schemaVersion: 1,
    release: 'Bronze 04.08.2026.29',
    stepId: '30-Z',
    requirement: 'PPK-002',
    phase: 'LOCATION_POLICY_ENFORCEMENT_CONTRACT_ATTEMPT_1',
    status: 'FAIL',
    countsAsPass: false,
    preservation: 'IMMUTABLE_FIRST_NONZERO_ATTEMPT_NOT_PASS',
    processExitCode: 1,
    realExitCodeObserved: true,
    failedChecks: [...failures],
    generatedAt: new Date().toISOString(),
    mandatoryTruthSentence: TRUTH
  };
  try {
    await writeFile(FIRST_FAILURE_PATH, JSON.stringify(firstFailureEvidence, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
  }
}

const preservedFailures = await inventoryEvidence(failurePattern);
check(
  preservedFailures.every(validFailureEvidence),
  'dynamic 30-Z failure inventory is exact, nonzero and never counted as PASS',
  { pattern: failurePattern.source, files: preservedFailures.map((item) => item.name) }
);
check(
  diagnostics.every(validDiagnosticEvidence),
  'dynamic 30-Z diagnostic inventory is separately bound and never counted as PASS',
  { pattern: diagnosticPattern.source, files: diagnostics.map((item) => item.name) }
);

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-Z',
  requirement: 'PPK-002',
  phase: predecessorRegression
    ? '30_Y_PREDECESSOR_REGRESSION_VIA_30_Z_STATIC_CONTRACT'
    : 'GOVERNED_LOCATION_POLICY_ENFORCEMENT_STATIC_CONTRACT',
  executionMode: predecessorRegression ? 'PREDECESSOR_REGRESSION' : 'PRIMARY_CONTRACT',
  gateClass: 'STATIC_SOURCE_CONTRACT_NO_TEST_EXECUTION',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  policySemantics: {
    savedReadCapability: 'location.read',
    createCapability: 'family.write',
    resourceType: 'location',
    purpose: 'general',
    sensitivity: 'highly_sensitive',
    familyReadUsedForSavedLocation: false,
    liveLocationShareInScope: false,
    privacyColumnAuthorized: false,
    aiProcessingAllowedColumnAuthorized: false
  },
  migration66: {
    name: 'location_policy_receipt_fence',
    expectedChecksum: EXPECTED_MIGRATION_CHECKSUM,
    computedChecksum: computedMigrationChecksum,
    manifestChecksum: manifestMigration66?.checksum ?? 'UNAVAILABLE'
  },
  predecessorRegression: {
    requested: predecessorRegression,
    predecessorStep: '30-Y',
    completionRecord: paths.predecessorCompletion,
    libraryReceipt: paths.predecessorReceipt,
    completionTransition: paths.predecessorTransition,
    canonicalPostcommitProof: paths.predecessorCanonicalProof,
    immutableCompletedAt: PREDECESSOR_COMPLETED_AT,
    immutableTrustRoot: {
      exactCount: immutablePredecessorSpecifications.length,
      allCurrentBindingsExact: exactImmutablePredecessorSource(),
      bindings: immutablePredecessorSpecifications.map(({ path, bytes, sha256: digest }) => ({
        path,
        sizeBytes: bytes,
        sha256: digest
      }))
    },
    canonicalPostcommitProcesses: {
      expected: 4,
      executed: predecessorCanonicalProof?.postcommitProcessExecuted ?? 'UNAVAILABLE',
      passed: predecessorCanonicalProof?.postcommitProcessPassed ?? 'UNAVAILABLE',
      failed: predecessorCanonicalProof?.postcommitProcessFailed ?? 'UNAVAILABLE',
      status: exactPostcommitCommands(predecessorCanonicalProof?.postcommitCommands) ? 'PASS' : 'FAIL'
    },
    mutationSelfTest: {
      negativeCases: predecessorMutationRejections.length,
      rejected: predecessorMutationRejections.filter(Boolean).length,
      status: predecessorMutationRejections.every(Boolean) ? 'PASS' : 'FAIL'
    },
    full30ZStaticContractAlsoEvaluated: true
  },
  failureEvidenceInventory: {
    pattern: failurePattern.source,
    exactCount: preservedFailures.length,
    files: preservedFailures.map((item) => {
      const value = normalizedFailureValue(item);
      return {
        name: item.name,
        path: item.path,
        bytes: item.bytes,
        sha256: item.sha256,
        status: value?.status ?? 'UNAVAILABLE',
        processExitCode: value?.processExitCode ?? 'UNAVAILABLE',
        realExitCodeObserved: value?.realExitCodeObserved ?? 'UNAVAILABLE',
        countsAsPass: false
      };
    }),
    failedAttemptsCountedAsPass: 0
  },
  diagnosticEvidenceInventory: {
    pattern: diagnosticPattern.source,
    exactCount: diagnostics.length,
    files: diagnostics.map(({ name, path, bytes, sha256: digest, value }) => ({
      name,
      path,
      bytes,
      sha256: digest,
      status: value?.status ?? 'UNAVAILABLE',
      processExitCode: value?.processExitCode ?? 'UNAVAILABLE',
      countsAsPass: false
    })),
    diagnosticsCountedAsPass: 0
  },
  evidenceBoundary: {
    ...scope?.evidenceBoundary,
    locationPolicyEnforcementVerticalSlice: status === 'PASS' ? 'TARGETED_STATIC_CONTRACT_PASS' : 'TARGETED_NOT_YET_PASS',
    locationDeleteAndImportRollbackWorkflow: 'NOT_COMPLETE_GOVERNED_DELETION_REQUIRED',
    locationImportBatchPolicyWorkflow: 'NOT_COMPLETE_MULTI_RECEIPT_BATCH_REQUIRED',
    timelineEventPolicyEnforcementVerticalSlice: 'NOT_COMPLETE',
    universalRepositoryEnforcement: 'NOT_COMPLETE'
  },
  PPK002: 'PARTIAL',
  bronzeCompletedPercent: 25.0,
  silverStatus: 'FORBIDDEN_NOT_READY',
  goldStatus: 'FORBIDDEN_NOT_READY',
  nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
  installerBuild: 'NOT_RUN_NOT_PASS',
  officialCompletionClaimed: completed30Z,
  persistentReceiptStatus: completed30Z ? 'PASS' : 'PENDING',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
if (status !== 'PASS') {
  console.error(`${predecessorRegression ? '30-Z / 30-Y predecessor regression' : '30-Z LOCATION policy enforcement static contract'}: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`${predecessorRegression ? '30-Z / 30-Y predecessor regression' : '30-Z LOCATION policy enforcement static contract'}: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL; persistent receipt ${completed30Z ? 'PASS' : 'PENDING'}).`);
console.log(TRUTH);
