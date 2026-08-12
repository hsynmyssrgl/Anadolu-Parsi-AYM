import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourceRoot = resolve(process.cwd());
const aymRoot = resolve(sourceRoot, '..', '..');
const mode = process.argv[2] ?? 'capture';
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const hashFile = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const evidencePath = resolve(sourceRoot, 'artifacts', 'validation', 'bronze-governance-reality-matrix.json');
const runProtectionVerifier = (script) => spawnSync(process.execPath, [script, 'verify'], {
  cwd: sourceRoot,
  encoding: 'utf8',
  windowsHide: true
});

check(sourceRoot === resolve('C:\\PPT\\AYM', '06_KOD', 'app'), `authoritative source mismatch: ${sourceRoot}`);
const [scope, decisions, policy, audit, featureReality] = await Promise.all([
  readJson(resolve(sourceRoot, 'config', 'accepted-scope-registry.json')),
  readJson(resolve(sourceRoot, 'config', 'user-decision-ledger.json')),
  readJson(resolve(sourceRoot, 'config', 'bronze-current-audit-policy.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'inventory', 'BRONZE_CURRENT_COMPLETION_AUDIT.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'validation', 'feature-reality-gate.json'))
]);

const b001 = scope.requirements?.find((item) => item.id === 'B0-01');
const b002 = scope.requirements?.find((item) => item.id === 'B0-02');
const b201 = scope.requirements?.find((item) => item.id === 'B2-01');
const gov005 = scope.requirements?.find((item) => item.id === 'GOV-005');
const ppk002 = scope.requirements?.find((item) => item.id === 'PPK-002');
const ppk003 = scope.requirements?.find((item) => item.id === 'PPK-003');
const statusCounts = Object.fromEntries(
  [...new Set(scope.requirements.map((item) => item.status))]
    .sort()
    .map((status) => [status, scope.requirements.filter((item) => item.status === status).length])
);
check(scope.requirementCount === 350 && scope.requirements.length === 350, 'accepted scope must contain exactly 350 requirements');
check(policy.authoritativeSource === '06_KOD/app', 'audit policy authoritative source mismatch');
check(decisions.decisions?.filter((item) => item.id === 'DEC-153' && item.status === 'ACTIVE').length === 1, 'active DEC-153 must be unique');
check(decisions.decisions?.filter((item) => item.id === 'DEC-162' && item.status === 'ACTIVE').length === 1, 'active DEC-162 must be unique');
check(decisions.decisions?.filter((item) => item.id === 'DEC-163' && item.status === 'ACTIVE').length === 1, 'active DEC-163 must be unique');
check(decisions.decisions?.filter((item) => item.id === 'DEC-164' && item.status === 'ACTIVE').length === 1, 'active DEC-164 must be unique');
check(decisions.decisions?.filter((item) => item.id === 'DEC-165' && item.status === 'ACTIVE').length === 1, 'active DEC-165 must be unique');
check(decisions.decisions?.filter((item) => item.id === 'DEC-180' && item.status === 'ACTIVE').length === 1, 'active DEC-180 must be unique');
check(decisions.decisions?.filter((item) => item.id === 'DEC-181' && item.status === 'ACTIVE').length === 1, 'active DEC-181 must be unique');
check(decisions.decisions?.filter((item) => item.id === 'DEC-183' && item.status === 'ACTIVE').length === 1, 'active DEC-183 must be unique');
check(decisions.decisions?.filter((item) => item.id === 'DEC-184' && item.status === 'ACTIVE').length === 1, 'active DEC-184 must be unique');
check(ppk002?.priority === 'P0' && ppk002.status === 'COMPLETE' && Object.values(ppk002.chain ?? {}).every((value) => value === true), 'PPK-002 must be P0 COMPLETE with a closed chain');
check(ppk003?.priority === 'P0' && ppk003.status === 'COMPLETE' && Object.values(ppk003.chain ?? {}).every((value) => value === true), 'PPK-003 must be P0 COMPLETE with a closed chain');
check(Boolean(b001), 'B0-01 is missing');
check(b001?.status === 'COMPLETE', 'B0-01 is not COMPLETE');
check(Object.values(b001?.chain ?? {}).every((value) => value === true), 'B0-01 completion chain is not closed');
check(b001?.evidence?.includes('artifacts/validation/bronze-governance-reality-matrix.json'), 'B0-01 matrix evidence link is missing');
check(b002?.status === 'COMPLETE' && Object.values(b002?.chain ?? {}).every((value) => value === true), 'B0-02 public release boundary chain is not COMPLETE');
check(b002?.evidence?.includes('artifacts/checkpoints/31-E_LIBRARY_RECEIPT.json'), 'B0-02 31-E receipt evidence link is missing');
check(b201?.status === 'COMPLETE', 'B2-01 must be COMPLETE under DEC-162');
check((b201?.completionBlockers?.length ?? 0) === 0, 'B2-01 must have no current completion blocker under DEC-162');
check(b201?.deferredValidations?.some((item) => item.id === 'B2-01-NATIVE-WINDOWS-HELLO'
  && item.status === 'USER_DEFERRED_NOT_RUN_NOT_PASS'
  && item.countsAsCompletionBlocker === false), 'B2-01 non-blocking native hardware deferral is missing');
check(b201?.temporaryClosure?.decision === 'DEC-162'
  && b201.temporaryClosure.runtimeCodePreserved === true
  && b201.temporaryClosure.passwordFallbackPreserved === true
  && b201.temporaryClosure.nativePassClaimed === false, 'B2-01 DEC-162 truth boundary mismatch');
check(gov005?.status === 'COMPLETE' && (gov005.completionBlockers?.length ?? 0) === 0, 'GOV-005 must be COMPLETE without a current blocker under DEC-164');
check(gov005?.externalProtectionClosure?.decision === 'DEC-164'
  && gov005.externalProtectionClosure.storageBackend === 'EXTERNAL_USB_D_DRIVE', 'GOV-005 external protection closure boundary mismatch');
check(featureReality.requirements === 350 && featureReality.status === 'PASS', 'Feature Reality Gate evidence is not current PASS');
check(featureReality.silverReady === false, 'Silver must remain blocked');
check(audit.scope.total === 350, 'Bronze audit scope total mismatch');
check(audit.PPK002 === 'COMPLETE', 'Bronze audit PPK-002 status is not COMPLETE');
check(audit.PPK003 === 'COMPLETE', 'Bronze audit PPK-003 status is not COMPLETE');
check(JSON.stringify(audit.scope.statusCounts) === JSON.stringify(statusCounts), 'Bronze audit status counts mismatch');
check(audit.numberingAssessment.newBuildAssigned === false, 'Bronze audit assigned a new Build');
check(audit.checkpoint30Z.persistentReceiptStatus === 'PASS', 'frozen external 30-Z receipt must be PASS');
check(audit.checkpoint30Z.officialCompletionClaimed === true, 'frozen 30-Z official completion is missing');
check(audit.checkpoint31A.persistentReceiptStatus === 'PASS', 'focused external 31-A receipt must be PASS');
check(audit.checkpoint31A.officialCompletionClaimed === true, 'focused 31-A official completion is missing');
check(audit.checkpoint31B.persistentReceiptStatus === 'PASS', 'focused external 31-B receipt must be PASS');
check(audit.checkpoint31B.officialCompletionClaimed === true, 'focused 31-B official completion is missing');
check(audit.checkpoint31C.persistentReceiptStatus === 'PASS', 'focused external 31-C receipt must be PASS');
check(audit.checkpoint31C.officialCompletionClaimed === true, 'focused 31-C official completion is missing');
check(audit.checkpoint31D.persistentReceiptStatus === 'PASS', 'focused external 31-D receipt must be PASS');
check(audit.checkpoint31D.officialCompletionClaimed === true, 'focused 31-D official completion is missing');
check(audit.checkpoint31E.persistentReceiptStatus === 'PASS', 'focused external 31-E receipt must be PASS');
check(audit.checkpoint31E.officialCompletionClaimed === true && audit.checkpoint31E.B002 === 'COMPLETE', 'focused 31-E official completion is missing');
check(['31-T', '33-D', '33-E'].includes(audit.currentStep) && audit.percentages.officialWeightedEvidenceStep === '31-T', 'Bronze audit active checkpoint or historical weighted-evidence checkpoint is invalid');
for (const letter of ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']) {
  const checkpoint = audit[`checkpoint31${letter}`];
  check(checkpoint?.persistentReceiptStatus === 'PASS', `external 31-${letter} receipt must be PASS`);
  check(checkpoint?.officialCompletionClaimed === true, `31-${letter} official completion is missing`);
  check(checkpoint?.requirementCompletionClaimed === false, `31-${letter} must not claim full requirement completion`);
}
check(audit.checkpoint31S.deliveredBoundary.preflightClassification === 'READ_ONLY_NON_AUTHORITATIVE_DEC_171_BLOCKED'
  && audit.checkpoint31S.deliveredBoundary.successorDecision === 'NOT_CREATED'
  && audit.checkpoint31S.deliveredBoundary.versionedDecisionSubmission === 'NOT_PERFORMED', '31-S non-authoritative truth boundary mismatch');
check(audit.checkpoint31T.PPK002 === undefined || audit.checkpoint31T.primaryRequirement === 'PPK-002', '31-T primary requirement mismatch');
check(audit.checkpoint31T.openBoundaries.universalRepositoryEnforcement === 'NOT_COMPLETE'
  && audit.checkpoint31T.openBoundaries.obligationExecution === 'NOT_RUN_NOT_PASS'
  && audit.checkpoint31T.openBoundaries.externalMonotonicRollbackAuthority === 'NOT_IMPLEMENTED', '31-T open-boundary truth mismatch');
check(audit.currentSourceExternalProtection.status === 'SEPARATE_LIVE_DELIVERY_GATE_REQUIRED'
  && audit.currentSourceExternalProtection.snapshotReceiptStatus === 'PASS'
  && audit.currentSourceExternalProtection.freshnessVerifiedInThisAudit === false,
'Bronze audit must preserve the separate live source-protection truth boundary');
const localProtection = runProtectionVerifier('scripts/protect-authoritative-source.mjs');
const externalProtection = runProtectionVerifier('scripts/protect-authoritative-source-external.mjs');
check(localProtection.status === 0, `current authoritative local source protection must be live PASS: ${localProtection.stderr || localProtection.stdout}`);
check(externalProtection.status === 0, `current authoritative D: source protection must be live PASS: ${externalProtection.stderr || externalProtection.stdout}`);

if (mode === 'verify-root') {
  const [rootDecisions, manifest, evidence] = await Promise.all([
    readJson(resolve(aymRoot, '01_YONETIM', 'KARAR_SICILI.json')),
    readJson(resolve(aymRoot, '00_PROJE', 'MASTER_MANIFEST.json')),
    readJson(evidencePath)
  ]);
  check(rootDecisions.records?.filter((item) => item.Id === 'DEC-153').length === 1, 'root decision register does not contain unique DEC-153');
  check(rootDecisions.records?.filter((item) => item.Id === 'DEC-162').length === 1, 'root decision register does not contain unique DEC-162');
  check(rootDecisions.records?.filter((item) => item.Id === 'DEC-163').length === 1, 'root decision register does not contain unique DEC-163');
  check(rootDecisions.records?.filter((item) => item.Id === 'DEC-164').length === 1, 'root decision register does not contain unique DEC-164');
  check(rootDecisions.records?.filter((item) => item.Id === 'DEC-165').length === 1, 'root decision register does not contain unique DEC-165');
  check(rootDecisions.records?.filter((item) => item.Id === 'DEC-180').length === 1, 'root decision register does not contain unique DEC-180');
  check(rootDecisions.records?.filter((item) => item.Id === 'DEC-181').length === 1, 'root decision register does not contain unique DEC-181');
  check(rootDecisions.rangeSize >= 181, 'root decision range does not include DEC-181');
  check(evidence.status === 'PASS_SOURCE_NATIVE_MATRIX', 'matrix evidence is not PASS_SOURCE_NATIVE_MATRIX');
  const manifestRecord = manifest.files?.find((item) => item.RelativePath === '06_KOD\\app\\artifacts\\validation\\bronze-governance-reality-matrix.json');
  check(Boolean(manifestRecord), 'matrix evidence is missing from live manifest');
  if (manifestRecord) check(String(manifestRecord.Sha256).toLowerCase() === await hashFile(evidencePath), 'matrix evidence manifest hash mismatch');
} else if (mode !== 'capture') {
  throw new Error(`Unknown mode: ${mode}`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

if (mode === 'capture') {
  const decisionPath = resolve(sourceRoot, 'docs', 'decisions', 'DEC-153-b0-01-governance-reality-matrix-closure.md');
  const report = {
    schemaVersion: 1,
    id: 'BRONZE-GOVERNANCE-REALITY-MATRIX-B0-01',
    generatedAt: new Date().toISOString(),
    status: 'PASS_SOURCE_NATIVE_MATRIX',
    requirement: 'B0-01',
    decision: 'DEC-153',
    priorityAuthority: 'DEC-137',
    rules: ['PR-087', 'PR-098', 'PR-101', 'PR-124', 'PR-187', 'PR-194', 'PR-203'],
    checks,
    authoritativeSource: policy.authoritativeSource,
    requirementCount: scope.requirementCount,
    statusCounts,
    strictComplete: audit.scope.strictComplete,
    strictRequirementCompletionPercent: audit.percentages.strictRequirementCompletionPercent,
    implementationChainCoveragePercent: audit.percentages.implementationChainCoveragePercent,
    governanceEvidenceChainCoveragePercent: audit.percentages.governanceEvidenceChainCoveragePercent,
    b201RequirementStatus: 'COMPLETE',
    b201NativeStatus: 'USER_DEFERRED_NOT_RUN_NOT_PASS',
    b201NativeCompletionBlocking: false,
    external30ZReceiptStatus: 'PASS',
    external31AReceiptStatus: 'PASS',
    external31BReceiptStatus: 'PASS',
    external31CReceiptStatus: 'PASS',
    external31DReceiptStatus: 'PASS',
    external31EReceiptStatus: 'PASS',
    external31KThrough31TReceiptStatus: 'PASS',
    currentCheckpoint: '31-T',
    PPK002: 'COMPLETE',
    PPK003: 'COMPLETE',
    successorDecisionCreated: false,
    cutoverAuthorityAttached: false,
    officialCompletionClaimed: true,
    currentSourceExternalProtectionStatus: 'PASS',
    currentSourceExternalProtectionBackend: 'EXTERNAL_USB_D_DRIVE',
    newBuildAssigned: false,
    decisionSha256: await hashFile(decisionPath),
    rootBindingVerifier: 'scripts/verify-aym-governance-incremental-contract.mjs',
    truthBoundary: 'The focused 30-Z through 31-T external receipts and current-source D: external protection are PASS. DEC-183/31-X complete PPK-002 universal enforcement; DEC-184/31-Y complete PPK-003 bounded default-deny decision availability. The 31-S preflight remains read-only and non-authoritative; no successor cutover decision or cutover authority exists. Other Bronze scope remains open.'
  };
  await mkdir(dirname(evidencePath), { recursive: true });
  const content = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(evidencePath, content, 'utf8');
  check(await readFile(evidencePath, 'utf8') === content, 'matrix evidence readback mismatch');
}

console.log(`Bronze governance reality matrix: PASS (${checks} checks; mode=${mode}; B0-02 COMPLETE; PPK-002 COMPLETE; PPK-003 COMPLETE; 30-Z through 31-T receipts PASS; current-source D: protection PASS; no successor cutover decision or cutover authority).`);
