import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import {
  canonicalPlatformPolicyJson,
  computePlatformPolicyReceiptHash
} from '../packages/repositories/dist/index.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 authorization diagnostic must run from ${expectedRoot}; received ${root}`);
}

const diagnosticRoot = resolve(root, '.tmp', 'ppk002-diagnostics');
mkdirSync(diagnosticRoot, { recursive: true });
const databasePath = join(diagnosticRoot, `authorization-${Date.now()}.db`);
const receiptRecords = [];
const captures = [];
const base = createArchivePolicyTestOptions(receiptRecords);
const provider = base.archivePolicyAuthorizationProvider;
const wrappedProvider = Object.freeze({
  authorize(input) {
    const result = provider.authorize(input);
    captures.push({ request: result.effectiveRequest, authorization: result.authorization });
    return result;
  },
  verify(input) { return provider.verify(input); }
});
const store = new FamilyDataStore({
  databasePath,
  applicationVersion: ACTIVE_BUILD_META.applicationVersion,
  migrationBackupDirectory: diagnosticRoot,
  clock: new FixedClock(asIsoDateTime('2026-08-10T00:00:00.000Z')),
  ...base,
  archivePolicyAuthorizationProvider: wrappedProvider
});

let location;
let ownerPersonId;
let applicationFailure;
try {
  store.setupAdmin({
    displayName: 'PPK-002 Authorization Diagnostic',
    email: 'ppk002-authorization@example.com',
    password: 'PPK002-Authorization-Password!2026'
  });
  const seed = await store.getSnapshot();
  ownerPersonId = seed.people[0].id;
  location = (await store.createLocation({ label: 'PPK-002 Authorization Location', kind: 'venue' })).location;
  try {
    await store.createEvent({
      title: 'PPK-002 authorization event diagnostic',
      startAt: '2026-08-11T09:00:00.000Z',
      locationId: location.id,
      visibility: 'family',
      participantPersonIds: [ownerPersonId],
      aiProcessingAllowed: false
    });
  } catch (error) {
    applicationFailure = error instanceof Error ? error.message : String(error);
  }
} finally {
  store.close();
}

const eventCapture = [...captures].reverse().find(({ request }) =>
  request.resource.type === 'event' && request.action === 'create'
);
const locationReadCapture = [...captures].reverse().find(({ request }) =>
  request.resource.type === 'location'
  && request.resource.id === location?.id
  && request.action === 'read'
);
if (!eventCapture || !locationReadCapture || !location || !ownerPersonId) {
  throw new Error('PPK-002 diagnostic could not capture the exact event and source-location authorizations');
}

const record = Object.freeze({
  correlationId: eventCapture.request.correlationId,
  resourceType: eventCapture.request.resource.type,
  resourceId: eventCapture.request.resource.id,
  action: eventCapture.request.action,
  capability: eventCapture.request.capability,
  request: eventCapture.request,
  decision: eventCapture.authorization.decision,
  receipt: eventCapture.authorization.receipt,
  recordedAt: eventCapture.authorization.receipt.issuedAt
});
const receiptHash = computePlatformPolicyReceiptHash(record.receipt);
const sourceReceiptHash = computePlatformPolicyReceiptHash(locationReadCapture.authorization.receipt);
const recordJson = canonicalPlatformPolicyJson(record);

const database = new DatabaseSync(databasePath);
let directInsertError;
try {
  database.prepare(`INSERT INTO platform_policy_transaction_receipts(
    receipt_hash,receipt_version,request_hash,nonce,correlation_id,policy_version,
    resource_type,resource_id,action,capability,fence_name,fence_epoch,fence_writable,
    issued_at,recorded_at,record_json
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    receiptHash, record.receipt.receiptVersion, record.receipt.requestHash, record.receipt.nonce,
    record.correlationId, record.decision.policyVersion, record.resourceType, record.resourceId,
    record.action, record.capability, 'timeline-event-write', 30, 1,
    record.receipt.issuedAt, record.recordedAt, recordJson
  );
  database.prepare(`INSERT INTO platform_policy_journal_projection_outbox(
    receipt_hash,record_json,status,created_at,projected_at
  ) VALUES(?,?,'pending',?,NULL)`).run(receiptHash, recordJson, record.recordedAt);
  try {
    database.prepare(`INSERT INTO events(
      id,family_id,owner_person_id,kind,title,description,start_at,location_id,location_label,
      visibility,participant_person_ids,invitation_text,notes,attachment_count,
      ai_processing_allowed,recurrence,reminder_days,created_at,updated_at,archived_at,
      timeline_policy_receipt_hash,timeline_policy_receipt_version,timeline_policy_receipt_nonce,
      timeline_policy_correlation_id,timeline_policy_resource_type,timeline_policy_resource_id,
      timeline_policy_action,timeline_policy_capability,source_location_receipt_hash
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      record.resourceId, record.request.resource.familyId, ownerPersonId, 'important_day',
      'PPK-002 direct diagnostic', null, '2026-08-11T09:00:00.000Z', location.id, location.label,
      'family', JSON.stringify([ownerPersonId]), null, null, 0, 0, 'none', '[]',
      record.recordedAt, record.recordedAt, null, receiptHash, 1, record.receipt.nonce,
      record.correlationId, record.resourceType, record.resourceId, record.action,
      record.capability, sourceReceiptHash
    );
  } catch (error) {
    directInsertError = error instanceof Error ? error.message : String(error);
  }
  const checks = database.prepare(`SELECT
    EXISTS(SELECT 1 FROM platform_policy_database_fences WHERE fence_name='timeline-event-write' AND epoch=30 AND writable=1) main_fence,
    EXISTS(SELECT 1 FROM accounts WHERE id=? AND person_id=? AND status='active') active_actor,
    EXISTS(SELECT 1 FROM people WHERE id=? AND family_id=? AND status='active') active_owner,
    EXISTS(SELECT 1 FROM platform_policy_transaction_receipts WHERE receipt_hash=? AND record_json=?) main_receipt,
    EXISTS(SELECT 1 FROM platform_policy_journal_projection_outbox WHERE receipt_hash=? AND record_json=?) main_projection,
    EXISTS(SELECT 1 FROM platform_policy_transaction_receipts WHERE receipt_hash=? AND fence_name='location-write' AND resource_type='location' AND resource_id=? AND action='read' AND capability='location.read') source_receipt,
    EXISTS(SELECT 1 FROM platform_policy_journal_projection_outbox WHERE receipt_hash=?) source_projection
  `).get(
    record.request.subject.accountId, ownerPersonId, ownerPersonId, record.request.resource.familyId,
    receiptHash, recordJson, receiptHash, recordJson, sourceReceiptHash, location.id, sourceReceiptHash
  );
  console.log(JSON.stringify({
    databasePath,
    applicationFailure,
    directInsertError,
    checks,
    eventRequest: record.request,
    sourceRequest: locationReadCapture.request,
    receiptHash,
    sourceReceiptHash
  }, null, 2));
} finally {
  database.close();
}
