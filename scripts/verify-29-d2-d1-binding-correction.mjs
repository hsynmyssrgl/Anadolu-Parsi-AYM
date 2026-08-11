import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const TRUTH='Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures=[];let checks=0;const check=(c,m)=>{checks++;if(!c)failures.push(m)};
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const [artifact,failure,correction]=await Promise.all([
 readJson('artifacts/inventory/29-D2-D1_CONSOLIDATED_INVENTORY.json'),
 readJson('artifacts/checkpoints/29-D2-D1_FINALIZATION_FIRST_ATTEMPT_FAILURE.json'),
 readJson('artifacts/checkpoints/29-D2-D1_BINDING_CORRECTION.json')
]);
const snapshotPath='artifacts/inventory/snapshots/29-D2-D1_WORK_PLAN_AT_GENERATION.json';
const snapshot=await readFile(snapshotPath);
const binding=artifact.sourceBindings.find(e=>e.id==='workPlan');
check(failure.status==='FAIL','first attempt must remain FAIL');
check(failure.exitCode===1,'first attempt exit code mismatch');
check(failure.countedAsPass===false,'first attempt counted as PASS');
check(failure.failures.includes('workPlan binding size mismatch'),'missing first size mismatch evidence');
check(failure.failures.includes('workPlan binding SHA mismatch'),'missing first SHA mismatch evidence');
check(correction.failedAttemptCountedAsPass===false,'correction counts failed attempt as PASS');
check(['CORRECTED_PENDING_REVALIDATION','CORRECTED_REVALIDATION_PASS'].includes(correction.status),'correction status invalid');
check(correction.snapshotPath===snapshotPath,'snapshot path mismatch');
check(correction.snapshotSha256===sha256(snapshot),'correction snapshot SHA mismatch');
check(binding?.path===snapshotPath,'artifact binding path mismatch');
check(binding?.sizeBytes===snapshot.length,'artifact binding size mismatch');
check(binding?.sha256===sha256(snapshot),'artifact binding SHA mismatch');
check(artifact.bindingCorrection?.firstFinalizationAttemptExitCode===1,'artifact correction exit code mismatch');
check(artifact.bindingCorrection?.firstFinalizationAttemptCountedAsPass===false,'artifact correction counts failure as PASS');
check(artifact.parentCompletionClaimed===false,'correction must not complete parent');
check(artifact.mandatoryTruthSentence===TRUTH,'truth sentence mismatch');
const report={schemaVersion:1,release:'Bronze 04.08.2026.29',step:'29-D2-D1',phase:'BINDING_CORRECTION_GATE',checks,failures,firstAttemptExitCode:1,firstAttemptCountedAsPass:false,status:failures.length?'FAIL':'PASS',generatedAt:new Date().toISOString(),mandatoryTruthSentence:TRUTH};
await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/29-D2-D1-binding-correction.json',JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`29-D2-D1 Binding Correction: PASS (${checks} checks / first exit code 1 preserved as FAIL).`);
