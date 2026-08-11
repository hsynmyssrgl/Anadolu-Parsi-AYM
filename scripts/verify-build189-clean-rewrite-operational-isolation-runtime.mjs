import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const tmp=join(root,'.tmp','build189-clean-rewrite-operational-isolation-runtime');
const out=resolve(process.argv[2]??'artifacts/validation/build189-clean-rewrite-operational-isolation-runtime.json');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
let repositorySource=await readFile('packages/repositories/src/backup-propagation-repository.ts','utf8');
const transpiled=ts.transpileModule(repositorySource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const runnable=transpiled
  .replace(/import \{ SqliteRepository \} from '\.\/sqlite-base\.js';/,`class SqliteRepository { database(context){return context.transaction;} execute(_context,operation){try{return {ok:true,value:operation()};}catch(error){return {ok:false,error};}} }`);
const modulePath=join(tmp,'repository.mjs');await writeFile(modulePath,runnable);
const {SqliteBackupPropagationRepository}=await import(pathToFileURL(modulePath).href);

const migrationSource=await readFile('packages/database/src/family-database-migrations.ts','utf8');
const extract=(name)=>{const start=`const ${name} = `+'`';const from=migrationSource.indexOf(start);if(from<0)throw new Error(`${name} not found`);const bodyStart=from+start.length;const end=migrationSource.indexOf('`;\n',bodyStart);if(end<0)throw new Error(`${name} terminator not found`);return migrationSource.slice(bodyStart,end);};
const schema=(db)=>{
  db.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
  INSERT INTO database_metadata VALUES('schema_generation','test','2026-07-30T00:00:00.000Z');
  CREATE TABLE backup_propagation_runs(id TEXT PRIMARY KEY,status TEXT,pending_records INTEGER,target_count INTEGER,refreshed_targets INTEGER,quarantined_artifacts INTEGER,pending_remaining INTEGER,manual_backup_warning INTEGER,target_results TEXT,error TEXT,started_at TEXT,completed_at TEXT);
  CREATE TABLE backup_clean_rewrite_policy(id TEXT PRIMARY KEY,enabled INTEGER NOT NULL,retention_days INTEGER NOT NULL,manual_failure_backoff_minutes INTEGER NOT NULL,automatic_failure_backoff_minutes INTEGER NOT NULL,high_load_defer_minutes INTEGER NOT NULL,state TEXT NOT NULL,consecutive_failures INTEGER NOT NULL,last_outcome TEXT NOT NULL,last_trigger TEXT,last_attempt_at TEXT,last_success_at TEXT,next_attempt_at TEXT,last_error TEXT,in_progress_run_id TEXT,in_progress_started_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE backup_clean_rewrite_runs(id TEXT PRIMARY KEY,trigger TEXT NOT NULL,status TEXT NOT NULL,retention_cutoff TEXT NOT NULL,due_records INTEGER NOT NULL,enabled_targets INTEGER NOT NULL,propagation_run_id TEXT,next_attempt_at TEXT,error TEXT,started_at TEXT NOT NULL,completed_at TEXT,updated_at TEXT NOT NULL);
  CREATE TABLE data_lifecycle(resource_type TEXT,resource_id TEXT,state TEXT,backup_propagation_pending INTEGER,purged_at TEXT,updated_at TEXT);
  `);
  for(const name of ['cleanBackupRewriteLinkedChronologySql','cleanBackupRewriteRecoveryChronologySql','cleanBackupRewriteClaimChronologySql','cleanBackupRewriteOperationalIsolationSql'])db.exec(extract(name));
};
const context=(db)=>({transaction:db,actor:{userId:'admin',roles:['family_admin']},correlationId:'build189',occurredAt:'2026-07-30T00:00:00.000Z'});
const insertPolicy=(db,state='idle')=>db.prepare(`INSERT INTO backup_clean_rewrite_policy VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('default',1,30,60,360,30,state,0,'never',null,null,null,null,null,null,null,'2026-07-01T00:00:00.000Z','2026-07-30T12:00:00.000Z');
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};

let db=new DatabaseSync(':memory:');schema(db);insertPolicy(db);let repo=new SqliteBackupPropagationRepository();let ctx=context(db);
let result=repo.updateCleanRewritePolicy(ctx,{enabled:false,retentionDays:45,updatedAt:'2026-07-30T12:01:00.000Z'});
check('idle policy update succeeds',()=>assert.equal(result.ok,true));
check('idle policy update persists values',()=>{const row=db.prepare(`SELECT enabled,retention_days FROM backup_clean_rewrite_policy`).get();assert.deepEqual([row.enabled,row.retention_days],[0,45]);});
db.prepare(`UPDATE backup_clean_rewrite_policy SET enabled=1,retention_days=30,state='running',last_trigger='automatic',last_attempt_at='2026-07-30T13:00:00.000Z',in_progress_run_id='run-189-recovery',in_progress_started_at='2026-07-30T13:00:00.000Z',updated_at='2026-07-30T13:00:00.000Z'`).run();
db.prepare(`INSERT INTO backup_clean_rewrite_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run('run-189-recovery','automatic','running','2026-06-30T13:00:00.000Z',2,1,null,null,null,'2026-07-30T13:00:00.000Z',null,'2026-07-30T13:00:00.000Z');
result=repo.updateCleanRewritePolicy(ctx,{enabled:false,retentionDays:60,updatedAt:'2026-07-30T14:00:00.000Z'});
check('running policy update fails closed',()=>assert.equal(result.ok,false));
check('running policy values remain unchanged',()=>{const row=db.prepare(`SELECT enabled,retention_days FROM backup_clean_rewrite_policy`).get();assert.deepEqual([row.enabled,row.retention_days],[1,30]);});
db.prepare(`UPDATE backup_clean_rewrite_runs SET updated_at='2026-07-30T15:00:00.000Z' WHERE id='run-189-recovery'`).run();
result=repo.recoverInterruptedCleanRewrite(ctx,{observedAt:'2026-07-30T10:00:00.000Z',error:'restart'});
check('repository recovery succeeds',()=>assert.equal(result.ok,true));
check('recovery uses ledger update floor',()=>assert.equal(result.value.policy.updatedAt,'2026-07-30T15:00:00.000Z'));
check('recovery schedules six-hour backoff from floor',()=>assert.equal(result.value.policy.nextAttemptAt,'2026-07-30T21:00:00.000Z'));
check('recovery releases policy owner',()=>assert.equal(result.value.policy.inProgressRunId,undefined));
check('recovery marks ledger interrupted',()=>assert.equal(result.value.run.status,'interrupted'));
check('recovery ledger completion equals floor',()=>assert.equal(result.value.run.completedAt,'2026-07-30T15:00:00.000Z'));
check('recovery ledger retry matches policy',()=>assert.equal(result.value.run.nextAttemptAt,result.value.policy.nextAttemptAt));
db.close();

db=new DatabaseSync(':memory:');schema(db);insertPolicy(db);repo=new SqliteBackupPropagationRepository();ctx=context(db);
let claimed=repo.claimCleanRewrite(ctx,{trigger:'automatic',runId:'run-189-success',startedAt:'2026-07-30T12:00:00.000Z',retentionCutoff:'2026-06-30T12:00:00.000Z',dueRecords:1,enabledTargets:1});
check('valid claim succeeds',()=>assert.equal(claimed.ok&&claimed.value?.state==='running',true));
let completed=repo.completeCleanRewrite(ctx,{runId:'run-189-success',state:'backoff',outcome:'success',runStatus:'success',completedAt:'2026-07-30T12:05:00.000Z',success:true});
check('inconsistent terminal contract is rejected',()=>assert.equal(completed.ok,false));
db.prepare(`INSERT INTO backup_propagation_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run('prop-189','success',1,1,1,0,0,0,'[]',null,'2026-07-30T12:00:00.000Z','2026-07-30T12:05:00.000Z');
completed=repo.completeCleanRewrite(ctx,{runId:'run-189-success',state:'idle',outcome:'success',runStatus:'success',completedAt:'2026-07-30T12:05:00.000Z',propagationRunId:'prop-189',success:true});
check('consistent terminal contract succeeds',()=>assert.equal(completed.ok,true));
check('terminal policy and ledger agree',()=>assert.deepEqual([completed.value.policy.state,completed.value.policy.lastOutcome,completed.value.run.status],['idle','success','success']));
check('terminal timestamps agree',()=>assert.equal(completed.value.policy.updatedAt,completed.value.run.completedAt));
db.close();

assert.equal(checks.length,16);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:189,stage:'Bronze RC2 Active Development',scope:'Repository-backed clean rewrite operational isolation and recovery chronology',status:'PASS',checks:checks.length,checkLabels:checks,nodeSqlite:'node:sqlite DatabaseSync',generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 189 clean rewrite operational isolation runtime: PASS (${checks.length}/${checks.length})`);
