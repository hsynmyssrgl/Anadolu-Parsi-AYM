import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import { PlatformPolicyKernel } from '../packages/platform-policy/dist/index.js';
import { generateTotpCode } from '../packages/security/dist/index.js';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '../packages/repositories/dist/index.js';

const policyVersion = '30-x-health-verifier-policy-v1';
const policyKernel = new PlatformPolicyKernel({
  policyVersion,
  signingKey: Buffer.from('30-x-health-verifier-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': ['health.read', 'health.write', 'finance.read', 'finance.write', 'archive.write']
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});
const policyProvider = Object.freeze({
  authorize({ request, nonce }) {
    return Object.freeze({
      effectiveRequest: request,
      authorization: policyKernel.authorizeWithReceipt(request, request.occurredAt, nonce)
    });
  },
  verify({ request, receipt }) {
    return policyKernel.verifyReceiptForRequest(receipt, request);
  }
});
const projectionProof = (record) => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: 1,
  entryHash: '8'.repeat(64),
  headSequence: 1,
  headHash: '8'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: 'b'.repeat(64)
});
const policyOptions = Object.freeze({
  archivePolicyAuthorizationProvider: policyProvider,
  archivePolicyReceiptSink: {
    append: () => undefined,
    ensure: projectionProof,
    verifyProjectionProof: () => true
  },
  archivePolicyVersion: policyVersion,
  archiveClusterFence: () => ({ writable: true, epoch: 31 })
});

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp54-health-'));
const databasePath = join(directory, 'family.db');
const deviceIdentityPath = join(directory, 'secrets', 'device-identity.json');
const checks = [];
const check = async (name, operation) => { await operation(); checks.push(name); };
const clock = new FixedClock(asIsoDateTime('2026-07-23T12:00:00.000Z'));
const adminPassword = 'GucluSaglikYoneticiParolasi!2026';
const memberPassword = 'GucluSaglikUyeParolasi!2026';
let store;
try {
  const makeStore = () => new FamilyDataStore({
    databasePath,
    deviceIdentityPath,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'migration-backups'),
    clock,
    ...policyOptions
  });
  store = makeStore();
  store.setupAdmin({ displayName: 'Sağlık Yöneticisi', email: 'health-admin@example.com', password: adminPassword });
  const bootstrap = new DatabaseSync(databasePath);
  bootstrap.exec(`
    INSERT INTO people(id,family_id,display_name,relationship_type,generation,branch,status,created_at) VALUES
      ('person-health-member','family-main','Sağlık Üyesi','Aile üyesi',2,'Ana Dal','active','2026-07-23T12:00:00.000Z'),
      ('person-health-other','family-main','Diğer Sağlık Üyesi','Aile üyesi',2,'İkinci Dal','active','2026-07-23T12:00:00.000Z');
  `);
  bootstrap.close();
  const invitation = store.createInvitation({
    email: 'health-member@example.com', role: 'adult_member', personId: 'person-health-member'
  });
  store.acceptInvitation({ token: invitation.token, displayName: 'Sağlık Üyesi', password: memberPassword });

  const twoFactor = store.beginTwoFactorSetup();
  store.enableTwoFactor({
    code: generateTotpCode(twoFactor.secret, Date.parse(clock.now()))
  });
  store.trustCurrentDevice({
    password: memberPassword,
    code: twoFactor.recoveryCodes[0],
    displayName: '30-X health verifier device'
  });

  const healthRecords = await store.createHealthRecord({
    ownerPersonId: 'person-health-member',
    title: 'Yıllık kontrol',
    kind: 'appointment',
    privacy: 'private',
    provider: 'Aile Hekimi',
    notes: 'Rutin kontrol',
    occurredAt: '2026-07-20T09:30:00.000Z'
  });
  const healthRecord = healthRecords.find((item) => item.title === 'Yıllık kontrol');
  await check('health record is created through application use case', () => {
    assert.ok(healthRecord);
    assert.equal(healthRecord.ownerPersonId, 'person-health-member');
    assert.equal(healthRecord.provider, 'Aile Hekimi');
  });

  const medicationPlans = await store.createMedicationPlan({
    ownerPersonId: 'person-health-member',
    name: 'Vitamin D',
    dosage: '1000 IU',
    schedule: 'Günde bir',
    startsAt: '2026-07-21T08:00:00.000Z',
    endsAt: '2026-08-21T08:00:00.000Z',
    privacy: 'private',
    provider: 'Dahiliye',
    notes: 'Kahvaltı sonrası'
  });
  const medicationPlan = medicationPlans.find((item) => item.name === 'Vitamin D');
  await check('medication plan preserves schedule and date range', () => {
    assert.ok(medicationPlan);
    assert.equal(medicationPlan.schedule, 'Günde bir');
    assert.equal(medicationPlan.endsAt, '2026-08-21T08:00:00.000Z');
  });

  const history = await store.createFamilyHealthHistory({
    relatedPersonId: 'person-health-member',
    condition: 'Hipertansiyon',
    relationshipNote: 'Anne tarafı',
    diagnosedAt: '2020-05-01T00:00:00.000Z',
    privacy: 'selected_members',
    notes: 'Düzenli takip'
  });
  const historyRecord = history.find((item) => item.condition === 'Hipertansiyon');
  await check('family health history is created with sensitive privacy', () => {
    assert.ok(historyRecord);
    assert.equal(historyRecord.privacy, 'selected_members');
    assert.equal(historyRecord.relationshipNote, 'Anne tarafı');
  });

  const beforeInvalid = new DatabaseSync(databasePath, { readOnly: true });
  const countsBefore = {
    health: Number(beforeInvalid.prepare('SELECT COUNT(*) count FROM health_records').get().count),
    medication: Number(beforeInvalid.prepare('SELECT COUNT(*) count FROM medication_plans').get().count),
    history: Number(beforeInvalid.prepare('SELECT COUNT(*) count FROM family_health_history').get().count),
    audit: Number(beforeInvalid.prepare('SELECT COUNT(*) count FROM audit_log').get().count),
    outbox: Number(beforeInvalid.prepare('SELECT COUNT(*) count FROM event_outbox').get().count)
  };
  beforeInvalid.close();

  await check('missing person rejects health creation without partial writes', async () => {
    await assert.rejects(() => store.createHealthRecord({
      ownerPersonId: 'missing-person', title: 'Geçersiz kayıt', kind: 'note', privacy: 'private', occurredAt: '2026-07-22T00:00:00.000Z'
    }), /PERMISSION-DENIED-001|RESOURCE-NOT-FOUND-001/);
  });
  await check('invalid medication range is rejected before transaction', async () => {
    await assert.rejects(() => store.createMedicationPlan({
      ownerPersonId: 'person-health-member', name: 'Yanlış Plan', dosage: '1', schedule: 'Günde bir',
      startsAt: '2026-08-10T00:00:00.000Z', endsAt: '2026-08-01T00:00:00.000Z', privacy: 'private'
    }), /CORE-VALIDATION-001/);
  });
  await check('invalid health operations do not add audit or outbox records', () => {
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM health_records').get().count), countsBefore.health);
      assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM medication_plans').get().count), countsBefore.medication);
      assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM family_health_history').get().count), countsBefore.history);
      assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM audit_log').get().count), countsBefore.audit);
      assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM event_outbox').get().count), countsBefore.outbox);
    } finally { probe.close(); }
  });

  await check('linked member sees own private health records', async () => {
    assert.equal((await store.listHealthRecords()).some((item) => item.id === healthRecord.id), true);
    assert.equal((await store.listMedicationPlans()).some((item) => item.id === medicationPlan.id), true);
  });
  await check('linked member cannot create record for another person without grant', async () => {
    await assert.rejects(() => store.createHealthRecord({
      ownerPersonId: 'person-health-other', title: 'Yetkisiz kayıt', kind: 'note', privacy: 'family', occurredAt: '2026-07-22T00:00:00.000Z'
    }), /PERMISSION-DENIED-001/);
  });

  store.logout();
  store.login({ email: 'health-admin@example.com', password: adminPassword });
  const memberAccount = store.listAccounts().find((item) => item.email === 'health-member@example.com');
  assert.ok(memberAccount);
  store.upsertPermission({
    subjectAccountId: memberAccount.id,
    resourceType: 'health_record',
    resourceId: '*',
    actions: ['read'],
    effect: 'deny',
    denialReason: 'Bu sağlık kaydı üyeye açık değildir.'
  });
  store.logout();
  store.login({ email: 'health-member@example.com', password: memberPassword });
  await check('explicit deny overrides health record ownership', async () => {
    await assert.rejects(() => store.listHealthRecords(), /PERMISSION-DENIED-001|EXPLICIT_DENY/);
  });
  await check('deny on health record does not hide medication plan', async () => {
    assert.equal((await store.listMedicationPlans()).some((item) => item.id === medicationPlan.id), true);
  });

  store.logout();
  store.login({ email: 'health-admin@example.com', password: adminPassword });
  const denyPermission = store.listPermissions().find((item) => item.subjectAccountId === memberAccount.id && item.resourceType === 'health_record' && item.effect === 'deny');
  assert.ok(denyPermission);
  store.deletePermission(denyPermission.id);
  const dispatch = await store.dispatchPendingEvents();
  await check('health outbox events are publishable', () => {
    assert.ok(dispatch.claimed >= 3);
    assert.equal(dispatch.failed, 0);
  });

  store.close(); store = undefined;
  store = makeStore();
  store.login({ email: 'health-member@example.com', password: memberPassword });
  await check('health records survive application restart', async () => {
    assert.ok((await store.listHealthRecords()).some((item) => item.id === healthRecord.id));
    assert.ok((await store.listMedicationPlans()).some((item) => item.id === medicationPlan.id));
    assert.ok((await store.listFamilyHealthHistory()).some((item) => item.id === historyRecord.id));
  });

  const probe = new DatabaseSync(databasePath, { readOnly: true });
  try {
    await check('health writes contain audit and outbox evidence', () => {
      for (const action of ['health.created', 'medication.created', 'health_history.created']) {
        assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM audit_log WHERE action=?').get(action).count), 1);
      }
      for (const eventType of ['health.record.created', 'health.medication_plan.created', 'health.family_history.created']) {
        assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM event_outbox WHERE event_type=?').get(eventType).count), 1);
      }
    });
    await check('health audit chain remains valid', () => {
      store.logout();
      store.login({ email: 'health-admin@example.com', password: adminPassword });
      assert.equal(store.verifyAuditIntegrity().valid, true);
    });
  } finally { probe.close(); }

  const report = {
    schemaVersion: 1,
    product: 'Panthera pardus tulliana',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    status: 'passed',
    checks: checks.length,
    scenarios: checks,
    healthRepositoryActive: true,
    applicationUseCasesActive: true,
    objectAuthorizationActive: true,
    transactionalAuditOutboxActive: true,
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/HEALTH_USE_CASE_VERIFICATION_MVP56.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
