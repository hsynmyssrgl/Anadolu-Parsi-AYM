import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const tmp=join(root,'.tmp','build146-family-data-import-runtime');
const args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build146-family-data-import-runtime.json'));
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
const source=await readFile('apps/desktop/src/main/family-data-import-service.ts','utf8');
const body=source.slice(source.indexOf('const MAX_IMPORT_BYTES'));
const prelude=`import { createHash, randomUUID } from 'node:crypto';\nimport { basename, extname } from 'node:path';\nimport { lstatSync, readFileSync } from 'node:fs';\nconst ERROR_CODES={RESOURCE_NOT_FOUND:'RESOURCE_NOT_FOUND',RESOURCE_CONFLICT:'RESOURCE_CONFLICT'};\nconst asEventId=(value)=>value,asIsoDate=(value)=>value,asIsoDateTime=(value)=>value,asPersonId=(value)=>value;\nconst createAppError=(value)=>value,err=(error)=>({ok:false,error}),ok=(value)=>({ok:true,value});\ntype AppError=any;type Result<T,E>=({ok:true,value:T}|{ok:false,error:E});\ntype DataLifecycleApplicationContext=any;type StrongAuthenticationPort=any;type AuditRepositoryPort=any;type FamilyDataImportRepositoryPort=any;type FamilyDataImportExistingData=any;type FamilyDataImportBatchRecord=any;type FamilyRepositoryPort=any;type LocationRepositoryPort=any;type PersonRepositoryPort=any;type RelationRepositoryPort=any;type RepositoryExecutionContext=any;type TimelineRepositoryPort=any;type TransactionExecutor=any;type TransactionContext=any;type ApplyFamilyDataImportInput=any;type FamilyDataImportBatchView=any;type FamilyDataImportEntitySummaryView=any;type FamilyDataImportEntityType=any;type FamilyDataImportIssueView=any;type FamilyDataImportPreviewView=any;type RollbackFamilyDataImportInput=any;\n`;
const output=ts.transpileModule(prelude+body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
const diagnostics=(output.diagnostics??[]).filter((item)=>item.category===ts.DiagnosticCategory.Error);
if(diagnostics.length)throw new Error(diagnostics.map((item)=>ts.flattenDiagnosticMessageText(item.messageText,'\n')).join('\n'));
const modulePath=join(tmp,'family-data-import-service.mjs');await writeFile(modulePath,output.outputText);
const {FamilyDataImportService}=await import(pathToFileURL(modulePath).href);

const freshState=()=>({
  family:{id:'family-main',name:'Test Ailesi'},
  people:new Map(),relations:new Map(),locations:new Map(),events:new Map(),batches:new Map(),items:[],audits:[],blockers:new Map(),failEntity:null
});
const state=freshState();
const restore=(snapshot)=>{for(const key of Object.keys(state))state[key]=snapshot[key];};
const resultError=(message)=>({ok:false,error:{code:'TEST_FAILURE',message}});
let role='family_admin',authCalls=0,actorId='admin',familyId='family-main';
const context=(prefix)=>({familyId,actor:{userId:actorId,role},correlationId:`${prefix}-corr`});
const transactionExecutor={execute:(_correlation,callback)=>{const before=structuredClone(state);try{const result=callback({transaction:{},occurredAt:new Date().toISOString()});if(!result.ok)restore(before);return result;}catch(error){restore(before);throw error;}}};
const importRepository={
  loadExisting:()=>({ok:true,value:{people:[...state.people.values()].map(({id,displayName,birthDate})=>({id,displayName,...(birthDate?{birthDate}:{})})),locations:[...state.locations.values()].map(({id,label,address})=>({id,label,...(address?{address}:{})})),events:[...state.events.values()].map(({id,title,startAt})=>({id,title,startAt})),relations:[...state.relations.values()].map(({id,fromPersonId,toPersonId,relationType})=>({id,fromPersonId,toPersonId,relationType}))}}),
  insertBatch:(_context,row)=>{state.batches.set(row.id,structuredClone(row));return {ok:true,value:undefined};},
  insertItem:(_context,row)=>{state.items.push(structuredClone(row));return {ok:true,value:undefined};},
  listBatches:()=>({ok:true,value:[...state.batches.values()].toSorted((a,b)=>b.appliedAt.localeCompare(a.appliedAt))}),
  findBatch:(_context,id)=>({ok:true,value:state.batches.get(id)??null}),
  findActiveSource:(_context,familyId,sha,exportId)=>({ok:true,value:[...state.batches.values()].find((row)=>row.familyId===familyId&&['applied','rollback_blocked'].includes(row.status)&&(row.sourceSha256===sha||row.sourceExportId===exportId))??null}),
  listItems:(_context,batchId)=>({ok:true,value:state.items.filter((row)=>row.batchId===batchId)}),
  inspectRollback:(_context,batchId)=>{const blockers=state.blockers.get(batchId)??[];return {ok:true,value:{allowed:blockers.length===0,blockers}};},
  deleteCreatedEntities:(_context,batchId)=>{const rows=state.items.filter((row)=>row.batchId===batchId&&row.resolution==='created');for(const row of rows){const target=row.entityType==='person'?state.people:row.entityType==='relation'?state.relations:row.entityType==='location'?state.locations:state.events;target.delete(row.entityId);}return {ok:true,value:rows.length};},
  markRollbackBlocked:(_context,batchId)=>{const row=state.batches.get(batchId);if(row)state.batches.set(batchId,{...row,status:'rollback_blocked'});return {ok:true,value:undefined};},
  markRolledBack:(_context,batchId,rolledBackAt)=>{const row=state.batches.get(batchId);if(row)state.batches.set(batchId,{...row,status:'rolled_back',rolledBackAt});return {ok:true,value:undefined};}
};
const familyRepository={findById:()=>({ok:true,value:state.family})};
const insert=(collection,type)=>(_context,row)=>{if(state.failEntity===type)return resultError(`${type} insert failed`);collection.set(row.id,structuredClone(row));return {ok:true,value:undefined};};
const dependencies={transactionExecutor,importRepository,familyRepository,personRepository:{insert:insert(state.people,'person')},relationRepository:{insert:insert(state.relations,'relation')},locationRepository:{insert:insert(state.locations,'location')},timelineRepository:{insert:insert(state.events,'event')},auditRepository:{append:(_context,row)=>{state.audits.push(row);return {ok:true,value:undefined};}},strongAuthentication:{verify:(_context,input)=>{authCalls++;return input.password==='correct'?{ok:true,value:undefined}:resultError('bad auth');}},applicationContext:context};
const service=new FamilyDataImportService(dependencies);
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
const sample=(exportId,suffix='')=>({schemaVersion:1,exportId,createdAt:new Date().toISOString(),family:{name:'Kaynak Aile'},people:[{id:`p1${suffix}`,displayName:`Ayşe ${suffix||'Yılmaz'}`,birthDate:'1980-02-29',relationshipType:'Anne',generation:1,branch:'Ana Dal',status:'active'},{id:`p2${suffix}`,displayName:`Mehmet ${suffix||'Yılmaz'}`,relationshipType:'Baba',generation:1,branch:'Ana Dal',status:'active'}],relations:[{id:`r1${suffix}`,fromPersonId:`p1${suffix}`,toPersonId:`p2${suffix}`,relationType:'spouse'}],locations:[{id:`l1${suffix}`,label:`Ev ${suffix}`,address:'Sakarya',kind:'residence'}],events:[{id:`e1${suffix}`,kind:'important_day',title:`Yıldönümü ${suffix}`,startAt:'2026-08-01T12:00:00.000Z',locationId:`l1${suffix}`,visibility:'family',participantPersonIds:[`p1${suffix}`,`p2${suffix}`],aiProcessingAllowed:false,recurrence:'yearly',reminderDays:[7,1]}]});
const sourcePath=join(tmp,'family.json');await writeFile(sourcePath,JSON.stringify(sample('export-1')));
const preview=service.preview(sourcePath);
check('valid source previewed',()=>assert.equal(preview.valid,true));
check('all entity types summarized',()=>assert.deepEqual(preview.entities.map((row)=>row.entityType),['person','relation','location','event']));
check('five records planned for creation',()=>assert.equal(preview.totalCreateRecords,5));
actorId='other-admin';assert.throws(()=>service.apply({previewId:preview.previewId,password:'correct'}),/farklı kullanıcı veya aile oturumuna/);checks.push('preview cannot cross user sessions');actorId='admin';
const reboundPreview=service.preview(sourcePath);
const applied=service.apply({previewId:reboundPreview.previewId,password:'correct'});
check('deterministic preview plan applies',()=>assert.equal(applied.totalCreatedRecords,5));
check('atomic apply persisted all entities',()=>assert.deepEqual([state.people.size,state.relations.size,state.locations.size,state.events.size],[2,1,1,1]));
check('apply is audited',()=>assert.equal(state.audits.at(-1).action,'family_data.import_applied'));
check('strong authentication exercised',()=>assert.equal(authCalls,1));
const listed=service.listBatches();check('applied batch listed with rollback window',()=>assert.equal(listed[0].rollbackAvailable,true));
const replayPreview=service.preview(sourcePath);assert.throws(()=>service.apply({previewId:replayPreview.previewId,password:'correct'}),/daha önce uygulanmış/);checks.push('active source replay rejected');

const changedPath=join(tmp,'changed.json');await writeFile(changedPath,JSON.stringify(sample('export-change','c')));const changedPreview=service.preview(changedPath);await new Promise((resolve)=>setTimeout(resolve,5));await writeFile(changedPath,`${JSON.stringify(sample('export-change','c'))}\n`);assert.throws(()=>service.apply({previewId:changedPreview.previewId,password:'correct'}),/ön izlemeden sonra değişti|SHA-256/);checks.push('source mutation after preview rejected');

const conflictPath=join(tmp,'conflict.json');const conflictDoc=sample('export-conflict','x');await writeFile(conflictPath,JSON.stringify(conflictDoc));const conflictPreview=service.preview(conflictPath);state.people.set('manual-person',{id:'manual-person',displayName:conflictDoc.people[0].displayName,birthDate:conflictDoc.people[0].birthDate});assert.throws(()=>service.apply({previewId:conflictPreview.previewId,password:'correct'}),/Çakışma planını yenilemek/);checks.push('database change invalidates preview plan');state.people.delete('manual-person');

const atomicPath=join(tmp,'atomic.json');await writeFile(atomicPath,JSON.stringify(sample('export-atomic','a')));const atomicPreview=service.preview(atomicPath);const beforeAtomic=[state.people.size,state.relations.size,state.locations.size,state.events.size,state.batches.size,state.items.length];state.failEntity='event';assert.throws(()=>service.apply({previewId:atomicPreview.previewId,password:'correct'}),/TEST_FAILURE|event insert failed/);state.failEntity=null;check('failed insert rolls back entire transaction',()=>assert.deepEqual([state.people.size,state.relations.size,state.locations.size,state.events.size,state.batches.size,state.items.length],beforeAtomic));

const blockedPath=join(tmp,'blocked.json');await writeFile(blockedPath,JSON.stringify(sample('export-blocked','b')));const blockedPreview=service.preview(blockedPath);const blockedBatch=service.apply({previewId:blockedPreview.previewId,password:'correct'});state.blockers.set(blockedBatch.id,['Sonradan bağlı kayıt var.']);assert.throws(()=>service.rollback({batchId:blockedBatch.id,password:'correct'}),/Geri alma güvenli değil/);check('unsafe rollback persisted blocked status',()=>assert.equal(state.batches.get(blockedBatch.id).status,'rollback_blocked'));state.blockers.delete(blockedBatch.id);const rolledBack=service.rollback({batchId:blockedBatch.id,password:'correct'});check('safe retry rolls back batch',()=>assert.equal(rolledBack.status,'rolled_back'));check('rollback deletes only created import entities',()=>assert.equal([...state.people.values()].some((row)=>row.displayName.includes('b')),false));check('rollback is audited',()=>assert.equal(state.audits.at(-1).action,'family_data.import_rolled_back'));

const invalidPath=join(tmp,'invalid.json');await writeFile(invalidPath,'{"schemaVersion":1,"people":[]}');const invalidPreview=service.preview(invalidPath);check('invalid schema never becomes applicable',()=>assert.equal(invalidPreview.valid,false));check('invalid schema exposes errors',()=>assert.ok(invalidPreview.issues.some((item)=>item.severity==='error')));
const badUtf8Path=join(tmp,'bad-utf8.json');await writeFile(badUtf8Path,Buffer.from([0xc3,0x28]));assert.throws(()=>service.preview(badUtf8Path),/UTF-8/);checks.push('invalid UTF-8 rejected');
const malformedTypesPath=join(tmp,'malformed-types.json');const malformedTypes=sample('export-malformed','m');malformedTypes.people[0].birthDate=123;malformedTypes.events[0].participantPersonIds=[123];malformedTypes.events[0].aiProcessingAllowed='false';await writeFile(malformedTypesPath,JSON.stringify(malformedTypes));const malformedTypesPreview=service.preview(malformedTypesPath);check('invalid optional field types rejected',()=>assert.equal(malformedTypesPreview.valid,false));check('invalid participant and AI permission types exposed',()=>assert.ok(malformedTypesPreview.issues.some((item)=>item.code==='import.event_participants_type')&&malformedTypesPreview.issues.some((item)=>item.code==='import.event_ai_permission')));
role='adult_member';assert.throws(()=>service.preview(sourcePath),/aile yöneticisi/);checks.push('non-admin preview denied');role='family_admin';
assert.throws(()=>service.apply({previewId:'x',password:''}),/doğrulama bilgileri geçersiz/);checks.push('empty apply credential rejected');
const clearedPreview=service.preview(sourcePath);service.clearCachedPreviews();assert.throws(()=>service.apply({previewId:clearedPreview.previewId,password:'correct'}),/bulunamadı veya süresi doldu/);checks.push('session cache clear invalidates previews');

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:146,applicationVersion:'28.07.2026.146',packageVersion:'28.7.2026-146',stage:'Bronze RC2 Active Development',status:'PASS',checks:checks.length,checkLabels:checks,limitations:['Runtime scenarios use in-memory repository ports and a transactional state snapshot. Real SQLite locking, native Electron file dialogs, rendered UI and Windows packaging are not proven.'],generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});console.log(`Build 146 family data import runtime: PASS (${checks.length}/${checks.length}).`);
