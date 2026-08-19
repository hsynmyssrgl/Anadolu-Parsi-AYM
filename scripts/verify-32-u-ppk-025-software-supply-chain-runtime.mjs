import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const candidateMode = process.argv.includes('--candidate');
const node = process.execPath;
const root = process.cwd();
const appMetaSource = await readFile('packages/domain/src/app-meta.ts', 'utf8');
const activeRelease = appMetaSource.match(/releaseLabel: '([^']+)'/)?.[1] ?? 'Bronze UNKNOWN';
const normalize = (value) => String(value ?? '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const nodeStep = (args, cwd = root) => ({ executable: node, args, cwd });
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const targetedFiles = [
  'packages/platform-policy/supply-chain-release-policy.test.ts',
  'packages/application/tests/supply-chain-release-use-cases.test.ts',
  'apps/desktop/tests/ppk025-software-supply-chain-gates.test.ts'
];
const expectedCandidateReasons = [
  'AUTHENTICODE_ARTIFACT_MISSING',
  'AUTHENTICODE_CERTIFICATE_UNTRUSTED',
  'AUTHENTICODE_STATUS_INVALID',
  'AUTHENTICODE_TIMESTAMP_MISSING',
  'PRODUCTION_CERTIFICATE_NOT_PROVISIONED',
  'PROVENANCE_KEY_UNTRUSTED',
  'PROVENANCE_SIGNATURE_INVALID'
];
const contractArgs = [
  'scripts/verify-32-u-ppk-025-software-supply-chain-contract.mjs',
  ...(candidateMode ? ['--candidate'] : [])
];
const releaseArgs = [
  'scripts/create-ppk025-release-evidence.mjs',
  ...(candidateMode ? ['--candidate'] : [])
];

const commands = [
  {
    id: 'ppk-025-contract-preflight',
    steps: [nodeStep(contractArgs)],
    expectOutput: `PPK-025${candidateMode ? ' candidate' : ''} contract: PASS`
  },
  {
    id: 'ppk-025-three-file-targeted',
    steps: [nodeStep(['node_modules/vitest/vitest.mjs', 'run', ...targetedFiles, '--reporter=dot', '--maxWorkers=1'])],
    minimumTests: 22,
    minimumTestFiles: 3
  },
  {
    id: 'root-typescript',
    steps: [nodeStep(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'])]
  },
  {
    id: 'ppk-025-production-source-gate',
    steps: [nodeStep(['scripts/verify-software-supply-chain-boundary.mjs'])],
    expectOutput: 'PPK-025 software supply-chain boundary: PASS'
  },
  {
    id: 'ppk-025-deterministic-sbom',
    steps: [
      nodeStep(['scripts/generate-ppk025-sbom.mjs']),
      nodeStep(['scripts/verify-ppk025-sbom.mjs'])
    ],
    expectOutput: 'PPK-025 SBOM verification: PASS'
  },
  {
    id: 'ppk-025-license-and-notices',
    steps: [
      nodeStep(['scripts/generate-ppk025-third-party-notices.mjs']),
      nodeStep(['scripts/verify-ppk025-license-policy.mjs'])
    ],
    expectOutput: 'PPK-025 license policy: PASS'
  },
  {
    id: 'ppk-025-five-external-build-assets',
    steps: [nodeStep(['scripts/verify-ppk025-external-build-assets.mjs'])],
    expectOutput: '5 pinned assets'
  },
  {
    id: 'ppk-025-three-scope-vulnerability-evidence',
    steps: [
      nodeStep(['scripts/run-npm-audit-evidence.mjs', '--scope', 'root-production', '--raw', 'artifacts/validation/32-U-ppk-025-root-production-npm-audit-raw.json', '--report', 'artifacts/validation/32-U-ppk-025-root-production-vulnerability.json']),
      nodeStep(['scripts/run-npm-audit-evidence.mjs', '--scope', 'root-build-toolchain', '--raw', 'artifacts/validation/32-U-ppk-025-root-build-npm-audit-raw.json', '--report', 'artifacts/validation/32-U-ppk-025-root-build-vulnerability.json']),
      nodeStep(['scripts/run-npm-audit-evidence.mjs', '--scope', 'windows-packager', '--raw', 'artifacts/validation/32-U-ppk-025-windows-packager-npm-audit-raw.json', '--report', 'artifacts/validation/32-U-ppk-025-windows-packager-vulnerability.json']),
      nodeStep(['scripts/verify-ppk025-vulnerability-gate.mjs'])
    ],
    expectOutput: 'PPK-025 vulnerability gate: PASS'
  },
  {
    id: 'ppk-025-two-graph-registry-signature-evidence',
    steps: [
      nodeStep(['scripts/run-ppk025-registry-signature-gate.mjs', '--scope', 'root', '--report', 'artifacts/validation/32-U-ppk-025-root-registry-signatures.json']),
      nodeStep(['scripts/run-ppk025-registry-signature-gate.mjs', '--scope', 'windows-packager', '--report', 'artifacts/validation/32-U-ppk-025-windows-packager-registry-signatures.json']),
      nodeStep(['scripts/verify-ppk025-registry-signature-evidence.mjs'])
    ],
    expectOutput: 'PPK-025 registry signature evidence: PASS'
  },
  {
    id: candidateMode ? 'ppk-025-real-candidate-release-blocked' : 'ppk-025-production-release-eligible',
    steps: [
      nodeStep(['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json']),
      nodeStep(releaseArgs)
    ],
    expectOutput: candidateMode
      ? 'PPK-025 candidate release decision: BLOCKED'
      : 'PPK-025 production release decision: RELEASE_ELIGIBLE',
    decisionCheck: candidateMode ? 'CANDIDATE_BLOCKED' : 'PRODUCTION_ELIGIBLE'
  },
  {
    id: 'lockfile-dependency-supply-and-workspace-graph',
    steps: [
      nodeStep(['scripts/verify-lockfile-integrity.mjs']),
      nodeStep(['scripts/verify-dependency-supply.mjs']),
      nodeStep(['scripts/verify-workspace-dependencies.mjs'])
    ],
    expectOutput: 'acyclic production graph'
  },
  {
    id: 'ppk-025-build-toolchain-security',
    steps: [nodeStep(['scripts/verify-build-toolchain-security-contract.mjs', '--report', 'artifacts/validation/32-U-ppk-025-build-toolchain-security.json'])],
    expectOutput: 'Build toolchain security contract: PASS'
  },
  {
    id: candidateMode ? 'ppk-025-candidate-release-material-reseal' : 'ppk-025-production-release-material-reseal',
    steps: [nodeStep(releaseArgs)],
    expectOutput: candidateMode
      ? 'PPK-025 candidate release decision: BLOCKED'
      : 'PPK-025 production release decision: RELEASE_ELIGIBLE',
    decisionCheck: candidateMode ? 'CANDIDATE_BLOCKED' : 'PRODUCTION_ELIGIBLE'
  },
  {
    id: 'ppk-025-contract-postflight',
    steps: [nodeStep(contractArgs)],
    expectOutput: `PPK-025${candidateMode ? ' candidate' : ''} contract: PASS`
  },
  {
    id: 'decision-ledger',
    steps: [nodeStep(['scripts/verify-user-decision-ledger.mjs'])],
    expectOutput: 'User Decision Ledger: PASS'
  },
  {
    id: 'bronze-current-audit',
    steps: [nodeStep(['scripts/audit-bronze-current-state.mjs'])],
    expectOutput: 'Bronze current audit: PASS_WITH_OPEN_SCOPE'
  }
];

const execute = (step) => spawnSync(step.executable, step.args, {
  cwd: step.cwd,
  encoding: 'utf8',
  timeout: 900_000,
  maxBuffer: 64 * 1024 * 1024,
  windowsHide: true,
  env: process.env
});

const results = [];
for (const command of commands) {
  const executions = [];
  for (const step of command.steps) {
    const execution = execute(step);
    executions.push({ step, execution });
    if (execution.status !== 0 || execution.signal !== null || execution.error !== undefined) break;
  }
  const output = normalize(executions.map(({ execution }) => `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`).join('\n'));
  const lastExecution = executions.at(-1)?.execution;
  const testsMatch = output.match(/Tests\s+(\d+) passed/u);
  const filesMatch = output.match(/Test Files\s+(\d+) passed/u);
  const tests = testsMatch ? Number.parseInt(testsMatch[1], 10) : undefined;
  const testFiles = filesMatch ? Number.parseInt(filesMatch[1], 10) : undefined;
  const allStepsPassed = executions.length === command.steps.length && executions.every(({ execution }) =>
    execution.status === 0 && execution.signal === null && execution.error === undefined);
  let decisionPassed = true;
  let decisionSummary;
  if (command.decisionCheck) {
    try {
      const decision = await readJson('artifacts/validation/32-U-ppk-025-release-decision.json');
      decisionSummary = {
        mode: decision.mode,
        status: decision.status,
        releaseEligible: decision.releaseEligible,
        reasons: decision.reasons,
        privateSigningMaterialPersisted: decision.privateSigningMaterialPersisted
      };
      decisionPassed = command.decisionCheck === 'CANDIDATE_BLOCKED'
        ? decision.mode === 'CANDIDATE'
          && decision.status === 'BLOCKED'
          && decision.releaseEligible === false
          && JSON.stringify(decision.reasons) === JSON.stringify(expectedCandidateReasons)
          && decision.privateSigningMaterialPersisted === false
        : decision.mode === 'PRODUCTION_RELEASE'
          && decision.status === 'RELEASE_ELIGIBLE'
          && decision.releaseEligible === true
          && JSON.stringify(decision.reasons) === JSON.stringify(['ALLOW_VERIFIED_RELEASE'])
          && decision.sourceWorktreeClean === true
          && decision.privateSigningMaterialPersisted === false;
    } catch (error) {
      decisionPassed = false;
      decisionSummary = { readError: error instanceof Error ? error.message : String(error) };
    }
  }
  const passed = allStepsPassed
    && (command.minimumTests === undefined || (tests !== undefined && tests >= command.minimumTests))
    && (command.minimumTestFiles === undefined || (testFiles !== undefined && testFiles >= command.minimumTestFiles))
    && (command.expectOutput === undefined || output.includes(command.expectOutput))
    && decisionPassed;
  results.push({
    id: command.id,
    status: passed ? 'PASS' : 'FAIL',
    exitCode: lastExecution?.status ?? null,
    signal: lastExecution?.signal ?? null,
    executedSteps: executions.length,
    expectedSteps: command.steps.length,
    commandLines: command.steps.map((step) => [step.executable, ...step.args].join(' ')),
    ...(tests === undefined ? {} : { tests }),
    ...(testFiles === undefined ? {} : { testFiles }),
    ...(command.minimumTests === undefined ? {} : { minimumTests: command.minimumTests }),
    ...(command.minimumTestFiles === undefined ? {} : { minimumTestFiles: command.minimumTestFiles }),
    ...(command.expectOutput === undefined ? {} : { expectedOutput: command.expectOutput }),
    ...(decisionSummary === undefined ? {} : { decisionSummary, decisionPassed }),
    outputSha256: sha256(output),
    outputTail: output.length <= 2_400 ? output : output.slice(-2_400)
  });
}

const failed = results.filter((item) => item.status === 'FAIL');
const targeted = results.find((item) => item.id === 'ppk-025-three-file-targeted');
const releaseDecision = results.find((item) => item.id === (candidateMode ? 'ppk-025-candidate-release-material-reseal' : 'ppk-025-production-release-material-reseal'));
const report = {
  schemaVersion: 1,
  release: activeRelease,
  step: '32-U',
  requirement: 'PPK-025',
  phase: candidateMode ? 'SOFTWARE_SUPPLY_CHAIN_CANDIDATE_RUNTIME' : 'SOFTWARE_SUPPLY_CHAIN_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'TWO_EXACT_NPM_LOCK_GRAPHS_AND_EIGHTEEN_WORKSPACES',
    'CYCLONEDX_1_6_EXACT_442_COMPONENT_AND_DEPENDENCY_COVERAGE',
    'EXACT_402_CANONICAL_REGISTRY_PACKAGES_WITH_SHA512_INTEGRITY',
    'EXACT_382_LICENSE_AND_THIRD_PARTY_NOTICE_COMPONENTS',
    'THREE_FRESH_ZERO_FINDING_VULNERABILITY_SCOPES',
    'TWO_LIVE_CANONICAL_NPM_REGISTRY_SIGNATURE_GRAPHS_WITH_ZERO_INVALID_OR_MISSING',
    'FIVE_EXACT_EXTERNAL_BINARY_ASSET_HASH_PINS',
    'DSSE_ED25519_CRYPTOGRAPHIC_PROVENANCE_AND_EXACT_SUBJECT_BINDING',
    'INSTALLER_AND_INSTALLED_MAIN_EXECUTABLE_AUTHENTICODE_REQUIRED',
    'VALID_STATUS_EXACT_PUBLISHER_THUMBPRINT_CERTIFICATE_SHA256_EKU_CHAIN_AND_TIMESTAMP',
    'SELF_SIGNED_TEST_AND_CHECKSUM_ONLY_AUTHORITY_REJECTED',
    'PACKAGE_WIN_FAILS_BEFORE_UNSIGNED_ARTIFACT_EMISSION',
    'CONTENT_FREE_NON_AUTHORITATIVE_STATUS_BOUNDARY',
    'NO_MIGRATION_DATA_TRANSFER_BACKFILL_CUTOVER_OR_OWNERSHIP_CHANGE',
    candidateMode ? 'REAL_CANDIDATE_DECISION_BLOCKED_ON_EXACT_EXTERNAL_TRUST_REASONS' : 'REAL_PRODUCTION_RELEASE_ELIGIBILITY_DECISION'
  ],
  lockfiles: 2,
  workspaces: 18,
  sbomComponents: 442,
  dependencyNodes: 442,
  registryPackages: 402,
  licenseComponents: 382,
  vulnerabilityScopes: 3,
  registrySignatureScopes: 2,
  externalAssets: 5,
  authenticodeArtifacts: 2,
  targetedTestFiles: targetedFiles.length,
  targetedTests: targeted?.tests ?? null,
  candidateExpectedReasons: candidateMode ? expectedCandidateReasons : [],
  releaseDecision: releaseDecision?.decisionSummary ?? null,
  fullVitestExecutedByThisRuntime: false,
  fullProductionBuildExecutedByThisRuntime: false,
  fullValidationDeferredToFinalIntegration: true,
  productionPrivateMaterialPersisted: false,
  checksumAloneGrantsReleaseAuthority: false,
  selfSignedCertificateGrantsProductionAuthority: false,
  historicalEvidenceGrantsCurrentAuthority: false,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 77,
  historicalBackfillPerformed: false,
  realDataTransferPerformed: false,
  cutoverPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: false,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-U-ppk-025-software-supply-chain-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-U PPK-025${candidateMode ? ' candidate' : ''} runtime: FAIL (${failed.length}/${results.length}).`);
  failed.forEach((item) => console.error(`${item.id}: ${item.outputTail}`));
  process.exit(1);
}
console.log(`32-U PPK-025${candidateMode ? ' candidate' : ''} runtime: PASS (${results.length}/${results.length}).`);
