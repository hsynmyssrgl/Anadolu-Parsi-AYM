import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
const TRUTH='Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures=[];let checks=0;const check=(c,m)=>{checks++;if(!c)failures.push(m)};
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const [artifact,receipt,readback,completion,plan]=await Promise.all([
 readJson('artifacts/inventory/29-D2-D1_CONSOLIDATED_INVENTORY.json'),
 readJson('artifacts/checkpoints/29-D2-D1_LIBRARY_RECEIPT.json'),
 readJson('artifacts/validation/29-D2-D1-receipt-readback-verification.json'),
 readJson('artifacts/checkpoints/29-D2-D1_COMPLETION_RECORD.json'),
 readJson('config/work-segmentation-plan.json')
]);
check(artifact.status==='COMPLETED_PASS_LIBRARY_RECEIPT_PASS','artifact completion state mismatch');
check(artifact.validationStatus==='PASS','artifact validation state mismatch');
check(artifact.persistentReceiptStatus==='PASS','artifact receipt state mismatch');
check(artifact.parentCompletionClaimed===false,'artifact must not complete parent');
check(artifact.parentStepStatus==='IN_PROGRESS','artifact parent status mismatch');
check(artifact.gaps.length===12,'artifact gap count mismatch');
check(artifact.gaps.filter(g=>g.countedAsPass).length===0,'open gap counted as PASS');
check(receipt.status==='PASS','main receipt not PASS');
check(receipt.validationStatus==='PASS','main receipt validation not PASS');
check(receipt.persistentReceiptStatus==='PASS','main receipt persistence not PASS');
check(receipt.officialParentCompletionClaimed===false,'main receipt completes parent');
check(receipt.parentStepStatus==='IN_PROGRESS','main receipt parent state mismatch');
check(receipt.roundTripVerification.executed===13,'main receipt roundtrip executed mismatch');
check(receipt.roundTripVerification.matched===13,'main receipt roundtrip matched mismatch');
check(receipt.roundTripVerification.failed===0,'main receipt roundtrip failure');
check(readback.status==='PASS','receipt readback not PASS');
check(Object.values(readback.fieldChecks).every(Boolean),'receipt readback field check failure');
check(completion.status==='PASS','completion record not PASS');
check(completion.officialSubstepStatus==='COMPLETED','completion substep status mismatch');
check(completion.validationStatus==='PASS','completion validation mismatch');
check(completion.persistentReceiptStatus==='PASS','completion receipt mismatch');
check(completion.parentCompletionClaimed===false,'completion record completes parent');
check(completion.parentStepStatus==='IN_PROGRESS','completion parent state mismatch');
check(completion.consolidatedInventory.gapCount===12,'completion gap count mismatch');
check(completion.consolidatedInventory.openGapsCountedAsPass===0,'completion counts open gap as PASS');
check(completion.nextSubstep==='29-D2-D2','completion next substep mismatch');
check(completion.nextSubstepStatus==='PENDING_NOT_STARTED','completion next status mismatch');
check(completion.nextSubstepAuthorized===true,'completion next substep not authorized');
const parent=plan.steps.find(s=>s.id==='29-D2-D');
check(['IN_PROGRESS','COMPLETED'].includes(parent?.status),'parent plan status mismatch');
if(parent?.status==='IN_PROGRESS')check(plan.currentStep==='29-D2-D','plan currentStep mismatch before parent completion');
if(parent?.status==='COMPLETED'){check(['29-D3','29-D4','29-D5','29-D6'].includes(plan.currentStep),'plan did not reach or advance beyond 29-D3');check(parent.validationStatus==='PASS'&&parent.persistentReceiptStatus==='PASS','completed parent lacks PASS receipt');check(parent.persistentReceiptPath==='artifacts/checkpoints/29-D2-D3_PARENT_FINALIZATION_LIBRARY_RECEIPT.json','completed parent receipt path mismatch')}
const d0=parent?.substeps?.find(s=>s.id==='29-D2-D0');
const d1=parent?.substeps?.find(s=>s.id==='29-D2-D1');
const d2=parent?.substeps?.find(s=>s.id==='29-D2-D2');
check(d0?.status==='COMPLETED'&&d0.validationStatus==='PASS'&&d0.persistentReceiptStatus==='PASS','D0 substep state mismatch');
check(d1?.status==='COMPLETED','D1 plan status mismatch');
check(d1?.validationStatus==='PASS','D1 plan validation mismatch');
check(d1?.persistentReceiptStatus==='PASS','D1 plan receipt mismatch');
check(d1?.persistentReceiptPath==='artifacts/checkpoints/29-D2-D1_LIBRARY_RECEIPT.json','D1 plan receipt path mismatch');
check(['PENDING','IN_PROGRESS','BLOCKED','COMPLETED'].includes(d2?.status),'D2 downstream state invalid');
if(d2?.status==='PENDING'){check(d2.validationStatus==='PENDING','pending D2 validation mismatch');check(d2.persistentReceiptStatus==='PENDING','pending D2 receipt mismatch')}
if(d2?.status==='IN_PROGRESS'){
 check(['PENDING','PASS'].includes(d2.validationStatus),'in-progress D2 validation state invalid');
 check(['PENDING','PASS'].includes(d2.persistentReceiptStatus),'in-progress D2 receipt state invalid');
 if(d2.persistentReceiptStatus==='PASS'){
  check(d2.validationStatus==='PASS','persisted D2 validation must be PASS');
  check(d2.persistentReceiptPath==='artifacts/checkpoints/29-D2-D2_LIBRARY_RECEIPT.json','persisted D2 receipt path mismatch');
 }
}
if(d2?.status==='COMPLETED'){check(d2.validationStatus==='PASS','completed D2 validation not PASS');check(d2.persistentReceiptStatus==='PASS','completed D2 receipt not PASS')}
for(const p of ['artifacts/checkpoints/29-D2-D1_LIBRARY_RECEIPT.json','artifacts/validation/29-D2-D1-receipt-readback-verification.json','artifacts/checkpoints/29-D2-D1_COMPLETION_RECORD.json']){try{await stat(p);check(true,`${p} exists`)}catch{check(false,`${p} missing`)}}
check(completion.bronzeCompletedPercent===25.0,'Bronze percent changed without D5');
check(completion.bronzeRemainingPercent===75.0,'Bronze remaining percent changed without D5');
check(completion.silverStatus==='BLOCKED_NOT_READY','Silver gate mismatch');
check(completion.goldStatus==='BLOCKED_NOT_READY','Gold gate mismatch');
check(completion.conversationCapacity==='UNAVAILABLE','conversation capacity mismatch');
check(completion.mandatoryTruthSentence===TRUTH,'truth sentence mismatch');
const report={schemaVersion:1,release:'Bronze 04.08.2026.29',step:'29-D2-D1',phase:'POST_RECEIPT_FINALIZATION',checks,failures,status:failures.length?'FAIL':'PASS',parentCompletionClaimed:false,nextSubstep:'29-D2-D2',nextSubstepStatus:'PENDING_NOT_STARTED',generatedAt:new Date().toISOString(),mandatoryTruthSentence:TRUTH};
await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/29-D2-D1-finalization.json',JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`29-D2-D1 Finalization: PASS (${checks} checks / parent IN_PROGRESS / next D2-D2 PENDING).`);
