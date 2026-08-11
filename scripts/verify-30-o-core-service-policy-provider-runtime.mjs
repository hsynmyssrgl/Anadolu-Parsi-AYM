import strictAssert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PlatformPolicyEnforcementError,
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel
} from '../packages/platform-policy/src/index.ts';
import { CoreServiceRuntime } from '../apps/core-service/src/core-service-runtime.ts';
import { CoreServiceLocalAdminServer } from '../apps/core-service/src/local-admin-server.ts';
import { CoreServiceApplicationAdapter } from '../apps/desktop/src/main/core-service-application-adapter.ts';

const expectedAssertionCount = 29;
const reportPath = 'artifacts/validation/30-O-core-service-policy-provider-runtime.json';
const mandatoryTruth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
let assertionCount = 0;
const assert = new Proxy(strictAssert, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value !== 'function') return value;
    return (...args) => {
      assertionCount += 1;
      return Reflect.apply(value, target, args);
    };
  }
});

const policyVersion = 'PPT-PLATFORM-POLICY-2026-08-04-V1';
let nowMs = Date.parse('2026-08-06T03:00:00.000Z');
let sequence = 0;
const clock = () => new Date(nowMs).toISOString();
const kernel = new PlatformPolicyKernel({
  policyVersion,
  signingKey: Buffer.alloc(32, 30),
  applicationCapabilities: { 'windows-desktop': ['archive.read', 'archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'share', 'record', 'administer']
});
const authority = Object.freeze({
  policyVersion,
  accountId: 'account-30o',
  personId: 'person-30o',
  deviceId: 'device-30o',
  applicationId: 'windows-desktop',
  deviceTrusted: true,
  membershipActive: true,
  roles: Object.freeze(['adult_member']),
  familyIds: Object.freeze(['family-30o']),
  online: true,
  expiresAt: '2026-08-06T04:00:00.000Z'
});
const resource = Object.freeze({
  type: 'archive_item',
  id: 'archive-30o',
  familyId: 'family-30o',
  ownerPersonId: 'person-30o',
  sensitivity: 'personal'
});
const intent = () => Object.freeze({
  correlationId: `corr-30o-${++sequence}`,
  action: 'update',
  capability: 'archive.write',
  resourceType: resource.type,
  resourceId: resource.id
});
const makePep = ({ provider, fence, sink, replayStore, nonceFactory, receiptTtlMs }) => new PlatformPolicyEnforcementPoint({
  provider,
  authorityResolver: { resolve: () => authority },
  resourceResolver: { resolve: () => resource },
  receiptSink: { append: sink ?? (() => undefined) },
  replayStore: replayStore ?? { reserve: () => true },
  clock,
  nonceFactory: nonceFactory ?? (() => `nonce-30o-${++sequence}`),
  ...(receiptTtlMs === undefined ? {} : { receiptTtlMs })
});
const expectCode = async (operation, expected) => {
  await assert.rejects(operation, (error) => error instanceof PlatformPolicyEnforcementError && error.code === expected);
};
const signedProvider = ({ issueAt = () => clock(), effective = (request) => request, verify = (_input, count) => count > 0 }) => {
  let verifyCount = 0;
  return Object.freeze({
    authorize: ({ request, nonce }) => {
      const effectiveRequest = Object.freeze({ ...effective(request) });
      return Object.freeze({
        effectiveRequest,
        authorization: kernel.authorizeWithReceipt(effectiveRequest, issueAt(), nonce)
      });
    },
    verify: (input) => verify(input, ++verifyCount)
  });
};

const temporaryRoot = await mkdtemp(join(tmpdir(), 'ppt-30o-provider-'));
const endpoint = process.platform === 'win32'
  ? `\\\\.\\pipe\\ppt-30o-provider-${process.pid}-${Date.now()}`
  : join(temporaryRoot, 'core-service.sock');
const authenticationToken = randomBytes(48).toString('base64url');
const runtime = new CoreServiceRuntime({ policyKernel: kernel, policyVersion, clock });
runtime.markReady('leader');
const server = new CoreServiceLocalAdminServer({ endpoint, authenticationToken, runtime });
let runtimeFailure;

try {
  await server.start();
  const adapter = new CoreServiceApplicationAdapter({ endpoint, authenticationToken });
  const initialHealth = await adapter.getHealth();
  assert.equal(initialHealth.writeFenceEpoch, 1);
  assert.deepEqual(adapter.clusterFence(), { writable: true, epoch: 1 });

  const order = [];
  let verifyCalls = 0;
  let persisted;
  const provider = Object.freeze({
    authorize: async (input) => {
      order.push('provider.authorize');
      nowMs += 5;
      return adapter.policyProvider.authorize(input);
    },
    verify: async (input) => {
      order.push(`provider.verify.${++verifyCalls}`);
      return adapter.policyProvider.verify(input);
    }
  });
  const pep = makePep({
    provider,
    fence: adapter.clusterFence,
    replayStore: { reserve: () => { order.push('replay.reserve'); return true; } },
    sink: (record) => { order.push('receipt.append'); persisted = record; },
    nonceFactory: () => 'core-service-bound-nonce'
  });
  const committed = await pep.execute(intent(), adapter.clusterFence, () => { order.push('operation'); return 'committed'; });
  assert.equal(committed, 'committed');
  assert.deepEqual(order, [
    'replay.reserve',
    'provider.authorize',
    'provider.verify.1',
    'receipt.append',
    'provider.verify.2',
    'operation'
  ]);
  assert.equal(persisted.receipt.nonce, 'core-service-bound-nonce');
  assert.equal(persisted.recordedAt, persisted.receipt.issuedAt);
  assert.notEqual(persisted.recordedAt, persisted.request.occurredAt);
  assert.equal(kernel.verifyReceiptForRequest(persisted.receipt, persisted.request), true);

  let epochRaceSinkCalls = 0;
  const epochRacePep = makePep({
    provider: {
      authorize: (input) => { runtime.markReady('leader'); return adapter.policyProvider.authorize(input); },
      verify: (input) => adapter.policyProvider.verify(input)
    },
    sink: () => { epochRaceSinkCalls += 1; }
  });
  await expectCode(() => epochRacePep.execute(intent(), adapter.clusterFence, () => undefined), 'CLUSTER_FENCE_CHANGED');
  assert.equal(epochRaceSinkCalls, 0);
  assert.deepEqual(adapter.clusterFence(), { writable: true, epoch: 2 });

  let writableRaceSinkCalls = 0;
  const writableRacePep = makePep({
    provider: {
      authorize: (input) => { runtime.enterSafeMode('30O_FENCE_RACE'); return adapter.policyProvider.authorize(input); },
      verify: (input) => adapter.policyProvider.verify(input)
    },
    sink: () => { writableRaceSinkCalls += 1; }
  });
  await expectCode(() => writableRacePep.execute(intent(), adapter.clusterFence, () => undefined), 'CLUSTER_FENCE_CHANGED');
  assert.equal(writableRaceSinkCalls, 0);
  assert.deepEqual(adapter.clusterFence(), { writable: false, epoch: 3 });

  const directSafeMode = await adapter.authorize(
    { ...persisted.request, correlationId: 'corr-30o-direct-safe-mode', clusterWritable: true },
    'direct-safe-mode-nonce'
  );
  assert.equal(directSafeMode.effectiveRequest.clusterWritable, false);
  assert.equal(directSafeMode.authorization.decision.reason, 'CLUSTER_NOT_WRITABLE');
  assert.deepEqual(directSafeMode.fence, { writable: false, epoch: 3 });
  const directVerification = await adapter.verify(directSafeMode.effectiveRequest, directSafeMode.authorization.receipt);
  assert.equal(directVerification.valid, true);

  let authorizeCalls = 0;
  const replayPep = makePep({
    provider: {
      authorize: (input) => { authorizeCalls += 1; return signedProvider({}).authorize(input); },
      verify: () => true
    },
    replayStore: { reserve: () => false }
  });
  await expectCode(() => replayPep.execute(intent(), () => ({ writable: true, epoch: 1 }), () => undefined), 'RECEIPT_REPLAYED');
  assert.equal(authorizeCalls, 0);

  const wideningPep = makePep({
    provider: signedProvider({ effective: (request) => ({ ...request, clusterWritable: true }) })
  });
  await expectCode(() => wideningPep.execute(intent(), () => ({ writable: false, epoch: 4 }), () => undefined), 'RECEIPT_VERIFICATION_FAILED');

  let postAppendOperations = 0;
  let postAppendRecords = 0;
  const postAppendPep = makePep({
    provider: signedProvider({ verify: (_input, count) => count === 1 }),
    sink: () => { postAppendRecords += 1; }
  });
  await expectCode(
    () => postAppendPep.execute(intent(), () => ({ writable: true, epoch: 5 }), () => { postAppendOperations += 1; }),
    'RECEIPT_VERIFICATION_FAILED'
  );
  assert.equal(postAppendRecords, 1);
  assert.equal(postAppendOperations, 0);

  const requestStartedAtMs = nowMs;
  const staleProvider = signedProvider({ issueAt: () => new Date(requestStartedAtMs - 1).toISOString() });
  await expectCode(
    () => makePep({ provider: staleProvider }).execute(intent(), () => ({ writable: true, epoch: 6 }), () => undefined),
    'RECEIPT_VERIFICATION_FAILED'
  );

  const futureProvider = signedProvider({ issueAt: () => new Date(nowMs + 1).toISOString() });
  await expectCode(
    () => makePep({ provider: futureProvider }).execute(intent(), () => ({ writable: true, epoch: 7 }), () => undefined),
    'RECEIPT_VERIFICATION_FAILED'
  );

  const expiredProvider = signedProvider({
    issueAt: () => {
      const issuedAt = clock();
      nowMs += 1_001;
      return issuedAt;
    }
  });
  await expectCode(
    () => makePep({ provider: expiredProvider, receiptTtlMs: 1_000 }).execute(intent(), () => ({ writable: true, epoch: 8 }), () => undefined),
    'RECEIPT_EXPIRED'
  );

  const baseOptions = {
    authorityResolver: { resolve: () => authority },
    resourceResolver: { resolve: () => resource },
    receiptSink: { append: () => undefined }
  };
  assert.throws(
    () => new PlatformPolicyEnforcementPoint({ ...baseOptions }),
    (error) => error instanceof PlatformPolicyEnforcementError && error.code === 'ENFORCEMENT_UNAVAILABLE'
  );
  assert.throws(
    () => new PlatformPolicyEnforcementPoint({ ...baseOptions, kernel, provider: signedProvider({}) }),
    (error) => error instanceof PlatformPolicyEnforcementError && error.code === 'ENFORCEMENT_UNAVAILABLE'
  );
} catch (error) {
  runtimeFailure = error;
} finally {
  try {
    await server.stop();
  } catch (error) {
    runtimeFailure ??= error;
  }
  try {
    await rm(temporaryRoot, { recursive: true, force: true });
  } catch (error) {
    runtimeFailure ??= error;
  }
}

const status = runtimeFailure === undefined && assertionCount === expectedAssertionCount ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-O',
  requirement: 'PPK-002',
  phase: 'CORE_SERVICE_POLICY_PROVIDER_RUNTIME',
  status,
  assertionCount,
  expectedAssertionCount,
  passed: status === 'PASS' ? assertionCount : Math.max(0, assertionCount - 1),
  failed: status === 'PASS' ? 0 : 1,
  failure: runtimeFailure === undefined ? null : {
    name: runtimeFailure instanceof Error ? runtimeFailure.name : 'UnknownFailure',
    message: runtimeFailure instanceof Error ? runtimeFailure.message : String(runtimeFailure)
  },
  evidenceBoundary: {
    providerTransport: 'REAL_LOCAL_ADMIN_IPC',
    providerReceiptVerification: 'BEFORE_AND_AFTER_APPEND',
    crossProcessFenceToSqliteCommitAtomicity: 'NOT_IMPLEMENTED'
  },
  mandatoryTruth,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`30-O Core Service policy provider runtime: FAIL (${assertionCount}/${expectedAssertionCount} assertions).`);
  if (runtimeFailure !== undefined) console.error(runtimeFailure instanceof Error ? runtimeFailure.message : String(runtimeFailure));
  process.exit(1);
}
console.log(`30-O Core Service policy provider runtime: PASS (${assertionCount} assertions).`);
console.log(mandatoryTruth);
