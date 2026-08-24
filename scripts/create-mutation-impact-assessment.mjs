import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  classifyChangedFiles,
  createDependencyAssessmentContract,
  loadMutationEvidencePolicy,
  readExternalBaselineFromPointer,
  readEvidenceBinding,
  readRepoFileBinding,
  resolveChangeImpactDependencies,
  validateImpactAssessment,
  writeEvidenceReceipt
} from './lib/mutation-release-evidence.mjs';
import {
  captureReleaseSourceProvenance,
  listChangedPathsForImpactAnalysis
} from './lib/release-source-provenance.mjs';

const root = process.cwd();
const fallbackEvidence = 'docs/decisions/DEC-275-mutation-wide-record-and-test-closure.md';
const { policy, dependencyRegistry, dependencyRegistryBinding } = await loadMutationEvidencePolicy(root);
const baselinePointer = await readEvidenceBinding(root, policy.defaultEvidence.baseline, 'mutation baseline pointer');
const externalBaseline = await readExternalBaselineFromPointer({ pointer: baselinePointer.value });
const source = await captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' });
const changedFiles = listChangedPathsForImpactAnalysis({
  runGit: source.runGit,
  baselineReceipt: externalBaseline.record.value,
  baselinePointer: baselinePointer.value,
  headCommit: source.provenance.headCommit,
  currentProvenance: source.provenance
});
const changedFileImpacts = classifyChangedFiles(changedFiles);
const dependencyPlan = resolveChangeImpactDependencies({ registry: dependencyRegistry, changedFiles });
await stat(resolve(root, fallbackEvidence));
const dependentRecordImpacts = Object.fromEntries(await Promise.all(dependencyPlan.dependentRecords.map(async (path) => {
  const binding = await readRepoFileBinding(root, path, `dependent record impact ${path}`);
  return [path, changedFiles.includes(path)
    ? { status: 'UPDATED', sha256: binding.sha256, evidencePaths: [path] }
    : {
        status: 'NOT_AFFECTED_WITH_BASELINE_IDENTITY',
        reasonCode: 'DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED',
        sha256: binding.sha256,
        evidencePaths: [fallbackEvidence]
      }];
})));
const impactAreas = Object.fromEntries((policy.impactAreas ?? []).map((area) => {
  const paths = Object.entries(changedFileImpacts)
    .filter(([, areas]) => areas.includes(area))
    .map(([path]) => path)
    .sort((left, right) => left.localeCompare(right, 'en'));
  return [area, paths.length > 0
    ? { status: 'UPDATED', paths }
    : { status: 'NOT_IMPACTED_WITH_REASON', reasonCode: 'NO_MATCHING_CHANGED_PATH', evidencePaths: [fallbackEvidence] }];
}));
const assessment = {
  schemaVersion: 2,
  requirement: 'PR-235',
  decision: 'DEC-270',
  strengthenedByRequirement: 'PR-240',
  strengthenedByDecision: 'DEC-275',
  sourceCommit: source.provenance.headCommit,
  baselineCommit: externalBaseline.record.value.sourceProvenance.headCommit,
  changedFileImpacts,
  impactAreas,
  dependentRecordImpacts,
  dependencyPlan: createDependencyAssessmentContract({ plan: dependencyPlan, registryBinding: dependencyRegistryBinding })
};
validateImpactAssessment({
  policy,
  assessment,
  changedFiles,
  dependencyRegistry,
  dependencyRegistryBinding
});
await writeEvidenceReceipt(root, policy.defaultInput.impactAssessment, assessment);
console.log(`Mutation impact assessment: PASS / ${changedFiles.length} changed files / ${dependencyPlan.affectedVitestFiles.length} tests.`);
