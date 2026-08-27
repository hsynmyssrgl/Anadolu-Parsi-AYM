import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { computeGovernedSourceFingerprint, readJson } from './lib/governance-utils.mjs';

const cliArguments = process.argv.slice(2);
if (cliArguments.length > 1 || cliArguments.some((argument) => argument !== '--read-only')) {
  console.error('GOVERNED_PREFLIGHT blocked: only the optional --read-only flag is accepted.');
  process.exit(1);
}
const readOnly = process.argv.includes('--read-only');
const registry = await readJson('config/canonical-rule-registry.json');
const acknowledgement = await readJson('config/rule-acknowledgement.json');
const supplied = process.env.PPT_RULES_SHA256;
if (acknowledgement.release !== registry.effectiveRelease || acknowledgement.rulesSha256 !== registry.rulesSha256) {
  console.error('GOVERNED_PREFLIGHT blocked: rule acknowledgement is missing or stale');
  process.exit(1);
}
if (supplied !== undefined && supplied !== registry.rulesSha256) {
  console.error('GOVERNED_PREFLIGHT blocked: supplied rule SHA does not match the canonical registry');
  process.exit(1);
}
let certifiedPreflight = null;
if (readOnly) {
  certifiedPreflight = await readJson('artifacts/validation/governed-preflight.json');
  const currentFingerprint = await computeGovernedSourceFingerprint();
  const certificateValid = certifiedPreflight?.status === 'PASS'
    && certifiedPreflight.rulesSha256 === registry.rulesSha256
    && certifiedPreflight.sourceFingerprint?.sha256 === currentFingerprint.sha256
    && certifiedPreflight.sourceFingerprint?.fileCount === currentFingerprint.fileCount
    && Array.isArray(certifiedPreflight.results)
    && certifiedPreflight.results.length > 0
    && certifiedPreflight.results.every((result) => result.exitCode === 0);
  if (!certificateValid) {
    console.error('GOVERNED_PREFLIGHT read-only blocked: committed full-preflight certificate is stale or invalid.');
    process.exit(1);
  }
}
const fullCommands = [
  ['scripts/verify-canonical-rule-registry.mjs'],
  ['scripts/verify-operation-rule-check.mjs', '--kind', 'test', '--operation', 'governed-preflight'],
  ['docs/ticari-urun-temeli/11_OTOMASYON/dogrula-ticari-temel-alani.mjs'],
  ['scripts/verify-user-decision-ledger.mjs'],
  ['scripts/verify-documentation-synchronization-policy.mjs'],
  ['scripts/verify-current-master-documentation-v5.mjs'],
  ['scripts/verify-universal-rule-enforcement.mjs'],
  ['scripts/verify-product-brand-identity.mjs'],
  ['scripts/verify-first-family-clean-release-policy.mjs'],
  ['scripts/verify-windows-installer-retention-policy.mjs'],
  ['scripts/verify-user-visible-release-display-policy.mjs'],
  ['scripts/verify-step-checkpoint-gate.mjs'],
  ['scripts/verify-active-release-contract-v2.mjs'],
  ['scripts/verify-workspace-dependencies.mjs'],
  ['scripts/verify-conversation-capacity-policy.mjs'],
  ['scripts/verify-feature-reality-gate.mjs'],
  ['scripts/verify-platform-policy-gate.mjs'],
  ['scripts/verify-core-service-boundary.mjs'],
  ['scripts/verify-core-service-local-admin-contract.mjs'],
  ['scripts/verify-core-service-local-admin-runtime-wrapper.mjs'],
  ['scripts/verify-desktop-core-service-startup-contract.mjs'],
  ['scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs'],
  ['scripts/verify-system-health-core-service-ipc-contract.mjs'],
  ['scripts/verify-system-health-core-service-ipc-runtime-wrapper.mjs'],
  ...(!readOnly ? [['scripts/generate-project-artifact-index-v2.mjs', '--git-index']] : []),
  ['scripts/verify-project-artifact-index-v2.mjs', '--git-index']
];
const readOnlyCommands = [
  ['scripts/verify-product-brand-identity.mjs'],
  ['scripts/verify-workspace-dependencies.mjs'],
  ['scripts/verify-current-master-documentation-v5.mjs'],
  ['scripts/verify-project-artifact-index-v2.mjs', '--no-report', '--exact-head']
];
const commands = readOnly ? readOnlyCommands : fullCommands;
const results = [];
let failed = false;
for (const args of commands) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: process.env, windowsHide: true });
  results.push({ script: args[0], arguments: args.slice(1), exitCode: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() });
  if (result.status !== 0) { failed = true; break; }
}
const fingerprint = failed ? null : await computeGovernedSourceFingerprint();
const report = {
  schemaVersion: 1, release: registry.effectiveRelease, rulesSha256: registry.rulesSha256,
  mode: readOnly ? 'READ_ONLY_TRACKED_FILES' : 'GENERATE_AND_VERIFY', acknowledgement,
  certifiedFullPreflightGeneratedAt: certifiedPreflight?.generatedAt ?? null,
  sourceFingerprint: fingerprint, status: failed ? 'FAIL' : 'PASS', results, generatedAt: new Date().toISOString()
};
if (!readOnly) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/governed-preflight.json', `${JSON.stringify(report, null, 2)}\n`);
}
for (const result of results) {
  console.log(`${result.script}: ${result.exitCode === 0 ? 'PASS' : 'FAIL'}${result.stdout ? `\n${result.stdout}` : ''}${result.stderr ? `\n${result.stderr}` : ''}`);
}
if (failed) process.exit(1);
console.log(`GOVERNED_PREFLIGHT: PASS / ${report.mode} / rules ${registry.rulesSha256}.`);
