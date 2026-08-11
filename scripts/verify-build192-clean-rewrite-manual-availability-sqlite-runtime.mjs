import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp=join(process.cwd(),'.tmp','build192-clean-rewrite-manual-availability-sqlite-runtime');
const out=resolve(process.argv[2]??'artifacts/validation/build192-clean-rewrite-manual-availability-sqlite-runtime.json');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const source=await readFile('packages/repositories/src/backup-propagation-repository.ts','utf8');
const repositoryPath=join(tmp,'repository.mjs');
await writeFile(repositoryPath,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/import \{ SqliteRepository \} from '\.\/sqlite-base\.js';/,`class SqliteRepository { database(context){return context.transaction;} execute(context,operation){try{context.transaction.exec('BEGIN');const value=operation();context.transaction.exec('COMMIT');return {ok:true,value};}catch(error){try{context.transaction.exec('ROLLBACK');}catch{}return {ok:false,error};}} }`));
const {SqliteBackupPropagationRepository}=await import(pathToFileURL(repositoryPath).href);
const migrationSource=await readFile('packages/database/src/family-database-migrations.ts','utf8');
const extract=(name)=>{const start=`const ${name} = `+'`';const from=migrationSource.indexOf(start);if(from<0)throw new Error(`${name} missing`);const body=from+start.length;const end=migrationSource.indexOf('`;\n',body);return migrationSource.slice(body,end);};
const schema=(db)=>{db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);INSERT INTO database_metadata VALUES('schema_generation','test','2026-07-31T00:00:00.000Z');CREATE TABLE backup_propagation_runs(id TEXT PRIMARY KEY,status TEXT,pending_records INTEGER,target_count INTEGER,refreshed_targets INTEGER,quarantined_artifacts INTEGER,pending_remaining INTEGER,manual_backup_warning INTEGER,target_results TEXT,error TEXT,started_at TEXT,completed_at TEXT);CREATE TABLE backup_clean_rewrite_policy(id TEXT PRIMARY KEY,enabled INTEGER NOT NULL,retention_days INTEGER NOT NULL,manual_failure_backoff_minutes INTEGER NOT NULL,automatic_failure_backoff_minutes INTEGER NOT NULL,high_load_defer_minutes INTEGER NOT NULL,state TEXT NOT NULL,consecutive_failures INTEGER NOT NULL,last_outcome TEXT NOT NULL,last_trigger TEXT,last_attempt_at TEXT,last_success_at TEXT,next_attempt_at TEXT,last_error TEXT,in_progress_run_id TEXT,in_progress_started_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE TABLE backup_clean_rewrite_runs(id TEXT PRIMARY KEY,trigger TEXT NOT NULL,status TEXT NOT NULL,retention_cutoff TEXT NOT NULL,due_records INTEGER NOT NULL,enabled_targets INTEGER NOT NULL,propagation_run_id TEXT,next_attempt_at TEXT,error TEXT,started_at TEXT NOT NULL,completed_at TEXT,updated_at TEXT NOT NULL);`);for(const name of ['cleanBackupRewriteLinkedChronologySql','cleanBackupRewriteRecoveryChronologySql','cleanBackupRewriteClaimChronologySql','cleanBackupRewriteOperationalIsolationSql','cleanBackupRewriteTriggerAwareBackoffSql','cleanBackupRewriteManualAvailabilitySql'])db.exec(extract(name));};
const insertPolicy=(db,enabled=0)=>db.prepare(`INSERT INTO backup_clean_rewrite_policy VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('default',enabled,30,60,360,30,'idle',0,'never',null,null,null,null,null,null,null,'2026-07-01T00:00:00.000Z','2026-07-31T05:00:00.000Z');
const context=(db)=>({transaction:db,actor:{userId:'admin',roles:['family_admin']},correlationId:'build192',occurredAt:'2026-07-31T05:00:00.000Z'});
const unwrap=(result)=>{if(!result.ok)throw result.error;return result.value;};
const claimInput=(trigger,id)=>({trigger,runId:id,startedAt:'2026-07-31T05:00:00.000Z',retentionCutoff:'2026-07-01T05:00:00.000Z',dueRecords:1,enabledTargets:1});
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};

let db=new DatabaseSync(':memory:');schema(db);insertPolicy(db,0);let repo=new SqliteBackupPropagationRepository();let ctx=context(db);let claim=unwrap(repo.claimCleanRewrite(ctx,claimInput('automatic','auto-disabled')));
check('repository denies automatic claim while disabled',()=>assert.equal(claim,null));
check('automatic denial leaves policy idle',()=>assert.equal(db.prepare(`SELECT state FROM backup_clean_rewrite_policy`).get().state,'idle'));
check('automatic denial creates no run',()=>assert.equal(Number(db.prepare(`SELECT COUNT(*) AS value FROM backup_clean_rewrite_runs`).get().value),0));db.close();

db=new DatabaseSync(':memory:');schema(db);insertPolicy(db,0);repo=new SqliteBackupPropagationRepository();ctx=context(db);claim=unwrap(repo.claimCleanRewrite(ctx,claimInput('manual','manual-disabled')));
check('repository permits manual claim while disabled',()=>assert.equal(claim.state,'running'));
check('manual claim keeps automatic flag disabled',()=>assert.equal(claim.enabled,false));
check('manual claim persists trigger',()=>assert.equal(claim.lastTrigger,'manual'));
check('manual claim creates running ledger',()=>assert.equal(db.prepare(`SELECT status FROM backup_clean_rewrite_runs`).get().status,'running'));
check('manual claim ledger trigger is manual',()=>assert.equal(db.prepare(`SELECT trigger FROM backup_clean_rewrite_runs`).get().trigger,'manual'));
let completed=unwrap(repo.completeCleanRewrite(ctx,{runId:'manual-disabled',state:'attention',outcome:'attention',runStatus:'attention',completedAt:'2026-07-31T05:00:05.000Z',nextAttemptAt:'2026-07-31T06:00:05.000Z',error:'no target',success:false}));
check('manual disabled run completes atomically',()=>assert.equal(completed.run.status,'attention'));
check('manual completion keeps automatic flag disabled',()=>assert.equal(completed.policy.enabled,false));
check('manual completion keeps sixty minute retry',()=>assert.equal(completed.policy.nextAttemptAt,'2026-07-31T06:00:05.000Z'));db.close();

db=new DatabaseSync(':memory:');schema(db);insertPolicy(db,0);
assert.throws(()=>db.prepare(`UPDATE backup_clean_rewrite_policy SET state='running',last_trigger='automatic',last_attempt_at=?,in_progress_run_id='bad-auto',in_progress_started_at=?,updated_at=? WHERE id='default'`).run('2026-07-31T05:00:00.000Z','2026-07-31T05:00:00.000Z','2026-07-31T05:00:00.000Z'),/disabled clean rewrite policy permits manual runs only/);checks.push('direct disabled automatic running state denied');
check('direct automatic denial rolls back state',()=>assert.equal(db.prepare(`SELECT state FROM backup_clean_rewrite_policy`).get().state,'idle'));
db.prepare(`UPDATE backup_clean_rewrite_policy SET state='running',last_trigger='manual',last_attempt_at=?,in_progress_run_id='direct-manual',in_progress_started_at=?,updated_at=? WHERE id='default'`).run('2026-07-31T05:00:00.000Z','2026-07-31T05:00:00.000Z','2026-07-31T05:00:00.000Z');
check('direct disabled manual running state permitted',()=>assert.equal(db.prepare(`SELECT state FROM backup_clean_rewrite_policy`).get().state,'running'));
check('manual availability insert trigger exists',()=>assert.equal(Number(db.prepare(`SELECT COUNT(*) AS value FROM sqlite_master WHERE type='trigger' AND name='trg_backup_clean_rewrite_policy_manual_availability_insert'`).get().value),1));
check('manual availability update trigger exists',()=>assert.equal(Number(db.prepare(`SELECT COUNT(*) AS value FROM sqlite_master WHERE type='trigger' AND name='trg_backup_clean_rewrite_policy_manual_availability_update'`).get().value),1));db.close();

check('migration 36 registered',()=>assert.match(migrationSource,/createMigrationDefinition\(36, 'clean_backup_rewrite_manual_availability'/));
check('schema revision advanced',()=>assert.match(migrationSource,/REVISION-192-CLEAN-BACKUP-MANUAL-AVAILABILITY/));
assert.equal(checks.length,18);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:192,stage:'Bronze RC2 Active Development',scope:'Repository and SQLite enforcement of manual clean-rewrite availability under disabled automatic policy',status:'PASS',checks:checks.length,checkLabels:checks,nodeSqlite:'node:sqlite DatabaseSync',generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 192 clean rewrite manual availability SQLite runtime: PASS (${checks.length}/${checks.length})`);
