import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  CreateLifeRecordUseCase,
  ListLifeRecordsUseCase
} from '../packages/application/dist/index.js';
import {
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  ok
} from '../packages/core/dist/index.js';

const REPORT_PATH = 'artifacts/manifests/LIFE_USE_CASE_VERIFICATION_MVP56.json';
const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const EXPECTED_CHECKS = 10;
const checks = [];
const failures = [];
const check = async (name, operation) => {
  try {
    await operation();
    checks.push({ name, status: 'PASS' });
  } catch (error) {
    checks.push({
      name,
      status: 'FAIL',
      error: error instanceof Error ? error.message : String(error)
    });
    failures.push(name);
  }
};

const context = Object.freeze({
  familyId: asFamilyId('family-life-verifier'),
  actor: Object.freeze({
    userId: asUserId('account-life-verifier'),
    role: 'adult_member',
    personId: asPersonId('person-life-owner')
  }),
  correlationId: asCorrelationId('mvp56-life-use-case-verification')
});
const occurredAt = asIsoDateTime('2026-08-08T00:00:00.000Z');
const expectedRecord = Object.freeze({
  id: 'life-verifier-record',
  ownerPersonId: context.actor.personId,
  category: 'task',
  title: 'Governed LIFE task',
  status: 'planned',
  privacy: 'private',
  dueAt: asIsoDateTime('2026-08-09T00:00:00.000Z'),
  createdAt: occurredAt
});

let listedContext;
const listUseCase = new ListLifeRecordsUseCase({
  async listLifeRecords(received) {
    listedContext = received;
    return ok([expectedRecord]);
  }
});
const listed = await listUseCase.execute(context);
await check('list is asynchronous and returns the query result', () => {
  assert.deepEqual(listed, { ok: true, value: [expectedRecord] });
});
await check('list preserves the exact family and actor context', () => {
  assert.equal(listedContext, context);
  assert.equal(listedContext.familyId, 'family-life-verifier');
  assert.equal(listedContext.actor.personId, 'person-life-owner');
});

const observed = {
  intents: [],
  inserted: [],
  audits: [],
  events: [],
  transactionCalls: 0
};
const createUseCase = new CreateLifeRecordUseCase({
  async execute(receivedContext, intent, operation) {
    observed.transactionCalls += 1;
    assert.equal(receivedContext, context);
    observed.intents.push(intent);
    return operation({
      occurredAt,
      findPerson: (personId) => ok(personId === context.actor.personId ? { id: personId } : null),
      authorize: (authorization) => ok(
        authorization.action === 'create'
          && authorization.resourceType === 'life_record'
          && authorization.resourceId === 'life-verifier-record'
          && authorization.ownerPersonId === context.actor.personId
          && authorization.privacy === 'private'
      ),
      insertLifeRecord: (record) => {
        observed.inserted.push(record);
        return ok(undefined);
      },
      appendAudit: (entry) => {
        observed.audits.push(entry);
        return ok('audit-entry-hash');
      },
      enqueueEvent: (event) => {
        observed.events.push(event);
        return ok(undefined);
      }
    });
  }
});
const created = await createUseCase.execute({
  context,
  command: {
    ownerPersonId: context.actor.personId,
    category: 'task',
    title: '  Governed LIFE task  ',
    status: 'planned',
    privacy: 'private',
    dueAt: expectedRecord.dueAt
  },
  identifiers: {
    recordId: expectedRecord.id,
    auditId: 'audit-life-verifier',
    outboxEventId: asEventId('event-life-verifier')
  }
});

await check('create executes exactly one asynchronous unit of work', () => {
  assert.equal(observed.transactionCalls, 1);
  assert.equal(created.ok, true);
});
await check('create binds family.write and not invented life capabilities', () => {
  assert.deepEqual(observed.intents, [{
    action: 'create',
    capability: 'family.write',
    resourceType: 'life_record',
    resourceId: 'life-verifier-record',
    purpose: 'general',
    ownerPersonId: context.actor.personId,
    privacy: 'private'
  }]);
});
await check('create persists the exact family, owner, privacy and normalized title', () => {
  assert.equal(observed.inserted.length, 1);
  assert.equal(observed.inserted[0].familyId, context.familyId);
  assert.equal(observed.inserted[0].ownerPersonId, context.actor.personId);
  assert.equal(observed.inserted[0].privacy, 'private');
  assert.equal(observed.inserted[0].title, 'Governed LIFE task');
});
await check('create appends the exact LIFE audit marker', () => {
  assert.deepEqual(observed.audits, [{
    id: 'audit-life-verifier',
    action: 'life_record.created',
    resourceType: 'life_record',
    resourceId: 'life-verifier-record',
    occurredAt,
    actorId: context.actor.userId
  }]);
});
await check('create enqueues the exact LIFE outbox marker', () => {
  assert.equal(observed.events.length, 1);
  assert.equal(observed.events[0].eventType, 'life.record.created');
  assert.equal(observed.events[0].aggregateType, 'life_record');
  assert.equal(observed.events[0].aggregateId, 'life-verifier-record');
  assert.equal(observed.events[0].correlationId, context.correlationId);
});

const transactionCallsBeforeInvalid = observed.transactionCalls;
const invalidTitle = await createUseCase.execute({
  context,
  command: {
    ownerPersonId: context.actor.personId,
    category: 'task',
    title: ' ',
    status: 'planned',
    privacy: 'private'
  },
  identifiers: {
    recordId: 'life-invalid-title',
    auditId: 'audit-invalid-title',
    outboxEventId: asEventId('event-invalid-title')
  }
});
await check('invalid title fails before the unit of work', () => {
  assert.equal(invalidTitle.ok, false);
  assert.equal(invalidTitle.error.code, 'CORE-VALIDATION-001');
  assert.equal(observed.transactionCalls, transactionCallsBeforeInvalid);
});

const invalidRange = await createUseCase.execute({
  context,
  command: {
    ownerPersonId: context.actor.personId,
    category: 'task',
    title: 'Invalid range',
    status: 'planned',
    privacy: 'private',
    startsAt: '2026-08-10T00:00:00.000Z',
    dueAt: '2026-08-09T00:00:00.000Z'
  },
  identifiers: {
    recordId: 'life-invalid-range',
    auditId: 'audit-invalid-range',
    outboxEventId: asEventId('event-invalid-range')
  }
});
await check('invalid date range fails before the unit of work', () => {
  assert.equal(invalidRange.ok, false);
  assert.equal(invalidRange.error.code, 'CORE-VALIDATION-001');
  assert.equal(observed.transactionCalls, transactionCallsBeforeInvalid);
});

const [lifeSource, adapterSource] = await Promise.all([
  readFile('packages/application/src/life-use-cases.ts', 'utf8'),
  readFile('apps/desktop/src/main/life-application-adapter.ts', 'utf8')
]);
await check('source contract binds family.read and family.write with general purpose', () => {
  for (const marker of [
    "capability: 'family.write'",
    "resourceType: 'life_record'",
    "purpose: 'general'",
    "action: 'create'"
  ]) assert.equal(lifeSource.includes(marker), true, marker);
  for (const marker of [
    "action: 'read'",
    "capability: 'family.read'",
    "resourceType: 'life_record'",
    "purpose: 'general'"
  ]) assert.equal(adapterSource.includes(marker), true, marker);
  assert.equal(lifeSource.includes("'life.write'"), false);
  assert.equal(adapterSource.includes("'life.read'"), false);
});

assert.equal(checks.length, EXPECTED_CHECKS);
const status = failures.length === 0 ? 'passed' : 'failed';
const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana',
  release: 'Bronze 04.08.2026.29',
  milestone: 'MVP56',
  gate: 'LIFE_USE_CASE_VERIFICATION',
  status,
  expectedChecks: EXPECTED_CHECKS,
  executedChecks: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  exactCountersMatch: checks.length === EXPECTED_CHECKS
    && checks.filter((item) => item.status === 'PASS').length === EXPECTED_CHECKS
    && failures.length === 0,
  checks: EXPECTED_CHECKS,
  checkResults: checks,
  failures,
  policySemantics: {
    readCapability: 'family.read',
    createCapability: 'family.write',
    resourceType: 'life_record',
    purpose: 'general'
  },
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/manifests', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'passed') {
  console.error(`LIFE use-case verification: FAIL (${failures.length}/${EXPECTED_CHECKS}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`LIFE use-case verification: PASS (${EXPECTED_CHECKS}/${EXPECTED_CHECKS}).`);
console.log(TRUTH);
