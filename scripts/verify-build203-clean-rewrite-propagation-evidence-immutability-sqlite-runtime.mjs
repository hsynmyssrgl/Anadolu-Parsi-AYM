import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const outputPath = resolve(process.argv[2] ?? 'artifacts/validation/build203-clean-rewrite-propagation-evidence-immutability-sqlite-runtime.json');
const source = await readFile('packages/database/src/family-database-migrations.ts', 'utf8');
const match = /const cleanBackupRewritePropagationReferencedEvidenceImmutabilitySql = `([\s\S]*?)`;/m.exec(source);
assert.ok(match, 'Build 203 migration SQL exists');

const schema = `
CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
INSERT INTO database_metadata VALUES('schema_generation','BASE','2026-08-01T00:00:00.000Z');
CREATE TABLE backup_propagation_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  pending_records INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  refreshed_targets INTEGER NOT NULL,
  quarantined_artifacts INTEGER NOT NULL,
  pending_remaining INTEGER NOT NULL,
  manual_backup_warning INTEGER NOT NULL,
  target_results TEXT NOT NULL,
  error TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
CREATE TABLE backup_clean_rewrite_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  propagation_run_id TEXT
);
`;
const insertPropagation = `INSERT INTO backup_propagation_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`;
const makeDb = (withBuild203) => {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  if (withBuild203) db.exec(match[1]);
  db.prepare(insertPropagation).run(
    'p-linked','success',12,3,3,1,0,1,
    '[{"target":"local","status":"success"}]',null,
    '2026-08-01T00:00:00.000Z','2026-08-01T00:01:00.000Z'
  );
  db.prepare(insertPropagation).run(
    'p-free','failed',4,2,1,0,3,1,
    '[{"target":"cloud","status":"failed"}]','network',
    '2026-08-01T00:02:00.000Z','2026-08-01T00:03:00.000Z'
  );
  db.prepare(`INSERT INTO backup_clean_rewrite_runs VALUES('r-linked','success','p-linked')`).run();
  return db;
};

const checks = [];
const check = (label, fn) => { fn(); checks.push(label); console.log('PASS', label); };

const baseline = makeDb(false);
check('Build 202 baseline allows referenced status mutation', () => {
  assert.equal(Number(baseline.prepare(`UPDATE backup_propagation_runs SET status='partial' WHERE id='p-linked'`).run().changes), 1);
});
baseline.close();

const db = makeDb(true);
const reject = (label, sql, expected = /evidence cannot change/) => check(label, () => assert.throws(() => db.prepare(sql).run(), expected));
reject('referenced status mutation rejected', `UPDATE backup_propagation_runs SET status='partial' WHERE id='p-linked'`);
reject('referenced pending_records mutation rejected', `UPDATE backup_propagation_runs SET pending_records=13 WHERE id='p-linked'`);
reject('referenced target_count mutation rejected', `UPDATE backup_propagation_runs SET target_count=4 WHERE id='p-linked'`);
reject('referenced refreshed_targets mutation rejected', `UPDATE backup_propagation_runs SET refreshed_targets=2 WHERE id='p-linked'`);
reject('referenced quarantined_artifacts mutation rejected', `UPDATE backup_propagation_runs SET quarantined_artifacts=2 WHERE id='p-linked'`);
reject('referenced pending_remaining mutation rejected', `UPDATE backup_propagation_runs SET pending_remaining=1 WHERE id='p-linked'`);
reject('referenced manual warning mutation rejected', `UPDATE backup_propagation_runs SET manual_backup_warning=0 WHERE id='p-linked'`);
reject('referenced target results mutation rejected', `UPDATE backup_propagation_runs SET target_results='[]' WHERE id='p-linked'`);
reject('referenced error mutation rejected', `UPDATE backup_propagation_runs SET error='rewritten' WHERE id='p-linked'`);
reject('referenced started_at mutation rejected', `UPDATE backup_propagation_runs SET started_at='2026-08-01T00:00:01.000Z' WHERE id='p-linked'`);
reject('referenced completed_at mutation rejected', `UPDATE backup_propagation_runs SET completed_at='2026-08-01T00:01:01.000Z' WHERE id='p-linked'`);
check('referenced no-op evidence update allowed', () => {
  assert.equal(Number(db.prepare(`UPDATE backup_propagation_runs SET status=status,pending_records=pending_records,target_results=target_results WHERE id='p-linked'`).run().changes), 1);
});
check('unreferenced evidence update allowed', () => {
  assert.equal(Number(db.prepare(`UPDATE backup_propagation_runs SET status='attention',error='reviewed',pending_remaining=2 WHERE id='p-free'`).run().changes), 1);
  const row = db.prepare(`SELECT status,error,pending_remaining FROM backup_propagation_runs WHERE id='p-free'`).get();
  assert.equal(row.status, 'attention');
  assert.equal(row.error, 'reviewed');
  assert.equal(Number(row.pending_remaining), 2);
});
check('Build 203 trigger registered', () => {
  assert.equal(Number(db.prepare(`SELECT COUNT(*) count FROM sqlite_master WHERE type='trigger' AND name='trg_backup_propagation_runs_clean_rewrite_reference_evidence_update'`).get().count), 1);
});
check('migration 47 registered', () => {
  assert.match(source, /createMigrationDefinition\(47, 'clean_backup_rewrite_propagation_referenced_evidence_immutability'/);
});
check('schema generation updated', () => {
  assert.equal(db.prepare(`SELECT value FROM database_metadata WHERE key='schema_generation'`).get().value, 'REVISION-203-CLEAN-BACKUP-PROPAGATION-REFERENCED-EVIDENCE-IMMUTABILITY');
});
db.close();

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 203,
  applicationVersion: '01.08.2026.203',
  packageVersion: '1.8.2026-203',
  status: 'PASS',
  passed: checks.length,
  total: checks.length,
  checks,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 203 propagation evidence immutability SQLite: PASS (${checks.length}/${checks.length})`);
