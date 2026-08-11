import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 local continuation verifier must run from ${expectedRoot}; received ${root}`);
}

const runtimeRoot = resolve(root, '.tmp', 'ppk002-runtime');
mkdirSync(runtimeRoot, { recursive: true });
const databasePath = join(runtimeRoot, `timeline-policy-${Date.now()}.db`);
const receipts = [];
const checks = [];
const check = async (name, operation) => {
  await operation();
  checks.push(name);
};
const store = new FamilyDataStore({
  databasePath,
  applicationVersion: ACTIVE_BUILD_META.applicationVersion,
  migrationBackupDirectory: runtimeRoot,
  clock: new FixedClock(asIsoDateTime('2026-07-23T12:00:00.000Z')),
  ...createArchivePolicyTestOptions(receipts)
});

let event;
let location;
let ownerPersonId;
try {
  store.setupAdmin({
    displayName: 'PPK-002 Local Continuation Admin',
    email: 'ppk002-local-continuation@example.com',
    password: 'PPK002-Local-Continuation!2026'
  });
  const seed = await store.getSnapshot();
  ownerPersonId = seed.people[0].id;
  await check('legacy receiptless timeline rows are absent from the governed application snapshot', () => {
    assert.deepEqual(seed.events, []);
  });
  location = (await store.createLocation({
    label: 'PPK-002 Governed Source Location',
    address: 'Ankara',
    kind: 'venue'
  })).location;
  event = (await store.createEvent({
    title: 'PPK-002 governed timeline event',
    startAt: '2026-08-11T09:00:00.000Z',
    locationId: location.id,
    visibility: 'family',
    participantPersonIds: [ownerPersonId],
    aiProcessingAllowed: false,
    recurrence: 'none',
    reminderDays: [1]
  })).event;
  await check('governed event create is visible through the policy-filtered application read model', async () => {
    const snapshot = await store.getSnapshot();
    assert.equal(snapshot.events.some((candidate) => candidate.id === event.id), true);
  });
  await check('unknown exact event is denied before resource existence disclosure', async () => {
    await assert.rejects(() => store.getImportantDayDetails('ppk002-missing-event'), /PERMISSION-DENIED-001/);
  });
} finally {
  store.close();
}

const database = new DatabaseSync(databasePath);
try {
  const governed = database.prepare(`SELECT id,family_id,owner_person_id,timeline_policy_receipt_hash,
    source_location_receipt_hash FROM governed_timeline_events WHERE id=?`).get(event.id);
  await check('governed view exposes the exact event receipt and source-location receipt bindings', () => {
    assert.equal(governed?.id, event.id);
    assert.equal(governed?.owner_person_id, ownerPersonId);
    assert.match(String(governed?.timeline_policy_receipt_hash), /^[0-9a-f]{64}$/u);
    assert.match(String(governed?.source_location_receipt_hash), /^[0-9a-f]{64}$/u);
  });

  const eventReceipt = database.prepare(`SELECT receipt_hash,fence_name,resource_type,resource_id,action,capability,
    json_extract(record_json,'$.request.resource.familyId') family_id,
    json_extract(record_json,'$.request.resource.ownerPersonId') owner_person_id,
    json_extract(record_json,'$.request.resource.sourceResourceId') source_resource_id,
    json_extract(record_json,'$.request.resource.sensitivity') sensitivity,
    json_extract(record_json,'$.request.purpose') purpose
    FROM platform_policy_transaction_receipts WHERE receipt_hash=?`).get(governed.timeline_policy_receipt_hash);
  await check('event row is bound to an exact writable timeline policy receipt', () => {
    assert.deepEqual({
      fence: eventReceipt.fence_name,
      type: eventReceipt.resource_type,
      id: eventReceipt.resource_id,
      action: eventReceipt.action,
      capability: eventReceipt.capability,
      familyId: eventReceipt.family_id,
      ownerPersonId: eventReceipt.owner_person_id,
      sourceResourceId: eventReceipt.source_resource_id,
      sensitivity: eventReceipt.sensitivity,
      purpose: eventReceipt.purpose
    }, {
      fence: 'timeline-event-write', type: 'event', id: event.id, action: 'create',
      capability: 'family.write', familyId: 'family-main', ownerPersonId,
      sourceResourceId: location.id, sensitivity: 'personal', purpose: 'general'
    });
  });

  const sourceReceipt = database.prepare(`SELECT receipt_hash,fence_name,resource_type,resource_id,action,capability,
    json_extract(record_json,'$.request.subject.accountId') subject_account_id,
    json_extract(record_json,'$.request.resource.familyId') family_id,
    json_extract(record_json,'$.request.resource.sensitivity') sensitivity
    FROM platform_policy_transaction_receipts WHERE receipt_hash=?`).get(governed.source_location_receipt_hash);
  await check('event location reference is bound to a separate exact governed location-read receipt', () => {
    assert.equal(sourceReceipt.fence_name, 'location-write');
    assert.equal(sourceReceipt.resource_type, 'location');
    assert.equal(sourceReceipt.resource_id, location.id);
    assert.equal(sourceReceipt.action, 'read');
    assert.equal(sourceReceipt.capability, 'location.read');
    assert.equal(sourceReceipt.family_id, 'family-main');
    assert.equal(sourceReceipt.sensitivity, 'highly_sensitive');
  });

  await check('event policy receipt and source receipt both have protected journal projections', () => {
    for (const hash of [governed.timeline_policy_receipt_hash, governed.source_location_receipt_hash]) {
      const projection = database.prepare(`SELECT status,record_json IS NOT NULL has_record_json,
        proof_receipt_hash FROM platform_policy_journal_projection_outbox WHERE receipt_hash=?`).get(hash);
      assert.equal(projection?.status, 'projected');
      assert.equal(projection?.has_record_json, 1);
      assert.equal(projection?.proof_receipt_hash, hash);
    }
  });

  await check('audit and outbox evidence use the same canonical event policy receipt', () => {
    const audit = database.prepare(`SELECT resource_type,resource_id,policy_receipt_hash,policy_resource_type,
      policy_resource_id,policy_action,policy_capability FROM audit_log
      WHERE action='event.created' AND resource_id=?`).get(event.id);
    const outbox = database.prepare(`SELECT aggregate_type,aggregate_id,policy_receipt_hash,policy_resource_type,
      policy_resource_id,policy_action,policy_capability FROM event_outbox
      WHERE event_type='timeline.important_day.created' AND aggregate_id=?`).get(event.id);
    assert.deepEqual(
      [audit.resource_type, audit.resource_id, audit.policy_receipt_hash, audit.policy_resource_type,
        audit.policy_resource_id, audit.policy_action, audit.policy_capability],
      ['event', event.id, governed.timeline_policy_receipt_hash, 'event', event.id, 'create', 'family.write']
    );
    assert.deepEqual(
      [outbox.aggregate_type, outbox.aggregate_id, outbox.policy_receipt_hash, outbox.policy_resource_type,
        outbox.policy_resource_id, outbox.policy_action, outbox.policy_capability],
      ['event', event.id, governed.timeline_policy_receipt_hash, 'event', event.id, 'create', 'family.write']
    );
  });

  await check('receiptless active-owner event insert is rejected by the SQLite fence', () => {
    assert.throws(() => database.prepare(`INSERT INTO events(
      id,family_id,owner_person_id,kind,title,start_at,visibility,participant_person_ids,
      attachment_count,ai_processing_allowed,recurrence,reminder_days,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'ppk002-receiptless-active', 'family-main', ownerPersonId, 'important_day',
      'receiptless active event', '2026-08-12T09:00:00.000Z', 'family', '[]', 0, 0,
      'none', '[]', '2026-08-10T06:00:00.000Z'
    ), /exact durable event policy receipt/u);
  });

  await check('ownerless historical event remains stored but quarantined from governed reads', () => {
    database.prepare(`INSERT INTO events(
      id,family_id,kind,title,start_at,visibility,participant_person_ids,
      attachment_count,ai_processing_allowed,recurrence,reminder_days,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'ppk002-historical-quarantine', 'family-main', 'important_day', 'historical quarantine',
      '2020-01-01T00:00:00.000Z', 'family', '[]', 0, 0, 'none', '[]', '2020-01-01T00:00:00.000Z'
    );
    assert.equal(Number(database.prepare(`SELECT COUNT(*) count FROM events WHERE id='ppk002-historical-quarantine'`).get().count), 1);
    assert.equal(Number(database.prepare(`SELECT COUNT(*) count FROM governed_timeline_events WHERE id='ppk002-historical-quarantine'`).get().count), 0);
  });

  await check('event update cannot reuse its create receipt', () => {
    assert.throws(() => database.prepare(`UPDATE events SET title=?,updated_at=? WHERE id=?`).run(
      'stale receipt update', '2026-08-10T06:01:00.000Z', event.id
    ), /fresh exact durable event policy receipt/u);
  });

  await check('governed event physical deletion remains blocked', () => {
    assert.throws(() => database.prepare('DELETE FROM events WHERE id=?').run(event.id), /GOVERNED_TIMELINE_EVENT_DELETION_WORKFLOW_REQUIRED/u);
  });
} finally {
  database.close();
}

await check('family data import has no receiptless timeline repository write path', () => {
  const source = readFileSync(resolve(root, 'apps/desktop/src/main/family-data-import-service.ts'), 'utf8');
  assert.match(source, /currentPlan\.events\.length > 0/u);
  assert.equal(source.includes('timelineRepository.insert(repository'), false);
});

await check('user-facing cross-surface event readers use the governed projection', () => {
  const readers = [
    'automation-repository.ts', 'ai-consent-repository.ts', 'dashboard-repository.ts',
    'entity-catalog-repository.ts', 'genealogy-repository.ts',
    'large-family-read-model-repository.ts', 'report-repository.ts'
  ];
  for (const name of readers) {
    const source = readFileSync(resolve(root, 'packages', 'repositories', 'src', name), 'utf8');
    assert.equal(source.includes('governed_timeline_events'), true, `${name} bypasses the governed timeline view`);
  }
});

const report = Object.freeze({
  schemaVersion: 1,
  requirementId: 'PPK-002',
  decisionIds: ['DEC-137', 'DEC-151', 'DEC-152', 'DEC-156', 'DEC-158'],
  status: 'PASS',
  scope: 'LOCAL_CONTINUATION_ONLY',
  officialStepAdvanced: false,
  officialBuildClaim: false,
  external30ZReceipt: 'PASS',
  applicationVersion: ACTIVE_BUILD_META.applicationVersion,
  checkCount: checks.length,
  checks,
  receiptRecordCountObserved: receipts.length,
  diagnosticDatabasePath: databasePath,
  generatedAt: new Date().toISOString()
});
mkdirSync(resolve(root, 'artifacts', 'validation'), { recursive: true });
writeFileSync(
  resolve(root, 'artifacts', 'validation', 'PPK002_TIMELINE_POLICY_LOCAL_CONTINUATION.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);
console.log(JSON.stringify(report, null, 2));
