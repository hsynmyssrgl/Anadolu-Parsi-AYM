import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const tmp=join(root,'.tmp','build137-backup-propagation-runtime');
const args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build137-backup-purge-propagation-runtime.json'));
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const compile=async(name,prelude,body)=>{
  const transpiled=ts.transpileModule(prelude+body,{fileName:`${name}.ts`,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
  const diagnostics=(transpiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);
  if(diagnostics.length)throw new Error(diagnostics.map(item=>ts.flattenDiagnosticMessageText(item.messageText,'\n')).join('\n'));
  const modulePath=join(tmp,`${name}.mjs`);await writeFile(modulePath,transpiled.outputText);return import(pathToFileURL(modulePath).href);
};

const managedSource=await readFile(join(root,'packages/application/src/managed-backup-propagation-use-case.ts'),'utf8');
const managed=await compile('managed-backup-propagation',`
const ERROR_CODES={CORE_INVALID_ARGUMENT:'CORE_INVALID_ARGUMENT'};
const createAppError=(input)=>input;
const err=(error)=>({ok:false,error});
const ok=(value)=>({ok:true,value});
type AppError=any; type CorrelationId=string; type Result<T,E>=({ok:true,value:T}|{ok:false,error:E});
type BackupPropagationRunView=any; type BackupRunView=any; type BackupTargetView=any; type PendingBackupPropagationRecord=any;
type BackupPurgeQuarantineResult=any; type BackupPurgeTombstoneFingerprint=any;
`,managedSource.slice(managedSource.indexOf('export interface ManagedBackupPropagationOperations')));

const adapterSource=await readFile(join(root,'apps/desktop/src/main/backup-purge-propagation-file-application-adapter.ts'),'utf8');
const adapter=await compile('backup-purge-file-adapter',`
import { createHash } from 'node:crypto';
import { chmodSync,closeSync,existsSync,fsyncSync,mkdirSync,openSync,readFileSync,renameSync,rmSync,statSync,writeFileSync } from 'node:fs';
import { basename,isAbsolute,join,relative,resolve } from 'node:path';
const ERROR_CODES={CORE_UNEXPECTED:'CORE_UNEXPECTED'};
const createAppError=(input)=>input;
const err=(error)=>({ok:false,error});
const ok=(value)=>({ok:true,value});
type AppError=any; type CorrelationId=string; type BackupPurgeQuarantineFilePort=any;
`,adapterSource.slice(adapterSource.indexOf('const isWithin')));

const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
const correlationId='corr-137';
const pending=[
  {resourceType:'finance_record',resourceId:'finance-1',purgedAt:'2026-07-28T03:00:00.000Z',updatedAt:'2026-07-28T03:00:00.000Z'},
  {resourceType:'health_record',resourceId:'health-1',purgedAt:'2026-07-28T03:01:00.000Z',updatedAt:'2026-07-28T03:01:00.000Z'}
];
const tombstones=pending.map((record,index)=>({fingerprint:String(index+1).repeat(64),purgedAt:record.purgedAt}));
const target={id:'target-1',name:'Yerel yedek',kind:'local',path:'/managed',enabled:true,schedule:'manual',retentionCount:10,retryCount:0,createdAt:'2026-07-28T00:00:00.000Z'};
const oldRun={id:'run-old',targetId:'target-1',status:'success',filePath:'/managed/old.pptbackup',sha256:'a'.repeat(64),startedAt:'2026-07-27T00:00:00.000Z',completedAt:'2026-07-27T00:01:00.000Z'};
const freshRun={id:'run-fresh',targetId:'target-1',status:'success',filePath:'/managed/fresh.pptbackup',sha256:'b'.repeat(64),startedAt:'2026-07-28T03:02:00.000Z',completedAt:'2026-07-28T03:03:00.000Z'};

const makeOperations=({manual=false,failCreate=false,completeCount=pending.length}={})=>{
  const runs=new Map([['target-1',[oldRun]]]);
  const artifacts=new Set(['/managed/old.pptbackup',...(manual?['/managed/manual-copy.pptbackup']:[])]);
  const quarantined=[];let completeCalls=0;let createCalls=0;
  const operations={
    listSuccessfulRuns:(targetId)=>({ok:true,value:[...(runs.get(targetId)??[])]}),
    createVerifiedBackup:(targetId)=>{createCalls+=1;if(failCreate)return {ok:false,error:{message:'fresh backup failed'}};runs.set(targetId,[...(runs.get(targetId)??[]),freshRun]);artifacts.add(freshRun.filePath);return {ok:true,value:freshRun};},
    quarantineManagedArtifacts:(input)=>{for(const path of input.artifactPaths){quarantined.push(path);artifacts.delete(path);}return {ok:true,value:{quarantineDirectory:'/managed/.purge-quarantine/propagation-137',manifestPath:'/managed/.purge-quarantine/propagation-137/manifest.json',artifacts:input.artifactPaths.map(path=>({originalFilePath:path,quarantinedFilePath:`${path}.quarantined`,sha256:'c'.repeat(64),sizeBytes:10}))}};},
    deleteManagedRun:(runId)=>{for(const [targetId,values] of runs)runs.set(targetId,values.filter(run=>run.id!==runId));return {ok:true,value:undefined};},
    listArtifacts:()=>({ok:true,value:[...artifacts]}),
    completePending:()=>{completeCalls+=1;return {ok:true,value:completeCount};}
  };
  return {operations,runs,artifacts,quarantined,get completeCalls(){return completeCalls;},get createCalls(){return createCalls;}};
};
const execute=(state,input={})=>{let monotonicMs=0;return managed.executeManagedBackupPropagation({correlationId,runId:'propagation-137',pending,targets:[target],tombstones,startedAt:'2026-07-28T03:04:00.000Z',startedMonotonicMs:0,monotonicNowMs:()=>{monotonicMs+=30_000;return monotonicMs;},operations:state.operations,...input});};

const success=makeOperations();const successResult=execute(success);check('success result',()=>assert.equal(successResult.ok,true));
const successRun=successResult.value;
check('fresh backup created',()=>assert.equal(success.createCalls,1));
check('only managed old artifact quarantined',()=>assert.deepEqual(success.quarantined,['/managed/old.pptbackup']));
check('fresh artifact remains active',()=>assert.equal(success.artifacts.has('/managed/fresh.pptbackup'),true));
check('old run removed',()=>assert.deepEqual(success.runs.get('target-1').map(run=>run.id),['run-fresh']));
check('pending completed once',()=>assert.equal(success.completeCalls,1));
check('success status',()=>assert.equal(successRun.status,'success'));
check('all tombstones completed',()=>assert.equal(successRun.pendingRemaining,0));
check('quarantine metric',()=>assert.equal(successRun.quarantinedArtifacts,1));
check('quarantine path reported',()=>assert.match(successRun.targetResults[0].quarantineDirectory,/purge-quarantine/));
check('fresh hash reported',()=>assert.equal(successRun.targetResults[0].freshBackupSha256,'b'.repeat(64)));

const manual=makeOperations({manual:true});const manualResult=execute(manual);check('manual scenario returns run',()=>assert.equal(manualResult.ok,true));
check('manual copy untouched',()=>assert.equal(manual.artifacts.has('/managed/manual-copy.pptbackup'),true));
check('manual copy not quarantined',()=>assert.deepEqual(manual.quarantined,['/managed/old.pptbackup']));
check('manual active copy blocks target success',()=>assert.equal(manualResult.value.targetResults[0].success,false));
check('manual active copy keeps tombstones pending',()=>assert.equal(manual.completeCalls,0));
check('manual warning is reported',()=>assert.equal(manualResult.value.manualBackupWarning,true));

const failed=makeOperations({failCreate:true});const failedResult=execute(failed);check('failed refresh returns run',()=>assert.equal(failedResult.ok,true));
check('failed refresh status',()=>assert.equal(failedResult.value.status,'failed'));
check('failed refresh does not quarantine old backup',()=>assert.equal(failed.artifacts.has('/managed/old.pptbackup'),true));
check('failed refresh does not complete tombstones',()=>assert.equal(failed.completeCalls,0));

const noTarget=makeOperations();const noTargetResult=execute(noTarget,{targets:[]});check('no target is attention',()=>assert.equal(noTargetResult.value.status,'attention'));
check('no target leaves pending',()=>assert.equal(noTargetResult.value.pendingRemaining,pending.length));
const noPending=makeOperations();const noPendingResult=execute(noPending,{pending:[],tombstones:[]});check('no pending is success',()=>assert.equal(noPendingResult.value.status,'success'));
check('no pending creates no backup',()=>assert.equal(noPending.createCalls,0));
const mismatch=makeOperations();const mismatchResult=execute(mismatch,{tombstones:[]});check('tombstone count mismatch rejected',()=>assert.equal(mismatchResult.ok,false));
const duplicate=makeOperations();const duplicateResult=execute(duplicate,{targets:[target,target]});check('duplicate target rejected',()=>assert.equal(duplicateResult.ok,false));

// Real filesystem adapter: only explicitly managed path moves; manual and fresh files stay.
const fsRoot=join(tmp,'fs-target');await mkdir(fsRoot,{recursive:true});
const freshPath=join(fsRoot,'fresh.pptbackup');const oldPath=join(fsRoot,'old.pptbackup');const manualPath=join(fsRoot,'manual.pptbackup');
await writeFile(freshPath,'fresh');await writeFile(oldPath,'old');await writeFile(manualPath,'manual');
const port=new adapter.FileSystemBackupPurgeQuarantinePort();
const fsResult=port.quarantine({targetPath:fsRoot,excludeFilePath:freshPath,artifactPaths:[oldPath],batchId:'propagation-137',quarantinedAt:'2026-07-28T03:05:00.000Z',tombstones},correlationId);
check('filesystem quarantine succeeds',()=>assert.equal(fsResult.ok,true));
check('managed old file removed from active root',()=>assert.equal(fsResult.ok&&fsResult.value.artifacts[0].originalFilePath,oldPath));
check('fresh file still exists',()=>assert.equal(existsSync(freshPath),true));
check('manual file still exists',()=>assert.equal(existsSync(manualPath),true));
check('old file moved',()=>assert.equal(existsSync(oldPath),false));
check('quarantine artifact exists',()=>assert.equal(fsResult.ok&&existsSync(fsResult.value.artifacts[0].quarantinedFilePath),true));
check('manifest exists',()=>assert.equal(fsResult.ok&&existsSync(fsResult.value.manifestPath),true));
const manifest=fsResult.ok?JSON.parse(await readFile(fsResult.value.manifestPath,'utf8')):{};
check('manifest contains hash',()=>assert.match(manifest.artifacts[0].sha256,/^[a-f0-9]{64}$/));
check('manifest contains tombstone fingerprints',()=>assert.equal(manifest.tombstones.length,2));
check('manifest excludes raw resource identifiers',()=>assert.equal(JSON.stringify(manifest).includes('finance-1'),false));

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:137,applicationVersion:'28.07.2026.137',packageVersion:'28.7.2026-137',stage:'Bronze RC2 Active Development',scope:'Verified clean backup, managed-only recoverable quarantine, unmanaged-copy preservation/blocking, CAS-ready pending completion and real filesystem manifest behavior',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Build 137 backup purge propagation runtime: PASS (${checks.length}/${checks.length})`);
