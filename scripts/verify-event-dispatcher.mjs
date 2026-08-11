import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ERROR_CODES,
  FixedClock,
  asCorrelationId,
  asEventId,
  asIsoDateTime,
  createAppError,
  err,
  ok
} from '../packages/core/dist/index.js';
import {
  EventDispatcher,
  createExponentialRetryPolicy
} from '../packages/events/dist/index.js';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';

const checks = [];
const verify = async (name, operation) => {
  await operation();
  checks.push(name);
};

await verify('DataStore publishes member event and writes two receipts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp45-dispatcher-'));
  const databasePath = join(directory, 'family.db');
  let store;
  try {
    store = new FamilyDataStore({
      databasePath,
      applicationVersion: ACTIVE_BUILD_META.applicationVersion,
      migrationBackupDirectory: join(directory, 'migration-backups')
    });
    store.setupAdmin({
      displayName: 'Dispatcher Test',
      email: 'dispatcher@example.com',
      password: 'GucluDispatcherParolasi123!'
    });
    store.createMember({
      displayName: 'Event Üyesi',
      relationshipType: 'Kuzen',
      generation: 4,
      branch: 'Event Dalı'
    });
    const first = await store.dispatchPendingEvents();
    assert.equal(first.claimed, 1);
    assert.equal(first.published, 1);
    assert.equal(first.successfulHandlers, 2);
    const second = await store.dispatchPendingEvents();
    assert.equal(second.claimed, 0);
    store.close();
    store = undefined;

    const probe = new DatabaseSync(databasePath);
    try {
      const event = probe.prepare("SELECT id,status,attempt_count,published_at,processing_started_at FROM event_outbox WHERE event_type='family.member.created'").get();
      assert.equal(event.status, 'published');
      assert.equal(Number(event.attempt_count), 1);
      assert.ok(event.published_at);
      assert.equal(event.processing_started_at, null);
      assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM event_handler_receipts WHERE event_id=? AND outcome=\'success\'').get(event.id).count), 2);
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM diagnostic_entries WHERE code='family.member.created'").get().count), 1);

      probe.prepare("UPDATE event_outbox SET status='pending',published_at=NULL,available_at='2026-07-23T00:00:00.000Z' WHERE id=?").run(event.id);
    } finally {
      probe.close();
    }

    store = new FamilyDataStore({
      databasePath,
      applicationVersion: ACTIVE_BUILD_META.applicationVersion,
      migrationBackupDirectory: join(directory, 'migration-backups')
    });
    const replay = await store.dispatchPendingEvents();
    assert.equal(replay.claimed, 1);
    assert.equal(replay.published, 1);
    assert.equal(replay.skippedHandlers, 2);
    store.close();
    store = undefined;

    const replayProbe = new DatabaseSync(databasePath);
    let replayEventId;
    try {
      assert.equal(Number(replayProbe.prepare("SELECT COUNT(*) count FROM diagnostic_entries WHERE code='family.member.created'").get().count), 1);
      replayEventId = replayProbe.prepare("SELECT id FROM event_outbox WHERE event_type='family.member.created'").get().id;
      replayProbe.prepare(`
        UPDATE event_outbox SET
          status='processing',published_at=NULL,
          processing_started_at='2020-01-01T00:00:00.000Z'
        WHERE id=?
      `).run(replayEventId);
    } finally {
      replayProbe.close();
    }

    store = new FamilyDataStore({
      databasePath,
      applicationVersion: ACTIVE_BUILD_META.applicationVersion,
      migrationBackupDirectory: join(directory, 'migration-backups')
    });
    const recovered = await store.dispatchPendingEvents();
    assert.equal(recovered.claimed, 1);
    assert.equal(recovered.published, 1);
    assert.equal(recovered.skippedHandlers, 2);
    store.close();
    store = undefined;

    const recoveryProbe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const recoveredEvent = recoveryProbe.prepare('SELECT status,processing_started_at,attempt_count FROM event_outbox WHERE id=?').get(replayEventId);
      assert.equal(recoveredEvent.status, 'published');
      assert.equal(recoveredEvent.processing_started_at, null);
      assert.equal(Number(recoveredEvent.attempt_count), 3);
      assert.equal(Number(recoveryProbe.prepare("SELECT COUNT(*) count FROM diagnostic_entries WHERE code='family.member.created'").get().count), 1);
    } finally {
      recoveryProbe.close();
    }
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

await verify('dispatcher retries retryable handler then publishes', async () => {
  const now = asIsoDateTime('2026-07-23T20:00:00.000Z');
  const correlationId = asCorrelationId('dispatcher-retry-test');
  const eventId = asEventId('event-retry');
  const entry = {
    eventId,
    eventType: 'test.retry',
    eventVersion: 1,
    aggregateType: 'test',
    aggregateId: 'aggregate-retry',
    occurredAt: now,
    availableAt: now,
    status: 'pending',
    attemptCount: 0,
    correlationId,
    payload: {}
  };
  const receipts = new Map();
  let handlerCalls = 0;
  const store = {
    claimPending: () => {
      if (entry.status !== 'pending') return ok([]);
      entry.status = 'processing';
      entry.attemptCount += 1;
      return ok([{ ...entry }]);
    },
    hasSuccessfulReceipt: ({ eventId: id, handlerName }) => ok(receipts.get(`${id}:${handlerName}`)?.outcome === 'success'),
    recordReceipt: ({ receipt }) => { receipts.set(`${receipt.eventId}:${receipt.handlerName}`, receipt); return ok(undefined); },
    markPublished: () => { entry.status = 'published'; return ok(undefined); },
    reschedule: ({ availableAt }) => { entry.status = 'pending'; entry.availableAt = availableAt; return ok(undefined); },
    markFailed: () => { entry.status = 'failed'; return ok(undefined); }
  };
  const dispatcher = new EventDispatcher({
    store,
    clock: new FixedClock(now),
    retryPolicy: createExponentialRetryPolicy({ maximumAttempts: 3, baseDelayMs: 0, maximumDelayMs: 0 }),
    handlers: [{
      name: 'retry-once-v1',
      eventType: 'test.retry',
      handle: async () => {
        handlerCalls += 1;
        return handlerCalls === 1
          ? err(createAppError({
            code: ERROR_CODES.EVENT_HANDLER_FAILED,
            message: 'Geçici test hatası.',
            category: 'infrastructure',
            retryable: true,
            correlationId
          }))
          : ok(undefined);
      }
    }]
  });
  const first = await dispatcher.dispatchBatch({ correlationId });
  assert.equal(first.ok, true);
  assert.equal(first.value.retried, 1);
  assert.equal(entry.status, 'pending');
  const second = await dispatcher.dispatchBatch({ correlationId });
  assert.equal(second.ok, true);
  assert.equal(second.value.published, 1);
  assert.equal(entry.status, 'published');
  assert.equal(entry.attemptCount, 2);
  assert.equal(handlerCalls, 2);

  entry.status = 'pending';
  const replay = await dispatcher.dispatchBatch({ correlationId });
  assert.equal(replay.ok, true);
  assert.equal(replay.value.skippedHandlers, 1);
  assert.equal(handlerCalls, 2);
});

await verify('dispatcher permanently fails non-retryable handler', async () => {
  const now = asIsoDateTime('2026-07-23T21:00:00.000Z');
  const correlationId = asCorrelationId('dispatcher-failure-test');
  const entry = {
    eventId: asEventId('event-failure'), eventType: 'test.failure', eventVersion: 1,
    aggregateType: 'test', aggregateId: 'failed', occurredAt: now, availableAt: now,
    status: 'pending', attemptCount: 0, correlationId, payload: {}
  };
  const store = {
    claimPending: () => { if (entry.status !== 'pending') return ok([]); entry.status='processing'; entry.attemptCount += 1; return ok([{...entry}]); },
    hasSuccessfulReceipt: () => ok(false),
    recordReceipt: () => ok(undefined),
    markPublished: () => { entry.status='published'; return ok(undefined); },
    reschedule: () => { entry.status='pending'; return ok(undefined); },
    markFailed: () => { entry.status='failed'; return ok(undefined); }
  };
  const dispatcher = new EventDispatcher({
    store,
    clock: new FixedClock(now),
    retryPolicy: createExponentialRetryPolicy({ maximumAttempts: 5, baseDelayMs: 1000, maximumDelayMs: 5000 }),
    handlers: [{
      name: 'permanent-failure-v1', eventType: 'test.failure',
      handle: async () => err(createAppError({
        code: ERROR_CODES.CONTRACT_INVALID,
        message: 'Kalıcı payload hatası.',
        category: 'validation',
        retryable: false,
        correlationId
      }))
    }]
  });
  const result = await dispatcher.dispatchBatch({ correlationId });
  assert.equal(result.ok, true);
  assert.equal(result.value.failed, 1);
  assert.equal(entry.status, 'failed');
});

const report = {
  status: 'passed',
  version: ACTIVE_BUILD_META.applicationVersion,
  milestone: ACTIVE_BUILD_META.milestone,
  checks: checks.length,
  scenarios: checks
};
mkdirSync('artifacts/manifests', { recursive: true });
writeFileSync('artifacts/manifests/EVENT_DISPATCHER_VERIFICATION_MVP56.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
