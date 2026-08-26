import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  classifyChangedFiles,
  createDependencyAssessmentContract,
  renderCommand,
  resolveChangeImpactDependencies
} from '../../../scripts/lib/mutation-release-evidence.mjs';
import { validateMutationReleaseEvidence } from '../../../scripts/lib/release-source-provenance.mjs';

const sha = (value: string) => value.repeat(64);
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const jsonSha = (value: unknown) => digest(JSON.stringify(value));
const sourceCommit = 'a'.repeat(40);
const baseCommit = 'd'.repeat(40);
const canonicalRuleRegistrySha256 = sha('c');
const pointerSha = sha('1');
const externalSha = sha('2');
const assessmentSha = sha('3');
const impactSha = sha('4');
const targetedSha = sha('5');
const fullSha = sha('6');
const dependencyRegistryPath = 'config/change-impact-dependency-registry.json';
const dependencyRegistryBytes = readFileSync(dependencyRegistryPath);
const dependencyRegistry = JSON.parse(dependencyRegistryBytes.toString('utf8'));
const dependencyRegistryBinding = {
  path: dependencyRegistryPath,
  sizeBytes: dependencyRegistryBytes.length,
  sha256: digest(dependencyRegistryBytes),
  value: dependencyRegistry
};
const dependencyRegistryReceiptBinding = {
  path: dependencyRegistryBinding.path,
  sizeBytes: dependencyRegistryBinding.sizeBytes,
  sha256: dependencyRegistryBinding.sha256
};
const evidencePath = 'docs/decisions/DEC-270-her-mutasyon-sonrasi-exact-commit-kaniti-ve-taze-kurulu-exe-uat-teslim-kapisi.md';
const evidencePathBindings = { [evidencePath]: { path: evidencePath, sizeBytes: 200, sha256: sha('d') } };
const initialChangedFiles = [
  'apps/desktop/tests/data-store.test.ts',
  'config/canonical-rule-registry.json',
  'scripts/run-windows-installer-experience-uat.ps1',
  'scripts/verify-data-store-smoke.mjs',
  'scripts/verify-33-q-local-governed-ocr-derived-data-pipeline-runtime.mjs'
];
const changedFiles = [...initialChangedFiles].sort((a, b) => a.localeCompare(b, 'en'));
const dependencyPlan = resolveChangeImpactDependencies({ registry: dependencyRegistry, changedFiles });
const dependencyAssessment = createDependencyAssessmentContract({ plan: dependencyPlan, registryBinding: dependencyRegistryBinding });
const changedFileImpacts = classifyChangedFiles(changedFiles);
const impactAreaIds = ['mainSource', 'channelSources', 'canonicalRules', 'decisions', 'activeDocuments',
  'commercialRecords', 'workList', 'scopesInventoriesRatchets', 'manifestsIndexes', 'masterDocumentation', 'ratchets', 'tests', 'uat'];
const impactAreas = Object.fromEntries(impactAreaIds.map((area) => {
  const paths = Object.entries(changedFileImpacts)
    .filter(([, areas]) => (areas as string[]).includes(area))
    .map(([path]) => path)
    .sort((a, b) => a.localeCompare(b, 'en'));
  return [area, paths.length > 0
    ? { status: 'UPDATED', paths }
    : { status: 'NOT_IMPACTED_WITH_REASON', reasonCode: 'NO_MATCHING_CHANGED_PATH', evidencePaths: [evidencePath] }];
}));
const policy = {
  schemaVersion: 2, id: 'PPT-MUTATION-RELEASE-READINESS-V2', requirement: 'PR-235', decision: 'DEC-270',
  strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
  failClosed: true, waiverAllowed: false, impactAreas: impactAreaIds,
  allowedImpactStatus: ['UPDATED', 'NOT_IMPACTED_WITH_REASON', 'DEFERRED_TO_FRESH_INSTALLED_EXE_UAT'],
  dependencyRegistry: {
    path: dependencyRegistryPath, schemaVersion: 1, id: dependencyRegistry.id,
    sha256: dependencyRegistryBinding.sha256, unmatchedChangedPathEffect: 'BLOCK',
    dependentRecordsMustBeChanged: true,
    dependentRecordNotAffected: {
      allowed: true, status: 'NOT_AFFECTED_WITH_BASELINE_IDENTITY',
      reasonCode: 'DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED', sha256Required: true,
      baselineDiffAbsenceRequired: true, evidencePathsRequired: true
    },
    targetedVitestMustEqualAffectedFiles: true
  }
};
const provenance = {
  headCommit: sourceCommit, worktreeClean: true, sharedGitObjectDatabaseVerified: true,
  governedSourceFingerprint: { sha256: sha('f'), fileCount: 42 }
};
const identity = { status: 'PASS', sourceCommit, governedSourceFingerprintSha256: sha('f'), canonicalRuleRegistrySha256 };
const producer = (path: string, marker: string) => ({ path, sizeBytes: 100, sha256: sha(marker) });
const producerBindings = {
  baseline: producer('scripts/record-mutation-baseline.mjs', '8'),
  impactAnalysis: producer('scripts/create-mutation-impact-analysis.mjs', '9'),
  targetedTest: producer('scripts/run-mutation-test-evidence.mjs', 'a'),
  fullRegression: producer('scripts/run-mutation-test-evidence.mjs', 'a'),
  sourceIntegrity: producer('scripts/verify-source-integrity.mjs', 'b')
};
const historicalBaselineProducer = producer('scripts/record-mutation-baseline.mjs', '0');
const manifestBindings = {
  manifest: { path: 'manifest.json', sizeBytes: 10, sha256: sha('1') },
  sha256Sums: { path: 'SHA256SUMS.txt', sizeBytes: 10, sha256: sha('2') }
};
const toolchainBindings = [
  { path: 'package-lock.json', sizeBytes: 10, sha256: sha('7') },
  { path: 'node_modules/typescript/bin/tsc', sizeBytes: 10, sha256: sha('8') }
];
const fakeBindings = (paths: readonly string[], prefix: string) => Object.fromEntries(paths.map((path, index) => [path, {
  path, sizeBytes: 100 + index, sha256: digest(`${prefix}:${path}`)
}]));
const dependencyRecordBindings = fakeBindings(dependencyPlan.dependentRecords, 'record');
const dependentRecordImpacts = Object.fromEntries(dependencyPlan.dependentRecords.map((path: string) => [path,
  changedFiles.includes(path)
    ? { status: 'UPDATED', sha256: dependencyRecordBindings[path].sha256, evidencePaths: [path] }
    : {
        status: 'NOT_AFFECTED_WITH_BASELINE_IDENTITY',
        reasonCode: 'DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED',
        sha256: dependencyRecordBindings[path].sha256,
        evidencePaths: [evidencePath]
      }
]));
const affectedTestBindings = fakeBindings(dependencyPlan.affectedVitestFiles, 'test');
const stream = { sizeBytes: 0, sha256: digest('') };
const measured = (id: string, executable: string, args: string[], changedPath: string | null = null) => ({
  id, status: 'PASS', exitCode: 0, executable, arguments: args, command: renderCommand(executable, args), changedPath,
  stdout: stream, stderr: stream, startedAt: '2026-08-24T01:00:00.000Z', completedAt: '2026-08-24T01:00:01.000Z'
});
const fullCommands = (() => {
  const matrix = dependencyRegistry.commandMatrix;
  const result = [measured('rootTypecheck', matrix.rootTypecheck.executable, matrix.rootTypecheck.arguments)];
  for (const requiredId of dependencyPlan.requiredCommands.filter((id: string) => id.startsWith('affectedCommand:'))) {
    const command = dependencyRegistry.affectedCommandCatalog[requiredId.slice('affectedCommand:'.length)];
    result.push(measured(requiredId, command.executable, command.arguments));
  }
  for (const path of changedFiles.filter((value) => value.endsWith('.mjs')).sort()) {
    result.push(measured(`changedMjsSyntax:${path}`, matrix.changedMjsSyntax.executable, [...matrix.changedMjsSyntax.argumentPrefix, path], path));
  }
  for (const path of changedFiles.filter((value) => value.endsWith('.ps1')).sort()) {
    result.push(measured(
      `changedPs1Parser:${path}`,
      matrix.changedPs1Parser.executable,
      matrix.changedPs1Parser.arguments.map((value: string) => value === '{changedPath}' ? path : value),
      path
    ));
  }
  return result;
})();

const input = (): any => ({
  policy, canonicalRulesSha256: canonicalRuleRegistrySha256, provenance, changedFiles,
  dependencyRegistry, dependencyRegistryBinding, dependencyRecordBindings, affectedTestBindings,
  mutationBaselinePointer: {
    schemaVersion: 2, id: 'PPT-MUTATION-BASELINE-POINTER-V2', status: 'PASS',
    requirement: 'PR-235', decision: 'DEC-270', strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
    evidenceKind: 'PRE_MUTATION_BASELINE_POINTER', external: { sha256: externalSha }, producer: historicalBaselineProducer
  },
  mutationBaselinePointerSha256: pointerSha,
  mutationBaseline: {
    schemaVersion: 2, id: 'PPT-MUTATION-BASELINE-EXTERNAL-V2', status: 'PASS',
    requirement: 'PR-235', decision: 'DEC-270', strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
    evidenceKind: 'PRE_MUTATION_BASELINE_EXTERNAL', sourceProvenance: { headCommit: baseCommit }, producer: historicalBaselineProducer
  },
  mutationBaselineExternalSha256: externalSha,
  impactAssessment: {
    schemaVersion: 2, requirement: 'PR-235', decision: 'DEC-270',
    strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275', sourceCommit, baselineCommit: baseCommit,
    changedFileImpacts, impactAreas,
    dependentRecordImpacts: structuredClone(dependentRecordImpacts),
    dependencyPlan: dependencyAssessment
  },
  impactAssessmentSha256: assessmentSha,
  impactAnalysis: {
    ...identity, schemaVersion: 2, id: 'PPT-MUTATION-IMPACT-ANALYSIS-V2', requirement: 'PR-235', decision: 'DEC-270',
    strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
    evidenceKind: 'MUTATION_IMPACT_ANALYSIS', baseCommit, headCommit: sourceCommit,
    chain: {
      baselinePointerSha256: pointerSha, baselineExternalSha256: externalSha, assessmentSha256: assessmentSha,
      dependencyRegistrySha256: dependencyRegistryBinding.sha256
    },
    changedFiles, changedFileImpacts, impactAreas, dependentRecordImpacts: structuredClone(dependentRecordImpacts),
    evidencePathBindings, dependencyPlan: dependencyAssessment,
    dependencyRecordBindings, affectedTestBindings, producer: producerBindings.impactAnalysis
  },
  targetedTest: {
    ...identity, schemaVersion: 2, id: 'PPT-MUTATION-TARGETED-TEST-V2', evidenceKind: 'TARGETED_TEST', exitCode: 0,
    requirement: 'PR-235', decision: 'DEC-270', strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
    producer: producerBindings.targetedTest, targetFiles: dependencyPlan.affectedVitestFiles,
    command: renderCommand('node', ['node_modules/vitest/vitest.mjs', 'run', ...dependencyPlan.affectedVitestFiles, '--maxWorkers=1', '--reporter=json']),
    commandArguments: ['run', ...dependencyPlan.affectedVitestFiles, '--maxWorkers=1', '--reporter=json'],
    chain: { baselinePointerSha256: pointerSha, impactAnalysisSha256: impactSha, assessmentSha256: assessmentSha },
    dependencyRegistry: dependencyRegistryReceiptBinding, dependencyPlan: dependencyAssessment,
    additionalCommandCount: 0, additionalCommands: [], additionalCommandsSha256: jsonSha([]),
    vitestOutput: { stdoutSizeBytes: 100, stdoutSha256: sha('1'), stderrSizeBytes: 0, stderrSha256: digest('') },
    executionGuard: { beforeSha256: sha('e'), afterSha256: sha('e'), toolchainBindings },
    testFilesPassed: dependencyPlan.affectedVitestFiles.length, testFilesFailed: 0, testsPassed: 40, testsFailed: 0
  },
  fullRegression: {
    ...identity, schemaVersion: 2, id: 'PPT-MUTATION-FULL-REGRESSION-V2', evidenceKind: 'FULL_REGRESSION', exitCode: 0,
    requirement: 'PR-235', decision: 'DEC-270', strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
    producer: producerBindings.fullRegression, commandArguments: ['run', '--maxWorkers=1', '--reporter=json'],
    chain: { targetedTestSha256: targetedSha, impactAnalysisSha256: impactSha },
    dependencyRegistry: dependencyRegistryReceiptBinding, dependencyPlan: dependencyAssessment,
    additionalCommandCount: fullCommands.length, additionalCommands: [...fullCommands], additionalCommandsSha256: jsonSha(fullCommands),
    vitestOutput: { stdoutSizeBytes: 100, stdoutSha256: sha('2'), stderrSizeBytes: 0, stderrSha256: digest('') },
    executionGuard: { beforeSha256: sha('e'), afterSha256: sha('e'), toolchainBindings },
    testFilesPassed: 300, testFilesFailed: 0, testsPassed: 2200, testsFailed: 0
  },
  sourceIntegrity: {
    ...identity, schemaVersion: 2, id: 'PPT-MUTATION-SOURCE-INTEGRITY-V2', evidenceKind: 'SOURCE_INTEGRITY', exitCode: 0,
    requirement: 'PR-235', decision: 'DEC-270', strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
    producer: producerBindings.sourceIntegrity,
    commandArguments: ['--release-evidence', '--report', 'artifacts/validation/mutation-source-integrity.json'],
    chain: { fullRegressionSha256: fullSha, targetedTestSha256: targetedSha, impactAnalysisSha256: impactSha },
    manifestBindings, manifestFileCount: 5000, actualSourceFileCount: 5000, failures: []
  },
  evidenceHashes: { impactAnalysis: impactSha, targetedTest: targetedSha, fullRegression: fullSha },
  producerBindings, manifestBindings, impactEvidenceBindings: evidencePathBindings, toolchainBindings
});

describe('PR-235 mutation release readiness', () => {
  it('accepts only the complete exact dependency and command chain', () => {
    expect(validateMutationReleaseEvidence(input())).toMatchObject({
      status: 'PASS', requirement: 'PR-235', decision: 'DEC-270',
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275', sourceCommit,
      changedFileCount: changedFiles.length, targetedTestsPassed: 40, fullRegressionTestsPassed: 2200,
      dependencyClosure: {
        registry: dependencyRegistryReceiptBinding,
        universalDependentRecords: dependencyRegistry.universalDependentRecords,
        universalAffectedVitestFiles: dependencyRegistry.universalAffectedVitestFiles,
        dependentRecords: dependencyPlan.dependentRecords,
        affectedVitestFiles: dependencyPlan.affectedVitestFiles,
        dependentRecordBindingsSha256: jsonSha(dependencyRecordBindings),
        affectedTestBindingsSha256: jsonSha(affectedTestBindings)
      }
    });
  });

  it('rejects stale, dirty, forged and incomplete evidence', () => {
    const stale = input(); stale.targetedTest.sourceCommit = '9'.repeat(40);
    expect(() => validateMutationReleaseEvidence(stale)).toThrow(/source commit is stale/u);
    const dirty = input(); dirty.provenance = { ...dirty.provenance, worktreeClean: false };
    expect(() => validateMutationReleaseEvidence(dirty)).toThrow(/clean governed release worktree/u);
    const forgedProducer = input(); forgedProducer.targetedTest.producer = { ...forgedProducer.targetedTest.producer, sha256: sha('0') };
    expect(() => validateMutationReleaseEvidence(forgedProducer)).toThrow(/producer binding/u);
    const filtered = input(); filtered.targetedTest.commandArguments.splice(2, 0, '--config=evil.ts');
    expect(() => validateMutationReleaseEvidence(filtered)).toThrow(/measured PASS/u);
    const failedFile = input(); failedFile.targetedTest.testFilesFailed = 1;
    expect(() => validateMutationReleaseEvidence(failedFile)).toThrow(/measured PASS/u);
    const forgedAssessment = input(); forgedAssessment.impactAssessment.changedFileImpacts = {};
    expect(() => validateMutationReleaseEvidence(forgedAssessment)).toThrow(/path classification/u);
    const staleAssessmentSource = input(); staleAssessmentSource.impactAssessment.sourceCommit = '9'.repeat(40);
    expect(() => validateMutationReleaseEvidence(staleAssessmentSource)).toThrow(/source\/baseline commit identity/u);
    const missingAssessmentSource = input(); delete missingAssessmentSource.impactAssessment.sourceCommit;
    expect(() => validateMutationReleaseEvidence(missingAssessmentSource)).toThrow(/source\/baseline commit identity/u);
    const staleAssessmentBaseline = input(); staleAssessmentBaseline.impactAssessment.baselineCommit = '9'.repeat(40);
    expect(() => validateMutationReleaseEvidence(staleAssessmentBaseline)).toThrow(/source\/baseline commit identity/u);
    const missingAssessmentBaseline = input(); delete missingAssessmentBaseline.impactAssessment.baselineCommit;
    expect(() => validateMutationReleaseEvidence(missingAssessmentBaseline)).toThrow(/source\/baseline commit identity/u);
    const forgedNotAffected = input();
    const unchangedRecord = Object.keys(forgedNotAffected.impactAssessment.dependentRecordImpacts)
      .find((path) => !changedFiles.includes(path));
    expect(unchangedRecord).toBeDefined();
    forgedNotAffected.impactAssessment.dependentRecordImpacts[unchangedRecord as string].sha256 = sha('0');
    forgedNotAffected.impactAnalysis.dependentRecordImpacts[unchangedRecord as string].sha256 = sha('0');
    expect(() => validateMutationReleaseEvidence(forgedNotAffected)).toThrow(/SHA-256 differs/u);
    const missingTest = input(); missingTest.targetedTest.targetFiles = [...missingTest.targetedTest.targetFiles].slice(0, -1);
    expect(() => validateMutationReleaseEvidence(missingTest)).toThrow(/exact affected Vitest set/u);
    const missingTypecheck = input(); missingTypecheck.fullRegression.additionalCommands.shift();
    missingTypecheck.fullRegression.additionalCommandCount -= 1;
    missingTypecheck.fullRegression.additionalCommandsSha256 = jsonSha(missingTypecheck.fullRegression.additionalCommands);
    expect(() => validateMutationReleaseEvidence(missingTypecheck)).toThrow(/command matrix/u);
    const forgedRegistry = input(); forgedRegistry.dependencyRegistryBinding = { ...forgedRegistry.dependencyRegistryBinding, sha256: sha('0') };
    expect(() => validateMutationReleaseEvidence(forgedRegistry)).toThrow(/dependency plan|contract/u);
    const forgedOutput = input(); forgedOutput.fullRegression.vitestOutput.stdoutSha256 = 'x'.repeat(64);
    expect(() => validateMutationReleaseEvidence(forgedOutput)).toThrow(/Vitest output size\/SHA-256 binding/u);
    const forgedManifest = input();
    forgedManifest.sourceIntegrity.manifestBindings = {
      ...forgedManifest.sourceIntegrity.manifestBindings,
      manifest: { ...forgedManifest.sourceIntegrity.manifestBindings.manifest, sha256: sha('0') }
    };
    expect(() => validateMutationReleaseEvidence(forgedManifest)).toThrow(/integrity evidence is incomplete/u);
    for (const area of ['policy', 'impactAssessment', 'impactAnalysis', 'targetedTest', 'fullRegression', 'sourceIntegrity']) {
      const missing = input(); delete missing[area].strengthenedByRequirement;
      expect(() => validateMutationReleaseEvidence(missing)).toThrow(/invalid|contract|PASS result|incomplete/u);
    }
  });
});
