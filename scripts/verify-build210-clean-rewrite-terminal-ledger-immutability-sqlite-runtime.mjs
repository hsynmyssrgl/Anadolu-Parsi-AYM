import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const outputPath=resolve(process.argv[2]??'artifacts/validation/build210-clean-rewrite-terminal-ledger-immutability-sqlite-runtime.json');
const source=await readFile('packages/database/src/family-database-migrations.ts','utf8');
const match=/const cleanBackupRewriteTerminalLedgerImmutabilitySql = `([\s\S]*?)`;/m.exec(source);
assert.ok(match,'Build 210 migration SQL exists');
const protectionSql=match[1];
const schema=`
CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
INSERT INTO database_metadata VALUES('schema_generation','BASE','2026-08-01T00:00:00.000Z');
CREATE TABLE backup_clean_rewrite_runs (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL CHECK(trigger IN ('manual','automatic')),
  status TEXT NOT NULL CHECK(status IN ('running','success','partial','failed','attention','deferred','interrupted')),
  retention_cutoff TEXT NOT NULL,
  due_records INTEGER NOT NULL CHECK(due_records>=0),
  enabled_targets INTEGER NOT NULL CHECK(enabled_targets>=0),
  propagation_run_id TEXT,
  next_attempt_at TEXT,
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL
) STRICT;
`;
const insert=`INSERT INTO backup_clean_rewrite_runs(id,trigger,status,retention_cutoff,due_records,enabled_targets,propagation_run_id,next_attempt_at,error,started_at,completed_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`;
const row=(id,status,overrides={})=>[
  id,'automatic',status,'2026-07-01T00:00:00.000Z',3,2,
  status==='success'||status==='partial'?`p-${id}`:null,
  ['partial','failed','attention','deferred','interrupted'].includes(status)?'2026-08-01T02:00:00.000Z':null,
  ['failed','attention','interrupted'].includes(status)?'evidence':null,
  '2026-08-01T00:00:00.000Z',status==='running'?null:'2026-08-01T01:00:00.000Z',status==='running'?'2026-08-01T00:00:00.000Z':'2026-08-01T01:00:00.000Z',
  ...Object.values(overrides)
];
const terminalStatuses=['success','partial','failed','attention','deferred','interrupted'];
const seed=(db)=>{
  for(const status of terminalStatuses) db.prepare(insert).run(...row(`r-${status}`,status));
  db.prepare(insert).run(...row('r-running','running'));
};
const checks=[];
const check=(label,fn)=>{fn();checks.push(label);console.log('PASS',label);};

const baseline=new DatabaseSync(':memory:');
baseline.exec(schema);seed(baseline);
check('Build209 baseline permits terminal UPDATE',()=>assert.equal(Number(baseline.prepare(`UPDATE backup_clean_rewrite_runs SET error='tampered' WHERE id='r-success'`).run().changes),1));
check('Build209 baseline permits terminal DELETE',()=>assert.equal(Number(baseline.prepare(`DELETE FROM backup_clean_rewrite_runs WHERE id='r-partial'`).run().changes),1));
check('Build209 baseline permits terminal INSERT OR REPLACE',()=>{
  baseline.prepare(`INSERT OR REPLACE INTO backup_clean_rewrite_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(...row('r-failed','failed').map((v,i)=>i===8?'rewritten':v));
  assert.equal(baseline.prepare(`SELECT error FROM backup_clean_rewrite_runs WHERE id='r-failed'`).get().error,'rewritten');
});
baseline.close();

const db=new DatabaseSync(':memory:');
db.exec(schema+protectionSql);seed(db);
check('SQLite recursive triggers disabled',()=>assert.equal(Number(db.prepare('PRAGMA recursive_triggers').get().recursive_triggers),0));
for(const status of terminalStatuses){
  check(`terminal ${status} UPDATE rejected`,()=>assert.throws(()=>db.prepare(`UPDATE backup_clean_rewrite_runs SET due_records=due_records+1 WHERE id=?`).run(`r-${status}`),/terminal clean rewrite ledger is immutable/));
}
check('terminal nullable field mutation rejected',()=>assert.throws(()=>db.prepare(`UPDATE backup_clean_rewrite_runs SET error='changed' WHERE id='r-success'`).run(),/terminal clean rewrite ledger is immutable/));
check('terminal DELETE rejected',()=>assert.throws(()=>db.prepare(`DELETE FROM backup_clean_rewrite_runs WHERE id='r-success'`).run(),/terminal clean rewrite ledger cannot be deleted/));
check('terminal no-op UPDATE allowed',()=>{
  const before=db.prepare(`SELECT * FROM backup_clean_rewrite_runs WHERE id='r-success'`).get();
  assert.equal(Number(db.prepare(`UPDATE backup_clean_rewrite_runs SET status=status,error=error,updated_at=updated_at WHERE id='r-success'`).run().changes),1);
  const after=db.prepare(`SELECT * FROM backup_clean_rewrite_runs WHERE id='r-success'`).get();
  assert.deepEqual({...after},{...before});
});
check('terminal INSERT OR REPLACE rejected with recursive_triggers=0',()=>{
  const before=db.prepare(`SELECT * FROM backup_clean_rewrite_runs WHERE id='r-failed'`).get();
  assert.throws(()=>db.prepare(`INSERT OR REPLACE INTO backup_clean_rewrite_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(...row('r-failed','failed').map((v,i)=>i===8?'replaced':v)),/terminal clean rewrite ledger cannot be replaced/);
  const after=db.prepare(`SELECT * FROM backup_clean_rewrite_runs WHERE id='r-failed'`).get();
  assert.deepEqual({...after},{...before});
});
check('normal running to terminal transition remains allowed by Build210 guard',()=>{
  assert.equal(Number(db.prepare(`UPDATE backup_clean_rewrite_runs SET status='failed',next_attempt_at='2026-08-01T02:00:00.000Z',error='runtime',completed_at='2026-08-01T01:00:00.000Z',updated_at='2026-08-01T01:00:00.000Z' WHERE id='r-running'`).run().changes),1);
  const current=db.prepare(`SELECT status,completed_at FROM backup_clean_rewrite_runs WHERE id='r-running'`).get();
  assert.equal(current.status,'failed');assert.equal(current.completed_at,'2026-08-01T01:00:00.000Z');
});
check('new running row insert remains allowed',()=>{
  db.prepare(insert).run(...row('r-new','running'));
  assert.equal(Number(db.prepare(`SELECT COUNT(*) count FROM backup_clean_rewrite_runs WHERE id='r-new'`).get().count),1);
});
check('three Build210 triggers registered',()=>assert.equal(Number(db.prepare(`SELECT COUNT(*) count FROM sqlite_master WHERE type='trigger' AND name IN ('trg_backup_clean_rewrite_runs_terminal_immutable_update','trg_backup_clean_rewrite_runs_terminal_immutable_delete','trg_backup_clean_rewrite_runs_terminal_replace_guard')`).get().count),3));
check('migration 49 registered',()=>assert.match(source,/createMigrationDefinition\(49, 'clean_backup_rewrite_terminal_ledger_immutability'/));
check('schema generation updated',()=>assert.equal(db.prepare(`SELECT value FROM database_metadata WHERE key='schema_generation'`).get().value,'REVISION-210-CLEAN-BACKUP-TERMINAL-LEDGER-IMMUTABILITY'));
db.close();

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:210,applicationVersion:'01.08.2026.210',packageVersion:'1.8.2026-210',status:'PASS',passed:checks.length,total:checks.length,checks,limitations:['Targeted in-memory node:sqlite verification. Existing Build197+ terminal-transition triggers are covered by their historical regressions; this test proves the new Build210 guard does not itself block running→terminal.','Full workspace, Electron and Windows packaging are not executed by this targeted test.'],generatedAt:new Date().toISOString()};
await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Build 210 terminal ledger immutability SQLite: PASS (${checks.length}/${checks.length})`);
