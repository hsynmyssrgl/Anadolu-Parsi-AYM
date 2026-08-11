import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  PlatformPolicyEnforcementError,
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  assertActivePlatformPolicyTransactionContext
} from '../packages/platform-policy/src/index.ts';
import { CoreServiceRuntime } from '../apps/core-service/src/core-service-runtime.ts';

const workPlan = JSON.parse(await readFile('config/work-segmentation-plan.json', 'utf8'));
const successorRegression = process.argv.includes('--successor-regression') || workPlan.currentStep !== '30-M';
const noReport = process.argv.includes('--no-report');
const reportPath = successorRegression
  ? 'artifacts/validation/30-N-30-M-policy-enforcement-runtime-regression.json'
  : 'artifacts/validation/30-M-ppk-002-policy-enforcement-runtime.json';
const policyVersion = 'PPT-PLATFORM-POLICY-2026-08-04-V1';
const checks = [];
let nonceSequence = 0;
const check = async (label, operation) => {
  await operation();
  checks.push(label);
};
const expectCode = async (label, operation, code) => check(label, async () => {
  await assert.rejects(operation, (error) => error instanceof PlatformPolicyEnforcementError && error.code === code);
});
const kernelConfig = (overrides = {}) => ({
  policyVersion,
  signingKey: Buffer.alloc(32, 17),
  applicationCapabilities: { 'windows-core-service': ['archive.read', 'archive.write', 'family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'share', 'record', 'administer'],
  ...overrides
});
const baseAuthority = (overrides = {}) => ({
  policyVersion,
  accountId: 'account-30m',
  personId: 'person-30m',
  deviceId: 'device-30m',
  applicationId: 'windows-core-service',
  deviceTrusted: true,
  membershipActive: true,
  roles: ['adult_member'],
  familyIds: ['family-30m'],
  online: true,
  expiresAt: '2026-08-06T06:30:00.000Z',
  ...overrides
});
const baseResource = (overrides = {}) => ({
  type: 'archive_item',
  id: 'archive-30m',
  familyId: 'family-30m',
  ownerPersonId: 'person-30m',
  sensitivity: 'personal',
  ...overrides
});
const baseIntent = (overrides = {}) => ({
  correlationId: `corr-30m-${++nonceSequence}`,
  action: 'update',
  capability: 'archive.write',
  resourceType: 'archive_item',
  resourceId: 'archive-30m',
  ...overrides
});
const makeHarness = (options = {}) => {
  let nowMs = Date.parse(options.now ?? '2026-08-06T06:00:00.000Z');
  let authority = baseAuthority(options.authority);
  let resource = options.resource === null ? null : baseResource(options.resource);
  let sinkFailure = options.sinkFailure;
  const records = [];
  const order = [];
  const kernel = options.kernel ?? new PlatformPolicyKernel(kernelConfig(options.kernelConfig));
  const clock = () => new Date(nowMs).toISOString();
  const harness = {
    records,
    order,
    kernel,
    clock,
    advance: (milliseconds) => { nowMs += milliseconds; },
    setAuthority: (next) => { authority = next; },
    setResource: (next) => { resource = next; },
    setSinkFailure: (next) => { sinkFailure = next; }
  };
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: {
      resolve: async () => {
        order.push('authority');
        if (options.authorityFailure) throw options.authorityFailure;
        await options.onAuthorityResolve?.(harness);
        return authority;
      }
    },
    resourceResolver: {
      resolve: async (intent, resolvedAuthority) => {
        order.push('resource');
        await options.onResourceResolve?.(harness, intent, resolvedAuthority);
        if (options.resourceFailure) throw options.resourceFailure;
        return resource;
      }
    },
    receiptSink: {
      append: async (record) => {
        order.push('sink');
        await options.onSink?.(harness, record);
        if (sinkFailure) throw sinkFailure;
        records.push(record);
      }
    },
    clock,
    nonceFactory: options.nonceFactory ?? (() => `nonce-30m-${++nonceSequence}`),
    ...(options.receiptTtlMs !== undefined ? { receiptTtlMs: options.receiptTtlMs } : {}),
    ...(options.replayStore ? { replayStore: options.replayStore } : {})
  });
  return { ...harness, pep };
};

const allowedHarness = makeHarness();
const allowedIntent = baseIntent();
let capturedContext;
const allowedResult = await allowedHarness.pep.execute(allowedIntent, () => ({ writable: true, epoch: 1 }), (context) => {
  allowedHarness.order.push('operation');
  assert.equal(allowedHarness.records.length, 1);
  assertActivePlatformPolicyTransactionContext(context, {
    resourceType: 'archive_item', resourceId: 'archive-30m', action: 'update', capability: 'archive.write'
  });
  capturedContext = context;
  return 'committed';
});
await check('allowed flow resolves authority and resource, persists receipt, then opens the operation', async () => {
  assert.equal(allowedResult, 'committed');
  assert.deepEqual(allowedHarness.order, ['authority', 'resource', 'sink', 'operation']);
  assert.equal(allowedHarness.records[0].request.subject.accountId, 'account-30m');
  assert.equal(allowedHarness.kernel.verifyReceiptForRequest(allowedHarness.records[0].receipt, allowedHarness.records[0].request), true);
});
await check('captured transaction context expires when the callback returns', async () => {
  assert.throws(() => assertActivePlatformPolicyTransactionContext(capturedContext), (error) => error.code === 'TRANSACTION_CONTEXT_INVALID');
});
await check('forged transaction context is rejected', async () => {
  assert.throws(() => assertActivePlatformPolicyTransactionContext({}), (error) => error.code === 'TRANSACTION_CONTEXT_INVALID');
});

const mismatchHarness = makeHarness();
await expectCode('context cannot be reused for another repository action', () => mismatchHarness.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), (context) => {
  assertActivePlatformPolicyTransactionContext(context, { resourceType: 'archive_item', resourceId: 'archive-30m', action: 'delete', capability: 'archive.write' });
}), 'TRANSACTION_CONTEXT_MISMATCH');

await expectCode('caller cannot smuggle subject or role fields through bounded intent', () => makeHarness().pep.execute({ ...baseIntent(), accountId: 'forged', roles: ['family_admin'] }, () => ({ writable: true, epoch: 1 }), () => undefined), 'INTENT_INVALID');

const record = allowedHarness.records[0];
await check('caller-supplied forged decision cannot be signed', async () => {
  assert.throws(() => allowedHarness.kernel.issueReceipt(record.request, { ...record.decision, allowed: false }, record.recordedAt, 'forged-decision-nonce'));
});
await check('receipt is bound to correlation action resource and current evaluation', async () => {
  assert.equal(allowedHarness.kernel.verifyReceiptForRequest(record.receipt, record.request), true);
  assert.equal(allowedHarness.kernel.verifyReceiptForRequest(record.receipt, { ...record.request, correlationId: 'changed' }), false);
  assert.equal(allowedHarness.kernel.verifyReceiptForRequest(record.receipt, { ...record.request, action: 'delete' }), false);
  assert.equal(allowedHarness.kernel.verifyReceiptForRequest(record.receipt, { ...record.request, resource: { ...record.request.resource, id: 'other' } }), false);
});

const replayMutableIntent = baseIntent({ action: 'read', capability: 'archive.read' });
const replayMutationHarness = makeHarness({
  replayStore: {
    reserve: async () => {
      replayMutableIntent.action = 'delete';
      replayMutableIntent.capability = 'archive.write';
      replayMutableIntent.correlationId = 'mutated-during-replay';
      return true;
    }
  }
});
let replayMutationContext;
await replayMutationHarness.pep.execute(replayMutableIntent, () => ({ writable: true, epoch: 1 }), (context) => { replayMutationContext = context; });
await check('intent mutation during async replay reservation cannot change signed record or callback context', async () => {
  const persisted = replayMutationHarness.records[0];
  assert.equal(persisted.request.action, 'read');
  assert.equal(persisted.request.capability, 'archive.read');
  assert.equal(persisted.action, 'read');
  assert.equal(persisted.capability, 'archive.read');
  assert.equal(replayMutationContext.action, 'read');
  assert.equal(replayMutationContext.capability, 'archive.read');
  assert.equal(replayMutationHarness.kernel.verifyReceiptForRequest(persisted.receipt, persisted.request), true);
});

const sinkMutableIntent = baseIntent({ action: 'read', capability: 'archive.read' });
const sinkMutationHarness = makeHarness({
  onSink: () => {
    sinkMutableIntent.action = 'delete';
    sinkMutableIntent.capability = 'archive.write';
    sinkMutableIntent.resourceId = 'mutated-resource';
  }
});
let sinkMutationContext;
await sinkMutationHarness.pep.execute(sinkMutableIntent, () => ({ writable: true, epoch: 1 }), (context) => { sinkMutationContext = context; });
await check('intent mutation during async receipt persistence cannot change signed record or callback context', async () => {
  const persisted = sinkMutationHarness.records[0];
  assert.equal(persisted.request.action, 'read');
  assert.equal(persisted.request.capability, 'archive.read');
  assert.equal(persisted.resourceId, 'archive-30m');
  assert.equal(sinkMutationContext.action, 'read');
  assert.equal(sinkMutationContext.capability, 'archive.read');
  assert.equal(sinkMutationContext.resourceId, 'archive-30m');
  assert.equal(sinkMutationHarness.kernel.verifyReceiptForRequest(persisted.receipt, persisted.request), true);
});

await expectCode('malformed authority booleans fail with a normalized enforcement error', () => makeHarness({ authority: { deviceTrusted: 'false' } }).pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => undefined), 'AUTHORITY_INVALID');
await expectCode('authority resolver failure blocks the operation', () => makeHarness({ authorityFailure: new Error('authority offline') }).pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => undefined), 'AUTHORITY_RESOLUTION_FAILED');
await expectCode('null resource resolver output fails closed', () => makeHarness({ resource: null }).pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => undefined), 'RESOURCE_RESOLUTION_FAILED');
await expectCode('resource identity mismatch fails closed', () => makeHarness({ resource: { id: 'other-archive' } }).pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => undefined), 'RESOURCE_MISMATCH');
await expectCode('expired connection authority fails closed', () => makeHarness({ authority: { expiresAt: '2026-08-06T06:00:00.000Z' } }).pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => undefined), 'AUTHORITY_EXPIRED');

await check('NaN infinity fractional and out-of-range receipt TTL values are rejected', async () => {
  for (const receiptTtlMs of [Number.NaN, Number.POSITIVE_INFINITY, 1500.5, 999, 300001]) {
    assert.throws(() => makeHarness({ receiptTtlMs }), (error) => error.code === 'RECEIPT_VERIFICATION_FAILED');
  }
});

const sinkRetryNonce = `sink-retry-${++nonceSequence}`;
const sinkRetry = makeHarness({ sinkFailure: new Error('disk full'), nonceFactory: () => sinkRetryNonce });
let sinkRetryOperations = 0;
await expectCode('receipt persistence failure blocks the operation', () => sinkRetry.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => { sinkRetryOperations += 1; }), 'RECEIPT_PERSISTENCE_FAILED');
sinkRetry.setSinkFailure(undefined);
await expectCode('nonce remains reserved after receipt persistence failure', () => sinkRetry.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => { sinkRetryOperations += 1; }), 'RECEIPT_REPLAYED');
await check('sink failure and replay retry never opened the operation', async () => assert.equal(sinkRetryOperations, 0));

const denied = makeHarness({ authority: { deviceTrusted: false } });
let deniedOperations = 0;
await expectCode('signed policy denial is persisted before callback rejection', () => denied.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => { deniedOperations += 1; }), 'POLICY_DENIED');
await check('deny receipt is persisted and operation remains closed', async () => {
  assert.equal(denied.records.length, 1);
  assert.equal(denied.records[0].decision.allowed, false);
  assert.equal(deniedOperations, 0);
});

const versionDenied = makeHarness({ authority: { policyVersion: 'PPT-POLICY-OLD' } });
await expectCode('policy-version mismatch produces a persisted denial instead of an unverifiable receipt', () => versionDenied.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => undefined), 'POLICY_DENIED');
await check('policy-version mismatch denial receipt verifies against its canonical request', async () => {
  assert.equal(versionDenied.records[0].decision.reason, 'POLICY_VERSION_MISMATCH');
  assert.equal(versionDenied.kernel.verifyReceiptForRequest(versionDenied.records[0].receipt, versionDenied.records[0].request), true);
});

const sharedNonce = `cross-instance-${++nonceSequence}`;
const crossOne = makeHarness({ nonceFactory: () => sharedNonce });
const crossTwo = makeHarness({ nonceFactory: () => sharedNonce });
await crossOne.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => 'first');
await expectCode('default replay reservation rejects the same nonce across PEP instances', () => crossTwo.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => 'second'), 'RECEIPT_REPLAYED');

let ttlOperations = 0;
const ttlHarness = makeHarness({ onSink: (harness) => harness.advance(30_001) });
await expectCode('receipt TTL is rechecked after persistence', () => ttlHarness.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => { ttlOperations += 1; }), 'RECEIPT_EXPIRED');
await check('expired receipt never opens the operation', async () => assert.equal(ttlOperations, 0));

let authorityExpiryOperations = 0;
const expiryHarness = makeHarness({ authority: { expiresAt: '2026-08-06T06:00:05.000Z' }, onSink: (harness) => harness.advance(5_001) });
await expectCode('authority expiry during receipt persistence blocks execution', () => expiryHarness.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), () => { authorityExpiryOperations += 1; }), 'RECEIPT_EXPIRED');
await check('authority expiry race never opens the operation', async () => assert.equal(authorityExpiryOperations, 0));

let safeModeRuntime;
const safeModeDuringResolve = makeHarness({ onResourceResolve: () => safeModeRuntime.enterSafeMode('RACE_DURING_RESOLUTION') });
safeModeRuntime = new CoreServiceRuntime({ policyKernel: safeModeDuringResolve.kernel, policyVersion, policyEnforcementPoint: safeModeDuringResolve.pep, clock: safeModeDuringResolve.clock });
safeModeRuntime.markReady('leader');
let safeResolveOperations = 0;
await expectCode('safe mode entered during resolution is reflected in the signed denial', () => safeModeRuntime.executeAuthorizedTransaction(baseIntent(), () => { safeResolveOperations += 1; }), 'POLICY_DENIED');
await check('resolution race persists CLUSTER_NOT_WRITABLE and never calls operation', async () => {
  assert.equal(safeModeDuringResolve.records[0].decision.reason, 'CLUSTER_NOT_WRITABLE');
  assert.equal(safeResolveOperations, 0);
});

let sinkRaceRuntime;
const safeModeDuringSink = makeHarness({ onSink: () => sinkRaceRuntime.enterSafeMode('RACE_DURING_SINK') });
sinkRaceRuntime = new CoreServiceRuntime({ policyKernel: safeModeDuringSink.kernel, policyVersion, policyEnforcementPoint: safeModeDuringSink.pep, clock: safeModeDuringSink.clock });
sinkRaceRuntime.markReady('leader');
let sinkRaceOperations = 0;
await expectCode('cluster fence change during receipt persistence blocks execution', () => sinkRaceRuntime.executeAuthorizedTransaction(baseIntent(), () => { sinkRaceOperations += 1; }), 'CLUSTER_FENCE_CHANGED');
await check('sink fence race never opens the operation', async () => assert.equal(sinkRaceOperations, 0));

const missingPepKernel = new PlatformPolicyKernel(kernelConfig());
const missingPepRuntime = new CoreServiceRuntime({ policyKernel: missingPepKernel, policyVersion });
missingPepRuntime.markReady('standalone');
await check('Core Service without PEP fails closed synchronously', async () => {
  assert.throws(() => missingPepRuntime.executeAuthorizedTransaction(baseIntent(), () => undefined), (error) => error.code === 'ENFORCEMENT_UNAVAILABLE');
});

const validCoreHarness = makeHarness();
const validCoreRuntime = new CoreServiceRuntime({ policyKernel: validCoreHarness.kernel, policyVersion, policyEnforcementPoint: validCoreHarness.pep, clock: validCoreHarness.clock });
validCoreRuntime.markReady('standalone');
await check('Core Service executes one valid fenced policy transaction', async () => {
  assert.equal(await validCoreRuntime.executeAuthorizedTransaction(baseIntent(), (context) => {
    assertActivePlatformPolicyTransactionContext(context);
    return 'core-committed';
  }), 'core-committed');
});

const stoppedCoreHarness = makeHarness();
const stoppedCoreRuntime = new CoreServiceRuntime({ policyKernel: stoppedCoreHarness.kernel, policyVersion, policyEnforcementPoint: stoppedCoreHarness.pep, clock: stoppedCoreHarness.clock });
stoppedCoreRuntime.markReady('standalone');
stoppedCoreRuntime.finishShutdown();
let stoppedOperations = 0;
await expectCode('stopped Core Service denies writes even when finishShutdown is called directly', () => stoppedCoreRuntime.executeAuthorizedTransaction(baseIntent(), () => { stoppedOperations += 1; }), 'POLICY_DENIED');
await check('stopped lifecycle is always non-writable safe mode and never opens the operation', async () => {
  const health = stoppedCoreRuntime.health();
  assert.equal(health.lifecycle, 'stopped');
  assert.equal(health.writable, false);
  assert.equal(health.safeMode, true);
  assert.equal(stoppedOperations, 0);
  assert.equal(stoppedCoreHarness.records[0].decision.reason, 'CLUSTER_NOT_WRITABLE');
});

await check('kernel config and signing key are defensive copies', async () => {
  const capabilities = ['archive.write'];
  const signingKey = Buffer.alloc(32, 51);
  const kernel = new PlatformPolicyKernel(kernelConfig({ signingKey, applicationCapabilities: { 'windows-core-service': capabilities } }));
  const request = record.request;
  const authorization = kernel.authorizeWithReceipt(request, record.recordedAt, `copy-${++nonceSequence}`);
  capabilities.length = 0;
  signingKey.fill(0);
  assert.equal(kernel.evaluate(request).allowed, true);
  assert.equal(kernel.verifyReceiptForRequest(authorization.receipt, request), true);
});
await check('read capability cannot authorize delete action', async () => {
  const request = { ...record.request, action: 'delete', capability: 'family.read', resource: { ...record.request.resource, type: 'family', id: 'family-30m' } };
  assert.equal(allowedHarness.kernel.evaluate(request).reason, 'ACTION_CAPABILITY_MISMATCH');
});
await check('strict internal request without owner or explicit grant is denied', async () => {
  const request = { ...record.request, subject: { ...record.request.subject, personId: 'other-person' }, resource: { ...record.request.resource, ownerPersonId: undefined, sensitivity: 'internal' } };
  assert.equal(allowedHarness.kernel.evaluate(request).reason, 'OWNER_OR_GRANT_REQUIRED');
});
await check('family scope mismatch is denied', async () => {
  const request = { ...record.request, resource: { ...record.request.resource, familyId: 'other-family' } };
  assert.equal(allowedHarness.kernel.evaluate(request).reason, 'RESOURCE_SCOPE_DENIED');
});

let mutationOperations = 0;
const mutationHarness = makeHarness({
  resource: { sensitivity: 'sensitive' },
  onSink: (_harness, receiptRecord) => { receiptRecord.decision.obligations[0].type = 'no_export'; }
});
await expectCode('sink cannot mutate deeply frozen receipt obligations', () => mutationHarness.pep.execute(baseIntent({ purpose: 'archive-maintenance' }), () => ({ writable: true, epoch: 1 }), () => { mutationOperations += 1; }), 'RECEIPT_PERSISTENCE_FAILED');
await check('sink mutation attempt never opens the operation', async () => assert.equal(mutationOperations, 0));

const expiringContextHarness = makeHarness();
await expectCode('active context enforces TTL during a long callback', () => expiringContextHarness.pep.execute(baseIntent(), () => ({ writable: true, epoch: 1 }), (context) => {
  expiringContextHarness.advance(30_001);
  assertActivePlatformPolicyTransactionContext(context);
}), 'RECEIPT_EXPIRED');

let callbackFenceRuntime;
const callbackFenceHarness = makeHarness();
callbackFenceRuntime = new CoreServiceRuntime({ policyKernel: callbackFenceHarness.kernel, policyVersion, policyEnforcementPoint: callbackFenceHarness.pep, clock: callbackFenceHarness.clock });
callbackFenceRuntime.markReady('leader');
await expectCode('active context detects safe mode transition inside callback', () => callbackFenceRuntime.executeAuthorizedTransaction(baseIntent(), (context) => {
  callbackFenceRuntime.enterSafeMode('RACE_IN_CALLBACK');
  assertActivePlatformPolicyTransactionContext(context);
}), 'CLUSTER_FENCE_CHANGED');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: successorRegression ? workPlan.currentStep : '30-M',
  requirement: 'PPK-002',
  phase: successorRegression ? '30-M_PREDECESSOR_REGRESSION' : 'POLICY_ENFORCEMENT_FOUNDATION',
  status: 'PASS',
  checkCount: checks.length,
  passed: checks.length,
  failed: 0,
  checks,
  failures: [],
  assertions: {
    boundedIntentAndTrustedResolvers: 'PASS',
    requestBoundFreshReceipt: 'PASS',
    sinkBeforeOperationAndPostSinkVerification: 'PASS',
    denialPersistence: 'PASS',
    ttlAuthorityExpiryAndReplay: 'PASS',
    clusterFence: 'PASS',
    opaqueCallbackContext: 'PASS',
    coreServiceFailClosed: 'PASS'
  },
  evidenceBoundary: {
    controlledRuntime: true,
    scopedFoundation: 'PASS',
    historical30MReportMutated: false,
    universalRepositoryEnforcement: 'NOT_COMPLETE',
    productionStartupPepWired: false,
    durableMultiProcessReplayProtection: 'NOT_RUN_NOT_PASS',
    receiptAndBusinessCommitAtomicity: 'NOT_RUN_NOT_PASS',
    obligationExecution: 'NOT_RUN_NOT_PASS',
    legacyRepositoryPathsMigrated: false,
    requirementCompletionClaimed: false,
    scopeStatus: 'PARTIAL'
  },
  generatedAt: new Date().toISOString()
};
if (!noReport) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`${successorRegression ? '30-M predecessor runtime regression' : '30-M PPK-002 policy enforcement runtime'}: PASS (${checks.length} controlled checks; PPK-002 remains PARTIAL).`);
