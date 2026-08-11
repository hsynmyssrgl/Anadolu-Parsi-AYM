import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const out=resolve(process.argv[2]??'artifacts/validation/build184-clean-backup-rewrite-sqlite-runtime.json');
const source=await readFile('packages/repositories/src/backup-propagation-repository.ts','utf8');
const completion=/const policyResult=this\.database\(context\)\.prepare\(`([^`]+)`\)\.run\(([^;]+)\) as \{changes\?:number\};/.exec(source);
assert.ok(completion,'Build 184 policy completion SQL was not found');
const sql=completion[1];
const runArguments=completion[2];
const argumentCount=runArguments.split(',').length;
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
check('completion SQL has ten placeholders',()=>assert.equal((sql.match(/\?/g)??[]).length,10));
check('completion call has ten arguments',()=>assert.equal(argumentCount,10));
check('run owner is the final binding',()=>assert.equal(runArguments.trim().split(',').at(-1).trim(),'input.runId'));
check('success timestamp has dedicated binding',()=>assert.ok(runArguments.includes('input.outcome,input.completedAt,input.nextAttemptAt')));

const db=new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE backup_clean_rewrite_policy(
 id TEXT PRIMARY KEY, enabled INTEGER NOT NULL, retention_days INTEGER NOT NULL,
 state TEXT NOT NULL, consecutive_failures INTEGER NOT NULL, last_outcome TEXT NOT NULL,
 last_trigger TEXT,last_attempt_at TEXT,last_success_at TEXT,next_attempt_at TEXT,last_error TEXT,
 in_progress_run_id TEXT,in_progress_started_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE backup_clean_rewrite_runs(
 id TEXT PRIMARY KEY,trigger TEXT NOT NULL,status TEXT NOT NULL,retention_cutoff TEXT NOT NULL,
 due_records INTEGER NOT NULL,enabled_targets INTEGER NOT NULL,propagation_run_id TEXT,next_attempt_at TEXT,
 error TEXT,started_at TEXT NOT NULL,completed_at TEXT,updated_at TEXT NOT NULL
) STRICT;
INSERT INTO backup_clean_rewrite_policy VALUES('default',1,30,'running',3,'failed','automatic','2026-07-30T10:00:00.000Z',NULL,NULL,'old error','run-success','2026-07-30T10:00:00.000Z','2026-07-01T00:00:00.000Z','2026-07-30T10:00:00.000Z');
INSERT INTO backup_clean_rewrite_runs(id,trigger,status,retention_cutoff,due_records,enabled_targets,started_at,updated_at) VALUES('run-success','automatic','running','2026-06-30T10:00:00.000Z',2,1,'2026-07-30T10:00:00.000Z','2026-07-30T10:00:00.000Z');
`);
const completePolicy=db.prepare(sql);
const completeRun=db.prepare(`UPDATE backup_clean_rewrite_runs SET status=?,propagation_run_id=?,next_attempt_at=?,error=?,completed_at=?,updated_at=? WHERE id=? AND status='running'`);
const completedAt='2026-07-30T10:01:00.000Z';
const policyResult=completePolicy.run('idle','success','success','success','success',completedAt,null,null,completedAt,'run-success');
const runResult=completeRun.run('success','propagation-1',null,null,completedAt,completedAt,'run-success');
check('success updates one policy row',()=>assert.equal(policyResult.changes,1));
check('success updates one ledger row',()=>assert.equal(runResult.changes,1));
const policy=db.prepare(`SELECT * FROM backup_clean_rewrite_policy WHERE id='default'`).get();
const run=db.prepare(`SELECT * FROM backup_clean_rewrite_runs WHERE id='run-success'`).get();
check('success clears failure counter',()=>assert.equal(policy.consecutive_failures,0));
check('success writes last success timestamp',()=>assert.equal(policy.last_success_at,completedAt));
check('success clears backoff',()=>assert.equal(policy.next_attempt_at,null));
check('success clears error',()=>assert.equal(policy.last_error,null));
check('success releases owner',()=>assert.equal(policy.in_progress_run_id,null));
check('ledger links propagation run',()=>assert.equal(run.propagation_run_id,'propagation-1'));
check('ledger is completed',()=>assert.equal(run.completed_at,completedAt));

db.prepare(`UPDATE backup_clean_rewrite_policy SET state='running',consecutive_failures=0,last_outcome='success',in_progress_run_id='run-partial',in_progress_started_at=?,updated_at=? WHERE id='default'`).run(completedAt,completedAt);
db.prepare(`INSERT INTO backup_clean_rewrite_runs(id,trigger,status,retention_cutoff,due_records,enabled_targets,started_at,updated_at) VALUES('run-partial','automatic','running','2026-06-30T10:00:00.000Z',1,2,?,?)`).run(completedAt,completedAt);
const retryAt='2026-07-30T16:01:00.000Z';
completePolicy.run('backoff','partial','partial','partial','partial',completedAt,retryAt,'target failure',completedAt,'run-partial');
completeRun.run('partial','propagation-2',retryAt,'target failure',completedAt,completedAt,'run-partial');
const partialPolicy=db.prepare(`SELECT * FROM backup_clean_rewrite_policy WHERE id='default'`).get();
check('partial increments failure counter',()=>assert.equal(partialPolicy.consecutive_failures,1));
check('partial persists backoff',()=>assert.equal(partialPolicy.next_attempt_at,retryAt));
check('partial preserves prior success timestamp',()=>assert.equal(partialPolicy.last_success_at,completedAt));
check('partial persists visible error',()=>assert.equal(partialPolicy.last_error,'target failure'));

const stale=completePolicy.run('idle','success','success','success','success',completedAt,null,null,completedAt,'stale-run');
check('stale owner cannot finalize policy',()=>assert.equal(stale.changes,0));
check('ledger retains due-record snapshot',()=>assert.equal(run.due_records,2));
check('ledger retains target snapshot',()=>assert.equal(run.enabled_targets,1));

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:184,stage:'Bronze RC2 Active Development',scope:'Real SQLite binding and atomic clean-backup rewrite finalization regression',status:'PASS',checks:checks.length,checkLabels:checks,nodeSqlite:'node:sqlite DatabaseSync',generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);db.close();console.log(`Build 184 clean backup rewrite SQLite runtime: PASS (${checks.length}/${checks.length})`);
