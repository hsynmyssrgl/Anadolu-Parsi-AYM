import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  ERROR_CODES,
  FixedClock,
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok
} from '../packages/core/dist/index.js';
import { SqliteTransactionExecutor } from '../packages/database/dist/index.js';
import {
  SqliteAuditRepository,
  SqliteOutboxRepository,
  SqlitePersonRepository
} from '../packages/repositories/dist/index.js';

const database = new DatabaseSync(':memory:');
database.exec(`
  PRAGMA foreign_keys=ON;
  CREATE TABLE people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,display_name TEXT NOT NULL,birth_date TEXT,relationship_type TEXT NOT NULL,generation INTEGER NOT NULL,branch TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL) STRICT;
  CREATE TABLE audit_log(id TEXT PRIMARY KEY,action TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,occurred_at TEXT NOT NULL,actor_id TEXT,prev_hash TEXT,entry_hash TEXT,sequence_no INTEGER,hash_version INTEGER NOT NULL DEFAULT 1,correlation_id TEXT) STRICT;
  CREATE TABLE event_outbox(id TEXT PRIMARY KEY,event_type TEXT NOT NULL,event_version INTEGER NOT NULL,aggregate_type TEXT NOT NULL,aggregate_id TEXT NOT NULL,payload_json TEXT NOT NULL,headers_json TEXT NOT NULL,occurred_at TEXT NOT NULL,available_at TEXT NOT NULL,status TEXT NOT NULL,attempt_count INTEGER NOT NULL DEFAULT 0,published_at TEXT,last_error_code TEXT,last_error_message TEXT) STRICT;
`);
const occurredAt = asIsoDateTime('2026-07-23T18:00:00.000Z');
const correlationId = asCorrelationId('atomicity-test');
const actorId = asUserId('account-test');
const executor = new SqliteTransactionExecutor(database, new FixedClock(occurredAt));
const people = new SqlitePersonRepository();
const audit = new SqliteAuditRepository();
const outbox = new SqliteOutboxRepository();

const personId = asPersonId(randomUUID());
const success = executor.execute(correlationId, (transaction) => {
  const context = { transaction: transaction.database, actor: { userId: actorId, roles: ['family_admin'] }, correlationId, occurredAt };
  const inserted = people.insert(context, { id: personId, familyId: asFamilyId('family-main'), displayName: 'Atomik Üye', relationshipType: 'Kuzen', generation: 4, branch: 'Test', status: 'active', createdAt: occurredAt });
  if (!inserted.ok) return inserted;
  const audited = audit.append(context, { id: randomUUID(), action: 'member.created', resourceType: 'person', resourceId: personId, occurredAt, actorId });
  if (!audited.ok) return audited;
  return outbox.enqueue(context, { eventId: asEventId(randomUUID()), eventType: 'family.member.created', eventVersion: 1, aggregateType: 'person', aggregateId: personId, occurredAt, actorId, correlationId, payload: { personId } });
});
assert.equal(success.ok, true);
assert.equal(Number(database.prepare('SELECT COUNT(*) count FROM people').get().count), 1);
assert.equal(Number(database.prepare('SELECT COUNT(*) count FROM audit_log').get().count), 1);
assert.equal(Number(database.prepare('SELECT COUNT(*) count FROM event_outbox').get().count), 1);

const rollbackPersonId = asPersonId(randomUUID());
const failure = executor.execute(correlationId, (transaction) => {
  const context = { transaction: transaction.database, actor: { userId: actorId, roles: ['family_admin'] }, correlationId, occurredAt };
  const inserted = people.insert(context, { id: rollbackPersonId, familyId: asFamilyId('family-main'), displayName: 'Rollback Üye', relationshipType: 'Kuzen', generation: 4, branch: 'Test', status: 'active', createdAt: occurredAt });
  if (!inserted.ok) return inserted;
  const audited = audit.append(context, { id: randomUUID(), action: 'member.created', resourceType: 'person', resourceId: rollbackPersonId, occurredAt, actorId });
  if (!audited.ok) return audited;
  return err(createAppError({ code: ERROR_CODES.EVENT_HANDLER_FAILED, message: 'Test rollback.', category: 'infrastructure', correlationId }));
});
assert.equal(failure.ok, false);
assert.equal(Number(database.prepare('SELECT COUNT(*) count FROM people WHERE id=?').get(rollbackPersonId).count), 0);
assert.equal(Number(database.prepare('SELECT COUNT(*) count FROM audit_log WHERE resource_id=?').get(rollbackPersonId).count), 0);
assert.equal(Number(database.prepare('SELECT COUNT(*) count FROM event_outbox WHERE aggregate_id=?').get(rollbackPersonId).count), 0);
database.close();
const report = { status:'passed', checks:9, version:ACTIVE_BUILD_META.applicationVersion, milestone:ACTIVE_BUILD_META.milestone, atomicCommit:true, atomicRollback:true };
mkdirSync('artifacts/manifests', { recursive: true });
writeFileSync('artifacts/manifests/TRANSACTIONAL_ATOMICITY_VERIFICATION_MVP56.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
