import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const out=resolve(process.argv[2]??'artifacts/validation/build185-backup-propagation-chronology-runtime.json');
const tmp=resolve('.tmp/build185-backup-propagation-chronology-runtime');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const source=await readFile('packages/application/src/managed-backup-propagation-use-case.ts','utf8');
const prelude=`
const ERROR_CODES={CORE_INVALID_ARGUMENT:'CORE_INVALID_ARGUMENT'};
const createAppError=(input)=>input;const err=(error)=>({ok:false,error});const ok=(value)=>({ok:true,value});
type AppError=any;type CorrelationId=string;type Result<T,E>=({ok:true,value:T}|{ok:false,error:E});
type BackupPropagationRunView=any;type BackupRunView=any;type BackupTargetView=any;type PendingBackupPropagationRecord=any;
type BackupPurgeQuarantineResult=any;type BackupPurgeTombstoneFingerprint=any;
`;
const body=source.slice(source.indexOf('export interface ManagedBackupPropagationOperations'));
const transpiled=ts.transpileModule(prelude+body,{fileName:'managed-backup-propagation-use-case.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
const errors=(transpiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);
if(errors.length)throw new Error(errors.map(item=>ts.flattenDiagnosticMessageText(item.messageText,'\n')).join('\n'));
const modulePath=join(tmp,'managed.mjs');await writeFile(modulePath,transpiled.outputText);const managed=await import(pathToFileURL(modulePath).href);

const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
const pending=[{resourceType:'finance_record',resourceId:'f-1',purgedAt:'2026-07-30T08:00:00.000Z',updatedAt:'2026-07-30T08:00:00.000Z'}];
const tombstones=[{fingerprint:'a'.repeat(64),purgedAt:pending[0].purgedAt}];
const target=(id)=>({id,name:`Hedef ${id}`,kind:'local',path:`/backup/${id}`,enabled:true,schedule:'manual',retentionCount:5,retryCount:0,createdAt:'2026-07-30T08:00:00.000Z'});
const fresh=(id)=>({id:`fresh-${id}`,targetId:id,status:'success',filePath:`/backup/${id}/fresh.pptbackup`,sha256:'b'.repeat(64),startedAt:'2026-07-30T10:00:00.000Z',completedAt:'2026-07-30T10:00:01.000Z'});
const old=(id)=>({id:`old-${id}`,targetId:id,status:'success',filePath:`/backup/${id}/old.pptbackup`,sha256:'c'.repeat(64),startedAt:'2026-07-29T10:00:00.000Z',completedAt:'2026-07-29T10:00:01.000Z'});
const makeState=()=>{const quarantineTimes=[];const completedTimes=[];let quarantineCalls=0;let completeCalls=0;return{quarantineTimes,completedTimes,get quarantineCalls(){return quarantineCalls;},get completeCalls(){return completeCalls;},operations:{listSuccessfulRuns:(id)=>({ok:true,value:[old(id)]}),createVerifiedBackup:(id)=>({ok:true,value:fresh(id)}),quarantineManagedArtifacts:(input)=>{quarantineCalls+=1;quarantineTimes.push(input.quarantinedAt);return{ok:true,value:{quarantineDirectory:`${input.targetPath}/.q`,manifestPath:`${input.targetPath}/.q/manifest.json`,artifacts:[{originalFilePath:input.artifactPaths[0],quarantinedFilePath:`${input.artifactPaths[0]}.q`,sha256:'d'.repeat(64),sizeBytes:1}]}};},deleteManagedRun:()=>({ok:true,value:undefined}),listArtifacts:(path)=>({ok:true,value:[`${path}/fresh.pptbackup`]}),completePending:(_records,at)=>{completeCalls+=1;completedTimes.push(at);return{ok:true,value:pending.length};}}};};
const execute=({targets=[target('one')],sequence=[500,1500],startedAt='2026-07-30T10:00:00.000Z',startedMonotonicMs=1000,state=makeState(),clock}={})=>{let index=0;const monotonicNowMs=clock??(()=>startedMonotonicMs+(sequence[index++]??sequence.at(-1)??0));const result=managed.executeManagedBackupPropagation({correlationId:'corr-185',runId:'propagation-185',pending,targets,tombstones,startedAt,startedMonotonicMs,monotonicNowMs,operations:state.operations});return{result,state};};

const success=execute({sequence:[500,2500]});
check('success returns run',()=>assert.equal(success.result.ok,true));
check('quarantine timestamp derives from elapsed monotonic time',()=>assert.equal(success.state.quarantineTimes[0],'2026-07-30T10:00:00.500Z'));
check('completion timestamp is captured after operations',()=>assert.equal(success.result.value.completedAt,'2026-07-30T10:00:02.500Z'));
check('completion timestamp reaches tombstone completion',()=>assert.equal(success.state.completedTimes[0],'2026-07-30T10:00:02.500Z'));
check('completion occurs after quarantine',()=>assert.ok(Date.parse(success.result.value.completedAt)>Date.parse(success.state.quarantineTimes[0])));
check('completion is not the start timestamp',()=>assert.notEqual(success.result.value.completedAt,success.result.value.startedAt));
check('one quarantine call',()=>assert.equal(success.state.quarantineCalls,1));
check('one completion call',()=>assert.equal(success.state.completeCalls,1));

const twoTargets=execute({targets:[target('one'),target('two')],sequence:[200,900,1800]});
check('two target run succeeds',()=>assert.equal(twoTargets.result.ok,true));
check('per-target quarantine timestamps are ordered',()=>assert.deepEqual(twoTargets.state.quarantineTimes,['2026-07-30T10:00:00.200Z','2026-07-30T10:00:00.900Z']));
check('final time follows all target timestamps',()=>assert.equal(twoTargets.result.value.completedAt,'2026-07-30T10:00:01.800Z'));
check('final completion uses same time for pending rows',()=>assert.equal(twoTargets.state.completedTimes[0],twoTargets.result.value.completedAt));

const invalidStart=execute({startedAt:'not-a-date'});
check('invalid wall-clock start is rejected',()=>assert.equal(invalidStart.result.ok,false));
check('invalid wall-clock start performs no quarantine',()=>assert.equal(invalidStart.state.quarantineCalls,0));
const invalidMono=execute({startedMonotonicMs:-1});
check('negative monotonic start is rejected',()=>assert.equal(invalidMono.result.ok,false));
check('negative monotonic start performs no quarantine',()=>assert.equal(invalidMono.state.quarantineCalls,0));
const backwardAtQuarantine=execute({startedMonotonicMs:1000,clock:()=>999});
check('backward clock before quarantine is rejected',()=>assert.equal(backwardAtQuarantine.result.ok,false));
check('backward clock prevents quarantine',()=>assert.equal(backwardAtQuarantine.state.quarantineCalls,0));
const finalState=makeState();let finalIndex=0;const finalValues=[1500,1400];
const backwardAtFinal=execute({state:finalState,startedMonotonicMs:1000,clock:()=>finalValues[finalIndex++]});
check('backward final clock is rejected',()=>assert.equal(backwardAtFinal.result.ok,false));
check('backward final clock leaves tombstones pending',()=>assert.equal(finalState.completeCalls,0));
const thrownState=makeState();const thrown=execute({state:thrownState,clock:()=>{throw new Error('clock unavailable');}});
check('throwing clock is rejected',()=>assert.equal(thrown.result.ok,false));
check('throwing clock error is visible',()=>assert.match(thrown.result.error.message,/okunamadı/));
const nanState=makeState();const nanClock=execute({state:nanState,clock:()=>Number.NaN});
check('non-finite clock is rejected',()=>assert.equal(nanClock.result.ok,false));
check('non-finite clock prevents quarantine',()=>assert.equal(nanState.quarantineCalls,0));

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:185,stage:'Bronze RC2 Active Development',scope:'Monotonic managed-backup propagation chronology, post-operation completion time and fail-closed clock validation',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});console.log(`Build 185 backup propagation chronology runtime: PASS (${checks.length}/${checks.length})`);
