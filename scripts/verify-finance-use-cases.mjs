import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import {
  PlatformPolicyKernel
} from '../packages/platform-policy/dist/index.js';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '../packages/repositories/dist/index.js';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const decodeBase32 = (value) => {
  let bits = '';
  for (const char of value) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
};
const makeTotp = (secret, occurredAt) => {
  const counter = Math.floor(Date.parse(occurredAt) / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
};

const policyVersion = '30-w-finance-verifier-policy-v1';
const policyKernel = new PlatformPolicyKernel({
  policyVersion,
  signingKey: Buffer.from('30-w-finance-verifier-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': ['finance.read', 'finance.write', 'archive.write']
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
  entryHash: '9'.repeat(64),
  headSequence: 1,
  headHash: '9'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: 'a'.repeat(64)
});
const policyOptions = Object.freeze({
  archivePolicyAuthorizationProvider: policyProvider,
  archivePolicyReceiptSink: {
    append: () => undefined,
    ensure: projectionProof,
    verifyProjectionProof: () => true
  },
  archivePolicyVersion: policyVersion,
  archiveClusterFence: () => ({ writable: true, epoch: 30 })
});

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp55-finance-'));
const databasePath = join(directory, 'family.db');
const devicePath = join(directory, 'secrets', 'device.json');
const checks = [];
const check = async (name, assertion) => {
  await assertion();
  checks.push(name);
};
let store;

try {
  const clock = new FixedClock(asIsoDateTime('2026-07-24T00:30:00.000Z'));
  const adminPassword = 'GucluFinansYonetici!2026';
  const memberPassword = 'GucluFinansUye!2026';
  const makeStore = () => new FamilyDataStore({
    databasePath,
    deviceIdentityPath: devicePath,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'backups'),
    clock,
    ...policyOptions
  });

  store = makeStore();
  store.setupAdmin({
    displayName: 'Finans Yöneticisi',
    email: 'finance-admin@example.com',
    password: adminPassword
  });
  const bootstrap = new DatabaseSync(databasePath);
  bootstrap.prepare(`
    INSERT INTO people(
      id,family_id,display_name,relationship_type,generation,branch,status,created_at
    ) VALUES('person-finance-member','family-main','Finans Üyesi','Aile üyesi',2,'Ana Dal','active',?)
  `).run(clock.now());
  bootstrap.close();

  const invitation = store.createInvitation({
    email: 'finance-member@example.com',
    role: 'adult_member',
    personId: 'person-finance-member'
  });
  store.acceptInvitation({
    token: invitation.token,
    displayName: 'Finans Üyesi',
    password: memberPassword
  });
  const memberMfa = store.beginTwoFactorSetup();
  store.enableTwoFactor({ code: makeTotp(memberMfa.secret, clock.now()) });
  store.trustCurrentDevice({
    password: memberPassword,
    code: memberMfa.recoveryCodes[0],
    displayName: 'Finans doğrulama cihazı'
  });

  const records = await store.createFinanceRecord({
    ownerPersonId: 'person-finance-member',
    title: 'Altın hesabı',
    kind: 'asset',
    amount: 100000,
    currency: 'try',
    privacy: 'private',
    occurredAt: '2026-07-23T10:00:00.000Z',
    symbol: 'xau'
  });
  const record = records.find((item) => item.title === 'Altın hesabı');
  await check('finance record created through governed use case', () => {
    assert.ok(record);
    assert.equal(record.currency, 'TRY');
    assert.equal(record.symbol, 'XAU');
  });

  const valuations = await store.createFinanceValuation({
    financeRecordId: record.id,
    valueDate: '2026-07-23T12:00:00.000Z',
    unitPrice: 5000,
    quantity: 25,
    provider: 'Manuel'
  });
  const valuation = valuations.find((item) => item.financeRecordId === record.id);
  await check('valuation computes market value', () => {
    assert.ok(valuation);
    assert.equal(valuation.marketValue, 125000);
  });

  const before = new DatabaseSync(databasePath, { readOnly: true });
  const counts = {
    records: Number(before.prepare('SELECT COUNT(*) AS count FROM finance_records').get().count),
    audit: Number(before.prepare('SELECT COUNT(*) AS count FROM audit_log').get().count),
    outbox: Number(before.prepare('SELECT COUNT(*) AS count FROM event_outbox').get().count)
  };
  before.close();

  await check('invalid owner fails closed before finance mutation', () => assert.rejects(
    store.createFinanceRecord({
      ownerPersonId: 'missing',
      title: 'Geçersiz',
      kind: 'expense',
      amount: 10,
      currency: 'TRY',
      privacy: 'private',
      occurredAt: '2026-07-23T10:00:00.000Z'
    }),
    /PERMISSION-DENIED-001/u
  ));
  await check('invalid amount rejected before PEP execution', () => assert.rejects(
    store.createFinanceRecord({
      ownerPersonId: 'person-finance-member',
      title: 'Eksi',
      kind: 'expense',
      amount: -1,
      currency: 'TRY',
      privacy: 'private',
      occurredAt: '2026-07-23T10:00:00.000Z'
    }),
    /CORE-VALIDATION-001/u
  ));

  const noPartialWrites = new DatabaseSync(databasePath, { readOnly: true });
  await check('invalid operations leave no partial writes', () => {
    assert.equal(Number(noPartialWrites.prepare('SELECT COUNT(*) AS count FROM finance_records').get().count), counts.records);
    assert.equal(Number(noPartialWrites.prepare('SELECT COUNT(*) AS count FROM audit_log').get().count), counts.audit);
    assert.equal(Number(noPartialWrites.prepare('SELECT COUNT(*) AS count FROM event_outbox').get().count), counts.outbox);
  });
  noPartialWrites.close();

  await check('owner sees own private finance record', async () => {
    assert.equal((await store.listFinanceRecords()).some((item) => item.id === record.id), true);
  });
  store.logout();
  store.login({ email: 'finance-admin@example.com', password: adminPassword });
  const account = store.listAccounts().find((item) => item.email === 'finance-member@example.com');
  assert.ok(account);
  store.upsertPermission({
    subjectAccountId: account.id,
    resourceType: 'finance_record',
    resourceId: '*',
    actions: ['read', 'update'],
    effect: 'deny',
    denialReason: 'Bu finans alanı üyeye açık değildir.'
  });
  store.logout();
  store.login({ email: 'finance-member@example.com', password: memberPassword });
  await check('explicit deny stops collection read at the PEP', () => assert.rejects(
    store.listFinanceRecords(),
    /PERMISSION-DENIED-001/u
  ));
  await check('explicit deny blocks valuation at the PEP', () => assert.rejects(
    store.createFinanceValuation({
      financeRecordId: record.id,
      valueDate: '2026-07-24T00:00:00.000Z',
      unitPrice: 5100,
      quantity: 25
    }),
    /PERMISSION-DENIED-001/u
  ));

  store.logout();
  store.login({ email: 'finance-admin@example.com', password: adminPassword });
  const denyPermission = store.listPermissions().find((item) =>
    item.subjectAccountId === account.id
    && item.resourceType === 'finance_record'
    && item.effect === 'deny'
  );
  assert.ok(denyPermission);
  store.deletePermission(denyPermission.id);
  const dispatch = await store.dispatchPendingEvents();
  await check('finance outbox events are publishable', () => assert.equal(dispatch.failed, 0));

  store.close();
  store = undefined;
  store = makeStore();
  store.login({ email: 'finance-member@example.com', password: memberPassword });
  await check('finance data survives restart', async () => {
    assert.ok((await store.listFinanceRecords()).some((item) => item.id === record.id));
    assert.ok((await store.listFinanceValuations()).some((item) => item.id === valuation.id));
  });

  const probe = new DatabaseSync(databasePath, { readOnly: true });
  await check('finance writes have audit evidence', () => {
    assert.equal(Number(probe.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='finance.created'").get().count), 1);
    assert.equal(Number(probe.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='finance.valued'").get().count), 1);
  });
  await check('finance writes have outbox evidence', () => {
    assert.equal(Number(probe.prepare("SELECT COUNT(*) AS count FROM event_outbox WHERE event_type='finance.record.created'").get().count), 1);
    assert.equal(Number(probe.prepare("SELECT COUNT(*) AS count FROM event_outbox WHERE event_type='finance.record.valued'").get().count), 1);
  });
  await check('finance rows carry governed receipt bindings', () => {
    assert.equal(Number(probe.prepare("SELECT COUNT(*) AS count FROM finance_records WHERE policy_receipt_hash IS NOT NULL AND policy_capability='finance.write'").get().count), 1);
    assert.equal(Number(probe.prepare("SELECT COUNT(*) AS count FROM finance_valuations WHERE policy_receipt_hash IS NOT NULL AND policy_capability='finance.write'").get().count), 1);
  });
  probe.close();

  store.logout();
  store.login({ email: 'finance-admin@example.com', password: adminPassword });
  await check('audit chain remains valid', () => assert.equal(store.verifyAuditIntegrity().valid, true));

  const report = {
    schemaVersion: 1,
    product: 'Panthera pardus tulliana',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    status: 'passed',
    checks: checks.length,
    scenarios: checks,
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync(
    'artifacts/manifests/FINANCE_USE_CASE_VERIFICATION_MVP56.json',
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
