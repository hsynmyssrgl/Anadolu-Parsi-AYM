import { spawnSync } from 'node:child_process';
import { readJson } from './lib/governance-utils.mjs';
import {
  loadCanonicalProducerBindings, loadMutationEvidencePolicy, readEvidenceBinding, readExternalBaselineFromPointer,
  readRepoFileBinding, snapshotMutationEvidenceAndToolchain, validateImpactAssessment,
  writeEvidenceReceipt
} from './lib/mutation-release-evidence.mjs';
import {
  assertMatchingReleaseSourceProvenance, captureReleaseSourceProvenance,
  listChangedPathsForImpactAnalysis, validateMutationReleaseEvidence
} from './lib/release-source-provenance.mjs';

const root = process.cwd();
const registry = await readJson('config/canonical-rule-registry.json');
const acknowledgement = await readJson('config/rule-acknowledgement.json');
const supplied = process.env.PPT_RULES_SHA256;
if (acknowledgement.release !== registry.effectiveRelease || acknowledgement.rulesSha256 !== registry.rulesSha256) {
  console.error('GOVERNED_POSTFLIGHT blocked: rule acknowledgement is missing or stale'); process.exit(1);
}
if (supplied !== undefined && supplied !== registry.rulesSha256) {
  console.error('GOVERNED_POSTFLIGHT blocked: supplied rule SHA does not match the canonical registry'); process.exit(1);
}

const results = [];
let failed = false;
let source;
try { source = await captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' }); }
catch (error) {
  failed = true;
  results.push({ script: 'clean exact-commit source capture', exitCode: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) });
}
const commands = [
  ['scripts/run-governed-preflight.mjs', '--read-only']
];
for (const args of commands) {
  if (failed) break;
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: process.env, windowsHide: true });
  results.push({ script: args[0], arguments: args.slice(1), exitCode: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() });
  if (result.status !== 0) failed = true;
}

let mutationReleaseReadiness = null;
if (!failed) {
  try {
    const sourceAfter = await captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' });
    assertMatchingReleaseSourceProvenance(sourceAfter.provenance, source.provenance, 'postflight tracked source');
    const { policy, dependencyRegistry, dependencyRegistryBinding } = await loadMutationEvidencePolicy(root);
    const bindings = Object.fromEntries(await Promise.all(
      Object.entries(policy.defaultEvidence).map(async ([id, path]) => [id, await readEvidenceBinding(root, path, `${id} evidence`)])
    ));
    const [externalBaseline, assessment, producerBindings, manifest, sha256Sums, evidenceSnapshot] = await Promise.all([
      readExternalBaselineFromPointer({ pointer: bindings.baseline.value }),
      readEvidenceBinding(root, policy.defaultInput.impactAssessment, 'mutation impact assessment'),
      loadCanonicalProducerBindings(root, policy),
      readRepoFileBinding(root, 'manifest.json', 'postflight manifest'),
      readRepoFileBinding(root, 'SHA256SUMS.txt', 'postflight SHA256SUMS'),
      snapshotMutationEvidenceAndToolchain(root)
    ]);
    const changedFiles = listChangedPathsForImpactAnalysis({
      runGit: source.runGit,
      baselineReceipt: externalBaseline.record.value,
      headCommit: source.provenance.headCommit,
      currentProvenance: source.provenance
    });
    const assessed = validateImpactAssessment({
      policy,
      assessment: assessment.value,
      changedFiles,
      dependencyRegistry,
      dependencyRegistryBinding
    });
    const impactEvidencePaths = [...new Set(Object.values(assessed.impactAreas).flatMap((area) => area.evidencePaths ?? []))].sort();
    const impactEvidenceBindings = Object.fromEntries(await Promise.all(impactEvidencePaths.map(async (path) => {
      const binding = await readRepoFileBinding(root, path, `impact evidence ${path}`);
      return [path, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
    })));
    const dependencyRecordBindings = Object.fromEntries(await Promise.all(assessed.dependencyPlan.dependentRecords.map(async (path) => {
      const binding = await readRepoFileBinding(root, path, `dependent record ${path}`);
      return [path, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
    })));
    const affectedTestBindings = Object.fromEntries(await Promise.all(assessed.dependencyPlan.affectedVitestFiles.map(async (path) => {
      const binding = await readRepoFileBinding(root, path, `affected test ${path}`);
      return [path, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
    })));
    mutationReleaseReadiness = validateMutationReleaseEvidence({
      policy, canonicalRulesSha256: registry.rulesSha256, provenance: source.provenance, changedFiles,
      mutationBaselinePointer: bindings.baseline.value,
      mutationBaselinePointerSha256: bindings.baseline.sha256,
      mutationBaseline: externalBaseline.record.value,
      mutationBaselineExternalSha256: externalBaseline.record.sha256,
      impactAssessment: assessment.value,
      impactAssessmentSha256: assessment.sha256,
      impactAnalysis: bindings.impactAnalysis.value,
      targetedTest: bindings.targetedTest.value,
      fullRegression: bindings.fullRegression.value,
      sourceIntegrity: bindings.sourceIntegrity.value,
      evidenceHashes: {
        impactAnalysis: bindings.impactAnalysis.sha256,
        targetedTest: bindings.targetedTest.sha256,
        fullRegression: bindings.fullRegression.sha256
      },
      producerBindings,
      manifestBindings: {
        manifest: { path: manifest.path, sizeBytes: manifest.sizeBytes, sha256: manifest.sha256 },
        sha256Sums: { path: sha256Sums.path, sizeBytes: sha256Sums.sizeBytes, sha256: sha256Sums.sha256 }
      },
      impactEvidenceBindings,
      toolchainBindings: evidenceSnapshot.toolchain,
      dependencyRegistry,
      dependencyRegistryBinding,
      dependencyRecordBindings,
      affectedTestBindings
    });
  } catch (error) {
    failed = true;
    results.push({ script: 'PR-235 mutation-release readiness', exitCode: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) });
  }
}
const report = {
  schemaVersion: 1, release: registry.effectiveRelease, rulesSha256: registry.rulesSha256,
  trackedFileMode: 'READ_ONLY', mutationReleaseReadiness, status: failed ? 'FAIL' : 'PASS',
  results, generatedAt: new Date().toISOString()
};
await writeEvidenceReceipt(root, 'artifacts/validation/governed-postflight.json', report);
for (const result of results) console.log(`${result.script}: ${result.exitCode === 0 ? 'PASS' : 'FAIL'}`);
if (failed) {
  console.error(results.at(-1)?.stderr || results.at(-1)?.stdout || 'postflight failed'); process.exit(1);
}
console.log(`GOVERNED_POSTFLIGHT: PASS / tracked files READ_ONLY / rules ${registry.rulesSha256}.`);
