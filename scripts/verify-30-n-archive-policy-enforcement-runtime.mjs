import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AssignArchiveRetentionPolicyUseCase,
  CreateArchiveCategoryUseCase,
  CreateArchiveRetentionPolicyUseCase,
  ImportArchiveItemUseCase,
  MarkArchiveDestroyedUseCase,
  PrepareArchiveDestructionUseCase,
  RecordArchiveOpenedUseCase,
  UpdateArchiveClassificationUseCase
} from '@ppt/application';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  assertActivePlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import { assertPolicyAuthorizedRepositoryContext } from '@ppt/repository-contracts';
import {
  RepositoryBackedArchiveQueryPort,
  RepositoryBackedArchiveUnitOfWork,
  failClosedArchivePolicyEnforcementPointResolver
} from '../apps/desktop/dist/main/archive-application-adapter.js';
import { PlatformPolicyReceiptFileSink } from '../apps/desktop/dist/main/platform-policy-receipt-file-sink.js';
import { ProtectedSideArtifactStore } from '../apps/desktop/dist/main/protected-side-artifact-store.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workPlan = JSON.parse(await readFile(resolve(projectRoot, 'config/work-segmentation-plan.json'), 'utf8'));
const step30N = workPlan.steps?.find((item) => item.id === '30-N');
const successorRegression = process.argv.includes('--successor-regression') || workPlan.currentStep !== '30-N' || step30N?.status === 'COMPLETED';
const reportPath = resolve(
  projectRoot,
  successorRegression
    ? 'artifacts/validation/30-O-30-N-archive-policy-enforcement-runtime-regression.json'
    : 'artifacts/validation/30-N-ppk-002-archive-policy-enforcement-runtime.json'
);
const policyVersion = 'PPT-POLICY-30-N';
const occurredAt = '2026-08-06T06:30:00.000Z';
const familyId = 'family-30n';
const accountId = 'account-30n';
const personId = 'person-30n';
let nonceSequence = 0;

const checks = [];
const failures = [];

const serializeError = (error) => ({
  name: error instanceof Error ? error.name : 'UnknownError',
  message: error instanceof Error ? error.message : String(error),
  ...(error && typeof error === 'object' && 'code' in error ? { code: String(error.code) } : {})
});

const check = async (name, operation) => {
  try {
    await operation();
    checks.push({ name, status: 'PASS' });
  } catch (error) {
    const failure = { name, status: 'FAIL', error: serializeError(error) };
    checks.push(failure);
    failures.push(failure);
  }
};

const appError = (correlationId, message = 'Instrumented repository failure') => ({
  code: 'CORE-UNEXPECTED-001',
  message,
  category: 'infrastructure',
  retryable: false,
  correlationId
});

const ok = (value) => ({ ok: true, value });
const fail = (correlationId, message) => ({ ok: false, error: appError(correlationId, message) });

const kernelConfig = () => ({
  policyVersion,
  signingKey: Buffer.alloc(32, 0x30),
  applicationCapabilities: { 'windows-desktop': ['archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

class ControlledTestDeviceSecretProtector {
  protectionId = 'controlled-test-device-protector-30n';
  required = true;

  isAvailable() { return true; }

  protect(secret) {
    return Buffer.from(`controlled-30n:${secret}`, 'utf8').toString('base64url');
  }

  unprotect(protectedValue) {
    const opened = Buffer.from(protectedValue, 'base64url').toString('utf8');
    if (!opened.startsWith('controlled-30n:')) throw new Error('CONTROLLED_TEST_PROTECTOR_INVALID');
    return opened.slice('controlled-30n:'.length);
  }
}

const controlledMonotonicAuthority = () => ({
  epoch: 0,
  checkpoint: undefined,
  async checkpointPolicyJournal(input) {
    this.epoch += 1;
    this.checkpoint = Object.freeze({ ...input });
    return Object.freeze({
      schemaVersion: 1,
      authorityEpoch: this.epoch,
      ...input,
      checkpointHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      acceptedAt: occurredAt
    });
  }
});

const grantFor = (intent, effect = 'allow', id = `${effect}-grant-30n`) => ({
  id,
  subjectAccountId: accountId,
  resourceType: intent.resourceType,
  resourceId: intent.resourceId,
  actions: [intent.action],
  purposes: [intent.purpose],
  effect,
  startsAt: '2026-08-06T05:30:00.000Z',
  endsAt: '2026-08-06T08:30:00.000Z'
});

const makeHarness = (options = {}) => {
  let nowMs = Date.parse(occurredAt);
  let fence = { writable: true, epoch: 1 };
  const order = [];
  const receipts = [];
  const mutations = [];
  const repoCalls = [];
  const transactions = { begins: 0, commits: 0, rollbacks: 0 };
  const context = {
    familyId,
    actor: {
      userId: options.accountId ?? accountId,
      role: options.role ?? 'adult_member',
      personId: options.personId ?? personId
    },
    correlationId: options.correlationId ?? `corr-30n-${++nonceSequence}`
  };
  const clock = () => new Date(nowMs).toISOString();
  const clusterFence = () => Object.freeze({ ...fence });
  const kernel = new PlatformPolicyKernel(kernelConfig());

  const authority = {
    policyVersion,
    accountId: options.authorityAccountId ?? context.actor.userId,
    personId: options.authorityPersonId ?? context.actor.personId,
    deviceId: 'device-30n',
    applicationId: 'windows-desktop',
    deviceTrusted: options.deviceTrusted ?? true,
    membershipActive: options.membershipActive ?? true,
    roles: options.authorityRoles ?? [context.actor.role],
    familyIds: options.authorityFamilyIds ?? [context.familyId],
    online: true,
    grants: options.grants ?? [],
    expiresAt: options.authorityExpiresAt ?? '2026-08-06T08:30:00.000Z'
  };

  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: {
      resolve: async () => {
        order.push('authority');
        if (options.authorityFailure) throw options.authorityFailure;
        return authority;
      }
    },
    resourceResolver: {
      resolve: async (intent) => {
        order.push('resource');
        if (options.resourceFailure) throw options.resourceFailure;
        if (options.nullResource) return null;
        return {
          type: options.resourceType ?? intent.resourceType,
          id: options.resourceId ?? intent.resourceId,
          familyId: options.resourceFamilyId ?? context.familyId,
          sensitivity: options.sensitivity ?? 'internal'
        };
      }
    },
    receiptSink: {
      append: async (record) => {
        order.push('sink');
        await options.onSink?.({ record, setFence: (next) => { fence = { ...next }; }, advance: (milliseconds) => { nowMs += milliseconds; } });
        if (options.sinkFailure) throw options.sinkFailure;
        await options.receiptSink?.append(record);
        receipts.push(record);
      }
    },
    replayStore: options.replayStore ?? { reserve: () => true },
    nonceFactory: options.nonceFactory ?? (() => `nonce-30n-${++nonceSequence}`),
    clock,
    receiptTtlMs: options.receiptTtlMs ?? 30_000
  });

  const verify = (execution, expectation) => {
    assertPolicyAuthorizedRepositoryContext(execution, {
      ...expectation,
      correlationId: execution.correlationId,
      resourceFamilyId: context.familyId
    });
  };
  const recordRepositoryCall = (name, execution, expectation, mutates = true) => {
    if (expectation) verify(execution, expectation);
    else assertPolicyAuthorizedRepositoryContext(execution);
    order.push(`repo:${name}`);
    repoCalls.push(name);
    if (options.repositoryFailure === name) return fail(execution.correlationId, `Repository failure: ${name}`);
    if (mutates) mutations.push(`repo:${name}`);
    return undefined;
  };

  const archiveRepository = {
    list: () => ok([]),
    search: () => ok([]),
    find: () => ok(null),
    listVersions: () => ok([]),
    listRetentionPolicies: () => ok([]),
    listRetentionStatus: () => ok([]),
    listCategories: () => ok([]),
    listClassifications: () => ok([]),
    insert(execution, row) {
      const failure = recordRepositoryCall('insert', execution, { resourceType: 'archive_item', resourceId: row.id, action: 'create', capability: 'archive.write' });
      return failure ?? ok(undefined);
    },
    insertVersion(execution, row) {
      const failure = recordRepositoryCall('insertVersion', execution, { resourceType: 'archive_item', resourceId: row.archiveItemId, action: 'create', capability: 'archive.write' });
      return failure ?? ok(undefined);
    },
    insertRetentionPolicy(execution, row) {
      const failure = recordRepositoryCall('insertRetentionPolicy', execution, { resourceType: 'archive_retention_policy', resourceId: row.id, action: 'create', capability: 'archive.write' });
      return failure ?? ok(undefined);
    },
    assignRetentionPolicy(execution, itemId) {
      const failure = recordRepositoryCall('assignRetentionPolicy', execution, { resourceType: 'archive_item', resourceId: itemId, action: 'update', capability: 'archive.write' });
      return failure ?? ok(undefined);
    },
    getDestructionPlan(execution, itemId) {
      const failure = recordRepositoryCall('getDestructionPlan', execution, { resourceType: 'archive_item', resourceId: itemId, action: 'delete', capability: 'archive.write' }, false);
      return failure ?? ok({ storedName: 'archive-30n.bin', secureDestroy: true });
    },
    markDestroyed(execution, itemId) {
      const failure = recordRepositoryCall('markDestroyed', execution, { resourceType: 'archive_item', resourceId: itemId, action: 'delete', capability: 'archive.write' });
      return failure ?? ok(undefined);
    },
    insertCategory(execution, row) {
      const failure = recordRepositoryCall('insertCategory', execution, { resourceType: 'archive_category', resourceId: row.id, action: 'create', capability: 'archive.write' });
      return failure ?? ok(undefined);
    },
    updateClassification(execution, input) {
      const failure = recordRepositoryCall('updateClassification', execution, { resourceType: 'archive_item', resourceId: input.itemId, action: 'update', capability: 'archive.write' });
      return failure ?? ok(undefined);
    },
    incrementEventAttachment(execution) {
      const failure = recordRepositoryCall('incrementEventAttachment', execution);
      return failure ?? ok(undefined);
    }
  };

  const auditRepository = {
    append(execution) {
      assertPolicyAuthorizedRepositoryContext(execution);
      order.push('audit:append');
      repoCalls.push('audit.append');
      if (options.repositoryFailure === 'audit.append') return fail(execution.correlationId, 'Audit repository failure');
      mutations.push('audit:append');
      return ok('audit-hash-30n');
    }
  };
  const outboxRepository = {
    enqueue(execution) {
      assertPolicyAuthorizedRepositoryContext(execution);
      order.push('outbox:enqueue');
      repoCalls.push('outbox.enqueue');
      if (options.repositoryFailure === 'outbox.enqueue') return fail(execution.correlationId, 'Outbox repository failure');
      mutations.push('outbox:enqueue');
      return ok(undefined);
    }
  };

  const transactionExecutor = {
    execute(correlationId, operation) {
      const mutationStart = mutations.length;
      transactions.begins += 1;
      order.push('BEGIN');
      try {
        options.onAfterBegin?.({ setFence: (next) => { fence = { ...next }; }, advance: (milliseconds) => { nowMs += milliseconds; } });
        const result = operation({ transaction: Object.freeze({ kind: 'instrumented-transaction-30n' }), correlationId, occurredAt: clock() });
        if (!result.ok) {
          mutations.splice(mutationStart);
          transactions.rollbacks += 1;
          order.push('ROLLBACK');
          return result;
        }
        transactions.commits += 1;
        order.push('COMMIT');
        return result;
      } catch (error) {
        mutations.splice(mutationStart);
        transactions.rollbacks += 1;
        order.push('ROLLBACK');
        throw error;
      }
    }
  };

  const accountRepository = {
    findById: () => ok({
      id: context.actor.userId,
      displayName: '30-N actor',
      email: 'actor-30n@example.invalid',
      passwordRecord: 'not-used',
      role: context.actor.role,
      status: 'active',
      personId: context.actor.personId,
      startsAt: '2026-08-06T05:30:00.000Z',
      failedLoginCount: 0,
      securityEpoch: 0,
      createdAt: '2026-08-06T05:30:00.000Z'
    })
  };
  const permissionRepository = { listActiveForSubject: () => ok([]) };
  const policyEnforcementPointResolver = options.policyEnforcementPointResolver ?? { resolve: () => pep };
  const dependencies = {
    transactionExecutor,
    archiveRepository,
    accountRepository,
    permissionRepository,
    auditRepository,
    outboxRepository,
    policyEnforcementPointResolver,
    clusterFence
  };

  return {
    context,
    kernel,
    pep,
    clusterFence,
    dependencies,
    unitOfWork: new RepositoryBackedArchiveUnitOfWork(dependencies),
    queryPort: new RepositoryBackedArchiveQueryPort(dependencies),
    order,
    receipts,
    mutations,
    repoCalls,
    transactions,
    advance: (milliseconds) => { nowMs += milliseconds; },
    setFence: (next) => { fence = { ...next }; }
  };
};

const definitions = [
  {
    name: 'archive import maps to create/archive_item/archive.write',
    intent: { action: 'create', capability: 'archive.write', resourceType: 'archive_item', resourceId: 'archive-import-30n', purpose: 'archive' },
    run: (harness) => new ImportArchiveItemUseCase(harness.unitOfWork).execute({
      context: harness.context,
      command: {
        title: '30-N governed archive',
        originalName: 'archive.txt',
        storedName: 'archive-30n.bin',
        mimeType: 'text/plain',
        sizeBytes: 64,
        sha256: 'a'.repeat(64),
        linkedEventId: 'event-30n'
      },
      identifiers: { itemId: 'archive-import-30n', versionId: 'version-30n', auditId: 'audit-import-30n', outboxEventId: 'outbox-import-30n' }
    })
  },
  {
    name: 'retention creation maps to create/archive_retention_policy/archive.write',
    intent: { action: 'create', capability: 'archive.write', resourceType: 'archive_retention_policy', resourceId: 'retention-30n', purpose: 'archive' },
    run: (harness) => new CreateArchiveRetentionPolicyUseCase(harness.unitOfWork).execute({
      context: harness.context,
      command: { name: '30-N retention', retentionDays: 365, secureDestroy: true },
      identifiers: { policyId: 'retention-30n', auditId: 'audit-retention-30n' }
    })
  },
  {
    name: 'retention assignment maps to update/archive_item/archive.write',
    intent: { action: 'update', capability: 'archive.write', resourceType: 'archive_item', resourceId: 'archive-assign-30n', purpose: 'archive' },
    run: (harness) => new AssignArchiveRetentionPolicyUseCase(harness.unitOfWork).execute({
      context: harness.context,
      itemId: 'archive-assign-30n',
      policyId: 'retention-30n',
      identifiers: { auditId: 'audit-assign-30n' }
    })
  },
  {
    name: 'destruction preparation maps to delete/archive_item/archive.write',
    intent: { action: 'delete', capability: 'archive.write', resourceType: 'archive_item', resourceId: 'archive-plan-30n', purpose: 'archive' },
    run: (harness) => new PrepareArchiveDestructionUseCase(harness.queryPort).execute(harness.context, 'archive-plan-30n')
  },
  {
    name: 'destruction recording maps to delete/archive_item/archive.write',
    intent: { action: 'delete', capability: 'archive.write', resourceType: 'archive_item', resourceId: 'archive-delete-30n', purpose: 'archive' },
    run: (harness) => new MarkArchiveDestroyedUseCase(harness.unitOfWork).execute({
      context: harness.context,
      itemId: 'archive-delete-30n',
      identifiers: { auditId: 'audit-delete-30n' }
    })
  },
  {
    name: 'category creation maps to create/archive_category/archive.write',
    intent: { action: 'create', capability: 'archive.write', resourceType: 'archive_category', resourceId: 'category-30n', purpose: 'archive' },
    run: (harness) => new CreateArchiveCategoryUseCase(harness.unitOfWork).execute({
      context: harness.context,
      command: { name: '30-N category', description: 'Governed category' },
      identifiers: { categoryId: 'category-30n', auditId: 'audit-category-30n' }
    })
  },
  {
    name: 'classification update maps to update/archive_item/archive.write',
    intent: { action: 'update', capability: 'archive.write', resourceType: 'archive_item', resourceId: 'archive-classification-30n', purpose: 'archive' },
    run: (harness) => new UpdateArchiveClassificationUseCase(harness.unitOfWork).execute({
      context: harness.context,
      command: { itemId: 'archive-classification-30n', categoryId: 'category-30n', tagNames: ['30-N'], sensitivity: 'personal', aiProcessingAllowed: false },
      identifiers: { auditId: 'audit-classification-30n', tagIds: ['tag-30n'] }
    })
  },
  {
    name: 'opened audit maps to record/archive_item/archive.write',
    intent: { action: 'record', capability: 'archive.write', resourceType: 'archive_item', resourceId: 'archive-opened-30n', purpose: 'archive' },
    run: (harness) => new RecordArchiveOpenedUseCase(harness.unitOfWork).execute({
      context: harness.context,
      itemId: 'archive-opened-30n',
      identifiers: { auditId: 'audit-opened-30n' }
    })
  }
];

for (const definition of definitions) {
  await check(definition.name, async () => {
    const harness = makeHarness({
      correlationId: `corr-${definition.intent.resourceId}`,
      grants: [grantFor(definition.intent)]
    });
    const result = await definition.run(harness);
    assert.equal(result.ok, true);
    assert.equal(harness.receipts.length, 1);
    assert.deepEqual(
      {
        action: harness.receipts[0].action,
        capability: harness.receipts[0].capability,
        resourceType: harness.receipts[0].resourceType,
        resourceId: harness.receipts[0].resourceId,
        purpose: harness.receipts[0].request.purpose
      },
      definition.intent
    );
    assert.equal(harness.receipts[0].request.purpose, 'archive');
    assert.equal(harness.receipts[0].request.subject.roles.includes('adult_member'), true);
    assert.equal(harness.receipts[0].decision.matchedGrantId, 'allow-grant-30n');
    assert.equal(harness.transactions.begins, 1);
    assert.equal(harness.transactions.commits, 1);
    assert.equal(harness.transactions.rollbacks, 0);
    assert.ok(harness.order.indexOf('sink') < harness.order.indexOf('BEGIN'));
    assert.ok(harness.order.indexOf('BEGIN') < harness.order.findIndex((entry) => entry.startsWith('repo:') || entry.startsWith('audit:')));
  });
}

await check('explicit allow receipt is durable before BEGIN and every import repository mutation', async () => {
  const definition = definitions[0];
  const harness = makeHarness({ correlationId: 'corr-order-30n', grants: [grantFor(definition.intent)] });
  const result = await definition.run(harness);
  assert.equal(result.ok, true);
  assert.deepEqual(harness.order, [
    'authority', 'resource', 'sink', 'BEGIN', 'repo:insert', 'repo:incrementEventAttachment',
    'repo:insertVersion', 'audit:append', 'outbox:enqueue', 'COMMIT'
  ]);
});

await check('family_admin without owner or explicit grant is denied before transaction and repository access', async () => {
  const definition = definitions[1];
  const harness = makeHarness({ role: 'family_admin', grants: [] });
  const result = await definition.run(harness);
  assert.equal(result.ok, false);
  assert.equal(result.error.details?.enforcementCode, 'POLICY_DENIED');
  assert.equal(harness.receipts.length, 1);
  assert.equal(harness.receipts[0].decision.reason, 'OWNER_OR_GRANT_REQUIRED');
  assert.equal(harness.transactions.begins, 0);
  assert.equal(harness.repoCalls.length, 0);
  assert.equal(harness.mutations.length, 0);
});

await check('adult_member with matching explicit grant is allowed', async () => {
  const definition = definitions[5];
  const harness = makeHarness({ role: 'adult_member', grants: [grantFor(definition.intent)] });
  const result = await definition.run(harness);
  assert.equal(result.ok, true);
  assert.equal(harness.receipts[0].decision.reason, 'ALLOW_POLICY');
  assert.equal(harness.receipts[0].decision.matchedGrantId, 'allow-grant-30n');
  assert.equal(harness.transactions.commits, 1);
});

await check('matching explicit deny wins over explicit allow and blocks transaction', async () => {
  const definition = definitions[6];
  const harness = makeHarness({
    grants: [grantFor(definition.intent, 'allow'), grantFor(definition.intent, 'deny')]
  });
  const result = await definition.run(harness);
  assert.equal(result.ok, false);
  assert.equal(result.error.details?.enforcementCode, 'POLICY_DENIED');
  assert.equal(harness.receipts[0].decision.reason, 'EXPLICIT_DENY');
  assert.equal(harness.receipts[0].decision.matchedGrantId, 'deny-grant-30n');
  assert.equal(harness.transactions.begins, 0);
  assert.equal(harness.repoCalls.length, 0);
});

await check('missing policy resolver fails closed with zero transaction and repository access', async () => {
  const definition = definitions[5];
  const harness = makeHarness({
    grants: [grantFor(definition.intent)],
    policyEnforcementPointResolver: failClosedArchivePolicyEnforcementPointResolver
  });
  const result = await definition.run(harness);
  assert.equal(result.ok, false);
  assert.equal(result.error.details?.enforcementCode, 'ENFORCEMENT_UNAVAILABLE');
  assert.equal(harness.transactions.begins, 0);
  assert.equal(harness.repoCalls.length, 0);
  assert.equal(harness.receipts.length, 0);
});

const zeroEntryFailures = [
  {
    name: 'authority resolver failure',
    expectedCode: 'AUTHORITY_RESOLUTION_FAILED',
    options: { authorityFailure: new Error('authority unavailable') }
  },
  {
    name: 'resource resolver failure',
    expectedCode: 'RESOURCE_RESOLUTION_FAILED',
    options: { resourceFailure: new Error('resource unavailable') }
  },
  {
    name: 'resource identity mismatch',
    expectedCode: 'RESOURCE_MISMATCH',
    options: { resourceId: 'wrong-resource-30n' }
  },
  {
    name: 'receipt sink failure',
    expectedCode: 'RECEIPT_PERSISTENCE_FAILED',
    options: { sinkFailure: new Error('receipt store unavailable') }
  },
  {
    name: 'replay reservation failure',
    expectedCode: 'RECEIPT_REPLAYED',
    options: { replayStore: { reserve: () => false } }
  },
  {
    name: 'receipt expiry after sink',
    expectedCode: 'RECEIPT_EXPIRED',
    options: { receiptTtlMs: 1_000, onSink: ({ advance }) => advance(1_001) }
  },
  {
    name: 'cluster fence change after sink',
    expectedCode: 'CLUSTER_FENCE_CHANGED',
    options: { onSink: ({ setFence }) => setFence({ writable: false, epoch: 2 }) }
  }
];

for (const failureDefinition of zeroEntryFailures) {
  await check(`${failureDefinition.name} opens zero transactions and performs zero repository calls`, async () => {
    const definition = definitions[5];
    const harness = makeHarness({ grants: [grantFor(definition.intent)], ...failureDefinition.options });
    const result = await definition.run(harness);
    assert.equal(result.ok, false);
    assert.equal(result.error.details?.enforcementCode, failureDefinition.expectedCode);
    assert.equal(harness.transactions.begins, 0);
    assert.equal(harness.repoCalls.length, 0);
    assert.equal(harness.mutations.length, 0);
  });
}

await check('non-writable initial fence persists CLUSTER_NOT_WRITABLE denial and opens zero transactions', async () => {
  const definition = definitions[5];
  const harness = makeHarness({ grants: [grantFor(definition.intent)] });
  harness.setFence({ writable: false, epoch: 1 });
  const result = await definition.run(harness);
  assert.equal(result.ok, false);
  assert.equal(result.error.details?.enforcementCode, 'POLICY_DENIED');
  assert.equal(harness.receipts[0].decision.reason, 'CLUSTER_NOT_WRITABLE');
  assert.equal(harness.transactions.begins, 0);
  assert.equal(harness.repoCalls.length, 0);
});

await check('forged policy repository context is rejected', async () => {
  assert.throws(
    () => assertPolicyAuthorizedRepositoryContext({
      transaction: Object.freeze({}),
      actor: { userId: accountId, roles: ['adult_member'] },
      correlationId: 'corr-forged-30n',
      occurredAt,
      policyAuthorization: Object.freeze({})
    }),
    (error) => error?.code === 'TRANSACTION_CONTEXT_INVALID'
  );
});

await check('active policy context cannot cross its correlation or resource binding', async () => {
  const intent = definitions[5].intent;
  const correlationHarness = makeHarness({ correlationId: 'corr-binding-30n', grants: [grantFor(intent)] });
  await assert.rejects(
    () => correlationHarness.pep.execute(
      { correlationId: correlationHarness.context.correlationId, ...intent },
      correlationHarness.clusterFence,
      (authorization) => assertPolicyAuthorizedRepositoryContext({
        transaction: Object.freeze({}),
        actor: { userId: accountId, roles: ['adult_member'] },
        correlationId: 'corr-other-30n',
        occurredAt,
        policyAuthorization: authorization
      })
    ),
    (error) => error?.code === 'TRANSACTION_CONTEXT_MISMATCH'
  );

  const resourceHarness = makeHarness({ correlationId: 'corr-resource-binding-30n', grants: [grantFor(intent)] });
  await assert.rejects(
    () => resourceHarness.pep.execute(
      { correlationId: resourceHarness.context.correlationId, ...intent },
      resourceHarness.clusterFence,
      (authorization) => assertActivePlatformPolicyTransactionContext(authorization, {
        ...intent,
        resourceId: 'other-resource-30n',
        correlationId: resourceHarness.context.correlationId,
        resourceFamilyId: familyId
      })
    ),
    (error) => error?.code === 'TRANSACTION_CONTEXT_MISMATCH'
  );
});

await check('fence change after BEGIN rolls back before repository mutation', async () => {
  const definition = definitions[5];
  const harness = makeHarness({
    grants: [grantFor(definition.intent)],
    onAfterBegin: ({ setFence }) => setFence({ writable: false, epoch: 2 })
  });
  const result = await definition.run(harness);
  assert.equal(result.ok, false);
  assert.equal(result.error.details?.enforcementCode, 'CLUSTER_FENCE_CHANGED');
  assert.equal(harness.receipts.length, 1);
  assert.equal(harness.transactions.begins, 1);
  assert.equal(harness.transactions.commits, 0);
  assert.equal(harness.transactions.rollbacks, 1);
  assert.equal(harness.repoCalls.length, 0);
  assert.equal(harness.mutations.length, 0);
  assert.deepEqual(harness.order.slice(-2), ['BEGIN', 'ROLLBACK']);
});

await check('receipt remains persisted when business repository result rolls back', async () => {
  const definition = definitions[5];
  const harness = makeHarness({
    grants: [grantFor(definition.intent)],
    repositoryFailure: 'insertCategory'
  });
  const result = await definition.run(harness);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'CORE-UNEXPECTED-001');
  assert.equal(harness.receipts.length, 1);
  assert.equal(harness.receipts[0].decision.allowed, true);
  assert.equal(harness.transactions.begins, 1);
  assert.equal(harness.transactions.commits, 0);
  assert.equal(harness.transactions.rollbacks, 1);
  assert.deepEqual(harness.repoCalls, ['insertCategory']);
  assert.equal(harness.mutations.length, 0);
});

await check('actual encrypted file receipt journal appends, reads back, hides plaintext and rejects tamper or truncation', async () => {
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), 'ppt-30n-policy-receipt-'));
  const keyPath = resolve(temporaryRoot, 'keys', 'receipt-data-key.json');
  const macKeyPath = resolve(temporaryRoot, 'keys', 'receipt-journal-mac-key.json');
  const journalPath = resolve(temporaryRoot, 'journal', 'policy-receipts.jsonl');
  const protectedArtifactStore = new ProtectedSideArtifactStore({
    keyPath,
    applicationVersion: '4.8.2026-29',
    protector: new ControlledTestDeviceSecretProtector(),
    now: () => occurredAt
  });
  try {
    const receiptSink = new PlatformPolicyReceiptFileSink({
      filePath: journalPath,
      macKeyPath,
      macKeyProtector: new ControlledTestDeviceSecretProtector(),
      protectedArtifactStore,
      monotonicAuthority: controlledMonotonicAuthority()
    });
    const definition = definitions[5];
    const harness = makeHarness({
      correlationId: 'corr-encrypted-journal-30n',
      grants: [grantFor(definition.intent)],
      receiptSink
    });
    const result = await definition.run(harness);
    assert.equal(result.ok, true);
    assert.equal(harness.transactions.commits, 1);

    const inspection = receiptSink.inspectForControlledTest();
    assert.equal(inspection.exists, true);
    assert.equal(inspection.valid, true);
    assert.equal(inspection.entryCount, 1);
    assert.equal(inspection.protection, 'AES_256_GCM_AND_HMAC_SHA256_DEVICE_PROTECTED_KEYS');
    assert.equal(inspection.latestReceiptNonce, harness.receipts[0].receipt.nonce);

    const original = await readFile(journalPath);
    const journalText = original.toString('utf8');
    for (const plaintext of [
      harness.context.correlationId,
      definition.intent.resourceId,
      harness.receipts[0].receipt.nonce
    ]) assert.equal(journalText.includes(plaintext), false);

    const tamperedEntry = JSON.parse(journalText.trimEnd());
    tamperedEntry.entryHash = `${tamperedEntry.entryHash.startsWith('a') ? 'b' : 'a'}${tamperedEntry.entryHash.slice(1)}`;
    await writeFile(journalPath, `${JSON.stringify(tamperedEntry)}\n`, 'utf8');
    assert.throws(() => receiptSink.inspectForControlledTest(), /POLICY_RECEIPT_JOURNAL_HASH_CHAIN_INVALID/u);

    const blockedHarness = makeHarness({
      correlationId: 'corr-tampered-journal-30n',
      grants: [grantFor(definition.intent)],
      receiptSink
    });
    const blocked = await definition.run(blockedHarness);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error.details?.enforcementCode, 'RECEIPT_PERSISTENCE_FAILED');
    assert.equal(blockedHarness.transactions.begins, 0);
    assert.equal(blockedHarness.repoCalls.length, 0);

    await writeFile(journalPath, original);
    await writeFile(journalPath, original.subarray(0, original.byteLength - 1));
    assert.throws(() => receiptSink.inspectForControlledTest(), /POLICY_RECEIPT_JOURNAL_TRUNCATED/u);
    receiptSink.dispose();
  } finally {
    protectedArtifactStore.dispose();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: successorRegression ? '30-O' : '30-N',
  ...(successorRegression ? { predecessorStep: '30-N' } : {}),
  requirement: 'PPK-002',
  phase: successorRegression ? '30-N_PREDECESSOR_REGRESSION' : 'ARCHIVE_POLICY_ENFORCEMENT_VERTICAL_SLICE',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  assertions: {
    eightArchiveIntentMappings: failures.some((failure) => definitions.some((definition) => definition.name === failure.name)) ? 'FAIL' : 'PASS',
    explicitGrantAndReceiptBeforeTransaction: failures.some((failure) => failure.name.includes('explicit allow receipt')) ? 'FAIL' : 'PASS',
    roleAloneDoesNotAuthorize: failures.some((failure) => failure.name.includes('family_admin without')) ? 'FAIL' : 'PASS',
    explicitDenyPrecedence: failures.some((failure) => failure.name.includes('explicit deny')) ? 'FAIL' : 'PASS',
    failClosedBeforeRepository: failures.some((failure) => failure.name.includes('zero transaction') || failure.name.includes('zero transactions')) ? 'FAIL' : 'PASS',
    opaqueContextBinding: failures.some((failure) => failure.name.includes('forged') || failure.name.includes('binding')) ? 'FAIL' : 'PASS',
    fenceRollback: failures.some((failure) => failure.name.includes('after BEGIN')) ? 'FAIL' : 'PASS',
    receiptSurvivesBusinessRollback: failures.some((failure) => failure.name.includes('business repository')) ? 'FAIL' : 'PASS',
    encryptedFileReceiptJournal: failures.some((failure) => failure.name.includes('encrypted file receipt journal')) ? 'FAIL' : 'PASS'
  },
  evidenceBoundary: {
    controlledInstrumentedRuntime: true,
    ...(successorRegression ? { historical30NReportMutated: false } : {}),
    actualPlatformPolicyKernelAndPep: true,
    compiledDesktopArchiveAdapter: true,
    actualEncryptedFileReceiptJournal: true,
    journalTestKeyProtector: 'CONTROLLED_TEST_ONLY_NOT_OS_DEVICE_PROTECTION',
    productionDeviceSecretProtection: 'NOT_RUN_NOT_PASS',
    productionStartupPepWiring: 'NOT_COMPLETE',
    sqliteRepositoryRuntime: 'NOT_RUN_NOT_PASS',
    durableMultiProcessReplayProtection: 'NOT_RUN_NOT_PASS',
    receiptAndBusinessCommitAtomicity: 'NOT_IMPLEMENTED',
    obligationExecution: 'NOT_RUN_NOT_PASS',
    universalRepositoryMigration: 'NOT_COMPLETE',
    requirementCompletionClaimed: false,
    scopeStatus: 'PARTIAL'
  },
  generatedAt: new Date().toISOString()
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (failures.length > 0) {
  console.error(`${successorRegression ? '30-N predecessor archive policy enforcement runtime regression' : '30-N archive policy enforcement runtime'}: FAIL (${failures.length}/${checks.length} failed).`);
  process.exitCode = 1;
} else {
  console.log(`${successorRegression ? '30-N predecessor archive policy enforcement runtime regression' : '30-N archive policy enforcement runtime'}: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
}
