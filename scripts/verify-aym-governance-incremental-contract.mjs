import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyAymGovernanceSourceAuthority } from './lib/aym-source-authority.mjs';

const sourceRoot = resolve(process.cwd());
const aymRoot = resolve(sourceRoot, '..', '..');
const expectedRoot = resolve('C:\\PPT\\AYM');
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const hashFile = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
check(aymRoot === expectedRoot, `workspace root mismatch: ${aymRoot}`);
const sourceAuthority = await verifyAymGovernanceSourceAuthority({ sourceRoot, aymRoot });
const receipt = sourceAuthority.protection;
const [manifest, summary, evidence, decisions, status, scope, authority, plan, active, backups, completion30Z, completion31A, completion31B, completion31C, completion31D, completion31E, completion31S, completion31T] = await Promise.all([
  readJson(resolve(aymRoot, '00_PROJE', 'MASTER_MANIFEST.json')),
  readJson(resolve(aymRoot, '00_PROJE', 'MANIFEST_OZETI.json')),
  readJson(resolve(aymRoot, '00_PROJE', 'ARTIMLI_MANIFEST_GUNCELLEME_KANITI.json')),
  readJson(resolve(aymRoot, '01_YONETIM', 'KARAR_SICILI.json')),
  readJson(resolve(aymRoot, '00_PROJE', 'DURUM.json')),
  readJson(resolve(aymRoot, '00_PROJE', 'KAPSAM.json')),
  readJson(resolve(aymRoot, '00_PROJE', 'YONETISIM_SICILI.json')),
  readJson(resolve(aymRoot, '01_YONETIM', 'TEK_PLAN.json')),
  readJson(resolve(aymRoot, '06_KOD', 'AKTIF_KAYNAK.json')),
  readJson(resolve(aymRoot, '10_YEDEK', 'YEDEK_SICILI.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '30-Z_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-A_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-B_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-C_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-D_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-E_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-S_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-T_COMPLETION_RECORD.json'))
]);

check(manifest.root === 'C:\\PPT\\AYM', 'manifest root is not canonical');
check(manifest.updateMode === 'INCREMENTAL_METADATA_COMPARE_SELECTIVE_REHASH', 'manifest was not incrementally updated');
check(evidence.fullContentRehashPerformed === false, 'full content rehash was claimed');
check(evidence.forbiddenRebuildScriptExecuted === false, 'forbidden rebuild script execution was claimed');
check(summary.liveFileCount === manifest.fileCount, 'manifest summary file count mismatch');
check(summary.liveBytes === manifest.bytes, 'manifest summary byte count mismatch');
check(decisions.records.some((record) => record.Id === 'DEC-152'), 'DEC-152 missing from JSON decision register');
check(decisions.records.some((record) => record.Id === 'DEC-158'), 'DEC-158 missing from JSON decision register');
check(decisions.records.some((record) => record.Id === 'DEC-159'), 'DEC-159 missing from JSON decision register');
check(decisions.records.some((record) => record.Id === 'DEC-160'), 'DEC-160 missing from JSON decision register');
check(decisions.records.some((record) => record.Id === 'DEC-161'), 'DEC-161 missing from JSON decision register');
check(decisions.records.some((record) => record.Id === 'DEC-163'), 'DEC-163 missing from JSON decision register');
check(decisions.records.some((record) => record.Id === 'DEC-164'), 'DEC-164 missing from JSON decision register');
check(decisions.records.some((record) => record.Id === 'DEC-165'), 'DEC-165 missing from JSON decision register');
check(decisions.records.some((record) => record.Id === 'DEC-180'), 'DEC-180 missing from JSON decision register');
check(decisions.records.some((record) => record.Id === 'DEC-181'), 'DEC-181 missing from JSON decision register');
check(decisions.rangeSize >= 181, 'decision range does not include DEC-181');
const decisionCsv = await readFile(resolve(aymRoot, '01_YONETIM', 'KARAR_SICILI.csv'), 'utf8');
check(decisionCsv.includes('"DEC-152"'), 'DEC-152 missing from CSV decision register');
check((decisionCsv.match(/"DEC-152"/gu) ?? []).length === 1, 'DEC-152 CSV row is not unique');
check((decisionCsv.match(/"DEC-158"/gu) ?? []).length === 1, 'DEC-158 CSV row is not unique');
check((decisionCsv.match(/"DEC-159"/gu) ?? []).length === 1, 'DEC-159 CSV row is not unique');
check((decisionCsv.match(/"DEC-160"/gu) ?? []).length === 1, 'DEC-160 CSV row is not unique');
check((decisionCsv.match(/"DEC-161"/gu) ?? []).length === 1, 'DEC-161 CSV row is not unique');
check((decisionCsv.match(/"DEC-163"/gu) ?? []).length === 1, 'DEC-163 CSV row is not unique');
check((decisionCsv.match(/"DEC-164"/gu) ?? []).length === 1, 'DEC-164 CSV row is not unique');
check((decisionCsv.match(/"DEC-165"/gu) ?? []).length === 1, 'DEC-165 CSV row is not unique');
check((decisionCsv.match(/"DEC-180"/gu) ?? []).length === 1, 'DEC-180 CSV row is not unique');
check((decisionCsv.match(/"DEC-181"/gu) ?? []).length === 1, 'DEC-181 CSV row is not unique');
check(status.workspaceRoot === 'C:\\PPT\\AYM', 'DURUM root mismatch');
check(scope.workspaceRoot === 'C:\\PPT\\AYM', 'KAPSAM root mismatch');
check(authority.workspaceRoot === 'C:\\PPT\\AYM', 'YONETISIM_SICILI root mismatch');
check(plan.current.newBuildAssigned === false, 'TEK_PLAN assigned a new Build');
check(receipt.localReceiptStatus === 'LOCAL_RECEIPT_VERIFIED', 'latest local receipt is not verified');
check(receipt.schemaVersion === 2 && receipt.source === '06_KOD/kanallar/Bronze', 'latest receipt is not the Bronze channel exact-commit schema');
check(receipt.sourceProvenance?.channel === 'Bronze' && receipt.sourceProvenance?.branch === 'channel/bronze', 'latest receipt channel provenance mismatch');
check(receipt.sourceProvenance?.headCommit === sourceAuthority.app.provenance.headCommit
  && receipt.backup?.headCommit === sourceAuthority.app.provenance.headCommit,
'protected Bronze commit does not equal the clean exact authoritative app source');
check(sourceAuthority.status === 'PASS'
  && sourceAuthority.appDiskReadback.status === 'PASS'
  && sourceAuthority.bronzeDiskReadback.status === 'PASS'
  && sourceAuthority.appDiskReadback.sha256 === sourceAuthority.bronzeDiskReadback.sha256
  && sourceAuthority.canonicalLatest.noReparseReadbackVerified === true,
'authoritative app / Bronze disk readback or canonical LATEST path verification failed');
check(/^10_YEDEK\/Bronze\/AYM_BRONZE_[a-f0-9]{12}_[a-f0-9]{16}\.zip$/u.test(receipt.backup?.path ?? ''), 'Bronze backup path/name contract mismatch');
check(receipt.externalLibraryReceiptStatus === 'PASS', 'current-source external protection is not PASS');
check(receipt.officialCompletionClaimed === true && receipt.externalReceipt?.storageBackend === 'EXTERNAL_USB_D_DRIVE' && String(receipt.externalReceipt?.externalPath ?? '').startsWith('D:\\AYM_LIBRARY\\'), 'current-source D: receipt truth boundary mismatch');
check(completion30Z.status === 'PASS' && completion30Z.officialStepStatus === 'COMPLETED', 'frozen 30-Z checkpoint is not completed');
check(completion30Z.persistentReceiptStatus === 'PASS' && completion30Z.officialCompletionClaimed === true, 'frozen 30-Z external receipt is not PASS');
check(completion31A.status === 'PASS' && completion31A.officialStepStatus === 'COMPLETED', 'focused 31-A checkpoint is not completed');
check(completion31A.persistentReceiptStatus === 'PASS' && completion31A.officialCompletionClaimed === true, 'focused 31-A external receipt is not PASS');
check(completion31B.status === 'PASS' && completion31B.officialStepStatus === 'COMPLETED', 'focused 31-B checkpoint is not completed');
check(completion31B.persistentReceiptStatus === 'PASS' && completion31B.officialCompletionClaimed === true, 'focused 31-B external receipt is not PASS');
check(completion31C.status === 'PASS' && completion31C.officialStepStatus === 'COMPLETED', 'focused 31-C checkpoint is not completed');
check(completion31C.persistentReceiptStatus === 'PASS' && completion31C.officialCompletionClaimed === true, 'focused 31-C external receipt is not PASS');
check(completion31D.status === 'PASS' && completion31D.officialStepStatus === 'COMPLETED', 'focused 31-D checkpoint is not completed');
check(completion31D.persistentReceiptStatus === 'PASS' && completion31D.officialCompletionClaimed === true, 'focused 31-D external receipt is not PASS');
check(completion31E.status === 'PASS' && completion31E.officialStepStatus === 'COMPLETED', 'focused 31-E checkpoint is not completed');
check(completion31E.persistentReceiptStatus === 'PASS' && completion31E.officialCompletionClaimed === true, 'focused 31-E external receipt is not PASS');
check(completion31S.status === 'PASS' && completion31S.officialStepStatus === 'COMPLETED', '31-S checkpoint is not completed');
check(completion31S.persistentReceiptStatus === 'PASS' && completion31S.officialCompletionClaimed === true, '31-S external receipt is not PASS');
check(completion31T.status === 'PASS' && completion31T.officialStepStatus === 'COMPLETED', '31-T checkpoint is not completed');
check(completion31T.persistentReceiptStatus === 'PASS' && completion31T.officialCompletionClaimed === true && completion31T.PPK002 === 'PARTIAL', '31-T external receipt or PPK-002 truth is not PASS/PARTIAL');
check(status.currentCheckpoint === '31-T' && status.external31TReceiptStatus === 'PASS', 'DURUM does not expose completed 31-T');
check(status.checkpoint31A?.persistentReceiptStatus === 'PASS', 'DURUM 31-A checkpoint summary mismatch');
check(status.checkpoint31B?.persistentReceiptStatus === 'PASS', 'DURUM 31-B checkpoint summary mismatch');
check(status.checkpoint31C?.persistentReceiptStatus === 'PASS', 'DURUM 31-C checkpoint summary mismatch');
check(status.checkpoint31D?.persistentReceiptStatus === 'PASS', 'DURUM 31-D checkpoint summary mismatch');
check(status.checkpoint31E?.persistentReceiptStatus === 'PASS', 'DURUM 31-E checkpoint summary mismatch');
check(status.checkpoint31S?.persistentReceiptStatus === 'PASS' && status.checkpoint31S?.successorDecisionCreated === false, 'DURUM 31-S checkpoint summary mismatch');
check(status.checkpoint31T?.persistentReceiptStatus === 'PASS' && status.checkpoint31T?.PPK002 === 'PARTIAL', 'DURUM 31-T checkpoint summary mismatch');
check(status.external30ZReceiptStatus === 'PASS' && status.officialStepCompletionClaimed === true, 'DURUM does not expose completed 30-Z');
check(status.currentSourceExternalProtectionStatus === 'PASS', 'DURUM does not expose current-source external protection PASS');
check(scope.checkpoint30Z?.persistentReceiptStatus === 'PASS' && scope.currentSourceExternalProtectionStatus === 'PASS', 'KAPSAM receipt boundaries mismatch');
check(scope.currentCheckpoint === '31-T' && scope.checkpoint31A?.persistentReceiptStatus === 'PASS' && scope.checkpoint31B?.persistentReceiptStatus === 'PASS' && scope.checkpoint31C?.persistentReceiptStatus === 'PASS' && scope.checkpoint31D?.persistentReceiptStatus === 'PASS' && scope.checkpoint31E?.persistentReceiptStatus === 'PASS' && scope.checkpoint31S?.persistentReceiptStatus === 'PASS' && scope.checkpoint31T?.persistentReceiptStatus === 'PASS', 'KAPSAM 31-A through 31-T receipt boundary mismatch');
check(authority.checkpoint30Z?.persistentReceiptStatus === 'PASS' && authority.currentSourceExternalProtectionStatus === 'PASS', 'YONETISIM_SICILI receipt boundaries mismatch');
check(authority.currentCheckpoint === '31-T' && authority.checkpoint31S?.persistentReceiptStatus === 'PASS' && authority.checkpoint31T?.persistentReceiptStatus === 'PASS', 'YONETISIM_SICILI 31-T receipt boundary mismatch');
check(plan.current.external30ZReceiptStatus === 'PASS' && plan.current.currentSourceExternalProtectionStatus === 'PASS', 'TEK_PLAN receipt boundaries mismatch');
check(plan.current.external31AReceiptStatus === 'PASS', 'TEK_PLAN 31-A receipt boundary mismatch');
check(plan.current.external31BReceiptStatus === 'PASS', 'TEK_PLAN 31-B receipt boundary mismatch');
check(plan.current.external31CReceiptStatus === 'PASS', 'TEK_PLAN 31-C receipt boundary mismatch');
check(plan.current.external31DReceiptStatus === 'PASS', 'TEK_PLAN 31-D receipt boundary mismatch');
check(plan.current.external31EReceiptStatus === 'PASS', 'TEK_PLAN 31-E receipt boundary mismatch');
check(plan.current.workingCheckpoint === '31-T' && plan.current.external31SReceiptStatus === 'PASS' && plan.current.external31TReceiptStatus === 'PASS', 'TEK_PLAN 31-T receipt boundary mismatch');
check(evidence.external30ZReceiptStatus === 'PASS' && evidence.currentSourceExternalProtectionStatus === 'PASS', 'incremental evidence receipt boundaries mismatch');
check(evidence.external31AReceiptStatus === 'PASS', 'incremental evidence 31-A receipt mismatch');
check(evidence.external31BReceiptStatus === 'PASS', 'incremental evidence 31-B receipt mismatch');
check(evidence.external31CReceiptStatus === 'PASS', 'incremental evidence 31-C receipt mismatch');
check(evidence.external31DReceiptStatus === 'PASS', 'incremental evidence 31-D receipt mismatch');
check(evidence.external31EReceiptStatus === 'PASS', 'incremental evidence 31-E receipt mismatch');
check(evidence.external31SReceiptStatus === 'PASS', 'incremental evidence 31-S receipt mismatch');
check(evidence.external31TReceiptStatus === 'PASS', 'incremental evidence 31-T receipt mismatch');
check(summary.sourceProtection?.external30ZReceiptStatus === 'PASS' && summary.sourceProtection?.currentSourceExternalProtectionStatus === 'PASS', 'manifest summary receipt boundaries mismatch');
check(summary.sourceProtection?.external31AReceiptStatus === 'PASS', 'manifest summary 31-A receipt mismatch');
check(summary.sourceProtection?.external31BReceiptStatus === 'PASS', 'manifest summary 31-B receipt mismatch');
check(summary.sourceProtection?.external31CReceiptStatus === 'PASS', 'manifest summary 31-C receipt mismatch');
check(summary.sourceProtection?.external31DReceiptStatus === 'PASS', 'manifest summary 31-D receipt mismatch');
check(summary.sourceProtection?.external31EReceiptStatus === 'PASS', 'manifest summary 31-E receipt mismatch');
check(summary.sourceProtection?.external31SReceiptStatus === 'PASS', 'manifest summary 31-S receipt mismatch');
check(summary.sourceProtection?.external31TReceiptStatus === 'PASS', 'manifest summary 31-T receipt mismatch');
check(active.sourceTreeSha256 === receipt.treeSha256, 'AKTIF_KAYNAK tree hash mismatch');
check(active.path === '06_KOD/kanallar/Bronze' && active.mainSourcePath === '06_KOD/app', 'AKTIF_KAYNAK source path isolation mismatch');
check(active.sourceCommit === mainHeadCommit && active.mainSourceCommitEquality === 'PASS', 'AKTIF_KAYNAK main/channel exact commit equality mismatch');
check(active.sourceFiles === receipt.fileCount, 'AKTIF_KAYNAK file count mismatch');
check(active.official30ZCheckpointStatus === 'COMPLETED' && active.official30ZPersistentReceiptStatus === 'PASS', 'AKTIF_KAYNAK does not expose completed frozen checkpoint');
check(active.official31ACheckpointStatus === 'COMPLETED' && active.official31APersistentReceiptStatus === 'PASS', 'AKTIF_KAYNAK does not expose completed focused checkpoint');
check(active.official31BCheckpointStatus === 'COMPLETED' && active.official31BPersistentReceiptStatus === 'PASS', 'AKTIF_KAYNAK does not expose completed 31-B checkpoint');
check(active.official31CCheckpointStatus === 'COMPLETED' && active.official31CPersistentReceiptStatus === 'PASS', 'AKTIF_KAYNAK does not expose completed 31-C checkpoint');
check(active.official31DCheckpointStatus === 'COMPLETED' && active.official31DPersistentReceiptStatus === 'PASS', 'AKTIF_KAYNAK does not expose completed 31-D checkpoint');
check(active.official31ECheckpointStatus === 'COMPLETED' && active.official31EPersistentReceiptStatus === 'PASS', 'AKTIF_KAYNAK does not expose completed 31-E checkpoint');
check(active.official31SCheckpointStatus === 'COMPLETED' && active.official31SPersistentReceiptStatus === 'PASS', 'AKTIF_KAYNAK does not expose completed 31-S checkpoint');
check(active.official31TCheckpointStatus === 'COMPLETED' && active.official31TPersistentReceiptStatus === 'PASS', 'AKTIF_KAYNAK does not expose completed 31-T checkpoint');
check(active.currentSourceExternalProtectionStatus === 'PASS', 'AKTIF_KAYNAK current-source boundary mismatch');
check(backups.backups.some((item) => item.path === receipt.backup.path && String(item.sha256).toLowerCase() === receipt.backup.sha256), 'current deterministic source backup missing from YEDEK_SICILI');

const dec152Path = resolve(sourceRoot, 'docs', 'decisions', 'DEC-152-authoritative-source-local-receipt-and-build-numbering.md');
const dec152Record = manifest.files.find((record) => record.RelativePath === '06_KOD\\app\\docs\\decisions\\DEC-152-authoritative-source-local-receipt-and-build-numbering.md');
check(Boolean(dec152Record), 'DEC-152 missing from live manifest');
if (dec152Record) check(String(dec152Record.Sha256).toLowerCase() === await hashFile(dec152Path), 'DEC-152 live manifest hash mismatch');

const oldCopiesPath = resolve(aymRoot, '06_KOD', 'DOSYALAR');
let oldCopyFiles = 0;
try {
  oldCopyFiles = (await readdir(oldCopiesPath, { withFileTypes: true })).filter((entry) => entry.isFile()).length;
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
check(oldCopyFiles === 0, `06_KOD/DOSYALAR still contains ${oldCopyFiles} files`);

const archiveRoot = resolve(aymRoot, '09_ARSIV', 'YONETIM_GECMISI', '20260809_KOD_TEK_KAYNAK');
const countFiles = async (directory) => {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countFiles(resolve(directory, entry.name));
    else if (entry.isFile()) count += 1;
  }
  return count;
};
const archivedFiles = await countFiles(archiveRoot);
check(archivedFiles >= 359, `single-source archive evidence is unexpectedly small: ${archivedFiles}`);
const archiveLedger = await readJson(resolve(archiveRoot, 'ARSIV_KAYDI.json'));
check(
  archiveLedger.fileCount === 357 || archiveLedger.archivedFileCount === 357 || archiveLedger.files?.length === 357,
  '357-file archive ledger count missing'
);
check((await stat(resolve(aymRoot, '00_PROJE', 'MASTER_MANIFEST.json'))).size > 0, 'live manifest is empty');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`AYM incremental governance contract: PASS (${checks} checks; DEC-181 linked; 30-Z through 31-T receipts PASS; current-source D: external protection PASS; PPK-002 PARTIAL).`);
