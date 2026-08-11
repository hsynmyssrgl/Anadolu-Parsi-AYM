import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const successorRegression = process.argv.includes('--successor-regression');
const paths = {
  verifier: 'apps/core-service/src/signed-cutover-readiness-evidence-verifier.ts',
  tests: 'apps/core-service/tests/signed-cutover-readiness-evidence-verifier.test.ts',
  index: 'apps/core-service/src/index.ts',
  ledger: 'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  runtime: 'apps/core-service/src/core-service-runtime.ts',
  contracts: 'packages/core-service-contracts/src/index.ts',
  decision: 'docs/decisions/DEC-174-signed-cutover-readiness-evidence-verifier-boundary.md',
  predecessor: 'docs/decisions/DEC-173-protected-cutover-readiness-journal-port.md',
  readiness: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutover: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  scope: 'config/31-m-signed-cutover-readiness-evidence-verifier-boundary-scope.json',
  plan: 'config/work-segmentation-plan.json',
  governance: 'config/active-governance-ledger.json',
  authority: 'artifacts/authority/31-M_SIGNED_EVIDENCE_VERIFIER_BOUNDARY_AUTHORITY.json',
  audit: 'docs/audit/31-M_SIGNED_CUTOVER_READINESS_EVIDENCE_VERIFIER_BOUNDARY.md'
};
const documents = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
));
const failures = [];
const checks = [];
const check = (condition, name) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
  if (!condition) failures.push(name);
};
const has = (key, markers) => {
  for (const marker of markers) check(documents[key].includes(marker), `${key} contains ${marker}`);
};

has('verifier', [
  "import { KeyObject, verify as verifySignature } from 'node:crypto'",
  'SignedCutoverReadinessEvidenceVerifier',
  'SignedCutoverReadinessEvidenceVerifierConfigurationError',
  "'KEY_ID_INVALID'",
  "'PUBLIC_KEY_REQUIRED'",
  "'ALGORITHM_UNSUPPORTED'",
  'public readonly algorithm = \'ed25519\'',
  'input.publicKey instanceof KeyObject',
  "input.publicKey.type !== 'public'",
  "input.publicKey.asymmetricKeyType !== 'ed25519'",
  'PPT-CUTOVER-READINESS-EVIDENCE-V1',
  "'ed25519'",
  'keyId',
  'hasExactClaimKeys',
  'CANONICAL_ED25519_SIGNATURE_PATTERN',
  "Buffer.from(value.verificationBinding, 'base64url')",
  'signature.byteLength !== 64',
  "signature.toString('base64url') !== value.verificationBinding",
  'CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.includes',
  'catch {',
  'return false'
]);
for (const forbidden of [
  'createPublicKey', 'publicKeyPem', 'privateKey', 'generateKeyPair', 'sign(', 'node:fs', 'node:sqlite',
  'better-sqlite', 'electron', 'process.env', 'databasePath', 'authenticationToken', 'password',
  'Google Drive', 'console.log', 'console.error', 'C:\\', 'D:\\', 'G:\\'
]) check(!documents.verifier.includes(forbidden), `verifier excludes ${forbidden}`);
has('tests', [
  'accepts an exact Ed25519 signature bound to the configured key identifier',
  'rejects mutations of every signed claim field and a different key identifier',
  'rejects malformed, non-canonical, unknown-gate, and extra-field claims without throwing',
  'rejects private keys, non-Ed25519 public keys, PEM strings, and invalid key identifiers',
  'does not expose the configured public key or any signing capability'
]);
check(documents.index.includes("export * from './signed-cutover-readiness-evidence-verifier.js'"), 'Core Service exports the verifier boundary');
check(!documents.ledger.includes('signed-cutover-readiness-evidence-verifier'), 'readiness ledger does not attach the signed verifier');
check(!documents.runtime.includes('SignedCutoverReadinessEvidenceVerifier'), 'Core Service runtime does not attach the signed verifier');
check(documents.runtime.includes('new CoreServiceFamilyDataCutoverReadinessLedger({ clock: this.#clock })'), 'runtime retains detached readiness composition');
check(!documents.contracts.includes("'family-data-cutover-readiness.append'"), 'local administration exposes no readiness mutation method');
check(!documents.contracts.includes('verificationBinding') && !documents.contracts.includes('keyId'), 'local administration exposes no signature or key identity');
has('decision', [
  'accepts only a Node `KeyObject`',
  'does not accept or parse PEM text and rejects private key objects',
  'key identifier',
  'canonical unpadded Base64URL that decodes to exactly 64 bytes',
  'does not attach it to the readiness ledger or Core Service runtime',
  'No production verification-key authority',
  'DEC-171, DEC-172, and DEC-173 are not replaced or weakened',
  'No requirement is declared COMPLETE'
]);
has('predecessor', ['Status: ACTIVE', 'The production composition remains detached', 'DEC-171 and DEC-172 are not replaced or weakened']);
has('readiness', ['Status: ACTIVE', 'trusted evidence verifier', 'DEC-171 is not replaced or weakened']);
has('cutover', ['Status: ACTIVE', 'No API in 31-J can enable cutover']);
has('audit', ['public Node `KeyObject`', 'No production verification-key authority', 'DEC-171 remains active']);

const scope = JSON.parse(documents.scope);
const plan = JSON.parse(documents.plan);
const governance = JSON.parse(documents.governance);
const authority = JSON.parse(documents.authority);
check(scope.step === '31-M' && scope.decision === 'DEC-174' && scope.predecessorDecision === 'DEC-173', 'scope identity and predecessor decision');
check(scope.readinessDecision === 'DEC-172' && scope.cutoverDecision === 'DEC-171', 'scope binds readiness and cutover decisions');
check(scope.targets.signatureAlgorithm === 'ED25519_ONLY', 'scope selects Ed25519 only');
check(scope.targets.publicKeyInput === 'PUBLIC_KEY_KEYOBJECT_ONLY_NO_PEM_OR_PRIVATE_KEY_INPUT', 'scope selects public KeyObject only');
check(scope.targets.keyIdentityBinding === 'KEY_ID_INCLUDED_IN_SIGNED_PAYLOAD', 'scope binds key identity');
check(scope.targets.signatureEncoding === 'CANONICAL_BASE64URL_EXACT_64_BYTE_ED25519_SIGNATURE', 'scope requires canonical 64-byte signature');
check(scope.targets.productionKeyAuthority === 'NOT_ATTACHED' && scope.targets.runtimeIntegration === 'NOT_WIRED', 'scope excludes production key authority and runtime wiring');
check(scope.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED' && scope.openBoundaries.sqliteOwnershipTransfer === 'NOT_PERFORMED_BLOCKED', 'real data and SQLite transfer remain blocked');
check(scope.openBoundaries.productionEvidenceSigner === 'NOT_ATTACHED_DEFAULT_DENY' && scope.openBoundaries.productionVerifierKeyAuthority === 'NOT_ATTACHED_DEFAULT_DENY', 'signer and production key authority remain open');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'scope makes no requirement or Build claim');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_CONTINUATION_APPLY_31_M', 'authority binds explicit user continuation');
check(authority.reviewedStaging.treeSha256 === '942d11a1b2e18cd0fa58dfb8d3897d62756153b7c45ad4870019705990a13127', 'authority binds reviewed staging tree');
const step = plan.steps.find((item) => item.id === '31-M');
const active = plan.currentStep === '31-M' && step?.status === 'IN_PROGRESS' && governance.activeMicroStep === '31-M' && String(governance.libraryUploadStatus).startsWith('31-M_');
const complete = plan.currentStep === '31-M' && step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS' && governance.activeMicroStep === null && governance.libraryUploadStatus === '31-M_COMPLETED_RECEIPT_PASS';
const later = inspectAuthorizedSuccessorLifecycle({ plan, ledger: governance, predecessorId: '31-M' });
check(active || complete || (later.planValid && later.ledgerValid && later.nextTaskValid), '31-M has an active, completed, or authorized-successor lifecycle');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-M',
  phase: 'SIGNED_CUTOVER_READINESS_EVIDENCE_VERIFIER_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu PASS yalnız açık-anahtar doğrulama sınırına aittir; üretim anahtar otoritesi, imzalayıcı, runtime bağlantısı veya cutover PASS değildir.'
};
if (!successorRegression) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/31-M_SIGNED_CUTOVER_READINESS_EVIDENCE_VERIFIER_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`31-M contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`31-M contract: PASS (${checks.length}/${checks.length}).`);
