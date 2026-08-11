import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const out=resolve(process.argv[2]??'artifacts/validation/build195-clean-rewrite-active-ownership-snapshot-sqlite-runtime.json');
const tmp=join(process.cwd(),'.tmp','build195-clean-rewrite-active-ownership-snapshot-sqlite-runtime');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const migrationSource=await readFile('packages/database/src/family-database-migrations.ts','utf8');
const extract=(name)=>{const match=new RegExp('const '+name+' = `([\\s\\S]*?)`;').exec(migrationSource);if(!match)throw new Error(`Migration SQL not found: ${name}`);return match[1];};
const baseSchema=`
CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
INSERT INTO database_metadata VALUES('schema_generation','BASE','2026-07-31T00:00:00.000Z');
CREATE TABLE backup_clean_rewrite_policy(
 id TEXT PRIMARY KEY,enabled INTEGER NOT NULL,retention_days INTEGER NOT NULL,
 manual_failure_backoff_minutes INTEGER NOT NULL,automatic_failure_backoff_minutes INTEGER NOT NULL,
 high_load_defer_minutes INTEGER NOT NULL,state TEXT NOT NULL,consecutive_failures INTEGER NOT NULL,
 last_outcome TEXT NOT NULL,last_trigger TEXT,last_attempt_at TEXT,last_success_at TEXT,next_attempt_at TEXT,
 last_error TEXT,in_progress_run_id TEXT,in_progress_started_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE backup_clean_rewrite_runs(
 id TEXT PRIMARY KEY,trigger TEXT NOT NULL,status TEXT NOT NULL,retention_cutoff TEXT NOT NULL,
 due_records INTEGER NOT NULL,enabled_targets INTEGER NOT NULL,propagation_run_id TEXT,next_attempt_at TEXT,
 error TEXT,started_at TEXT NOT NULL,completed_at TEXT,updated_at TEXT NOT NULL
);`;
const migration37=extract('cleanBackupRewriteRunningLedgerIdentitySql');
const migration38=extract('cleanBackupRewriteClaimReservationSql');
const migration39=extract('cleanBackupRewriteActiveOwnershipSnapshotSql');
const start='2026-07-31T12:00:00.000Z';
const cutoff='2026-07-01T12:00:00.000Z';
const setup=(includeBuild195)=>{const db=new DatabaseSync(':memory:');db.exec(baseSchema);db.exec(migration37);db.exec(migration38);if(includeBuild195)db.exec(migration39);db.prepare(`INSERT INTO backup_clean_rewrite_policy VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('default',1,30,60,360,30,'idle',0,'never',null,null,null,null,null,null,null,'2026-07-01T00:00:00.000Z',start);return db;};
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const repositorySource=await readFile('packages/repositories/src/backup-propagation-repository.ts','utf8');
const modulePath=join(tmp,'repository.mjs');
await writeFile(modulePath,ts.transpileModule(repositorySource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/import \{ SqliteRepository \} from '\.\/sqlite-base\.js';/,`class SqliteRepository { database(context){return context.transaction;} execute(_context,operation){try{return {ok:true,value:operation()};}catch(error){return {ok:false,error};}} }`));
const {SqliteBackupPropagationRepository}=await import(pathToFileURL(modulePath).href);
const repo=new SqliteBackupPropagationRepository();
const context=(db)=>({transaction:db,actor:{userId:'admin',roles:['family_admin']},correlationId:'build195',occurredAt:start});
const unwrap=(result)=>{if(!result.ok)throw result.error;return result.value;};
const claim=(db,id='build195-owner')=>unwrap(repo.claimCleanRewrite(context(db),{trigger:'manual',runId:id,startedAt:start,retentionCutoff:cutoff,dueRecords:4,enabledTargets:2}));
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};

let baseline=setup(false);claim(baseline,'baseline-owner');
check('Build 194 baseline permits active ledger due-record mutation',()=>assert.equal(Number(baseline.prepare(`UPDATE backup_clean_rewrite_runs SET due_records=99 WHERE id='baseline-owner'`).run().changes),1));
check('Build 194 baseline permits active policy clock mutation',()=>assert.equal(Number(baseline.prepare(`UPDATE backup_clean_rewrite_policy SET updated_at='2026-07-31T12:00:01.000Z' WHERE id='default'`).run().changes),1));
baseline.close();

let db=setup(true);const owned=claim(db);
check('valid claim enters running state',()=>assert.equal(owned.state,'running'));
check('valid claim records owner id',()=>assert.equal(owned.inProgressRunId,'build195-owner'));
check('claim reservation is consumed',()=>assert.equal(db.prepare(`SELECT state FROM backup_clean_rewrite_claim_reservations WHERE run_id='build195-owner'`).get().state,'consumed'));
check('running ledger matches reservation workload snapshot',()=>{const row=db.prepare(`SELECT run.due_records AS run_due,reservation.due_records AS reservation_due,run.enabled_targets AS run_targets,reservation.enabled_targets AS reservation_targets FROM backup_clean_rewrite_runs run JOIN backup_clean_rewrite_claim_reservations reservation ON reservation.run_id=run.id WHERE run.id='build195-owner'`).get();assert.equal(row.run_due,4);assert.equal(row.reservation_due,4);assert.equal(row.run_targets,2);assert.equal(row.reservation_targets,2);});
for(const [label,sql,error] of [
 ['active policy updated_at mutation denied',`UPDATE backup_clean_rewrite_policy SET updated_at='2026-07-31T12:00:01.000Z' WHERE id='default'`,/active clean rewrite policy ownership snapshot is immutable/],
 ['active policy last_attempt mutation denied',`UPDATE backup_clean_rewrite_policy SET last_attempt_at='2026-07-31T12:00:01.000Z' WHERE id='default'`,/active clean rewrite policy ownership snapshot is immutable/],
 ['active ledger due-record mutation denied',`UPDATE backup_clean_rewrite_runs SET due_records=99 WHERE id='build195-owner'`,/active clean rewrite ledger snapshot is immutable/],
 ['active ledger target-count mutation denied',`UPDATE backup_clean_rewrite_runs SET enabled_targets=99 WHERE id='build195-owner'`,/active clean rewrite ledger snapshot is immutable/],
 ['active ledger cutoff mutation denied',`UPDATE backup_clean_rewrite_runs SET retention_cutoff='2026-06-30T12:00:00.000Z' WHERE id='build195-owner'`,/active clean rewrite ledger snapshot is immutable/],
 ['active ledger error injection denied',`UPDATE backup_clean_rewrite_runs SET error='forged' WHERE id='build195-owner'`,/active clean rewrite ledger snapshot is immutable/],
 ['active ledger update clock mutation denied',`UPDATE backup_clean_rewrite_runs SET updated_at='2026-07-31T12:00:01.000Z' WHERE id='build195-owner'`,/active clean rewrite ledger snapshot is immutable/]
]){assert.throws(()=>db.exec(sql),error);checks.push(label);}
check('denied changes preserve active policy snapshot',()=>{const row=db.prepare(`SELECT last_attempt_at,updated_at FROM backup_clean_rewrite_policy WHERE id='default'`).get();assert.equal(row.last_attempt_at,start);assert.equal(row.updated_at,start);});
check('denied changes preserve active ledger snapshot',()=>{const row=db.prepare(`SELECT retention_cutoff,due_records,enabled_targets,error,updated_at FROM backup_clean_rewrite_runs WHERE id='build195-owner'`).get();assert.equal(row.retention_cutoff,cutoff);assert.equal(row.due_records,4);assert.equal(row.enabled_targets,2);assert.equal(row.error,null);assert.equal(row.updated_at,start);});
const terminal=unwrap(repo.completeCleanRewrite(context(db),{runId:'build195-owner',state:'attention',outcome:'attention',runStatus:'attention',completedAt:'2026-07-31T12:00:05.000Z',nextAttemptAt:'2026-07-31T13:00:05.000Z',error:'no target',success:false}));
check('authorized terminal transition remains allowed',()=>assert.equal(terminal.run.status,'attention'));
check('terminal transition clears active owner',()=>assert.equal(terminal.policy.inProgressRunId,undefined));
check('policy active snapshot trigger exists',()=>assert.equal(Number(db.prepare(`SELECT COUNT(*) AS value FROM sqlite_master WHERE type='trigger' AND name='trg_backup_clean_rewrite_policy_active_snapshot_update'`).get().value),1));
check('ledger active snapshot trigger exists',()=>assert.equal(Number(db.prepare(`SELECT COUNT(*) AS value FROM sqlite_master WHERE type='trigger' AND name='trg_backup_clean_rewrite_runs_active_snapshot_update'`).get().value),1));
check('migration 39 registered',()=>assert.match(migrationSource,/createMigrationDefinition\(39, 'clean_backup_rewrite_active_ownership_snapshot'/));
check('schema revision advanced',()=>assert.match(migrationSource,/REVISION-195-CLEAN-BACKUP-ACTIVE-OWNERSHIP-SNAPSHOT/));
db.close();
assert.equal(checks.length,21);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:195,stage:'Bronze RC2 Active Development',scope:'Active clean-rewrite ownership snapshot immutability',status:'PASS',checks:checks.length,checkLabels:checks,nodeSqlite:'node:sqlite DatabaseSync',generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 195 clean rewrite active ownership snapshot SQLite runtime: PASS (${checks.length}/${checks.length})`);
