import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root=resolve(process.cwd());
const canonicalRoot=resolve('C:\\PPT\\AYM','06_KOD','app');
if(root!==canonicalRoot)throw new Error(`Unsafe source root: ${root}`);
const allowedArguments=new Set(['--dry-run']);
if(process.argv.slice(2).some((argument)=>!allowedArguments.has(argument)))throw new Error('Unsupported 33-L finalizer argument');
const dryRun=process.argv.includes('--dry-run');
const release='Bronze 04.08.2026.29';
const stepId='33-L';
const decision='DEC-223';
const requirements=Object.freeze(['LTP-001','LTP-002','LTP-003','LTP-004','LTP-005','LTP-006','LTP-007','LTP-008']);
const localPackageRoot='C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\33-L_Long_Term_Portfolio';
const libraryRoot='D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\33-L_Long_Term_Portfolio';
const stagingSuffix=`.staging-${process.pid}-${Date.now()}`;
const localStagingRoot=`${localPackageRoot}${stagingSuffix}`;
const libraryStagingRoot=`${libraryRoot}${stagingSuffix}`;
const predecessorReceiptPath='artifacts/checkpoints/33-K_LIBRARY_RECEIPT.json';
const truth='Bu makbuz 33-L DEC-223 kapsamındaki yerel uzun vadeli portföy takip, hesaplama ve senaryo yüzeylerini kanıtlar; broker emri veya para hareketi yürütüldüğü, canlı fiyat teslim edildiği, yatırım tavsiyesi verildiği ya da getiri, vergi/hukuk doğruluğu veya 2032 sonucu garanti edildiği iddiası değildir.';
const truthFields=Object.freeze({
  brokerExecutionPerformed:false,moneyMovementPerformed:false,livePriceDelivery:'not_performed',
  investmentAdviceProvided:false,returnGuaranteed:false,taxOrLegalAccuracyGuaranteed:false,
  projectionOutcomeGuaranteed:false,networkChannelsAdded:0
});
const paths=Object.freeze({
  plan:'config/work-segmentation-plan.json',ledger:'config/active-governance-ledger.json',
  registry:'config/accepted-scope-registry.json',scope:'config/33-l-long-term-portfolio-scope.json',
  inventory:'config/33-l-long-term-portfolio-inventory.json',
  boundary:'artifacts/validation/33-L-long-term-portfolio-boundary.json',
  contract:'artifacts/validation/33-L-long-term-portfolio-contract.json',
  runtime:'artifacts/validation/33-L-long-term-portfolio-runtime.json',
  migrationManifest:'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  receipt:'artifacts/checkpoints/33-L_LIBRARY_RECEIPT.json',
  readback:'artifacts/validation/33-L_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback:'artifacts/validation/33-L_RECEIPT_READBACK_VERIFICATION.json',
  persistence:'artifacts/validation/33-L_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  finalInventory:'artifacts/validation/33-L_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion:'artifacts/checkpoints/33-L_COMPLETION_RECORD.json',
  transition:'artifacts/validation/33-L_COMPLETION_TRANSITION_VALIDATION.json',
  closureInventory:'artifacts/validation/33-L_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json'
});
const proofKeys=Object.freeze(['receipt','readback','receiptReadback','persistence','finalInventory','completion','transition','closureInventory']);
const supportingPayloadPaths=Object.freeze([
  'package.json','package-lock.json','pnpm-lock.yaml',paths.plan,paths.ledger,paths.registry,paths.scope,paths.inventory,
  'docs/decisions/DEC-223-long-term-portfolio-center.md','docs/security/THREAT_MODEL_33_L_LONG_TERM_PORTFOLIO.md',
  'docs/audit/33-L_LONG_TERM_PORTFOLIO_UST_KAPANIS.md',paths.boundary,paths.contract,paths.runtime,paths.migrationManifest,
  predecessorReceiptPath,`${predecessorReceiptPath}.sha256`,
  'packages/domain/src/long-term-portfolio.ts','packages/application/src/long-term-portfolio-use-cases.ts',
  'packages/repository-contracts/src/long-term-portfolio-repository.ts','packages/repositories/src/long-term-portfolio-repository.ts',
  'packages/database/src/family-database-migrations.ts','apps/desktop/src/main/long-term-portfolio-application-adapter.ts',
  'apps/desktop/src/main/data-store.ts','apps/desktop/src/main/ipc-integration-policy.ts',
  'apps/desktop/src/renderer/LongTermPortfolioPanel.tsx','packages/application/tests/long-term-portfolio-security.test.ts',
  'packages/repositories/long-term-portfolio-repository-policy.test.ts','apps/desktop/tests/b4-long-term-portfolio-ipc-integration.test.ts',
  'scripts/verify-long-term-portfolio-boundary.mjs','scripts/verify-33-l-long-term-portfolio-contract.mjs',
  'scripts/verify-33-l-long-term-portfolio-runtime.mjs','scripts/finalize-33-l-long-term-portfolio-external-receipt.mjs',
  'scripts/verify-33-l-long-term-portfolio-completion.mjs'
]);
const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const jsonBytes=(value)=>Buffer.from(`${JSON.stringify(value,null,2)}\n`,'utf8');
const full=(path)=>resolve(root,path);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const readJson=async(path)=>JSON.parse(await readFile(full(path),'utf8'));
const writeBytes=async(path,bytes)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);};
const writeGovernanceJsonAtomic=async(path,value)=>{
  const target=full(path);const temporary=resolve(root,'.tmp','33-l-governance-commit',`${basename(path)}.${process.pid}.tmp`);
  await writeBytes(temporary,jsonBytes(value));await rename(temporary,target);
};
const posix=(path)=>path.split(sep).join('/');
const gitRun=(args)=>spawnSync('git',['-c','safe.directory=C:/PPT/AYM/06_KOD/app',...args],{
  cwd:root,encoding:'utf8',windowsHide:true,timeout:120_000,maxBuffer:64*1024*1024
});
const nodeRun=(args)=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:900_000,maxBuffer:64*1024*1024,env:process.env});
const exactArray=(actual,expected)=>Array.isArray(actual)&&JSON.stringify(actual)===JSON.stringify(expected);
const exists=async(path)=>{try{await access(path);return true;}catch{return false;}};
const listFiles=async(directory)=>{
  const files=[];const visit=async(current)=>{for(const entry of await readdir(current,{withFileTypes:true})){
    const path=join(current,entry.name);if(entry.isSymbolicLink())throw new Error(`Symbolic link forbidden: ${path}`);
    if(entry.isDirectory())await visit(path);else if(entry.isFile())files.push(posix(relative(directory,path)));
    else throw new Error(`Special filesystem entry forbidden: ${path}`);
  }};await visit(directory);return files.sort();
};
const copy=async(sourceRoot,targetRoot,path)=>{const target=resolve(targetRoot,path);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(sourceRoot,path),target);};
const compare=async(sourceRoot,targetRoot,names)=>Promise.all(names.map(async(path)=>{
  const [source,target]=await Promise.all([readFile(resolve(sourceRoot,path)),readFile(resolve(targetRoot,path))]);
  const sourceHash=sha256(source),targetHash=sha256(target);
  return {path,sourceSizeBytes:source.length,librarySizeBytes:target.length,sourceSha256:sourceHash,librarySha256:targetHash,
    status:source.length===target.length&&sourceHash===targetHash?'PASS':'FAIL'};
}));
const bind=async(base,path)=>{const bytes=await readFile(resolve(base,path));return {path,sizeBytes:bytes.length,sha256:sha256(bytes)};};
const sidecarBindsExactBytes=async(path)=>{try{
  const [bytes,sidecar]=await Promise.all([readFile(full(path)),readFile(full(`${path}.sha256`),'utf8')]);
  return sidecar===`${sha256(bytes)}  ${basename(path)}\n`;
}catch{return false;}};
const writePair=async(path,value)=>{const bytes=jsonBytes(value),digest=sha256(bytes);await writeBytes(full(path),bytes);
  await writeBytes(full(`${path}.sha256`),Buffer.from(`${digest}  ${basename(path)}\n`,'ascii'));
  return {path,sizeBytes:bytes.length,sha256:digest};};
const copyPair=async(item)=>{for(const targetRoot of [localStagingRoot,libraryStagingRoot]){
  await copy(root,targetRoot,item.path);await copy(root,targetRoot,`${item.path}.sha256`);
}};
const exactRegistry=(registry)=>requirements.every((id)=>{const item=registry?.requirements?.find((candidate)=>candidate.id===id);
  return item?.status==='COMPLETE'&&Object.keys(item.chain??{}).length===13
    && Object.values(item.chain).every((value)=>value===true)
    && [paths.boundary,paths.contract,paths.runtime].every((path)=>item.evidence?.includes(path));
});
const validationVector=(scope)=>scope?.validation?.finalEvidence?Object.freeze({...scope.validation.finalEvidence}):null;
const exactEvidence=(scope,boundary,contract,runtime,migrationManifest)=>{
  const vector=validationVector(scope);const migration=migrationManifest?.migrationVersions?.find((item)=>item.version===89);
  return scope?.validation?.finalEvidence?.finalClosureEvidence===true
    && Number.isInteger(vector?.fullVitestTestFilesPassed)&&vector.fullVitestTestFilesPassed>0
    && Number.isInteger(vector?.fullVitestTestsPassed)&&vector.fullVitestTestsPassed>0
    && Number.isInteger(vector?.productionWorkspaceBuildsPassed)&&vector.productionWorkspaceBuildsPassed>0
    && vector.boundaryChecksPassed===boundary?.checksPassed&&boundary?.status==='PASS'&&boundary?.checksFailed===0
    && vector.contractChecksPassed===contract?.checksPassed&&contract?.status==='PASS'&&contract?.checksFailed===0
    && vector.runtimeChecksPassed===runtime?.checksPassed&&runtime?.status==='PASS'&&runtime?.checksFailed===0
    && vector.targetedTestFilesPassed===runtime?.targetedTestFilesPassed
    && vector.targetedTestsPassed===runtime?.targetedTestsPassed
    && vector.ppk021ExactAllowlistEntries===562&&vector.ppk021UseCaseCompositionSurfaces===286
    && vector.ppk022CapabilitySurfaces===246&&vector.networkChannels===0
    && vector.latestDatabaseMigration===89&&vector.requirementChainsComplete===8
    && migrationManifest?.status==='passed'&&migration?.name==='b4_long_term_portfolio_ledger'
    && migration?.checksum===vector.migration89Checksum;
};
const remoteHead=(remote)=>{const result=gitRun(['ls-remote','--heads',remote,'main']);
  return result.status===0?result.stdout.trim().match(/^([0-9a-f]{40})\s+refs\/heads\/main$/u)?.[1]:undefined;};

const [plan,ledger,registry,scope,inventory,boundary,contract,runtime,migrationManifest,predecessorReceipt]=await Promise.all([
  readJson(paths.plan),readJson(paths.ledger),readJson(paths.registry),readJson(paths.scope),readJson(paths.inventory),
  readJson(paths.boundary),readJson(paths.contract),readJson(paths.runtime),readJson(paths.migrationManifest),readJson(predecessorReceiptPath)
]);
const step=plan.steps?.find((item)=>item.id===stepId);
assert(step?.status==='IN_PROGRESS'&&step.validationStatus==='PASS'&&step.persistentReceiptStatus==='PENDING','33-L is not the sole validated receipt-pending step');
assert(plan.steps?.filter((item)=>item.status==='IN_PROGRESS').length===1,'33-L must be the only IN_PROGRESS governed step');
assert(plan.currentStep===stepId&&ledger.activeMicroStep===stepId,'33-L is not the active governed work step');
assert(scope.status==='COMPLETE'&&scope.validation?.status==='PASS'&&inventory.status==='COMPLETE','33-L scope or inventory is not COMPLETE/PASS');
assert(scope.decision===decision&&exactArray(scope.requirements,requirements)&&exactArray(inventory.requirements,requirements),'33-L decision or requirements changed');
const [decisionDocument,threatDocument,auditDocument]=await Promise.all([
  readFile(full('docs/decisions/DEC-223-long-term-portfolio-center.md'),'utf8'),
  readFile(full('docs/security/THREAT_MODEL_33_L_LONG_TERM_PORTFOLIO.md'),'utf8'),
  readFile(full('docs/audit/33-L_LONG_TERM_PORTFOLIO_UST_KAPANIS.md'),'utf8')
]);
assert(decisionDocument.includes('DEC-223')&&decisionDocument.includes('LTP-001')&&decisionDocument.includes('LTP-008')&&decisionDocument.includes('transfer_out')&&decisionDocument.includes('clientOperationId'),'DEC-223 decision semantics are incomplete');
assert(threatDocument.includes('DEC-223')&&threatDocument.includes('fail-closed')&&threatDocument.includes('transfer_out')&&threatDocument.includes('2032'),'33-L threat-model semantics are incomplete');
assert(auditDocument.includes('33-L')&&auditDocument.includes('1.083/1.083')&&auditDocument.includes('18/18'),'33-L audit validation summary is incomplete');
assert(exactRegistry(registry),'33-L registry chains or evidence are incomplete');
assert(exactEvidence(scope,boundary,contract,runtime,migrationManifest),'33-L validation vector is not exact');
assert(predecessorReceipt.step==='33-K'&&predecessorReceipt.status==='PASS'&&predecessorReceipt.persistentReceiptStatus==='PASS','33-K predecessor receipt is not PASS');
assert(await sidecarBindsExactBytes(predecessorReceiptPath),'33-K predecessor receipt sidecar mismatch');
const headResult=gitRun(['rev-parse','HEAD']);assert(headResult.status===0,'Could not resolve HEAD');const sourceCommit=headResult.stdout.trim();
assert(/^[0-9a-f]{40}$/u.test(sourceCommit),'Invalid source commit');
assert(gitRun(['merge-base','--is-ancestor',predecessorReceipt.sourceCommit,sourceCommit]).status===0,'33-K source is not an ancestor');
const status=gitRun(['status','--porcelain']);assert(status.status===0&&status.stdout.trim()==='',`33-L finalization requires a clean committed tree: ${status.stdout.trim()}`);
assert(remoteHead('github')===sourceCommit,'GitHub main must equal the 33-L source commit before receipt finalization');
assert(remoteHead('backup')===sourceCommit,'D: Git backup main must equal the 33-L source commit before receipt finalization');
assert(!(await exists(localPackageRoot))&&!(await exists(libraryRoot))&&!(await exists(localStagingRoot))&&!(await exists(libraryStagingRoot)),'33-L checkpoint target or this run staging path already exists; overwrite is forbidden');

if(dryRun){console.log(JSON.stringify({status:'PASS',step:stepId,sourceCommit,requirements,validation:validationVector(scope),
  localTargetAbsent:true,externalTargetAbsent:true,githubHead:sourceCommit,backupHead:sourceCommit}));process.exit(0);}

const tree=gitRun(['ls-tree','-r','HEAD']);assert(tree.status===0,'Could not enumerate tracked source');
const trackedEntries=tree.stdout.trim().split(/\r?\n/u).filter(Boolean).map((line)=>{
  const match=line.match(/^(100644|100755) blob ([0-9a-f]+)\t(.+)$/u);assert(match,`Non-regular tracked entry: ${line}`);
  return {gitMode:match[1],gitObjectId:match[2],sourcePath:match[3]};
});
const trackedPaths=trackedEntries.map((item)=>item.sourcePath).sort();
const trackedEntryByPath=new Map(trackedEntries.map((item)=>[item.sourcePath,item]));
assert(trackedPaths.length>0&&new Set(trackedPaths).size===trackedPaths.length,'Tracked source snapshot is empty or duplicated');
const payloadPaths=[...new Set([...trackedPaths,...supportingPayloadPaths])].sort();
assert(trackedPaths.every((path)=>payloadPaths.includes(path))&&supportingPayloadPaths.every((path)=>payloadPaths.includes(path)),'Checkpoint payload omits tracked source or required evidence');
await mkdir(join(localStagingRoot,'payload'),{recursive:true});
const payload=[];
for(const sourcePath of payloadPaths){const bytes=await readFile(full(sourcePath));const packagePath=`payload/${sourcePath}`;const trackedEntry=trackedEntryByPath.get(sourcePath);
  await writeBytes(resolve(localStagingRoot,packagePath),bytes);payload.push({sourcePath,packagePath,
    sourceClassification:trackedEntry?'TRACKED_HEAD':'SUPPLEMENTAL_REQUIRED_EVIDENCE',
    ...(trackedEntry?{gitMode:trackedEntry.gitMode,gitObjectId:trackedEntry.gitObjectId}:{}),sizeBytes:bytes.length,sha256:sha256(bytes)});
}
const proofCommon=Object.freeze({schemaVersion:1,release,step:stepId,decision,requirements,sourceCommit,
  predecessorStep:'33-K',predecessorReceiptPath,predecessorSourceCommit:predecessorReceipt.sourceCommit,
  sourceCommitRange:`${predecessorReceipt.sourceCommit}..${sourceCommit}`,validation:validationVector(scope),
  migration89Checksum:validationVector(scope).migration89Checksum,...truthFields,
  currentAuthoritativeSourceExternalProtectionStatus:'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',mandatoryTruthSentence:truth});
const manifestName='33-L_CHECKPOINT_MANIFEST.json';
const manifest={...proofCommon,phase:'LONG_TERM_PORTFOLIO_CHECKPOINT_PACKAGE',status:'PASS',
  payloadMode:'EXACT_COMPLETE_TRACKED_SOURCE_SNAPSHOT_AT_HEAD_PLUS_REQUIRED_UNTRACKED_EVIDENCE',trackedEntryPolicy:'REGULAR_BLOBS_ONLY_100644_OR_100755',
  trackedSourceFileCount:trackedPaths.length,supplementalEvidenceFileCount:payloadPaths.length-trackedPaths.length,payloadCount:payload.length,payload,
  persistentReceiptStatus:'PENDING',officialCompletionClaimed:false,requirementCompletionClaimed:true,
  currentAuthoritativeSourceExternalProtectionStatus:'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',createdAt:new Date().toISOString()};
const manifestBytes=jsonBytes(manifest),manifestHash=sha256(manifestBytes);
await writeBytes(join(localStagingRoot,manifestName),manifestBytes);
await writeBytes(join(localStagingRoot,`${manifestName}.sha256`),Buffer.from(`${manifestHash}  ${manifestName}\n`,'ascii'));
const proofPairPaths=proofKeys.flatMap((key)=>[paths[key],`${paths[key]}.sha256`]);
const expectedBase=[...payload.map((item)=>item.packagePath),manifestName,`${manifestName}.sha256`].sort();
assert(JSON.stringify((await listFiles(localStagingRoot)).filter((path)=>!proofPairPaths.includes(path)).sort())===JSON.stringify(expectedBase),'Local base checkpoint set is not exact');
await mkdir(libraryStagingRoot,{recursive:true});for(const path of expectedBase)await copy(localStagingRoot,libraryStagingRoot,path);
const baseReadback=await compare(localStagingRoot,libraryStagingRoot,expectedBase);assert(baseReadback.every((item)=>item.status==='PASS'),'D: base checkpoint readback mismatch');

const readback=await writePair(paths.readback,{...proofCommon,status:'PASS',countsAsPass:true,storageBackend:'EXTERNAL_USB_D_DRIVE',
  libraryPath:libraryRoot,localCheckpointPath:localPackageRoot,expected:expectedBase.length,executed:baseReadback.length,
  matched:baseReadback.length,failed:0,manifestSha256:manifestHash,artifacts:baseReadback,verifiedAt:new Date().toISOString()});
const receipt=await writePair(paths.receipt,{...proofCommon,status:'PASS',validationStatus:'PASS',persistentReceiptStatus:'PASS',
  officialStepStatus:'COMPLETED',officialCompletionClaimed:true,requirementCompletionClaimed:true,
  storageBackend:'EXTERNAL_USB_D_DRIVE',libraryPath:libraryRoot,localCheckpointPath:localPackageRoot,
  verificationBasis:'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK',basePackage:{expected:expectedBase.length,matched:expectedBase.length,failed:0,manifestSha256:manifestHash,status:'PASS'},
  libraryReadbackVerification:readback,nextOfficialStep:null,newBuildIssued:false,
  currentAuthoritativeSourceExternalProtectionStatus:'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',recordedAt:new Date().toISOString()});
await copyPair(readback);await copyPair(receipt);
const receiptPaths=[paths.readback,`${paths.readback}.sha256`,paths.receipt,`${paths.receipt}.sha256`];
const receiptArtifacts=await compare(root,libraryStagingRoot,receiptPaths);assert(receiptArtifacts.every((item)=>item.status==='PASS'),'D: receipt readback mismatch');
const receiptReadback=await writePair(paths.receiptReadback,{...proofCommon,status:'PASS',expected:receiptPaths.length,executed:receiptPaths.length,matched:receiptPaths.length,failed:0,artifacts:receiptArtifacts,verifiedAt:new Date().toISOString()});
await copyPair(receiptReadback);
const persistencePaths=[paths.receiptReadback,`${paths.receiptReadback}.sha256`];
const persistenceArtifacts=await compare(root,libraryStagingRoot,persistencePaths);assert(persistenceArtifacts.every((item)=>item.status==='PASS'),'D: receipt persistence mismatch');
const persistence=await writePair(paths.persistence,{...proofCommon,status:'PASS',expected:persistencePaths.length,executed:persistencePaths.length,matched:persistencePaths.length,failed:0,artifacts:persistenceArtifacts,verifiedAt:new Date().toISOString()});
await copyPair(persistence);

const futureNames=[paths.finalInventory,`${paths.finalInventory}.sha256`,paths.completion,`${paths.completion}.sha256`,paths.transition,`${paths.transition}.sha256`,paths.closureInventory,`${paths.closureInventory}.sha256`];
const supplementPairs=[readback,receipt,receiptReadback,persistence];
const expectedBeforeInventory=[...expectedBase,...supplementPairs.flatMap((item)=>[item.path,`${item.path}.sha256`])].sort();
const actualBeforeInventory=(await listFiles(libraryStagingRoot)).filter((path)=>!futureNames.includes(path)).sort();
assert(JSON.stringify(actualBeforeInventory)===JSON.stringify(expectedBeforeInventory),'D: pre-inventory set is not exact');
const finalInventory=await writePair(paths.finalInventory,{...proofCommon,status:'PASS',countsAsPass:true,officialCompletionClaimed:false,
  libraryPath:libraryRoot,expectedFilesBeforeInventory:expectedBeforeInventory.length,actualFilesBeforeInventory:actualBeforeInventory.length,
  finalExpectedFilesIncludingInventoryPair:expectedBeforeInventory.length+2,
  filesBeforeInventory:await Promise.all(actualBeforeInventory.map((path)=>bind(libraryStagingRoot,path))),verifiedAt:new Date().toISOString()});
await copyPair(finalInventory);
const baseFinalExpected=[...expectedBeforeInventory,paths.finalInventory,`${paths.finalInventory}.sha256`].sort();
const baseFinalActual=(await listFiles(libraryStagingRoot)).filter((path)=>![paths.completion,`${paths.completion}.sha256`,paths.transition,`${paths.transition}.sha256`,paths.closureInventory,`${paths.closureInventory}.sha256`].includes(path)).sort();
assert(JSON.stringify(baseFinalActual)===JSON.stringify(baseFinalExpected),'D: base final inventory is not exact');

const completedAt=new Date().toISOString();
const completion=await writePair(paths.completion,{...proofCommon,status:'PASS',officialStepStatus:'COMPLETED',validationStatus:'PASS',persistentReceiptStatus:'PASS',
  officialCompletionClaimed:true,requirementCompletionClaimed:true,persistentReceiptPath:paths.receipt,libraryPath:libraryRoot,
  localCheckpointPath:localPackageRoot,storageBackend:'EXTERNAL_USB_D_DRIVE',nextOfficialStep:null,newBuildIssued:false,
  currentAuthoritativeSourceExternalProtectionStatus:'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',completedAt});
Object.assign(step,{status:'COMPLETED',validationStatus:'PASS',persistentReceiptStatus:'PASS',persistentReceiptPath:paths.receipt,completionTransitionStatus:'PASS'});
step.localEvidence??=[];for(const evidence of [paths.receipt,paths.readback,paths.receiptReadback,paths.persistence,paths.finalInventory,paths.completion,paths.transition,paths.closureInventory])if(!step.localEvidence.includes(evidence))step.localEvidence.push(evidence);
plan.currentStep=null;plan.workflowStatus='COMPLETED';plan.updatedAt=completedAt;
plan.segmentationNote='33-L is immutable COMPLETED/PASS with exact local and D: hash/size readback. All currently defined governed steps are complete; new scope requires a new explicit decision.';
ledger.libraryUploadStatus='33-L_COMPLETED_RECEIPT_PASS';ledger.nextOfficialTask='ALL_CURRENT_GOVERNED_STEPS_COMPLETED_BACKLOG_REVIEW';ledger.activeMicroStep=null;ledger.postflightStatus='PASS';
ledger.externalLibraryAuthority33L={step:stepId,status:'PASS',storageBackend:'EXTERNAL_USB_D_DRIVE',path:libraryRoot,localCheckpointPath:localPackageRoot,receipt:paths.receipt,focusedCheckpointOnly:true};ledger.updatedAt=completedAt;
const transitionChecks=[
  ['base package exact',baseReadback.every((item)=>item.status==='PASS')],['receipt readback exact',receiptArtifacts.every((item)=>item.status==='PASS')],
  ['receipt persistence exact',persistenceArtifacts.every((item)=>item.status==='PASS')],['registry exact',exactRegistry(registry)],
  ['validation exact',exactEvidence(scope,boundary,contract,runtime,migrationManifest)],['work step complete',step.status==='COMPLETED'&&step.persistentReceiptStatus==='PASS'],
  ['ledger complete',ledger.libraryUploadStatus==='33-L_COMPLETED_RECEIPT_PASS'&&ledger.activeMicroStep===null],
  ['no implicit successor',plan.currentStep===null&&plan.workflowStatus==='COMPLETED']
].map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
assert(transitionChecks.every((item)=>item.status==='PASS'),'33-L completion transition failed');
const transition=await writePair(paths.transition,{...proofCommon,status:'PASS',expected:transitionChecks.length,executed:transitionChecks.length,
  passed:transitionChecks.length,failed:0,checks:transitionChecks,officialStepStatus:'COMPLETED',persistentReceiptStatus:'PASS',
  officialCompletionClaimed:true,requirementCompletionClaimed:true,nextOfficialStep:null,newBuildIssued:false,
  currentAuthoritativeSourceExternalProtectionStatus:'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',verifiedAt:new Date().toISOString()});
await copyPair(completion);await copyPair(transition);
const closureArtifacts=await compare(root,libraryStagingRoot,[paths.completion,`${paths.completion}.sha256`,paths.transition,`${paths.transition}.sha256`]);
assert(closureArtifacts.every((item)=>item.status==='PASS'),'D: completion/transition readback mismatch');
const expectedBeforeClosure=[...baseFinalExpected,paths.completion,`${paths.completion}.sha256`,paths.transition,`${paths.transition}.sha256`].sort();
const actualBeforeClosure=(await listFiles(libraryStagingRoot)).filter((path)=>![paths.closureInventory,`${paths.closureInventory}.sha256`].includes(path)).sort();
assert(JSON.stringify(actualBeforeClosure)===JSON.stringify(expectedBeforeClosure),'D: pre-closure inventory is not exact');
const closureInventory=await writePair(paths.closureInventory,{...proofCommon,status:'PASS',countsAsPass:true,officialCompletionClaimed:true,
  requirementCompletionClaimed:true,libraryPath:libraryRoot,localCheckpointPath:localPackageRoot,
  expectedFilesBeforeInventory:expectedBeforeClosure.length,actualFilesBeforeInventory:actualBeforeClosure.length,
  finalExpectedFilesIncludingInventoryPair:expectedBeforeClosure.length+2,
  filesBeforeInventory:await Promise.all(actualBeforeClosure.map((path)=>bind(libraryStagingRoot,path))),verifiedAt:new Date().toISOString()});
await copyPair(closureInventory);
const closureFinalExpected=[...expectedBeforeClosure,paths.closureInventory,`${paths.closureInventory}.sha256`].sort();
assert(JSON.stringify(await listFiles(libraryStagingRoot))===JSON.stringify(closureFinalExpected),'D: closure inventory set is not exact');
assert(JSON.stringify(await listFiles(localStagingRoot))===JSON.stringify(closureFinalExpected),'Local closure inventory set is not exact');
assert((await compare(localStagingRoot,libraryStagingRoot,closureFinalExpected)).every((item)=>item.status==='PASS'),'Local and D: checkpoint packages differ');
let libraryPromoted=false;
try{
  assert(!(await exists(localPackageRoot))&&!(await exists(libraryRoot)),'Final checkpoint target appeared during staging; overwrite is forbidden');
  await rename(libraryStagingRoot,libraryRoot);libraryPromoted=true;
  await rename(localStagingRoot,localPackageRoot);
}catch(error){
  if(libraryPromoted&&await exists(libraryRoot)&&!(await exists(libraryStagingRoot)))await rename(libraryRoot,libraryStagingRoot);
  throw error;
}
await writeGovernanceJsonAtomic(paths.ledger,ledger);await writeGovernanceJsonAtomic(paths.plan,plan);
console.log(`33-L external receipt finalized: PASS (${closureFinalExpected.length} exact local/D: files; source ${sourceCommit}).`);
