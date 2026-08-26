import { captureReleaseSourceProvenance, listChangedPathsForImpactAnalysis } from './lib/release-source-provenance.mjs';
import {
  currentEvidenceIdentity, loadCanonicalProducerBindings, loadMutationEvidencePolicy,
  readEvidenceBinding, readExternalBaselineFromPointer, readRepoFileBinding,
  validateImpactAssessment, writeEvidenceReceipt
} from './lib/mutation-release-evidence.mjs';

if (process.argv.length !== 2) throw new Error('Mutation impact analysis accepts no path or base overrides.');
const root = process.cwd();
const { policy, registry, dependencyRegistry, dependencyRegistryBinding } = await loadMutationEvidencePolicy(root);
const [source, baselinePointer, assessment, producers] = await Promise.all([
  captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' }),
  readEvidenceBinding(root, policy.defaultEvidence.baseline, 'pre-mutation baseline pointer'),
  readEvidenceBinding(root, policy.defaultInput.impactAssessment, 'mutation impact assessment'),
  loadCanonicalProducerBindings(root, policy)
]);
const external = await readExternalBaselineFromPointer({ pointer: baselinePointer.value });
const changedFiles = listChangedPathsForImpactAnalysis({
  runGit: source.runGit,
  baselineReceipt: external.record.value,
  baselinePointer: baselinePointer.value,
  headCommit: source.provenance.headCommit,
  currentProvenance: source.provenance
});
if (changedFiles.length === 0) throw new Error('Mutation impact analysis has no exact changed file.');
const assessed = validateImpactAssessment({
  policy,
  assessment: assessment.value,
  changedFiles,
  dependencyRegistry,
  dependencyRegistryBinding,
  expectedSourceCommit: source.provenance.headCommit,
  expectedBaselineCommit: external.record.value.sourceProvenance.headCommit
});
const evidencePaths = [...new Set(Object.values(assessed.impactAreas)
  .flatMap((area) => area.evidencePaths ?? []))].sort();
const evidencePathBindings = Object.fromEntries(await Promise.all(evidencePaths.map(async (path) => {
  const binding = await readRepoFileBinding(root, path, `impact evidence ${path}`);
  return [path, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
})));
const dependencyRecordBindings = Object.fromEntries(await Promise.all(assessed.dependencyPlan.dependentRecords.map(async (path) => {
  const binding = await readRepoFileBinding(root, path, `dependent record ${path}`);
  return [path, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
})));
for (const [path, impact] of Object.entries(assessed.dependentRecordImpacts)) {
  if (dependencyRecordBindings[path]?.sha256 !== impact.sha256) {
    throw new Error(`Dependent record impact SHA-256 differs from current readback: ${path}`);
  }
}
const affectedTestBindings = Object.fromEntries(await Promise.all(assessed.dependencyPlan.affectedVitestFiles.map(async (path) => {
  const binding = await readRepoFileBinding(root, path, `affected test ${path}`);
  return [path, { path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }];
})));
const receipt = {
  schemaVersion: 2,
  id: 'PPT-MUTATION-IMPACT-ANALYSIS-V2',
  requirement: 'PR-235',
  decision: 'DEC-270',
  strengthenedByRequirement: 'PR-240',
  strengthenedByDecision: 'DEC-275',
  release: registry.effectiveRelease,
  evidenceKind: 'MUTATION_IMPACT_ANALYSIS',
  status: 'PASS',
  ...currentEvidenceIdentity({ provenance: source.provenance, registry }),
  baseCommit: external.record.value.sourceProvenance.headCommit,
  headCommit: source.provenance.headCommit,
  chain: {
    baselinePointerSha256: baselinePointer.sha256,
    baselineExternalSha256: external.record.sha256,
    assessmentSha256: assessment.sha256,
    dependencyRegistrySha256: dependencyRegistryBinding.sha256
  },
  assessment: { path: assessment.path, sizeBytes: assessment.sizeBytes, sha256: assessment.sha256 },
  changedFiles,
  changedFileImpacts: assessed.changedFileImpacts,
  impactAreas: assessed.impactAreas,
  dependentRecordImpacts: assessed.dependentRecordImpacts,
  dependencyPlan: assessed.dependencyAssessment,
  dependencyRecordBindings,
  affectedTestBindings,
  evidencePathBindings,
  producer: producers.impactAnalysis,
  generatedAt: new Date().toISOString()
};
await writeEvidenceReceipt(root, policy.defaultEvidence.impactAnalysis, receipt);
console.log(`Mutation impact analysis: PASS / ${changedFiles.length} changed files.`);
