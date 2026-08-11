import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 SQL diagnostic must run from ${expectedRoot}; received ${root}`);
}

const diagnosticRoot = resolve(root, '.tmp', 'ppk002-diagnostics');
mkdirSync(diagnosticRoot, { recursive: true });
const databasePath = join(diagnosticRoot, `timeline-${Date.now()}.db`);
const receiptRecords = [];
const store = new FamilyDataStore({
  databasePath,
  applicationVersion: ACTIVE_BUILD_META.applicationVersion,
  migrationBackupDirectory: diagnosticRoot,
  clock: new FixedClock(asIsoDateTime('2026-08-10T00:00:00.000Z')),
  ...createArchivePolicyTestOptions(receiptRecords)
});

let failure;
try {
  store.setupAdmin({
    displayName: 'PPK-002 Diagnostic Admin',
    email: 'ppk002-diagnostic@example.com',
    password: 'PPK002-Diagnostic-Password!2026'
  });
  const seed = await store.getSnapshot();
  const ownerPersonId = seed.people[0].id;
  const location = (await store.createLocation({ label: 'PPK-002 Governed Location', kind: 'venue' })).location;
  try {
    await store.createEvent({
      title: 'PPK-002 governed event diagnostic',
      startAt: '2026-08-11T09:00:00.000Z',
      locationId: location.id,
      visibility: 'family',
      participantPersonIds: [ownerPersonId],
      aiProcessingAllowed: false
    });
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
} finally {
  store.close();
}

const database = new DatabaseSync(databasePath);
try {
  const rows = database.prepare(`SELECT receipt_hash,fence_name,fence_epoch,resource_type,resource_id,
    action,capability,correlation_id,
    json_extract(record_json,'$.request.subject.accountId') subject_account_id,
    json_extract(record_json,'$.request.subject.personId') subject_person_id,
    json_extract(record_json,'$.request.resource.familyId') resource_family_id,
    json_extract(record_json,'$.request.resource.ownerPersonId') resource_owner_person_id,
    json_extract(record_json,'$.request.resource.sensitivity') sensitivity,
    json_extract(record_json,'$.request.resource.sourceResourceId') source_resource_id,
    json_extract(record_json,'$.request.purpose') purpose
    FROM platform_policy_transaction_receipts ORDER BY recorded_at,receipt_hash`).all();
  const projections = database.prepare(`SELECT receipt_hash,status,record_json IS NOT NULL has_record_json
    FROM platform_policy_journal_projection_outbox ORDER BY created_at,receipt_hash`).all();
  const fences = database.prepare(`SELECT fence_name,epoch,writable FROM platform_policy_database_fences ORDER BY fence_name`).all();
  const locations = database.prepare(`SELECT id,family_id,owner_person_id,policy_receipt_hash FROM locations`).all();
  const events = database.prepare(`SELECT id,family_id,owner_person_id,timeline_policy_receipt_hash,source_location_receipt_hash FROM events`).all();
  console.log(JSON.stringify({ databasePath, failure, receiptSinkRecords: receiptRecords.length, rows, projections, fences, locations, events }, null, 2));
  if (!failure) throw new Error('PPK-002 diagnostic expected the current regression failure but the write succeeded');
} finally {
  database.close();
}
