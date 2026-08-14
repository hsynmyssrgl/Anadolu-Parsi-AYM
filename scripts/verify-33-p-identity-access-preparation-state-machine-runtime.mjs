import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  IDENTITY_ACCESS_COMPLETION_REQUIREMENTS,
  buildIdentityAccessPreparedState,
  evaluateIdentityAccessCompletionPreparation
} from './lib/identity-access-preparation-state-machine.mjs';
import { IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS } from './lib/identity-access-external-evidence-intake.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
if (process.argv.slice(2).some((argument) => argument !== '--no-write')) {
  throw new Error('Unsupported 33-P preparation runtime argument');
}
const noWrite = process.argv.includes('--no-write');
const output = resolve(root, 'artifacts/validation/33-P-identity-access-preparation-state-machine-runtime.json');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [scope, inventory, acceptedScopeRegistry, roadmap, workPlan, ledger, predecessorReceipt] = await Promise.all([
  readJson('config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json'),
  readJson('config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('artifacts/checkpoints/33-O_LIBRARY_RECEIPT.json')
]);

const HEAD = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const KEY = 'c'.repeat(64);
const PREPARED_AT = '2026-08-14T12:00:00.000Z';
const evidenceFiles = IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS.map((id, index) => ({
  id, relativePath: `${id}.json`, sizeBytes: 100 + index, sha256: `${index}`.padStart(64, 'd').slice(-64)
}));
const evidenceReport = {
  status: 'PASS',
  closureReadiness: {
    status: 'READY_FOR_GOVERNED_REVIEW', requirementPassGranted: false,
    registryMutationPerformed: false, persistentReceiptWritten: false
  },
  evidenceBinding: {
    sourceCommit: HEAD, sourceTree: TREE, hostRefSha256: 'e'.repeat(64), signerKeyIdSha256: KEY,
    manifest: { relativePath: 'manifest.json', sizeBytes: 500, sha256: 'f'.repeat(64) },
    files: evidenceFiles, evidenceTreeSha256: '1'.repeat(64),
    generatedAt: '2026-08-14T11:00:00.000Z', expiresAt: '2026-08-21T11:00:00.000Z'
  }
};
const trustedSignerRegistry = {
  schemaVersion: 1,
  id: '33-p-identity-access-external-evidence-trusted-signers',
  step: '33-P',
  decision: 'DEC-227',
  status: 'CONFIGURED',
  signers: [{
    authority: 'independent_33p_evidence_reviewer', status: 'ACTIVE', signerKeyIdSha256: KEY,
    evidenceIds: IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS,
    validFrom: '2026-08-13T12:00:00.000Z', validUntil: '2026-09-13T12:00:00.000Z'
  }],
  configurationTruth: {
    defaultSignerTrusted: false, selfSignedEvidenceAccepted: false,
    sourceCommitBindingRequired: true, activationRequiresGovernedReview: true
  }
};
const technicalEvidence = {
  sourceCommit: HEAD,
  boundary: { status: 'PASS', checksPassed: 21 },
  contract: { status: 'PASS', checksPassed: 17 },
  runtime: { status: 'PASS', checksPassed: 24, targetedTestFilesPassed: 19, targetedTestsPassed: 116 },
  migration93Checksum: '51191e62bcf4baec07e3eab5985ef4210402cdb8b7416064519ceb082322916a',
  ppk021: { status: 'PASS', findings: 0, exactAllowlistEntries: 683 },
  ppk022: { status: 'PASS', findings: 0, exactManifestSurfaces: 339 },
  fullVitest: { testFilesPassed: 170, testsPassed: 1338 },
  builds: { packages: true, coreService: true, desktop: true }
};
const base = {
  scope, inventory, acceptedScopeRegistry, roadmap, workPlan, ledger, predecessorReceipt,
  trustedSignerRegistry, evidenceReport, technicalEvidence,
  gitBinding: {
    clean: true, head: HEAD, tree: TREE, predecessorAncestor: true,
    predecessorSourceCommit: predecessorReceipt.sourceCommit
  },
  preparedAt: PREPARED_AT
};
const checks = [];
const check = (id, condition) => checks.push({ id, status: condition ? 'PASS' : 'FAIL' });

const governedPaths = [
  'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json',
  'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json',
  'config/accepted-scope-registry.json',
  'config/remaining-scope-package-roadmap.json',
  'config/work-segmentation-plan.json',
  'config/active-governance-ledger.json'
];
const beforeCliFailure = await Promise.all(governedPaths.map((path) => readFile(resolve(root, path))));
const missingEvidenceRun = spawnSync(process.execPath, [
  'scripts/prepare-33-p-passkeys-federated-identity-verifiable-temporary-credentials-completion.mjs'
], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
const afterCliFailure = await Promise.all(governedPaths.map((path) => readFile(resolve(root, path))));
check('mutating-cli-rejects-missing-evidence-before-state-write', missingEvidenceRun.status !== 0
  && `${missingEvidenceRun.stdout ?? ''}\n${missingEvidenceRun.stderr ?? ''}`.includes(
    '33-P preparation requires exactly one value for --evidence-root')
  && beforeCliFailure.every((bytes, index) => bytes.equals(afterCliFailure[index])));

const accepted = evaluateIdentityAccessCompletionPreparation(base);
check('exact-synthetic-preparation-passes', accepted.status === 'PASS' && accepted.failed === 0);
const prepared = buildIdentityAccessPreparedState(base);
check('prepared-state-is-receipt-pending-without-registry-mutation',
  prepared.scope.status === 'VALIDATED_RECEIPT_PENDING'
  && prepared.scope.validation.countsAsRequirementPass === false
  && prepared.scope.manualEvidence.liveProviderAccountTest === 'PASS_SIGNED_EXTERNAL_EVIDENCE'
  && prepared.inventory.status === 'VALIDATED_RECEIPT_PENDING'
  && prepared.roadmap.packages.find((item) => item.step === '33-P')?.status === 'VALIDATED_AWAITING_RECEIPT'
  && prepared.workPlan.steps.find((item) => item.id === '33-P')?.persistentReceiptStatus === 'PENDING'
  && JSON.stringify(prepared.acceptedScopeRegistry) === JSON.stringify(acceptedScopeRegistry)
  && IDENTITY_ACCESS_COMPLETION_REQUIREMENTS.every((id) => prepared.acceptedScopeRegistry.requirements
    .find((item) => item.id === id)?.status !== 'COMPLETE'));
check('preparation-record-binds-content-free-evidence-and-successor',
  prepared.preparationRecord.evidenceSourceCommit === HEAD
  && prepared.preparationRecord.signerKeyIdSha256 === KEY
  && prepared.preparationRecord.evidenceTreeSha256 === evidenceReport.evidenceBinding.evidenceTreeSha256
  && prepared.preparationRecord.nextOfficialStep === '33-Q'
  && prepared.preparationRecord.countsAsRequirementPass === false);
const wrongSource = evaluateIdentityAccessCompletionPreparation({
  ...base, evidenceReport: { ...evidenceReport, evidenceBinding: { ...evidenceReport.evidenceBinding, sourceCommit: '9'.repeat(40) } }
});
check('foreign-evidence-source-rejected', wrongSource.status === 'FAIL'
  && wrongSource.checks.some((item) => item.id === 'external-evidence-binding-exact' && item.status === 'FAIL'));
const foreignSigner = evaluateIdentityAccessCompletionPreparation({
  ...base, trustedSignerRegistry: { ...trustedSignerRegistry, signers: trustedSignerRegistry.signers
    .map((signer) => ({ ...signer, signerKeyIdSha256: '8'.repeat(64) })) }
});
check('untrusted-signer-rejected', foreignSigner.status === 'FAIL'
  && foreignSigner.checks.some((item) => item.id === 'governed-signer-active' && item.status === 'FAIL'));
const failedTechnical = evaluateIdentityAccessCompletionPreparation({
  ...base, technicalEvidence: { ...technicalEvidence, builds: { ...technicalEvidence.builds, desktop: false } }
});
check('failed-build-rejected', failedTechnical.status === 'FAIL'
  && failedTechnical.checks.some((item) => item.id === 'technical-evidence-exact' && item.status === 'FAIL'));
const notActive = evaluateIdentityAccessCompletionPreparation({
  ...base, workPlan: { ...workPlan, currentStep: null }
});
check('non-active-step-rejected', notActive.status === 'FAIL'
  && notActive.checks.some((item) => item.id === 'sole-active-step-exact' && item.status === 'FAIL'));

const failures = checks.filter((item) => item.status !== 'PASS');
const report = {
  schemaVersion: 1,
  step: '33-P',
  decision: 'DEC-227',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checks: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  results: checks,
  actualExternalEvidenceStatus: 'NOT_RUN',
  actualPreparationStatus: 'NOT_RUN',
  registryMutationPerformed: false,
  persistentReceiptWritten: false,
  generatedAt: new Date().toISOString()
};
if (!noWrite) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`33-P preparation state machine runtime: ${report.status} (${report.passed}/${report.checks}; actual evidence NOT_RUN).`);
if (failures.length > 0) process.exitCode = 1;
