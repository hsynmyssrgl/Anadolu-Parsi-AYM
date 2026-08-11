import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp44-smoke-'));
const databasePath = join(directory, 'family.db');
const backupPath = join(directory, 'backup.db');
let store;
let migrationSummary;
const policyOptions = createArchivePolicyTestOptions();
try {
  store = new FamilyDataStore({
    databasePath,
    applicationVersion: '24.07.2026.60',
    migrationBackupDirectory: join(directory, 'migration-backups'),
    onMigrationCompleted: (summary) => { migrationSummary = summary; },
    ...policyOptions
  });
  assert.ok(migrationSummary, 'Migration özeti üretilmedi.');
  assert.deepEqual(migrationSummary.appliedVersions, Array.from({ length: 66 }, (_unused, index) => index + 1));
  assert.equal(migrationSummary.schemaAfter.tableCount, 79);

  const initialState = store.getAuthState();
  if (!initialState.initialized) {
    store.setupAdmin({
      displayName: 'Foundation Test Yöneticisi',
      email: 'foundation@example.com',
      password: 'GucluFoundationParolasi123!'
    });
  }
  const before = await store.getSnapshot();
  assert.ok(before.people.length >= 1, 'Yönetici aile üyesi okunamadı.');
  const mutation = store.createMember({
    displayName: 'Foundation Test Üyesi',
    birthDate: '1990-04-14',
    relationshipType: 'Kuzen',
    generation: 4,
    branch: 'Foundation Test Dalı'
  });
  assert.equal(mutation.person?.displayName, 'Foundation Test Üyesi', 'Sınırlı mutasyon sonucu kişi kaydını taşımıyor.');
  const after = await store.getSnapshot();
  assert.equal(after.people.length, before.people.length + 1, 'Aile üyesi kalıcı olarak eklenemedi.');
  store.exportBackup(backupPath);
  assert.equal(existsSync(backupPath), true, 'Yerel .db yedeği oluşturulamadı.');
  store.close();
  store = undefined;

  const probe = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const migrations = probe.prepare('SELECT version,success FROM schema_migrations ORDER BY version').all();
    assert.equal(migrations.length, 66, 'Migration kayıtları eksik.');
    assert.equal(migrations.every((row) => Number(row.success) === 1), true, 'Başarısız migration kaydı bulundu.');
    assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='database_metadata'").get()), true);
    const outbox = probe.prepare("SELECT event_type,aggregate_type,aggregate_id,status,attempt_count FROM event_outbox WHERE event_type='family.member.created' ORDER BY occurred_at DESC LIMIT 1").get();
    assert.ok(outbox, 'Aile üyesi olayı transactional outbox içine yazılmadı.');
    assert.equal(outbox.aggregate_type, 'person');
    assert.equal(outbox.status, 'pending');
    assert.equal(Number(outbox.attempt_count), 0);
    assert.equal(probe.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='member.created'").get().count >= 1, true);
  } finally {
    probe.close();
  }

  const report = {
    schemaVersion: 1,
    product: 'Panthera pardus tulliana',
    version: '24.07.2026.60',
    milestone: 'B064-M20 Backup Application Migration',
    status: 'passed',
    checks: 14,
    peopleBefore: before.people.length,
    peopleAfter: after.people.length,
    backupCreated: true,
    migrationVersions: migrationSummary.appliedVersions,
    schemaFingerprint: migrationSummary.schemaAfter.fingerprint
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/DATA_STORE_SMOKE_MVP60.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
