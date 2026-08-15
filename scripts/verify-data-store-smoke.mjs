import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp44-smoke-'));
const databasePath = join(directory, 'family.db');
const backupPath = join(directory, 'backup.pptbackup');
const backupPasswordPath = join(directory, 'managed-backup-password.json');
const backupSecretProtector = Object.freeze({
  protectionId: 'data-store-smoke-protector-v1',
  required: false,
  isAvailable: () => true,
  protect: (secret) => Buffer.from(`smoke:${secret}`, 'utf8').toString('base64'),
  unprotect: (protectedBase64) => {
    const value = Buffer.from(protectedBase64, 'base64').toString('utf8');
    if (!value.startsWith('smoke:')) throw new Error('Smoke yedek parola zarfı geçersiz.');
    return value.slice('smoke:'.length);
  }
});
let store;
let migrationSummary;
const policyOptions = createArchivePolicyTestOptions();
try {
  store = new FamilyDataStore({
    databasePath,
    backupSecretProtector,
    backupPasswordPath,
    applicationVersion: '24.07.2026.60',
    migrationBackupDirectory: join(directory, 'migration-backups'),
    onMigrationCompleted: (summary) => { migrationSummary = summary; },
    ...policyOptions
  });
  assert.ok(migrationSummary, 'Migration özeti üretilmedi.');
  assert.deepEqual(migrationSummary.appliedVersions, Array.from({ length: 107 }, (_unused, index) => index + 1));
  assert.equal(migrationSummary.schemaAfter.tableCount, 181);

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
  assert.equal(existsSync(backupPath), true, 'Cihaz korumalı .pptbackup yedeği oluşturulamadı.');
  const backupBytes = readFileSync(backupPath);
  assert.equal(backupBytes.subarray(0, 16).toString('utf8').includes('SQLite format 3'), false, 'Ham SQLite başlığı yedek hedefinde açığa çıktı.');
  const backupContainer = JSON.parse(backupBytes.toString('utf8'));
  assert.equal(backupContainer.format, 'anadolu-parsi-full-backup');
  assert.equal(backupContainer.version, 3);
  assert.equal(backupContainer.encryption?.algorithm, 'aes-256-gcm');
  assert.equal(typeof backupContainer.ciphertext, 'string');
  assert.equal(Object.hasOwn(backupContainer, 'database'), false, 'Yedek kapsayıcısı plaintext veritabanı alanı taşıyor.');
  store.close();
  store = undefined;

  const probe = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const migrations = probe.prepare('SELECT version,success FROM schema_migrations ORDER BY version').all();
    assert.equal(migrations.length, 107, 'Migration kayıtları eksik.');
    assert.equal(migrations.every((row) => Number(row.success) === 1), true, 'Başarısız migration kaydı bulundu.');
    assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='database_metadata'").get()), true);
    assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='local_governed_ocr_source_deletion_recovery_intents'").get()), true);
    assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='archive_legacy_ownership_reattestations'").get()), true);
    assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='archive_relation_evidence'").get()), true);
    assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='archive_relation_evidence_mutations'").get()), true);
    for (const tableName of ['health_care_mutations', 'health_care_centers', 'health_care_entries', 'health_care_access_grants']) {
      assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?").get(tableName)), true);
    }
    for (const tableName of ['household_operation_mutations', 'household_operations_centers', 'household_operation_items']) {
      assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?").get(tableName)), true);
    }
    for (const tableName of ['child_education_mutations', 'child_education_items']) {
      assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?").get(tableName)), true);
    }
    for (const tableName of ['signed_plugin_mutations', 'signed_plugin_releases', 'signed_plugin_installations']) {
      assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?").get(tableName)), true);
    }
    for (const tableName of ['communication_security_mutations', 'communication_device_credentials', 'communication_mls_epochs', 'communication_rooms', 'communication_room_memberships']) {
      assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?").get(tableName)), true);
    }
    for (const tableName of ['communication_messaging_mutations', 'communication_messages', 'communication_message_events', 'communication_delivery_queue', 'communication_presence_profiles', 'communication_retention_policies']) {
      assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?").get(tableName)), true);
    }
    for (const tableName of ['communication_call_mutations', 'communication_call_sessions', 'communication_call_participants',
      'communication_call_events', 'communication_call_preferences', 'communication_call_quality_observations']) {
      assert.equal(Boolean(probe.prepare("SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name=?").get(tableName)), true);
    }
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
