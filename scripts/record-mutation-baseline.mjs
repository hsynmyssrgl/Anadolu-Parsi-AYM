import {
  captureHistoricalReleaseSourceProvenance,
  captureReleaseSourceProvenance
} from './lib/release-source-provenance.mjs';
import {
  appendExternalBaselineRecord,
  BOOTSTRAP_ADOPTION_BASE_COMMIT,
  currentEvidenceIdentity,
  loadCanonicalProducerBindings,
  loadMutationEvidencePolicy,
  readEvidenceBinding,
  writeEvidenceReceipt
} from './lib/mutation-release-evidence.mjs';

const args = process.argv.slice(2);
if (args.some((value) => value !== '--bootstrap-adoption') || args.filter((value) => value === '--bootstrap-adoption').length > 1) {
  throw new Error('Only the single-use --bootstrap-adoption option is supported.');
}
const bootstrap = args.includes('--bootstrap-adoption');
const root = process.cwd();
const { policy, registry } = await loadMutationEvidencePolicy(root);
const [current, operationRule, producers] = await Promise.all([
  captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' }),
  readEvidenceBinding(root, 'artifacts/validation/operation-rule-check.json', 'baseline operation-rule receipt'),
  loadCanonicalProducerBindings(root, policy)
]);
if (operationRule.value?.schemaVersion !== 1 || operationRule.value.status !== 'PASS'
  || operationRule.value.kind !== 'mutation' || operationRule.value.operation !== 'record-pre-mutation-baseline'
  || operationRule.value.rulesSha256 !== registry.rulesSha256) {
  throw new Error('Baseline operation-rule receipt is stale or not bound to record-pre-mutation-baseline.');
}
const baselineProvenance = bootstrap
  ? captureHistoricalReleaseSourceProvenance({
      runGit: current.runGit,
      currentProvenance: current.provenance,
      commit: BOOTSTRAP_ADOPTION_BASE_COMMIT
    })
  : current.provenance;
const externalReceipt = {
  schemaVersion: 2,
  id: 'PPT-MUTATION-BASELINE-EXTERNAL-V2',
  requirement: 'PR-235', decision: 'DEC-270',
  strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
  release: registry.effectiveRelease,
  evidenceKind: 'PRE_MUTATION_BASELINE_EXTERNAL',
  baselineType: bootstrap ? 'BOOTSTRAP_ADOPTION' : 'PRE_MUTATION',
  bootstrapDecision: bootstrap ? 'DEC-270_INITIAL_ACTIVATION_ONLY' : null,
  fullDiffRequired: bootstrap,
  status: 'PASS',
  sourceProvenance: baselineProvenance,
  operationRuleBinding: {
    path: operationRule.path, sizeBytes: operationRule.sizeBytes, sha256: operationRule.sha256,
    status: operationRule.value.status, kind: operationRule.value.kind,
    operation: operationRule.value.operation, rulesSha256: operationRule.value.rulesSha256,
    checkedAt: operationRule.value.checkedAt
  },
  producer: producers.baseline,
  recordedAt: new Date().toISOString()
};
const appended = await appendExternalBaselineRecord({ record: externalReceipt });
const pointer = {
  schemaVersion: 2,
  id: 'PPT-MUTATION-BASELINE-POINTER-V2',
  requirement: 'PR-235', decision: 'DEC-270',
  strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
  release: registry.effectiveRelease,
  evidenceKind: 'PRE_MUTATION_BASELINE_POINTER', status: 'PASS',
  ...currentEvidenceIdentity({ provenance: current.provenance, registry }),
  external: {
    root: policy.externalBaselineChain.root, channel: policy.externalBaselineChain.channel,
    recordFile: appended.name, sizeBytes: appended.sizeBytes, sha256: appended.sha256,
    sequence: appended.value.chain.sequence
  },
  producer: producers.baseline,
  recordedAt: externalReceipt.recordedAt
};
await writeEvidenceReceipt(root, policy.defaultEvidence.baseline, pointer);
console.log(`Pre-mutation baseline: PASS / ${baselineProvenance.headCommit} / ${externalReceipt.baselineType}.`);
