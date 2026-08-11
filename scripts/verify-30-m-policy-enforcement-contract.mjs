import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const paths = {
  kernel: 'packages/platform-policy/src/policy-kernel.ts',
  pep: 'packages/platform-policy/src/policy-enforcement-point.ts',
  index: 'packages/platform-policy/src/index.ts',
  core: 'apps/core-service/src/core-service-runtime.ts',
  coreMain: 'apps/core-service/src/main.ts',
  decision: 'docs/decisions/DEC-138-ppk-002-central-policy-enforcement-foundation.md',
  registry: 'config/accepted-scope-registry.json',
  baseline: 'config/platform-policy-legacy-bypass-baseline.json',
  package: 'package.json',
  workPlan: 'config/work-segmentation-plan.json'
};
const text = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const registry = JSON.parse(text.registry);
const baseline = JSON.parse(text.baseline);
const packageJson = JSON.parse(text.package);
const workPlan = JSON.parse(text.workPlan);
const successorRegression = process.argv.includes('--successor-regression') || workPlan.currentStep !== '30-M';
const reportPath = successorRegression
  ? 'artifacts/validation/30-N-30-M-policy-enforcement-contract-regression.json'
  : 'artifacts/validation/30-M-ppk-002-policy-enforcement-contract.json';
const failures = [];
const checks = [];
const check = (condition, label) => {
  checks.push(label);
  if (!condition) failures.push(label);
};
const contains = (source, token, label) => check(source.includes(token), label);

contains(text.kernel, "'ACTION_CAPABILITY_MISMATCH'", 'kernel denies action-capability mismatches');
contains(text.kernel, "enforcementMode?: 'legacy' | 'strict'", 'request carries an explicit compatibility versus strict enforcement mode');
contains(text.kernel, "request.enforcementMode === 'strict'", 'strict mode does not inherit public/internal implicit allow');
contains(text.kernel, "'RESOURCE_SCOPE_DENIED'", 'kernel denies family household or branch scope mismatch');
contains(text.kernel, 'Uint8Array.from(config.signingKey)', 'kernel defensively copies its signing key');
contains(text.kernel, 'freezeObligations', 'policy obligations are deeply frozen');
contains(text.kernel, 'stable(receipt.decision) !== stable(this.evaluate(request))', 'request-bound receipt verification repeats current evaluation');
contains(text.kernel, 'policy decision does not match a fresh kernel evaluation', 'caller-supplied policy decisions cannot be signed without fresh evaluation');
contains(text.pep, 'resolve(): Promise<PlatformPolicyConnectionAuthority>', 'trusted authority resolver accepts no caller intent or authority fields');
contains(text.pep, "Object.keys(intent).some((key) => !allowedKeys.has(key))", 'bounded intent rejects unknown authority-smuggling fields');
contains(text.pep, 'intent = Object.freeze({', 'caller intent is canonicalized before any asynchronous policy boundary');
contains(text.pep, "enforcementMode: 'strict'", 'PEP always requests strict enforcement');
contains(text.pep, 'readonly request: PlatformPolicyRequest', 'persistent receipt record contains the canonical request');
contains(text.pep, 'PlatformPolicyReplayStore', 'PEP exposes an injectable replay reservation boundary');
contains(text.pep, 'sharedReplayReservations', 'default replay protection is shared across in-process PEP instances');
contains(text.pep, 'Number.isSafeInteger(receiptTtlMs)', 'receipt TTL rejects NaN infinity fractions and out-of-range values');
contains(text.pep, 'effectiveExpiresAtMs = Math.min', 'transaction lifetime is bounded by both receipt TTL and authority expiry');
contains(text.pep, 'Persisted policy receipt changed or no longer matches', 'receipt is reverified after the persistence sink returns');
contains(text.pep, 'CLUSTER_FENCE_CHANGED', 'cluster writability epoch changes fail closed');
contains(text.pep, 'TRANSACTION_CONTEXT_MISMATCH', 'repository context can be bound to the expected resource action and capability');
contains(text.pep, 'activeTransactionContexts.delete(context)', 'transaction context is retired after callback completion');
contains(text.core, 'ENFORCEMENT_UNAVAILABLE', 'Core Service fails closed when no PEP is configured');
contains(text.core, '#writeFenceEpoch += 1', 'Core Service advances its cluster write fence on lifecycle transitions');
contains(text.core, 'epoch: this.#writeFenceEpoch', 'Core Service supplies the live fence epoch to PEP');
contains(text.index, "export * from './policy-enforcement-point.js'", 'platform-policy public entrypoint exports the PEP foundation');
contains(text.decision, 'PPK-002 `COMPLETE` ilan edilmez', 'decision forbids a universal completion claim while legacy paths remain');
check(packageJson.scripts?.['verify:30-m:policy-enforcement-contract'] === 'node scripts/verify-30-m-policy-enforcement-contract.mjs', 'package exposes the 30-M contract gate');
check(packageJson.scripts?.['verify:30-m:policy-enforcement-runtime']?.includes('verify-30-m-policy-enforcement-runtime.mjs'), 'package exposes the 30-M controlled runtime gate');

const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
check(ppk002?.status === 'PARTIAL', 'PPK-002 remains PARTIAL');
check(ppk002?.chain?.decision === true && ppk002?.chain?.domain === true, 'existing PPK-002 decision and domain chain remains present');
check(!text.coreMain.includes('new PlatformPolicyEnforcementPoint'), 'production startup is not falsely claimed as wired before a trusted session authority exists');

const allowed = new Set((baseline.findings ?? []).map((item) => `${item.path}:${item.lineSha256}`));
const roleFindings = [];
let legacyRepositoryTransactions = 0;
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'tests') continue;
      await walk(path);
      continue;
    }
    if (!/\.tsx?$/u.test(entry.name)) continue;
    const source = await readFile(path, 'utf8');
    if (path.replaceAll('\\', '/').includes('apps/desktop/')) legacyRepositoryTransactions += source.split('transactionExecutor.execute').length - 1;
    if (path.replaceAll('\\', '/').includes('packages/platform-policy/')) continue;
    const lines = source.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      if (!/role\s*[!=]==?\s*['"]family_admin['"]|roles\.includes\(['"]family_admin['"]\)/u.test(lines[index])) continue;
      const lineSha256 = createHash('sha256').update(lines[index].trim()).digest('hex');
      roleFindings.push({ path: relative('.', path).replaceAll('\\', '/'), line: index + 1, lineSha256 });
    }
  }
};
await walk('apps');
await walk('packages');
const newBypasses = roleFindings.filter((item) => !allowed.has(`${item.path}:${item.lineSha256}`));
check(
  successorRegression ? roleFindings.length <= 34 : roleFindings.length === 34,
  successorRegression
    ? 'successor migration does not increase the 30-M direct-role inventory'
    : 'current legacy direct-role inventory remains 34 and is not hidden'
);
check(newBypasses.length === 0, '30-M introduces no new direct family_admin bypass');
check(legacyRepositoryTransactions > 0, 'legacy receiptless repository transaction inventory remains explicit');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: successorRegression ? workPlan.currentStep : '30-M',
  requirement: 'PPK-002',
  phase: successorRegression ? '30-M_PREDECESSOR_REGRESSION' : 'POLICY_ENFORCEMENT_FOUNDATION',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  assertions: {
    boundedIntent: failures.includes('bounded intent rejects unknown authority-smuggling fields') ? 'FAIL' : 'PASS',
    trustedAuthorityResolver: failures.includes('trusted authority resolver accepts no caller intent or authority fields') ? 'FAIL' : 'PASS',
    strictRequestBoundReceipt: failures.length === 0 ? 'PASS' : 'CHECK_REPORT',
    mutableIntentToctouResistance: failures.includes('caller intent is canonicalized before any asynchronous policy boundary') ? 'FAIL' : 'PASS',
    clusterFence: failures.includes('cluster writability epoch changes fail closed') ? 'FAIL' : 'PASS',
    replayStoreBoundary: failures.includes('PEP exposes an injectable replay reservation boundary') ? 'FAIL' : 'PASS'
  },
  evidenceBoundary: {
    scopedFoundation: failures.length === 0 ? 'PASS' : 'FAIL',
    historical30MReportMutated: false,
    universalRepositoryEnforcement: 'NOT_COMPLETE',
    productionStartupPepWired: false,
    durableMultiProcessReplayProtection: 'NOT_IMPLEMENTED',
    receiptAndBusinessCommitAtomicity: 'NOT_IMPLEMENTED',
    obligationExecution: 'NOT_IMPLEMENTED',
    legacyDirectRoleBypasses: roleFindings.length,
    legacyRepositoryTransactionCalls: legacyRepositoryTransactions,
    legacyRepositoryPathsMigrated: false,
    requirementCompletionClaimed: false,
    scopeStatus: 'PARTIAL'
  },
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`${successorRegression ? '30-M predecessor regression' : '30-M PPK-002 policy enforcement contract'}: PASS (${checks.length} checks; PPK-002 remains PARTIAL).`);
