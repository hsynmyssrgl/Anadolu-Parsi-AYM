import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp44-repository-'));
const databasePath = join(directory, 'family.db');
let store;
try {
  store = new FamilyDataStore({
    databasePath,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'migration-backups'),
    ...createArchivePolicyTestOptions()
  });
  store.setupAdmin({ displayName: 'Repository Test', email: 'repo@example.com', password: 'GucluRepositoryParolasi123!' });
  const before = (await store.getSnapshot()).people.length;
  const mutation = store.createMember({
    displayName: 'Transactional Üye',
    birthDate: '1992-05-09',
    relationshipType: 'Kuzen',
    generation: 4,
    branch: 'Repository Dalı'
  });
  assert.equal(mutation.person?.displayName, 'Transactional Üye');
  assert.equal((await store.getSnapshot()).people.length, before + 1);
  store.close(); store = undefined;

  const probe = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const person = probe.prepare("SELECT id FROM people WHERE display_name='Transactional Üye'").get();
    assert.ok(person);
    const audit = probe.prepare("SELECT resource_id,entry_hash FROM audit_log WHERE action='member.created' ORDER BY rowid DESC LIMIT 1").get();
    assert.equal(audit.resource_id, person.id);
    assert.equal(String(audit.entry_hash).length, 64);
    const outbox = probe.prepare("SELECT aggregate_id,event_type,status,payload_json,headers_json FROM event_outbox WHERE aggregate_id=?").get(person.id);
    assert.equal(outbox.event_type, 'family.member.created');
    assert.equal(outbox.status, 'pending');
    assert.equal(JSON.parse(outbox.payload_json).personId, person.id);
    assert.ok(JSON.parse(outbox.headers_json).correlationId);
    assert.equal(Number(probe.prepare('SELECT COUNT(*) AS count FROM event_handler_receipts').get().count), 0);
  } finally { probe.close(); }
  const report = { status:'passed', checks:10, version:ACTIVE_BUILD_META.applicationVersion, milestone:ACTIVE_BUILD_META.milestone };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/REPOSITORY_OUTBOX_VERIFICATION_MVP56.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive:true, force:true });
}
