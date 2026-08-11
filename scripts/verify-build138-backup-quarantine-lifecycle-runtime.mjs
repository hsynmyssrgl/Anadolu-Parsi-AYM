import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const tmp=join(root,'.tmp','build138-backup-quarantine-runtime');
const args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build138-backup-quarantine-lifecycle-runtime.json'));
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const compile=async(name,prelude,body)=>{
  const transpiled=ts.transpileModule(prelude+body,{fileName:`${name}.ts`,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
  const diagnostics=(transpiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);
  if(diagnostics.length)throw new Error(diagnostics.map(item=>ts.flattenDiagnosticMessageText(item.messageText,'\n')).join('\n'));
  const modulePath=join(tmp,`${name}.mjs`);await writeFile(modulePath,transpiled.outputText);return import(pathToFileURL(modulePath).href);
};
const source=await readFile(join(root,'packages/application/src/backup-quarantine-use-cases.ts'),'utf8');
const lifecycle=await compile('backup-quarantine-use-cases',`
const ERROR_CODES={AUTHORIZATION_DENIED:'AUTHORIZATION_DENIED',CORE_INVALID_ARGUMENT:'CORE_INVALID_ARGUMENT',RESOURCE_NOT_FOUND:'RESOURCE_NOT_FOUND',RESOURCE_CONFLICT:'RESOURCE_CONFLICT'};
const createAppError=(input)=>input;const err=(error)=>({ok:false,error});const ok=(value)=>({ok:true,value});
type AppError=any;type CorrelationId=string;type FamilyId=string;type PersonId=string;type UserId=string;type Result<T,E>=({ok:true,value:T}|{ok:false,error:E});
type BackupQuarantineBatchView=any;type BackupQuarantineDestructionResultView=any;type BackupQuarantinePolicyView=any;type DestroyBackupQuarantineBatchInput=any;type FamilyRole=any;type SetBackupQuarantineLegalHoldInput=any;type UpdateBackupQuarantinePolicyInput=any;type StrongAuthenticationPort=any;
`,source.slice(source.indexOf('export interface BackupQuarantineApplicationContext')));
const fileSource=await readFile(join(root,'apps/desktop/src/main/backup-quarantine-file-application-adapter.ts'),'utf8');
const files=await compile('backup-quarantine-file-adapter',`
import { createHash } from 'node:crypto';
import { chmodSync,closeSync,existsSync,fsyncSync,mkdirSync,openSync,readFileSync,renameSync,rmdirSync,statSync,unlinkSync,writeFileSync,writeSync } from 'node:fs';
import { basename,dirname,isAbsolute,join,relative,resolve } from 'node:path';
const ERROR_CODES={CORE_UNEXPECTED:'CORE_UNEXPECTED'};const createAppError=(input)=>input;const err=(error)=>({ok:false,error});const ok=(value)=>({ok:true,value});
type AppError=any;type CorrelationId=string;type BackupQuarantineDestructionFilePort=any;
`,fileSource.slice(fileSource.indexOf('interface QuarantineManifestArtifact')));

const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
const expectOk=(result)=>{assert.equal(result.ok,true,result.error?.message);return result.value;};
const expectFail=(result)=>assert.equal(result.ok,false);
const context={familyId:'family-main',actor:{userId:'admin-1',role:'family_admin',personId:'person-1'},correlationId:'corr-138'};
const memberContext={familyId:'family-main',actor:{userId:'member-1',role:'adult_member',personId:'person-2'},correlationId:'corr-member'};
let policy={id:'default',retentionDays:90,createdAt:'2026-07-28T00:00:00.000Z',updatedAt:'2026-07-28T00:00:00.000Z'};
const batches=new Map();let authCalls=0;let fileCalls=0;let simulatedFile={destroyedArtifacts:2,destroyedBytes:7,resumed:false,receiptPath:'/receipt.json'};
const query={
  getPolicy:()=>({ok:true,value:policy}),
  listBatches:(_context,limit)=>({ok:true,value:[...batches.values()].slice(0,limit)}),
  findBatch:(_context,id)=>({ok:true,value:batches.get(id)??null})
};
const write={
  updatePolicy:(_context,retentionDays,updatedAt)=>{policy={...policy,retentionDays,updatedAt};return {ok:true,value:policy};},
  insertBatch:(_context,row)=>{batches.set(row.id,row);return {ok:true,value:undefined};},
  setLegalHold:(_context,input)=>{const current=batches.get(input.id);if(!current||current.status!=='retained'||current.updatedAt!==input.expectedUpdatedAt)return {ok:true,value:null};const next={...current,legalHold:input.enabled,...(input.enabled?{holdReason:input.reason}:{holdReason:undefined}),updatedAt:input.updatedAt};if(!input.enabled)delete next.holdReason;batches.set(input.id,next);return {ok:true,value:next};},
  beginDestruction:(_context,input)=>{const current=batches.get(input.id);if(!current||current.status!=='retained'||current.legalHold||current.updatedAt!==input.expectedUpdatedAt)return {ok:true,value:null};const next={...current,status:'destroying',updatedAt:input.updatedAt};batches.set(input.id,next);return {ok:true,value:next};},
  completeDestruction:(_context,input)=>{const current=batches.get(input.id);if(!current||current.status!=='destroying'||current.updatedAt!==input.expectedUpdatedAt)return {ok:true,value:null};const next={...current,status:'destroyed',destroyedAt:input.destroyedAt,destroyedArtifacts:input.destroyedArtifacts,destroyedBytes:input.destroyedBytes,updatedAt:input.destroyedAt};batches.set(input.id,next);return {ok:true,value:next};}
};
const strongAuth={verify:(_context,input)=>{authCalls+=1;return input.password==='correct-password'?{ok:true,value:undefined}:{ok:false,error:{message:'bad credentials'}};}};
const filePort={destroy:()=>{fileCalls+=1;return {ok:true,value:simulatedFile};}};
const getPolicy=new lifecycle.GetBackupQuarantinePolicyUseCase(query);
const list=new lifecycle.ListBackupQuarantineBatchesUseCase(query);
const register=new lifecycle.RegisterBackupQuarantineBatchUseCase(query,write);
const updatePolicy=new lifecycle.UpdateBackupQuarantinePolicyUseCase(write,strongAuth);
const hold=new lifecycle.SetBackupQuarantineLegalHoldUseCase(query,write,strongAuth);
const destroy=new lifecycle.DestroyBackupQuarantineBatchUseCase(query,write,filePort,strongAuth);

check('non-admin policy access denied',()=>expectFail(getPolicy.execute(memberContext)));
check('admin reads default policy',()=>assert.equal(expectOk(getPolicy.execute(context)).retentionDays,90));
check('invalid retention rejected',()=>expectFail(updatePolicy.execute(context,{retentionDays:0,password:'correct-password'},'2026-07-28T01:00:00.000Z')));
check('invalid retention avoids auth',()=>assert.equal(authCalls,0));
check('wrong password rejects policy update',()=>expectFail(updatePolicy.execute(context,{retentionDays:120,password:'wrong'},'2026-07-28T01:00:00.000Z')));
check('policy update uses strong auth',()=>assert.equal(authCalls,1));
check('valid policy update succeeds',()=>assert.equal(expectOk(updatePolicy.execute(context,{retentionDays:90,password:'correct-password'},'2026-07-28T01:00:00.000Z')).retentionDays,90));
const batch=expectOk(register.execute(context,{id:'batch-138',propagationRunId:'run-137',targetId:'target-1',targetName:'Yerel',quarantineDirectory:'/target/.purge-quarantine/batch-138',manifestPath:'/target/.purge-quarantine/batch-138/manifest.json',quarantinedArtifacts:2,quarantinedAt:'2026-07-28T02:00:00.000Z'}));
check('registration starts retained',()=>assert.equal(batch.status,'retained'));
check('registration calculates 90-day retention',()=>assert.equal(batch.retainUntil,'2026-10-26T02:00:00.000Z'));
check('registration stores batch',()=>assert.equal(batches.size,1));
check('list returns registered batch',()=>assert.equal(expectOk(list.execute(context,100)).length,1));
check('short legal hold reason rejected',()=>expectFail(hold.execute(context,{batchId:'batch-138',enabled:true,reason:'x',password:'correct-password'},'2026-07-28T03:00:00.000Z')));
check('valid legal hold succeeds',()=>assert.equal(expectOk(hold.execute(context,{batchId:'batch-138',enabled:true,reason:'Hukuki inceleme devam ediyor',password:'correct-password'},'2026-07-28T03:00:00.000Z')).legalHold,true));
check('legal hold blocks destruction',()=>expectFail(destroy.execute(context,{batchId:'batch-138',confirmation:'KARANTİNA İMHA batch-138',password:'correct-password'},'2026-10-27T00:00:00.000Z')));
check('legal hold block avoids file erasure',()=>assert.equal(fileCalls,0));
expectOk(hold.execute(context,{batchId:'batch-138',enabled:false,password:'correct-password'},'2026-07-28T04:00:00.000Z'));
check('early destruction rejected',()=>expectFail(destroy.execute(context,{batchId:'batch-138',confirmation:'KARANTİNA İMHA batch-138',password:'correct-password'},'2026-10-25T00:00:00.000Z')));
const authBeforeConfirmation=authCalls;
check('wrong confirmation rejected',()=>expectFail(destroy.execute(context,{batchId:'batch-138',confirmation:'yanlış',password:'correct-password'},'2026-10-27T00:00:00.000Z')));
check('wrong confirmation rejected before auth',()=>assert.equal(authCalls,authBeforeConfirmation));
const destroyed=expectOk(destroy.execute(context,{batchId:'batch-138',confirmation:'KARANTİNA İMHA batch-138',password:'correct-password'},'2026-10-27T00:00:00.000Z'));
check('filesystem called once',()=>assert.equal(fileCalls,1));
check('batch completes destroyed',()=>assert.equal(destroyed.batch.status,'destroyed'));
check('destroyed artifact count recorded',()=>assert.equal(destroyed.batch.destroyedArtifacts,2));
check('destroyed bytes recorded',()=>assert.equal(destroyed.batch.destroyedBytes,7));
check('first destruction not resumed',()=>assert.equal(destroyed.resumed,false));

const resumedBatch={...batch,id:'batch-resume',status:'destroying',updatedAt:'2026-10-28T00:00:00.000Z',quarantineDirectory:'/target/.purge-quarantine/batch-resume',manifestPath:'/target/.purge-quarantine/batch-resume/manifest.json'};batches.set(resumedBatch.id,resumedBatch);simulatedFile={destroyedArtifacts:1,destroyedBytes:3,resumed:true,receiptPath:'/receipt-resume.json'};
const resumed=expectOk(destroy.execute(context,{batchId:'batch-resume',confirmation:'KARANTİNA İMHA batch-resume',password:'correct-password'},'2026-10-28T00:01:00.000Z'));
check('destroying batch resumes',()=>assert.equal(resumed.resumed,true));
check('resumed batch reaches destroyed',()=>assert.equal(resumed.batch.status,'destroyed'));

// Real filesystem destruction and idempotent receipt.
const targetRoot=join(tmp,'real-target');const quarantineRoot=join(targetRoot,'.purge-quarantine');const directory=join(quarantineRoot,'batch-real');await mkdir(directory,{recursive:true});
const artifacts=[{name:'old-a.pptbackup.quarantined',bytes:Buffer.from('abc')},{name:'old-b.pptbackup.quarantined',bytes:Buffer.from('defg')}];
for(const artifact of artifacts)await writeFile(join(directory,artifact.name),artifact.bytes);
const manifest={schemaVersion:1,batchId:'batch-real',artifacts:artifacts.map(item=>({quarantinedName:item.name,sha256:createHash('sha256').update(item.bytes).digest('hex'),sizeBytes:item.bytes.length}))};
const manifestPath=join(directory,'manifest.json');await writeFile(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
const realPort=new files.FileSystemBackupQuarantineDestructionPort();
const realResult=expectOk(realPort.destroy({batchId:'db-real',quarantineDirectory:directory,manifestPath,destroyedAt:'2026-10-29T00:00:00.000Z'},'corr-real'));
check('real filesystem reports two artifacts',()=>assert.equal(realResult.destroyedArtifacts,2));
check('real filesystem reports total bytes',()=>assert.equal(realResult.destroyedBytes,7));
check('quarantine directory removed',()=>assert.equal(existsSync(directory),false));
check('receipt created',()=>assert.equal(existsSync(realResult.receiptPath),true));
const receiptRetry=expectOk(realPort.destroy({batchId:'db-real',quarantineDirectory:directory,manifestPath,destroyedAt:'2026-10-29T00:00:01.000Z'},'corr-real-retry'));
check('receipt retry is idempotent',()=>assert.equal(receiptRetry.resumed,true));
check('receipt retry preserves counts',()=>assert.deepEqual([receiptRetry.destroyedArtifacts,receiptRetry.destroyedBytes],[2,7]));

// Tampering must fail and preserve evidence.
const tamperedDir=join(quarantineRoot,'batch-tampered');await mkdir(tamperedDir,{recursive:true});const tamperedBytes=Buffer.from('original');const tamperedName='old.pptbackup.quarantined';await writeFile(join(tamperedDir,tamperedName),Buffer.from('changed'));
const tamperedManifest={schemaVersion:1,batchId:'batch-tampered',artifacts:[{quarantinedName:tamperedName,sha256:createHash('sha256').update(tamperedBytes).digest('hex'),sizeBytes:tamperedBytes.length}]};const tamperedManifestPath=join(tamperedDir,'manifest.json');await writeFile(tamperedManifestPath,`${JSON.stringify(tamperedManifest,null,2)}\n`);
const tamperedResult=realPort.destroy({batchId:'db-tampered',quarantineDirectory:tamperedDir,manifestPath:tamperedManifestPath,destroyedAt:'2026-10-29T01:00:00.000Z'},'corr-tampered');
check('tampered artifact rejected',()=>expectFail(tamperedResult));
check('tampered directory remains',()=>assert.equal(existsSync(tamperedDir),true));

// Interrupted directory claim resumes from manifest.
const interruptedOriginal=join(quarantineRoot,'batch-interrupted');const interruptedDestroying=join(quarantineRoot,'.destroying-batch-interrupted');await mkdir(interruptedDestroying,{recursive:true});const interruptedBytes=Buffer.from('resume');const interruptedName='resume.pptbackup.quarantined';await writeFile(join(interruptedDestroying,interruptedName),interruptedBytes);const interruptedManifest={schemaVersion:1,batchId:'batch-interrupted',artifacts:[{quarantinedName:interruptedName,sha256:createHash('sha256').update(interruptedBytes).digest('hex'),sizeBytes:interruptedBytes.length}]};await writeFile(join(interruptedDestroying,'manifest.json'),`${JSON.stringify(interruptedManifest,null,2)}\n`);
const interrupted=expectOk(realPort.destroy({batchId:'db-interrupted',quarantineDirectory:interruptedOriginal,manifestPath:join(interruptedOriginal,'manifest.json'),destroyedAt:'2026-10-29T02:00:00.000Z'},'corr-interrupted'));
check('interrupted claim resumes',()=>assert.equal(interrupted.resumed,true));
check('interrupted destroying directory removed',()=>assert.equal(existsSync(interruptedDestroying),false));
const receiptFiles=await readdir(join(targetRoot,'.purge-destruction-receipts'));check('destruction receipt directory contains receipts',()=>assert.ok(receiptFiles.length>=2));

const ledger=JSON.parse(await readFile(join(root,'artifacts/manifests/VERSION_LEDGER.json'),'utf8'));const current=ledger.entries?.at(-1);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:138,applicationVersion:current?.version??null,packageVersion:current?.packageVersion??null,stage:'Bronze RC2 Active Development',scope:'Policy bounds, role boundary, strong authentication, exact confirmation, legal hold, retention deadline, CAS-style transitions, verified filesystem erasure, receipt idempotency, tamper rejection and interrupted-operation resume',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 138 backup quarantine lifecycle runtime: PASS (${checks.length}/${checks.length})`);
