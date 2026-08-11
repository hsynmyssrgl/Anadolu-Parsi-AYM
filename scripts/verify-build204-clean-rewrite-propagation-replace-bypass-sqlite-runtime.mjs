import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const outputPath = resolve(process.argv[2] ?? 'artifacts/validation/build204-clean-rewrite-propagation-replace-bypass-sqlite-runtime.json');
const source = await readFile('packages/database/src/family-database-migrations.ts', 'utf8');
const extract = (name) => {
  const match = new RegExp('const ' + name + ' = `([\\s\\S]*?)`;', 'm').exec(source);
  assert.ok(match, `${name} exists`);
  return match[1];
};
const permanenceSql = extract('cleanBackupRewritePropagationReferencePermanenceSql');
const immutabilitySql = extract('cleanBackupRewritePropagationReferencedEvidenceImmutabilitySql');
const protectionSql = extract('cleanBackupRewritePropagationReplaceBypassProtectionSql');
const schema = `
CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
INSERT INTO database_metadata VALUES('schema_generation','BASE','2026-08-01T00:00:00.000Z');
CREATE TABLE backup_propagation_runs (
 id TEXT PRIMARY KEY,status TEXT NOT NULL,pending_records INTEGER NOT NULL,target_count INTEGER NOT NULL,
 refreshed_targets INTEGER NOT NULL,quarantined_artifacts INTEGER NOT NULL,pending_remaining INTEGER NOT NULL,
 manual_backup_warning INTEGER NOT NULL,target_results TEXT NOT NULL,error TEXT,started_at TEXT NOT NULL,completed_at TEXT NOT NULL
);
CREATE TABLE backup_clean_rewrite_runs(id TEXT PRIMARY KEY,status TEXT NOT NULL,propagation_run_id TEXT);
`;
const insert = `INSERT INTO backup_propagation_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`;
const seed = (db) => {
  db.prepare(insert).run('p-linked','success',3,2,2,0,0,0,'[]',null,'2026-08-01T00:00:00.000Z','2026-08-01T00:01:00.000Z');
  db.prepare(insert).run('p-free','failed',1,1,0,0,1,1,'[]','network','2026-08-01T00:02:00.000Z','2026-08-01T00:03:00.000Z');
  db.prepare(`INSERT INTO backup_clean_rewrite_runs VALUES('r-linked','success','p-linked')`).run();
};
const replacementArgs = ['p-linked','failed',99,9,0,9,99,1,'[{"tampered":true}]','rewritten','2020-01-01','2020-01-02'];
const checks=[];
const check=(label,fn)=>{fn();checks.push(label);console.log('PASS',label);};

const baseline = new DatabaseSync(':memory:');
baseline.exec(schema + permanenceSql + immutabilitySql);
seed(baseline);
check('SQLite recursive triggers are disabled in baseline',()=>assert.equal(Number(baseline.prepare('PRAGMA recursive_triggers').get().recursive_triggers),0));
check('Build 203 baseline permits INSERT OR REPLACE bypass',()=>{
  baseline.prepare(`INSERT OR REPLACE INTO backup_propagation_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(...replacementArgs);
  assert.equal(baseline.prepare(`SELECT status FROM backup_propagation_runs WHERE id='p-linked'`).get().status,'failed');
});
baseline.close();

const db = new DatabaseSync(':memory:');
db.exec(schema + permanenceSql + immutabilitySql + protectionSql);
seed(db);
check('referenced propagation INSERT OR REPLACE rejected',()=>assert.throws(()=>db.prepare(`INSERT OR REPLACE INTO backup_propagation_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(...replacementArgs),/cannot be replaced/));
check('referenced propagation evidence remains unchanged',()=>{
  const row=db.prepare(`SELECT status,pending_records,target_results,error,started_at,completed_at FROM backup_propagation_runs WHERE id='p-linked'`).get();
  assert.deepEqual({...row},{status:'success',pending_records:3,target_results:'[]',error:null,started_at:'2026-08-01T00:00:00.000Z',completed_at:'2026-08-01T00:01:00.000Z'});
});
check('unreferenced propagation INSERT OR REPLACE remains allowed',()=>{
  db.prepare(`INSERT OR REPLACE INTO backup_propagation_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run('p-free','attention',2,1,0,0,2,1,'[]','review','2026-08-01T00:04:00.000Z','2026-08-01T00:05:00.000Z');
  assert.equal(db.prepare(`SELECT status FROM backup_propagation_runs WHERE id='p-free'`).get().status,'attention');
});
check('new propagation insert remains allowed',()=>{
  db.prepare(insert).run('p-new','success',0,1,1,0,0,0,'[]',null,'2026-08-01T00:06:00.000Z','2026-08-01T00:07:00.000Z');
  assert.equal(Number(db.prepare(`SELECT COUNT(*) count FROM backup_propagation_runs WHERE id='p-new'`).get().count),1);
});
check('Build 204 trigger registered',()=>assert.equal(Number(db.prepare(`SELECT COUNT(*) count FROM sqlite_master WHERE type='trigger' AND name='trg_backup_propagation_runs_clean_rewrite_reference_insert'`).get().count),1));
check('migration 48 registered',()=>assert.match(source,/createMigrationDefinition\(48, 'clean_backup_rewrite_propagation_replace_bypass_protection'/));
check('schema generation updated',()=>assert.equal(db.prepare(`SELECT value FROM database_metadata WHERE key='schema_generation'`).get().value,'REVISION-204-CLEAN-BACKUP-PROPAGATION-REPLACE-BYPASS-PROTECTION'));
db.close();

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:204,applicationVersion:'01.08.2026.204',packageVersion:'1.8.2026-204',status:'PASS',passed:checks.length,total:checks.length,checks,limitations:['In-memory node:sqlite targeted verification; full workspace, Electron and Windows packaging are not executed.'],generatedAt:new Date().toISOString()};
await mkdir(dirname(outputPath),{recursive:true});
await writeFile(outputPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Build 204 propagation REPLACE bypass SQLite: PASS (${checks.length}/${checks.length})`);
