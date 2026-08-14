import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asIsoDateTime,
  asPersonId,
  asUserId
} from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import {
  EnforceDerivedDataInheritanceUseCase,
  GetDerivedDataPolicyBoundaryUseCase
} from '@ppt/application';
import {
  DERIVED_DATA_AUTHORIZED_REPOSITORY_ADAPTERS,
  DERIVED_DATA_AUTHORIZED_PRODUCER_ADAPTERS,
  DERIVED_DATA_AUTHORIZED_SEALED_METADATA_READERS,
  DERIVED_DATA_AUTHORIZED_SEALED_PAYLOAD_READ_PATHS,
  DERIVED_DATA_AUTHORIZED_METADATA_INVENTORY_READERS,
  DERIVED_DATA_DIRECT_ACCESS_EXCEPTIONS,
  DERIVED_DATA_KINDS,
  DERIVED_DATA_MAX_ANCESTOR_COUNT,
  DERIVED_DATA_MAX_LINEAGE_DEPTH,
  DerivedDataInheritancePolicy,
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type DerivedDataPolicyBinding,
  type DerivedDataSourcePolicySnapshot,
  type DerivedDataTargetPolicy,
  type DataSensitivity,
  type PlatformApplicationId,
  type PlatformCapability,
  type PlatformDataClass,
  type PlatformPolicyReceiptRecord,
  type PlatformPolicyTransactionContext,
  type PolicyAction
} from '@ppt/platform-policy';
import {
  SqliteDerivedDataPolicyRepository,
  canonicalPlatformPolicyJson,
  computeDerivedDataPolicySourceKey,
  computePlatformPolicyReceiptHash
} from '@ppt/repositories';
import type { PolicyAuthorizedRepositoryExecutionContext } from '@ppt/repository-contracts';

const HASH = {
  contentA: '1'.repeat(64),
  contentB: '2'.repeat(64),
  policy: '3'.repeat(64),
  receiptA: '4'.repeat(64),
  receiptB: '5'.repeat(64),
  contextA: '6'.repeat(64),
  contextB: '7'.repeat(64),
  requestA: '8'.repeat(64),
  requestB: '9'.repeat(64)
};
const RETENTION_LATE = '2027-08-12T00:00:00.000Z';
const RETENTION_EARLY = '2027-08-11T00:00:00.000Z';

const source = (
  overrides: Partial<DerivedDataSourcePolicySnapshot> = {}
): DerivedDataSourcePolicySnapshot => ({
  schemaVersion: 1,
  resourceType: 'archive_item',
  resourceId: 'source-a',
  resourceVersion: 'v1',
  contentSha256: HASH.contentA,
  familyId: 'family-ppk-016',
  policyVersion: 'PPK-016',
  policyPackageSha256: HASH.policy,
  receiptActive: true,
  receiptHash: HASH.receiptA,
  contextHash: HASH.contextA,
  requestHash: HASH.requestA,
  sensitivity: 'personal',
  dataClasses: ['personal'],
  allowedAccountIds: ['account-a', 'account-shared'],
  allowedApplicationIds: ['windows-desktop', 'ocr-worker'],
  allowedCapabilities: ['archive.read', 'archive.ocr'],
  allowedActions: ['read', 'process'],
  allowedPurposes: ['archive-preview', 'ocr_process'],
  obligations: [{ type: 'no_cache' }],
  retentionUntil: RETENTION_LATE,
  lineageDepth: 0,
  ancestorResources: [],
  ...overrides
});

const target = (
  overrides: Partial<DerivedDataTargetPolicy> = {}
): DerivedDataTargetPolicy => ({
  schemaVersion: 1,
  kind: 'OCR_TEXT',
  resourceType: 'ocr_text',
  resourceId: 'derived-a',
  resourceVersion: 'v1',
  contentSha256: 'a'.repeat(64),
  familyId: 'family-ppk-016',
  policyVersion: 'PPK-016',
  policyPackageSha256: HASH.policy,
  sensitivity: 'personal',
  dataClasses: ['personal'],
  allowedAccountIds: ['account-shared'],
  allowedApplicationIds: ['ocr-worker'],
  allowedCapabilities: ['archive.ocr'],
  allowedActions: ['process'],
  allowedPurposes: ['ocr_process'],
  obligations: [{ type: 'no_cache' }],
  retentionUntil: RETENTION_LATE,
  ...overrides
});

const secondSource = (
  overrides: Partial<DerivedDataSourcePolicySnapshot> = {}
): DerivedDataSourcePolicySnapshot => source({
  resourceType: 'health_record',
  resourceId: 'source-b',
  resourceVersion: 'v2',
  contentSha256: HASH.contentB,
  receiptHash: HASH.receiptB,
  contextHash: HASH.contextB,
  requestHash: HASH.requestB,
  sensitivity: 'highly_sensitive',
  dataClasses: ['health', 'child'],
  allowedAccountIds: ['account-b', 'account-shared'],
  allowedApplicationIds: ['ai-worker', 'ocr-worker'],
  allowedCapabilities: ['ai.process', 'archive.ocr'],
  allowedActions: ['process'],
  allowedPurposes: ['ocr_process'],
  obligations: [{ type: 'no_export' }],
  retentionUntil: RETENTION_EARLY,
  ...overrides
});

const multiSourceTarget = (
  overrides: Partial<DerivedDataTargetPolicy> = {}
): DerivedDataTargetPolicy => target({
  sensitivity: 'highly_sensitive',
  dataClasses: ['personal', 'health', 'child'],
  allowedAccountIds: ['account-shared'],
  allowedApplicationIds: ['ocr-worker'],
  allowedCapabilities: ['archive.ocr'],
  allowedActions: ['process'],
  allowedPurposes: ['ocr_process'],
  obligations: [{ type: 'no_export' }, { type: 'no_cache' }],
  retentionUntil: RETENTION_EARLY,
  ...overrides
});

const allowedBinding = (): DerivedDataPolicyBinding => {
  const decision = new DerivedDataInheritancePolicy().evaluate({ target: target(), sources: [source()] });
  if (!decision.allowed) throw new Error(`Test binding could not be created: ${decision.reason}`);
  return decision.binding;
};

const RUNTIME_NOW = asIsoDateTime('2026-08-11T12:00:00.000Z');
const RUNTIME_FAMILY_ID = 'family-ppk-016-runtime';
const RUNTIME_ACCOUNT_ID = 'account-ppk-016-runtime';
const RUNTIME_PERSON_ID = 'person-ppk-016-runtime';
const RUNTIME_APPLICATION_ID = 'ocr-worker' as const;
const RUNTIME_CAPABILITY = 'archive.ocr' as const;
const RUNTIME_ACTION = 'process' as const;
const RUNTIME_PURPOSE = 'ocr_process';
const runtimeDatabases: DatabaseSync[] = [];
let runtimeSequence = 0;

const runtimePolicyKernel = new PlatformPolicyKernel({
  policyVersion: 'PPK-016',
  signingKey: Buffer.from('ppk-016-derived-data-runtime-signing-key', 'utf8'),
  applicationCapabilities: {
    [RUNTIME_APPLICATION_ID]: [RUNTIME_CAPABILITY, 'ai.process'],
    'ai-worker': [RUNTIME_CAPABILITY, 'ai.process']
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});
const alternateRuntimePolicyKernel = new PlatformPolicyKernel({
  policyVersion: 'PPK-016',
  policyPackageVersion: 2,
  signingKey: Buffer.from('ppk-016-alternate-runtime-signing-key', 'utf8'),
  applicationVersions: { [RUNTIME_APPLICATION_ID]: 'v2' },
  applicationCapabilities: { [RUNTIME_APPLICATION_ID]: [RUNTIME_CAPABILITY] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

interface RuntimeResource {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceVersion: string;
  readonly contentSha256: string;
  readonly sensitivity: DataSensitivity;
  readonly dataClasses: readonly PlatformDataClass[];
}

interface RuntimeAuthorizationOptions {
  readonly kernel?: PlatformPolicyKernel;
  readonly accountId?: string;
  readonly personId?: string;
  readonly applicationId?: PlatformApplicationId;
  readonly capability?: PlatformCapability;
  readonly action?: PolicyAction;
  readonly purpose?: string;
  readonly online?: boolean;
  readonly occurredAt?: string;
}

interface InsertedRuntimeFixture {
  readonly database: DatabaseSync;
  readonly repository: SqliteDerivedDataPolicyRepository;
  readonly binding: DerivedDataPolicyBinding;
  readonly sources: readonly [DerivedDataSourcePolicySnapshot, DerivedDataSourcePolicySnapshot];
}

interface RuntimeInsertAttempt {
  readonly binding: DerivedDataPolicyBinding;
  readonly result: ReturnType<SqliteDerivedDataPolicyRepository['insertSealed']>;
}

const runtimeResource = (
  resourceType: string,
  resourceId: string,
  resourceVersion: string,
  contentSha256: string
): RuntimeResource => ({
  resourceType,
  resourceId,
  resourceVersion,
  contentSha256,
  sensitivity: 'personal',
  dataClasses: ['personal']
});

const RUNTIME_SOURCE_A = runtimeResource('archive_item', 'runtime-source-a', 'v1', HASH.contentA);
const RUNTIME_SOURCE_B = runtimeResource('archive_item', 'runtime-source-b', 'v1', HASH.contentB);
const RUNTIME_TARGET = runtimeResource('ocr_text', 'runtime-derived-a', 'v1', 'a'.repeat(64));
const RUNTIME_TARGET_B = runtimeResource('ocr_text', 'runtime-derived-b', 'v1', 'b'.repeat(64));
const RUNTIME_TARGET_C = runtimeResource('ocr_text', 'runtime-derived-c', 'v1', 'c'.repeat(64));

const makeRuntimeDatabase = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  runtimeDatabases.push(database);
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE database_metadata(
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    INSERT INTO database_metadata(key,value,updated_at)
    VALUES('schema_generation','before-ppk016','${RUNTIME_NOW}');
    CREATE TABLE platform_policy_transaction_receipts(
      receipt_hash TEXT PRIMARY KEY,
      request_hash TEXT NOT NULL,
      context_hash TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      policy_package_sha256 TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      data_classes_json TEXT NOT NULL,
      record_json TEXT NOT NULL
    ) STRICT;
  `);
  const migration = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 77);
  if (!migration) throw new Error('MIGRATION_77_NOT_FOUND');
  database.exec(migration.sql);
  return database;
};

afterEach(() => {
  while (runtimeDatabases.length > 0) runtimeDatabases.pop()?.close();
});

const repositoryContext = (
  database: DatabaseSync,
  authorization: PlatformPolicyTransactionContext
): PolicyAuthorizedRepositoryExecutionContext => ({
  transaction: database as never,
  actor: {
    userId: asUserId(authorization.subject.accountId),
    ...(authorization.subject.personId
      ? { personId: asPersonId(authorization.subject.personId) }
      : {}),
    roles: ['family_admin']
  },
  correlationId: asCorrelationId(authorization.correlationId),
  occurredAt: asIsoDateTime(authorization.occurredAt),
  policyAuthorization: authorization
});

const withRuntimeAuthorization = async <T>(
  database: DatabaseSync,
  resource: RuntimeResource,
  operation: (
    context: PolicyAuthorizedRepositoryExecutionContext,
    authorization: PlatformPolicyTransactionContext
  ) => T | Promise<T>,
  options: RuntimeAuthorizationOptions = {}
): Promise<T> => {
  runtimeSequence += 1;
  const sequence = runtimeSequence;
  const correlationId = `corr-ppk016-runtime-${sequence}`;
  const kernel = options.kernel ?? runtimePolicyKernel;
  const accountId = options.accountId ?? RUNTIME_ACCOUNT_ID;
  const personId = options.personId ?? RUNTIME_PERSON_ID;
  const applicationId = options.applicationId ?? RUNTIME_APPLICATION_ID;
  const capability = options.capability ?? RUNTIME_CAPABILITY;
  const action = options.action ?? RUNTIME_ACTION;
  const purpose = options.purpose ?? RUNTIME_PURPOSE;
  const enforcementPoint = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: kernel.policyPackage.payload.policyVersion,
        accountId,
        personId,
        deviceId: 'device-ppk-016-runtime',
        applicationId,
        deviceTrusted: true,
        membershipActive: true,
        roles: ['family_admin'],
        familyIds: [RUNTIME_FAMILY_ID],
        online: options.online ?? true,
        expiresAt: '2026-08-11T12:05:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: resource.resourceType,
        id: resource.resourceId,
        familyId: RUNTIME_FAMILY_ID,
        ownerPersonId: RUNTIME_PERSON_ID,
        sensitivity: resource.sensitivity,
        dataClasses: resource.dataClasses
      })
    },
    receiptSink: { append: () => undefined },
    replayStore: { reserve: () => true },
    clock: () => asIsoDateTime(options.occurredAt ?? RUNTIME_NOW),
    nonceFactory: () => `nonce-ppk016-runtime-${sequence}`
  });
  return enforcementPoint.execute({
    correlationId,
    action,
    capability,
    resourceType: resource.resourceType,
    resourceId: resource.resourceId,
    purpose
  }, () => ({ writable: true, epoch: 77 }), (authorization) =>
    operation(repositoryContext(database, authorization), authorization));
};

const persistRuntimeReceipt = (
  database: DatabaseSync,
  authorization: PlatformPolicyTransactionContext
): void => {
  const record: PlatformPolicyReceiptRecord = authorization.receiptRecord;
  database.prepare(`
    INSERT INTO platform_policy_transaction_receipts(
      receipt_hash,request_hash,context_hash,policy_version,policy_package_sha256,
      resource_type,resource_id,issued_at,data_classes_json,record_json
    ) VALUES(?,?,?,?,?,?,?,?,?,?)
  `).run(
    computePlatformPolicyReceiptHash(authorization.receipt),
    authorization.requestHash,
    authorization.contextHash,
    authorization.policyVersion,
    authorization.policyPackageSha256,
    authorization.resourceType,
    authorization.resourceId,
    authorization.receipt.issuedAt,
    canonicalPlatformPolicyJson(authorization.dataClasses),
    canonicalPlatformPolicyJson(record)
  );
};

const sourceFromAuthorization = (
  resource: RuntimeResource,
  authorization: PlatformPolicyTransactionContext
): DerivedDataSourcePolicySnapshot => source({
  resourceType: resource.resourceType,
  resourceId: resource.resourceId,
  resourceVersion: resource.resourceVersion,
  contentSha256: resource.contentSha256,
  familyId: authorization.resourceFamilyId,
  policyVersion: authorization.policyVersion,
  policyPackageSha256: authorization.policyPackageSha256,
  receiptHash: computePlatformPolicyReceiptHash(authorization.receipt),
  contextHash: authorization.contextHash,
  requestHash: authorization.requestHash,
  sensitivity: resource.sensitivity,
  dataClasses: resource.dataClasses,
  allowedAccountIds: [authorization.subject.accountId],
  allowedApplicationIds: [authorization.subject.applicationId],
  allowedCapabilities: [authorization.capability],
  allowedActions: [authorization.action],
  allowedPurposes: [authorization.purpose],
  obligations: authorization.decision.obligations,
  retentionUntil: RETENTION_LATE
});

const targetFromAuthorization = (
  resource: RuntimeResource,
  authorization: PlatformPolicyTransactionContext
): DerivedDataTargetPolicy => target({
  resourceType: resource.resourceType,
  resourceId: resource.resourceId,
  resourceVersion: resource.resourceVersion,
  contentSha256: resource.contentSha256,
  familyId: authorization.resourceFamilyId,
  policyVersion: authorization.policyVersion,
  policyPackageSha256: authorization.policyPackageSha256,
  sensitivity: resource.sensitivity,
  dataClasses: resource.dataClasses,
  allowedAccountIds: [authorization.subject.accountId],
  allowedApplicationIds: [authorization.subject.applicationId],
  allowedCapabilities: [authorization.capability],
  allowedActions: [authorization.action],
  allowedPurposes: [authorization.purpose],
  obligations: authorization.decision.obligations,
  retentionUntil: RETENTION_LATE
});

const createRuntimeSource = async (
  database: DatabaseSync,
  resource: RuntimeResource
): Promise<DerivedDataSourcePolicySnapshot> => withRuntimeAuthorization(
  database,
  resource,
  (_context, authorization) => {
    persistRuntimeReceipt(database, authorization);
    return sourceFromAuthorization(resource, authorization);
  }
);

const evaluateRuntimeBinding = (
  runtimeTarget: DerivedDataTargetPolicy,
  sources: readonly DerivedDataSourcePolicySnapshot[]
): DerivedDataPolicyBinding => {
  const decision = new DerivedDataInheritancePolicy().evaluate({ target: runtimeTarget, sources });
  if (!decision.allowed) throw new Error(`RUNTIME_BINDING_REJECTED:${decision.reason}`);
  return decision.binding;
};

const insertInExplicitTransaction = (
  database: DatabaseSync,
  repository: SqliteDerivedDataPolicyRepository,
  context: PolicyAuthorizedRepositoryExecutionContext,
  binding: DerivedDataPolicyBinding
) => {
  database.exec('BEGIN IMMEDIATE');
  const result = repository.insertSealed(context, binding);
  database.exec(result.ok ? 'COMMIT' : 'ROLLBACK');
  return result;
};

const createInsertedRuntimeFixture = async (
  runtimeTarget: RuntimeResource = RUNTIME_TARGET,
  targetAuthorizationOptions: RuntimeAuthorizationOptions = {}
): Promise<InsertedRuntimeFixture> => {
  const database = makeRuntimeDatabase();
  const repository = new SqliteDerivedDataPolicyRepository();
  const sourceA = await createRuntimeSource(database, RUNTIME_SOURCE_A);
  const sourceB = await createRuntimeSource(database, RUNTIME_SOURCE_B);
  let binding: DerivedDataPolicyBinding | undefined;
  await withRuntimeAuthorization(database, runtimeTarget, (context, authorization) => {
    persistRuntimeReceipt(database, authorization);
    binding = evaluateRuntimeBinding(
      targetFromAuthorization(runtimeTarget, authorization),
      [sourceB, sourceA]
    );
    const inserted = insertInExplicitTransaction(database, repository, context, binding);
    expect(inserted).toEqual({ ok: true, value: undefined });
    expect(repository.findByHash(context, binding.bindingHash)).toEqual({ ok: true, value: binding });
  }, targetAuthorizationOptions);
  if (!binding) throw new Error('RUNTIME_BINDING_NOT_CREATED');
  return { database, repository, binding, sources: [sourceA, sourceB] };
};

const createDerivedRuntimeSource = async (
  fixture: InsertedRuntimeFixture,
  resource: RuntimeResource = RUNTIME_TARGET,
  overrides: Partial<DerivedDataSourcePolicySnapshot> = {},
  options: RuntimeAuthorizationOptions = {}
): Promise<DerivedDataSourcePolicySnapshot> => withRuntimeAuthorization(
  fixture.database,
  resource,
  (_context, authorization) => {
    persistRuntimeReceipt(fixture.database, authorization);
    return {
      ...sourceFromAuthorization(resource, authorization),
      lineageDepth: fixture.binding.lineageDepth,
      ancestorResources: fixture.binding.ancestorResources,
      ...overrides
    };
  },
  options
);

const attemptRuntimeBindingInsert = async (
  fixture: InsertedRuntimeFixture,
  runtimeSource: DerivedDataSourcePolicySnapshot,
  runtimeTarget: RuntimeResource = RUNTIME_TARGET_B,
  options: RuntimeAuthorizationOptions = {}
): Promise<RuntimeInsertAttempt> => {
  let attempt: RuntimeInsertAttempt | undefined;
  await withRuntimeAuthorization(fixture.database, runtimeTarget, (context, authorization) => {
    persistRuntimeReceipt(fixture.database, authorization);
    const binding = evaluateRuntimeBinding(targetFromAuthorization(runtimeTarget, authorization), [runtimeSource]);
    attempt = {
      binding,
      result: insertInExplicitTransaction(fixture.database, fixture.repository, context, binding)
    };
  }, options);
  if (!attempt) throw new Error('RUNTIME_DERIVED_INSERT_ATTEMPT_MISSING');
  return attempt;
};

const runtimeDigest = (value: unknown): string => createHash('sha256')
  .update(canonicalPlatformPolicyJson(value), 'utf8')
  .digest('hex');

const expectRuntimeBindingReadRejected = async (
  fixture: Pick<InsertedRuntimeFixture, 'database' | 'repository'>,
  bindingHash: string,
  runtimeTarget: RuntimeResource
): Promise<void> => {
  await withRuntimeAuthorization(fixture.database, runtimeTarget, (context) => {
    expect(fixture.repository.findByHash(context, bindingHash)).toMatchObject({ ok: false });
  });
};

const expectRuntimeSourceLookupRejected = async (
  fixture: InsertedRuntimeFixture,
  runtimeSource: RuntimeResource = RUNTIME_SOURCE_A,
  sourceSnapshot: DerivedDataSourcePolicySnapshot = fixture.sources[0]
): Promise<void> => {
  const sourceKey = computeDerivedDataPolicySourceKey(sourceSnapshot);
  await withRuntimeAuthorization(fixture.database, runtimeSource, (context) => {
    expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
  });
};

type StoredSqlValue = string | number | bigint | Uint8Array | null;

const insertStoredRow = (
  database: DatabaseSync,
  table: 'platform_policy_transaction_receipts' | 'derived_data_policy_bindings' | 'derived_data_policy_sources',
  row: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): void => {
  const stored = { ...row, ...overrides };
  const columns = Object.keys(stored);
  database.prepare(
    `INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`
  ).run(...columns.map((column) => stored[column] as StoredSqlValue));
};

const updateReceiptRecord = (
  database: DatabaseSync,
  receiptHash: string,
  mutate: (record: Record<string, unknown>) => void
): void => {
  const row = database.prepare(
    'SELECT record_json FROM platform_policy_transaction_receipts WHERE receipt_hash=?'
  ).get(receiptHash) as { record_json: string } | undefined;
  if (!row) throw new Error('RUNTIME_RECEIPT_NOT_FOUND');
  const record = JSON.parse(row.record_json) as Record<string, unknown>;
  mutate(record);
  database.prepare(
    'UPDATE platform_policy_transaction_receipts SET record_json=? WHERE receipt_hash=?'
  ).run(canonicalPlatformPolicyJson(record), receiptHash);
};

type RuntimeReceiptTamper = (database: DatabaseSync, receiptHash: string) => void;

const nestedRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`RUNTIME_${label.toUpperCase()}_MALFORMED`);
  }
  return value as Record<string, unknown>;
};

const attemptSourceReceiptTamper = async (tamper: RuntimeReceiptTamper) => {
  const database = makeRuntimeDatabase();
  const repository = new SqliteDerivedDataPolicyRepository();
  const runtimeSource = await createRuntimeSource(database, RUNTIME_SOURCE_A);
  tamper(database, runtimeSource.receiptHash);
  let result: ReturnType<SqliteDerivedDataPolicyRepository['insertSealed']> | undefined;
  await withRuntimeAuthorization(database, RUNTIME_TARGET, (context, authorization) => {
    persistRuntimeReceipt(database, authorization);
    const binding = evaluateRuntimeBinding(
      targetFromAuthorization(RUNTIME_TARGET, authorization),
      [runtimeSource]
    );
    result = insertInExplicitTransaction(database, repository, context, binding);
  });
  if (!result) throw new Error('RUNTIME_TAMPER_RESULT_MISSING');
  return {
    result,
    storedBindingCount: (database.prepare(
      'SELECT COUNT(*) AS count FROM derived_data_policy_bindings'
    ).get() as { count: number }).count
  };
};

const attemptProducerReceiptTamper = async (tamper: RuntimeReceiptTamper) => {
  const database = makeRuntimeDatabase();
  const repository = new SqliteDerivedDataPolicyRepository();
  const runtimeSource = await createRuntimeSource(database, RUNTIME_SOURCE_A);
  let result: ReturnType<SqliteDerivedDataPolicyRepository['insertSealed']> | undefined;
  await withRuntimeAuthorization(database, RUNTIME_TARGET, (context, authorization) => {
    persistRuntimeReceipt(database, authorization);
    const producerReceiptHash = computePlatformPolicyReceiptHash(authorization.receipt);
    tamper(database, producerReceiptHash);
    const binding = evaluateRuntimeBinding(
      targetFromAuthorization(RUNTIME_TARGET, authorization),
      [runtimeSource]
    );
    result = insertInExplicitTransaction(database, repository, context, binding);
  });
  if (!result) throw new Error('RUNTIME_PRODUCER_TAMPER_RESULT_MISSING');
  return {
    result,
    storedBindingCount: (database.prepare(
      'SELECT COUNT(*) AS count FROM derived_data_policy_bindings'
    ).get() as { count: number }).count
  };
};

describe('32-L PPK-016 türetilmiş veri politika mirası', () => {
  it('değişmez sıfır-istisna sınırı ve içeriksiz posture snapshot yayımlar', () => {
    const snapshot = new DerivedDataInheritancePolicy().snapshot();
    expect(DERIVED_DATA_DIRECT_ACCESS_EXCEPTIONS).toEqual([]);
    expect(Object.isFrozen(DERIVED_DATA_DIRECT_ACCESS_EXCEPTIONS)).toBe(true);
    expect(DERIVED_DATA_AUTHORIZED_REPOSITORY_ADAPTERS).toEqual([
      'packages/repositories/src/derived-data-policy-repository.ts'
    ]);
    expect(Object.isFrozen(DERIVED_DATA_AUTHORIZED_REPOSITORY_ADAPTERS)).toBe(true);
    expect(DERIVED_DATA_AUTHORIZED_PRODUCER_ADAPTERS).toEqual([
      'apps/desktop/src/main/local-governed-ocr-application-adapter.ts'
    ]);
    expect(DERIVED_DATA_AUTHORIZED_SEALED_METADATA_READERS).toEqual([
      'packages/repositories/src/local-governed-ocr-repository.ts'
    ]);
    expect(DERIVED_DATA_AUTHORIZED_SEALED_PAYLOAD_READ_PATHS).toEqual([
      'packages/application/src/local-governed-ocr-use-cases.ts',
      'apps/desktop/src/main/local-governed-ocr-runtime-adapter.ts'
    ]);
    expect([
      DERIVED_DATA_AUTHORIZED_PRODUCER_ADAPTERS,
      DERIVED_DATA_AUTHORIZED_SEALED_METADATA_READERS,
      DERIVED_DATA_AUTHORIZED_SEALED_PAYLOAD_READ_PATHS
    ].every(Object.isFrozen)).toBe(true);
    expect(DERIVED_DATA_AUTHORIZED_METADATA_INVENTORY_READERS).toEqual([
      'packages/repositories/src/data-lifecycle-repository.ts',
      'packages/repositories/src/privacy-ownership-data-rights-repository.ts'
    ]);
    expect(Object.isFrozen(DERIVED_DATA_AUTHORIZED_METADATA_INVENTORY_READERS)).toBe(true);
    expect(snapshot).toEqual({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      supportedKinds: DERIVED_DATA_KINDS,
      maximumSourceCount: 32,
      maximumLineageDepth: 16,
      maximumAncestorCount: 512,
      sourcePolicyIntersectionRequired: true,
      sensitivityDowngradeAllowed: false,
      accessBroadeningAllowed: false,
      authorizedRepositoryAdapterCount: 1,
      directAccessExceptionCount: 0,
      payloadExposed: false,
      persistentPathExposed: false,
      secretMaterialExposed: false,
      cutoverAuthorityAttached: false
    });
  });

  it('tek kaynağın exact ve doğrulanabilir bindingini üretir', () => {
    const policy = new DerivedDataInheritancePolicy();
    const decision = policy.evaluate({ target: target(), sources: [source()] });
    expect(decision).toMatchObject({ allowed: true, reason: 'ALLOW_INHERITANCE', operationAllowed: true, persistenceAllowed: true });
    if (!decision.allowed) return;
    expect(decision.binding).toMatchObject({ lineageDepth: 1, effectivePolicy: { sensitivity: 'personal' } });
    expect(decision.binding.ancestorResources).toEqual([{ resourceType: 'archive_item', resourceId: 'source-a' }]);
    expect(policy.verify(decision.binding)).toMatchObject({ allowed: true, reason: 'ALLOW_INHERITANCE' });
    expect(Object.isFrozen(decision.binding)).toBe(true);
  });

  it('çoklu kaynakta en yüksek hassasiyet, sınıf/yükümlülük birleşimi ve erişim kesişimini uygular', () => {
    const decision = new DerivedDataInheritancePolicy().evaluate({
      target: multiSourceTarget(),
      sources: [secondSource(), source()]
    });
    expect(decision).toMatchObject({ allowed: true });
    if (!decision.allowed) return;
    expect(decision.binding.effectivePolicy).toEqual({
      familyId: 'family-ppk-016',
      policyVersion: 'PPK-016',
      policyPackageSha256: HASH.policy,
      sensitivity: 'highly_sensitive',
      dataClasses: ['personal', 'health', 'child'],
      allowedAccountIds: ['account-shared'],
      allowedApplicationIds: ['ocr-worker'],
      allowedCapabilities: ['archive.ocr'],
      allowedActions: ['process'],
      allowedPurposes: ['ocr_process'],
      obligations: [{ type: 'no_cache' }, { type: 'no_export' }],
      retentionUntil: RETENTION_EARLY
    });
    expect(decision.binding.sources.map((item) => item.resourceId)).toEqual(['source-a', 'source-b']);
  });

  it('kaynak erişim kesişimi boşsa varsayılan-ret uygular', () => {
    expect(new DerivedDataInheritancePolicy().evaluate({
      target: multiSourceTarget(),
      sources: [source(), secondSource({ allowedAccountIds: ['account-b'] })]
    })).toMatchObject({ allowed: false, reason: 'SOURCE_ACCESS_INTERSECTION_EMPTY' });
  });

  it.each([
    ['allowedAccountIds', ['account-shared', 'account-outside'], 'ACCOUNT_ACCESS_BROADENED'],
    ['allowedApplicationIds', ['ocr-worker', 'ai-worker'], 'APPLICATION_ACCESS_BROADENED'],
    ['allowedCapabilities', ['archive.ocr', 'ai.process'], 'CAPABILITY_ACCESS_BROADENED'],
    ['allowedActions', ['process', 'share'], 'ACTION_ACCESS_BROADENED'],
    ['allowedPurposes', ['ocr_process', 'external-purpose'], 'PURPOSE_ACCESS_BROADENED']
  ] as const)('%s üzerinden erişim genişletmesini reddeder', (field, value, reason) => {
    expect(new DerivedDataInheritancePolicy().evaluate({
      target: target({ [field]: value }),
      sources: [source()]
    })).toMatchObject({ allowed: false, reason });
  });

  it('hassasiyet düşürmeyi reddeder', () => {
    expect(new DerivedDataInheritancePolicy().evaluate({
      target: target({ sensitivity: 'internal' }), sources: [source()]
    })).toMatchObject({ allowed: false, reason: 'SENSITIVITY_DOWNGRADE' });
  });

  it('kaynak veri sınıfını düşürmeyi reddeder', () => {
    expect(new DerivedDataInheritancePolicy().evaluate({
      target: target({ dataClasses: ['general'] }), sources: [source()]
    })).toMatchObject({ allowed: false, reason: 'DATA_CLASS_DOWNGRADE' });
  });

  it('kaynak yükümlülüğünü kaldırmayı reddeder', () => {
    expect(new DerivedDataInheritancePolicy().evaluate({
      target: target({ obligations: [] }), sources: [source()]
    })).toMatchObject({ allowed: false, reason: 'OBLIGATION_DOWNGRADE' });
  });

  it('kaynak saklama sonunu ileri taşımayı veya sonsuzlaştırmayı reddeder', () => {
    const policy = new DerivedDataInheritancePolicy();
    expect(policy.evaluate({
      target: target({ retentionUntil: '2027-08-13T00:00:00.000Z' }), sources: [source()]
    })).toMatchObject({ allowed: false, reason: 'RETENTION_BROADENED' });
    expect(policy.evaluate({
      target: target({ retentionUntil: null }), sources: [source()]
    })).toMatchObject({ allowed: false, reason: 'RETENTION_BROADENED' });
  });

  it.each([
    [source({ familyId: 'other-family' }), 'FAMILY_MISMATCH'],
    [source({ policyVersion: 'PPK-015' }), 'POLICY_VERSION_MISMATCH'],
    [source({ policyPackageSha256: 'b'.repeat(64) }), 'POLICY_PACKAGE_HASH_MISMATCH']
  ] as const)('aile, politika sürümü ve paket bağlarından sapmayı reddeder', (candidate, reason) => {
    expect(new DerivedDataInheritancePolicy().evaluate({ target: target(), sources: [candidate] }))
      .toMatchObject({ allowed: false, reason });
  });

  it.each(['contentSha256', 'receiptHash', 'contextHash', 'requestHash'] as const)(
    'bozuk %s bağını kaynak doğrulamasında reddeder',
    (field) => {
      expect(new DerivedDataInheritancePolicy().evaluate({
        target: target(), sources: [source({ [field]: 'corrupted' })]
      })).toMatchObject({ allowed: false, reason: 'SOURCE_MALFORMED' });
    }
  );

  it('pasif kaynak makbuzunu reddeder', () => {
    expect(new DerivedDataInheritancePolicy().evaluate({
      target: target(), sources: [source({ receiptActive: false })]
    })).toMatchObject({ allowed: false, reason: 'SOURCE_RECEIPT_INACTIVE' });
  });

  it('eksik veya sınırı aşan kaynak kümesini reddeder', () => {
    const policy = new DerivedDataInheritancePolicy();
    expect(policy.evaluate({ target: target(), sources: [] }))
      .toMatchObject({ allowed: false, reason: 'SOURCE_COUNT_INVALID' });
    expect(policy.evaluate({
      target: target(),
      sources: Array.from({ length: 33 }, (_, index) => source({ resourceId: `source-${index}` }))
    })).toMatchObject({ allowed: false, reason: 'SOURCE_COUNT_INVALID' });
  });

  it('yinelenen kaynak ve hedefin kendisine referansını reddeder', () => {
    const policy = new DerivedDataInheritancePolicy();
    expect(policy.evaluate({
      target: target(), sources: [source(), source({ resourceVersion: 'v2', contentSha256: HASH.contentB })]
    })).toMatchObject({ allowed: false, reason: 'DUPLICATE_SOURCE' });
    expect(policy.evaluate({
      target: target(), sources: [source({ resourceType: 'ocr_text', resourceId: 'derived-a' })]
    })).toMatchObject({ allowed: false, reason: 'SELF_REFERENCE' });
  });

  it('atalar üzerinden oluşan döngüyü reddeder', () => {
    expect(new DerivedDataInheritancePolicy().evaluate({
      target: target(),
      sources: [source({
        lineageDepth: 1,
        ancestorResources: [{ resourceType: 'ocr_text', resourceId: 'derived-a' }]
      })]
    })).toMatchObject({ allowed: false, reason: 'CYCLIC_LINEAGE' });
  });

  it('azami soy derinliğinden sonra yeni türetimi reddeder', () => {
    const ancestors = Array.from({ length: DERIVED_DATA_MAX_LINEAGE_DEPTH }, (_, index) => ({
      resourceType: 'ancestor', resourceId: `ancestor-${index}`
    }));
    expect(new DerivedDataInheritancePolicy().evaluate({
      target: target(),
      sources: [source({ lineageDepth: DERIVED_DATA_MAX_LINEAGE_DEPTH, ancestorResources: ancestors })]
    })).toMatchObject({ allowed: false, reason: 'LINEAGE_DEPTH_EXCEEDED' });
  });

  it('birleşik ata kümesinde 512 kaydı kabul, 513 kaydı fail-closed reddeder', () => {
    const ancestors = (count: number) => Array.from({ length: count }, (_, index) => ({
      resourceType: 'ancestor', resourceId: `ancestor-${index}`
    }));
    const policy = new DerivedDataInheritancePolicy();
    expect(policy.evaluate({
      target: target(),
      sources: [source({
        lineageDepth: 1,
        ancestorResources: ancestors(DERIVED_DATA_MAX_ANCESTOR_COUNT - 1)
      })]
    })).toMatchObject({ allowed: true });
    expect(policy.evaluate({
      target: target(),
      sources: [source({
        lineageDepth: 1,
        ancestorResources: ancestors(DERIVED_DATA_MAX_ANCESTOR_COUNT)
      })]
    })).toMatchObject({ allowed: false, reason: 'ANCESTOR_COUNT_EXCEEDED' });
  });

  it('bozuk source-set ve binding hashlerini doğrulamada ayrı ayrı reddeder', () => {
    const binding = allowedBinding();
    const policy = new DerivedDataInheritancePolicy();
    expect(policy.verify({ ...binding, sourceSetHash: 'd'.repeat(64) }))
      .toMatchObject({ allowed: false, reason: 'SOURCE_SET_HASH_MISMATCH' });
    expect(policy.verify({ ...binding, bindingHash: 'e'.repeat(64) }))
      .toMatchObject({ allowed: false, reason: 'BINDING_HASH_MISMATCH' });
    expect(policy.verify({ ...binding, injectedPayload: 'secret' }))
      .toMatchObject({ allowed: false, reason: 'BINDING_MALFORMED' });
  });

  it('use-case bindingi önce kalıcılaştırır, ardından iş operasyonunu çağırır', async () => {
    const order: string[] = [];
    const persistence = { persist: vi.fn(async () => { order.push('persist'); }) };
    const operation = vi.fn(() => { order.push('operation'); return 'completed'; });
    const useCase = new EnforceDerivedDataInheritanceUseCase(new DerivedDataInheritancePolicy(), persistence);
    await expect(useCase.execute({
      correlationId: asCorrelationId('corr-ppk016-allow'),
      target: target(),
      sources: [source()],
      operation
    })).resolves.toBe('completed');
    expect(order).toEqual(['persist', 'operation']);
    expect(persistence.persist).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('politika reddinde repository ve operasyon callbackini çağırmaz', async () => {
    const persistence = { persist: vi.fn() };
    const operation = vi.fn();
    const useCase = new EnforceDerivedDataInheritanceUseCase(new DerivedDataInheritancePolicy(), persistence);
    await expect(useCase.execute({
      correlationId: asCorrelationId('corr-ppk016-deny'),
      target: target({ sensitivity: 'internal' }),
      sources: [source()],
      operation
    })).rejects.toMatchObject({ code: ERROR_CODES.AUTHORIZATION_DENIED });
    expect(persistence.persist).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  it('repository hatasında operasyon callbackini çağırmaz', async () => {
    const persistence = { persist: vi.fn(async () => { throw new Error('repository unavailable'); }) };
    const operation = vi.fn();
    const useCase = new EnforceDerivedDataInheritanceUseCase(new DerivedDataInheritancePolicy(), persistence);
    await expect(useCase.execute({
      correlationId: asCorrelationId('corr-ppk016-persist-fail'),
      target: target(),
      sources: [source()],
      operation
    })).rejects.toThrow('repository unavailable');
    expect(operation).not.toHaveBeenCalled();
  });

  it('domain boundary görünümünü payload, yol, sır ve cutover yetkisi olmadan üretir', () => {
    expect(new GetDerivedDataPolicyBoundaryUseCase(new DerivedDataInheritancePolicy()).execute()).toMatchObject({
      enforcement: 'fail-closed',
      sourcePolicyIntersectionRequired: true,
      sensitivityDowngradeAllowed: false,
      accessBroadeningAllowed: false,
      authorizedRepositoryAdapterCount: 1,
      directAccessExceptionCount: 0,
      payloadExposed: false,
      persistentPathExposed: false,
      secretMaterialExposed: false,
      cutoverAuthorityAttached: false
    });
  });

  it('migration 77 kaynak/makbuz/seal/değişmezlik çitlerini kalıcı şemada tanımlar', () => {
    const migration = readFileSync(new URL('../../../packages/database/src/family-database-migrations.ts', import.meta.url), 'utf8');
    for (const marker of [
      'CREATE TABLE derived_data_policy_bindings',
      'CREATE TABLE derived_data_policy_sources',
      'trg_ppk016_derived_binding_receipt',
      'trg_ppk016_derived_source_receipt',
      'trg_ppk016_derived_binding_seal_complete',
      'trg_ppk016_derived_binding_sealed_update',
      'trg_ppk016_derived_binding_sealed_delete',
      'trg_ppk016_derived_source_update',
      'trg_ppk016_derived_source_delete',
      "createMigrationDefinition(77, 'ppk016_derived_data_policy_inheritance'"
    ]) expect(migration).toContain(marker);
  });

  it('PPK-016 posture IPC kanalını açık no-cache listesinde tutar', () => {
    const sourceText = readFileSync(new URL('../src/main/ipc-read-sharing.ts', import.meta.url), 'utf8');
    expect(sourceText).toContain('IPC_DERIVED_DATA_NO_CACHE_CHANNELS');
    expect(sourceText).toContain("'system:getDerivedDataPolicyBoundary'");
  });

  it('latent AI memory üreticisini domain kök exportundan kaldırır ve tekrarını statik olarak reddeder', () => {
    const domainIndex = readFileSync(new URL('../../../packages/domain/src/index.ts', import.meta.url), 'utf8');
    const sourceGate = readFileSync(new URL('../../../scripts/verify-derived-data-policy-boundary.mjs', import.meta.url), 'utf8');
    expect(domainIndex).not.toContain("export * from './ai-memory.js'");
    expect(sourceGate).toContain('UNGOVERNED_AI_MEMORY_MODULE_USE');
    expect(sourceGate).toContain('UNGOVERNED_AI_MEMORY_PRODUCER_USE');
    expect(sourceGate).toContain("export { buildAiTimelineContext } from './ai-memory.js';");
  });

  it('plaintext SQLite replica üreticisinin production compositiona dönmesini statik olarak reddeder', () => {
    const applicationIndex = readFileSync(new URL('../../../packages/application/src/index.ts', import.meta.url), 'utf8');
    const sourceGate = readFileSync(new URL('../../../scripts/verify-derived-data-policy-boundary.mjs', import.meta.url), 'utf8');
    expect(applicationIndex).not.toContain("export * from './database-export-file-use-cases.js'");
    expect(sourceGate).toContain('PLAINTEXT_REPLICA_MODULE_USE');
    expect(sourceGate).toContain('PLAINTEXT_REPLICA_SYMBOL_USE');
  });

  it('otomasyon ve arşiv sahiplerinin semantik payload kaçışlarını statik olarak reddeder', () => {
    const sourceGate = readFileSync(new URL('../../../scripts/verify-derived-data-policy-boundary.mjs', import.meta.url), 'utf8');
    for (const marker of [
      'AUTOMATION_TASK_SOURCE_SEMANTIC_PERSISTENCE',
      'AUTOMATION_LEDGER_SQL_OUTSIDE_AUTHORIZED_OWNER',
      'ARCHIVE_SEMANTIC_REPLAY_PAYLOAD',
      'ARCHIVE_OPERATION_SQL_OUTSIDE_AUTHORIZED_OWNER',
      'semanticAutomationPersistenceFields: 0',
      'semanticArchiveReplayPayloadFields: 0'
    ]) expect(sourceGate).toContain(marker);
  });

  it('local_ocr_result için tek writer, content-free metadata owner ve main-only read zincirini exact kilitler', () => {
    const producer = readFileSync(new URL('../src/main/local-governed-ocr-application-adapter.ts', import.meta.url), 'utf8');
    const useCases = readFileSync(new URL('../../../packages/application/src/local-governed-ocr-use-cases.ts', import.meta.url), 'utf8');
    const repository = readFileSync(new URL('../../../packages/repositories/src/local-governed-ocr-repository.ts', import.meta.url), 'utf8');
    const writerStart = producer.indexOf('public insertDerivedBinding(');
    const writerEnd = producer.indexOf('public appendAudit(', writerStart);
    const writer = producer.slice(writerStart, writerEnd);
    expect(writer.match(/\binsertSealed\s*\(/gu)).toHaveLength(1);
    expect(writer).toContain("targetIntent?.resourceType !== 'local_ocr_result'");
    expect(writer).toContain('targetIntent.sourceJobId !== primary.intent.resourceId');
    const readStart = useCases.indexOf('export class GetLocalGovernedOcrResultUseCase');
    const readEnd = useCases.indexOf('export class PropagateLocalGovernedOcrSourceDeletionUseCase', readStart);
    const read = useCases.slice(readStart, readEnd);
    expect(read).toContain('resolveSourceAndConsent(');
    expect(read).toContain('this.runtime.readSealedResult(');
    expect(read).toContain('read.value.contentSha256 !== current.value.resultContentSha256');
    expect(repository).toContain('derived_binding_hash');
    expect(repository).toContain('sealed_result_id');
    expect(repository).not.toMatch(/\b(?:result_text|ocr_text|raw_bytes|source_bytes|document_bytes|content_bytes|payload_json|file_path|source_path|vault_path)\b/iu);
  });

  it('zararlı OCR direct SQL, semantic repository payloadı ve yetkisiz plaintext read yolunu fail-closed reddeder', async () => {
    // @ts-expect-error Production source verifier is an ESM JavaScript module by design.
    const { scanDerivedDataPolicySourceText } = await import('../../../scripts/verify-derived-data-policy-boundary.mjs') as {
      scanDerivedDataPolicySourceText(path: string, sourceText: string): Array<{ readonly kind: string }>;
    };
    expect(scanDerivedDataPolicySourceText('apps/example/src/bypass.ts',
      "const sql='UPDATE local_governed_ocr_jobs SET sealed_result_id=? WHERE id=?'")
      .map((finding) => finding.kind)).toContain('OCR_METADATA_SQL_OUTSIDE_AUTHORIZED_OWNER');
    expect(scanDerivedDataPolicySourceText('packages/repositories/src/local-governed-ocr-repository.ts',
      "const sql='INSERT INTO local_governed_ocr_jobs(id,result_text) VALUES(?,?)'")
      .map((finding) => finding.kind)).toContain('OCR_REPOSITORY_SEMANTIC_PAYLOAD');
    expect(scanDerivedDataPolicySourceText('apps/example/src/bypass.ts',
      'runtime.readSealedResult({ jobId, sealedResultId })')
      .map((finding) => finding.kind)).toContain('OCR_SEALED_RESULT_READ_OUTSIDE_AUTHORIZED_PATH');
  });
});

describe('32-L PPK-016 migration 77 ve repository runtime', () => {
  it('pending-source-sealed zincirini tamamlar, exact binding okur ve source sorgusunda yalnız hash döndürür', async () => {
    const fixture = await createInsertedRuntimeFixture();
    const { database, repository, binding, sources } = fixture;
    expect(database.prepare(`
      SELECT status,source_count,lineage_depth,created_at,sealed_at
      FROM derived_data_policy_bindings WHERE binding_hash=?
    `).get(binding.bindingHash)).toEqual({
      status: 'sealed',
      source_count: 2,
      lineage_depth: 1,
      created_at: RUNTIME_NOW,
      sealed_at: RUNTIME_NOW
    });
    expect(database.prepare(
      'SELECT source_ordinal FROM derived_data_policy_sources WHERE binding_hash=? ORDER BY source_ordinal'
    ).all(binding.bindingHash)).toEqual([{ source_ordinal: 0 }, { source_ordinal: 1 }]);
    expect(database.prepare(
      "SELECT value FROM database_metadata WHERE key='schema_generation'"
    ).get()).toEqual({ value: 'REVISION-32-L-PPK-016-DERIVED-DATA-POLICY-INHERITANCE' });

    const sourceKey = computeDerivedDataPolicySourceKey(sources[0]);
    await withRuntimeAuthorization(database, RUNTIME_SOURCE_A, (context) => {
      const hashes = repository.listBindingHashesBySource(context, sourceKey);
      expect(hashes).toEqual({ ok: true, value: [binding.bindingHash] });
      expect(JSON.stringify(hashes)).not.toContain(RUNTIME_SOURCE_A.resourceId);
      expect(JSON.stringify(hashes)).not.toContain(RUNTIME_SOURCE_B.resourceId);
      expect(repository.findByHash(context, binding.bindingHash)).toMatchObject({ ok: false });
    });
  });

  it('mühürlü upstream soyunu exact bağlar ve daha gevşek olmayan güncel politika paketi rotasyonuna izin verir', async () => {
    const fixture = await createInsertedRuntimeFixture();
    const exactSource = await createDerivedRuntimeSource(fixture);
    const exact = await attemptRuntimeBindingInsert(fixture, exactSource, RUNTIME_TARGET_B);
    expect(exact.result).toEqual({ ok: true, value: undefined });
    expect(exact.binding.lineageDepth).toBe(2);

    const rotatedSource = await createDerivedRuntimeSource(
      fixture,
      RUNTIME_TARGET,
      {},
      { kernel: alternateRuntimePolicyKernel }
    );
    const rotated = await attemptRuntimeBindingInsert(
      fixture,
      rotatedSource,
      RUNTIME_TARGET_C,
      { kernel: alternateRuntimePolicyKernel }
    );
    expect(rotated.result).toEqual({ ok: true, value: undefined });
    expect(rotatedSource.policyPackageSha256).not.toBe(fixture.binding.target.policyPackageSha256);
  });

  it.each([
    ['soy sıfırlama', RUNTIME_TARGET, { lineageDepth: 0, ancestorResources: [] }, {}],
    ['eksik ata kümesi', RUNTIME_TARGET, {
      lineageDepth: 1,
      ancestorResources: [{ resourceType: RUNTIME_SOURCE_A.resourceType, resourceId: RUNTIME_SOURCE_A.resourceId }]
    }, {}],
    ['hassasiyet düşürme', { ...RUNTIME_TARGET, sensitivity: 'internal' as const }, {}, {}],
    ['veri sınıfı düşürme', { ...RUNTIME_TARGET, dataClasses: ['general'] as const }, {}, {}],
    ['hesap erişimi genişletme', RUNTIME_TARGET, {}, { accountId: 'other-account-ppk016' }],
    ['saklama süresini sonsuzlaştırma', RUNTIME_TARGET, { retentionUntil: null }, {}]
  ] as const)('upstream %s bypassını atomik ve fail-closed reddeder', async (
    _label,
    sourceResource,
    overrides,
    sourceOptions
  ) => {
    const fixture = await createInsertedRuntimeFixture();
    const runtimeSource = await createDerivedRuntimeSource(
      fixture,
      sourceResource,
      overrides,
      sourceOptions
    );
    const downstreamTarget: RuntimeResource = {
      ...RUNTIME_TARGET_B,
      sensitivity: sourceResource.sensitivity,
      dataClasses: sourceResource.dataClasses
    };
    const attempt = await attemptRuntimeBindingInsert(
      fixture,
      runtimeSource,
      downstreamTarget,
      sourceOptions
    );
    expect(attempt.result).toMatchObject({ ok: false });
    expect((fixture.database.prepare(
      'SELECT COUNT(*) AS count FROM derived_data_policy_bindings'
    ).get() as { count: number }).count).toBe(1);
  });

  it('tarihsel upstream target effective politikadan daha sıkıysa current source gevşetmesini reddeder', async () => {
    const strictUpstreamTarget: RuntimeResource = { ...RUNTIME_TARGET, sensitivity: 'sensitive' };
    const fixture = await createInsertedRuntimeFixture(strictUpstreamTarget);
    const relaxedCurrentSource = await createDerivedRuntimeSource(fixture, RUNTIME_TARGET);
    const attempt = await attemptRuntimeBindingInsert(fixture, relaxedCurrentSource);
    expect(fixture.binding.effectivePolicy.sensitivity).toBe('personal');
    expect(fixture.binding.target.sensitivity).toBe('sensitive');
    expect(attempt.result).toMatchObject({ ok: false });
  });

  it('geçerli PEP makbuzuyla historical offline no_export yükümlülüğünü current online kaynakta düşürmeyi reddeder', async () => {
    const fixture = await createInsertedRuntimeFixture(RUNTIME_TARGET, { online: false });
    expect(fixture.binding.target.obligations).toContainEqual({ type: 'no_export' });
    expect(fixture.binding.effectivePolicy.obligations).not.toContainEqual({ type: 'no_export' });

    const onlineCurrentSource = await createDerivedRuntimeSource(
      fixture,
      RUNTIME_TARGET,
      {},
      { online: true }
    );
    expect(onlineCurrentSource.obligations).not.toContainEqual({ type: 'no_export' });
    const attempt = await attemptRuntimeBindingInsert(fixture, onlineCurrentSource);
    expect(attempt.result).toMatchObject({ ok: false });
    expect((fixture.database.prepare(
      'SELECT COUNT(*) AS count FROM derived_data_policy_bindings'
    ).get() as { count: number }).count).toBe(1);
  });

  it('hedefi kaynak ata kümesine sokan SQLite soy bypassını mühürlemeden reddeder', async () => {
    const fixture = await createInsertedRuntimeFixture();
    const cyclicSource = await createDerivedRuntimeSource(fixture, RUNTIME_TARGET, {
      lineageDepth: 1,
      ancestorResources: [{
        resourceType: RUNTIME_TARGET_B.resourceType,
        resourceId: RUNTIME_TARGET_B.resourceId
      }]
    });
    let decision: ReturnType<DerivedDataInheritancePolicy['evaluate']> | undefined;
    await withRuntimeAuthorization(fixture.database, RUNTIME_TARGET_B, (_context, authorization) => {
      decision = new DerivedDataInheritancePolicy().evaluate({
        target: targetFromAuthorization(RUNTIME_TARGET_B, authorization),
        sources: [cyclicSource]
      });
    });
    expect(decision).toMatchObject({ allowed: false, reason: 'CYCLIC_LINEAGE' });
    expect((fixture.database.prepare(
      'SELECT COUNT(*) AS count FROM derived_data_policy_bindings'
    ).get() as { count: number }).count).toBe(1);
  });

  it('bozuk upstream bindingi primary kaynak saymadan varsayılan-ret uygular', async () => {
    const fixture = await createInsertedRuntimeFixture();
    const runtimeSource = await createDerivedRuntimeSource(fixture);
    fixture.database.exec('DROP TRIGGER trg_ppk016_derived_binding_sealed_update');
    fixture.database.prepare(
      'UPDATE derived_data_policy_bindings SET binding_json=? WHERE binding_hash=?'
    ).run('{}', fixture.binding.bindingHash);
    const attempt = await attemptRuntimeBindingInsert(fixture, runtimeSource);
    expect(attempt.result).toMatchObject({ ok: false });
    expect((fixture.database.prepare(
      'SELECT COUNT(*) AS count FROM derived_data_policy_bindings'
    ).get() as { count: number }).count).toBe(1);
  });

  it('source hash lookup current policy context sapmalarında binding veya hash sızdırmaz', async () => {
    const fixture = await createInsertedRuntimeFixture();
    const sourceKey = computeDerivedDataPolicySourceKey(fixture.sources[0]);
    const sensitivityMismatch: RuntimeResource = { ...RUNTIME_SOURCE_A, sensitivity: 'internal' };
    const classMismatch: RuntimeResource = { ...RUNTIME_SOURCE_A, dataClasses: ['general'] };
    const attempts: Array<Promise<unknown>> = [
      withRuntimeAuthorization(fixture.database, RUNTIME_SOURCE_A, (context) => {
        expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
      }, { accountId: 'other-account-ppk016' }),
      withRuntimeAuthorization(fixture.database, RUNTIME_SOURCE_A, (context) => {
        expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
      }, { applicationId: 'ai-worker' }),
      withRuntimeAuthorization(fixture.database, RUNTIME_SOURCE_A, (context) => {
        expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
      }, { capability: 'ai.process' }),
      withRuntimeAuthorization(fixture.database, RUNTIME_SOURCE_A, (context) => {
        expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
      }, { action: 'read' }),
      withRuntimeAuthorization(fixture.database, RUNTIME_SOURCE_A, (context) => {
        expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
      }, { purpose: 'other-purpose' }),
      withRuntimeAuthorization(fixture.database, RUNTIME_SOURCE_A, (context) => {
        expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
      }, { kernel: alternateRuntimePolicyKernel }),
      withRuntimeAuthorization(fixture.database, sensitivityMismatch, (context) => {
        expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
      }),
      withRuntimeAuthorization(fixture.database, classMismatch, (context) => {
        expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
      }),
      withRuntimeAuthorization(fixture.database, RUNTIME_SOURCE_A, (context) => {
        expect(fixture.repository.listBindingHashesBySource(context, sourceKey)).toMatchObject({ ok: false });
      }, { online: false })
    ];
    await Promise.all(attempts);
  });

  it.each([
    ['source resource', (database: DatabaseSync, hash: string) => database.prepare(
      'UPDATE platform_policy_transaction_receipts SET resource_id=? WHERE receipt_hash=?'
    ).run('other-source', hash)],
    ['context hash', (database: DatabaseSync, hash: string) => database.prepare(
      'UPDATE platform_policy_transaction_receipts SET context_hash=? WHERE receipt_hash=?'
    ).run('b'.repeat(64), hash)],
    ['request hash', (database: DatabaseSync, hash: string) => database.prepare(
      'UPDATE platform_policy_transaction_receipts SET request_hash=? WHERE receipt_hash=?'
    ).run('c'.repeat(64), hash)],
    ['future issued-at', (database: DatabaseSync, hash: string) => database.prepare(
      'UPDATE platform_policy_transaction_receipts SET issued_at=? WHERE receipt_hash=?'
    ).run('2026-08-11T12:00:00.001Z', hash)],
    ['stale issued-at', (database: DatabaseSync, hash: string) => database.prepare(
      'UPDATE platform_policy_transaction_receipts SET issued_at=? WHERE receipt_hash=?'
    ).run('2026-08-11T11:59:29.999Z', hash)],
    ['policy package', (database: DatabaseSync, hash: string) => database.prepare(
      'UPDATE platform_policy_transaction_receipts SET policy_package_sha256=? WHERE receipt_hash=?'
    ).run('d'.repeat(64), hash)],
    ['family', (database: DatabaseSync, hash: string) => updateReceiptRecord(database, hash, (record) => {
      nestedRecord(nestedRecord(record.request, 'request').resource, 'resource').familyId = 'other-family';
    })],
    ['sensitivity', (database: DatabaseSync, hash: string) => updateReceiptRecord(database, hash, (record) => {
      nestedRecord(nestedRecord(record.request, 'request').resource, 'resource').sensitivity = 'internal';
    })],
    ['data classes', (database: DatabaseSync, hash: string) => database.prepare(
      'UPDATE platform_policy_transaction_receipts SET data_classes_json=? WHERE receipt_hash=?'
    ).run(canonicalPlatformPolicyJson(['general']), hash)],
    ['account', (database: DatabaseSync, hash: string) => updateReceiptRecord(database, hash, (record) => {
      nestedRecord(nestedRecord(record.request, 'request').subject, 'subject').accountId = 'other-account';
    })],
    ['application', (database: DatabaseSync, hash: string) => updateReceiptRecord(database, hash, (record) => {
      nestedRecord(nestedRecord(record.request, 'request').subject, 'subject').applicationId = 'ai-worker';
    })],
    ['capability', (database: DatabaseSync, hash: string) => updateReceiptRecord(database, hash, (record) => {
      nestedRecord(record.request, 'request').capability = 'ai.process';
    })],
    ['action', (database: DatabaseSync, hash: string) => updateReceiptRecord(database, hash, (record) => {
      nestedRecord(record.request, 'request').action = 'read';
    })],
    ['purpose', (database: DatabaseSync, hash: string) => updateReceiptRecord(database, hash, (record) => {
      nestedRecord(record.request, 'request').purpose = 'other-purpose';
    })],
    ['obligations', (database: DatabaseSync, hash: string) => updateReceiptRecord(database, hash, (record) => {
      nestedRecord(record.decision, 'decision').obligations = [];
    })]
  ] as const)('bozuk %s source receipt bağını atomik ve varsayılan-ret reddeder', async (_label, tamper) => {
    const attempt = await attemptSourceReceiptTamper(tamper);
    expect(attempt.result).toMatchObject({ ok: false });
    expect(attempt.storedBindingCount).toBe(0);
  });

  it('source receipt için tam 30.000 ms tazelik sınırını kabul eder', async () => {
    const database = makeRuntimeDatabase();
    const repository = new SqliteDerivedDataPolicyRepository();
    const runtimeSource = await withRuntimeAuthorization(
      database,
      RUNTIME_SOURCE_A,
      (_context, authorization) => {
        persistRuntimeReceipt(database, authorization);
        return sourceFromAuthorization(RUNTIME_SOURCE_A, authorization);
      },
      { occurredAt: '2026-08-11T11:59:30.000Z' }
    );
    await withRuntimeAuthorization(database, RUNTIME_TARGET, (context, authorization) => {
      persistRuntimeReceipt(database, authorization);
      const binding = evaluateRuntimeBinding(
        targetFromAuthorization(RUNTIME_TARGET, authorization),
        [runtimeSource]
      );
      expect(insertInExplicitTransaction(database, repository, context, binding))
        .toEqual({ ok: true, value: undefined });
    });
    expect((database.prepare(
      'SELECT COUNT(*) AS count FROM derived_data_policy_bindings'
    ).get() as { count: number }).count).toBe(1);
  });

  it.each([
    ['target resource', (database: DatabaseSync, hash: string) => database.prepare(
      'UPDATE platform_policy_transaction_receipts SET resource_id=? WHERE receipt_hash=?'
    ).run('other-target', hash)],
    ['producer issued-at', (database: DatabaseSync, hash: string) => database.prepare(
      'UPDATE platform_policy_transaction_receipts SET issued_at=? WHERE receipt_hash=?'
    ).run('2026-08-11T12:00:01.000Z', hash)]
  ] as const)('bozuk %s producer receipt bağını kalıcılaştırmaz', async (_label, tamper) => {
    const attempt = await attemptProducerReceiptTamper(tamper);
    expect(attempt.result).toMatchObject({ ok: false });
    expect(attempt.storedBindingCount).toBe(0);
  });

  it.each([
    ['producer hash işaretçisi', (fixture: InsertedRuntimeFixture) => {
      fixture.database.exec(`
        PRAGMA foreign_keys=OFF;
        DROP TRIGGER trg_ppk016_derived_binding_sealed_update;
      `);
      fixture.database.prepare(
        'UPDATE derived_data_policy_bindings SET producer_receipt_hash=? WHERE binding_hash=?'
      ).run('f'.repeat(64), fixture.binding.bindingHash);
      fixture.database.exec('PRAGMA foreign_keys=ON');
    }],
    ['signed producer receipt hashı', (fixture: InsertedRuntimeFixture) => {
      const row = fixture.database.prepare(
        'SELECT producer_receipt_hash FROM derived_data_policy_bindings WHERE binding_hash=?'
      ).get(fixture.binding.bindingHash) as { producer_receipt_hash: string };
      updateReceiptRecord(fixture.database, row.producer_receipt_hash, (record) => {
        nestedRecord(record.receipt, 'producer receipt').signature = 'e'.repeat(64);
      });
    }],
    ['producer allowed subject', (fixture: InsertedRuntimeFixture) => {
      const row = fixture.database.prepare(
        'SELECT producer_receipt_hash FROM derived_data_policy_bindings WHERE binding_hash=?'
      ).get(fixture.binding.bindingHash) as { producer_receipt_hash: string };
      updateReceiptRecord(fixture.database, row.producer_receipt_hash, (record) => {
        nestedRecord(nestedRecord(record.request, 'producer request').subject, 'producer subject').accountId =
          'other-account';
      });
    }],
    ['producer created-at', (fixture: InsertedRuntimeFixture) => {
      fixture.database.exec('DROP TRIGGER trg_ppk016_derived_binding_sealed_update');
      fixture.database.prepare(
        'UPDATE derived_data_policy_bindings SET created_at=? WHERE binding_hash=?'
      ).run('2026-08-11T11:59:59.999Z', fixture.binding.bindingHash);
    }]
  ] as const)('diskte bozulmuş %s bağını read-back sırasında fail-closed reddeder', async (_label, tamper) => {
    const fixture = await createInsertedRuntimeFixture();
    tamper(fixture);
    await expectRuntimeBindingReadRejected(fixture, fixture.binding.bindingHash, RUNTIME_TARGET);
    await expectRuntimeSourceLookupRejected(fixture);
  });

  it('diskte kaynak authorized-at/receipt zamanı pencere dışına taşınırsa read-back reddeder', async () => {
    const fixture = await createInsertedRuntimeFixture();
    const sourceRow = fixture.database.prepare(`
      SELECT policy_receipt_hash FROM derived_data_policy_sources
      WHERE binding_hash=? ORDER BY source_ordinal LIMIT 1
    `).get(fixture.binding.bindingHash) as { policy_receipt_hash: string };
    fixture.database.exec('DROP TRIGGER trg_ppk016_derived_source_update');
    fixture.database.prepare(`
      UPDATE derived_data_policy_sources SET authorized_at=?
      WHERE binding_hash=? AND policy_receipt_hash=?
    `).run('2026-08-11T11:59:29.999Z', fixture.binding.bindingHash, sourceRow.policy_receipt_hash);
    fixture.database.prepare(
      'UPDATE platform_policy_transaction_receipts SET issued_at=? WHERE receipt_hash=?'
    ).run('2026-08-11T11:59:29.999Z', sourceRow.policy_receipt_hash);
    await expectRuntimeBindingReadRejected(fixture, fixture.binding.bindingHash, RUNTIME_TARGET);
    await expectRuntimeSourceLookupRejected(fixture);
  });

  it('diskte downstream soy metadata reseti yapıldığında read-back upstream bağıyla yeniden doğrular', async () => {
    const fixture = await createInsertedRuntimeFixture();
    const upstreamSource = await createDerivedRuntimeSource(fixture);
    const downstream = await attemptRuntimeBindingInsert(fixture, upstreamSource);
    expect(downstream.result).toEqual({ ok: true, value: undefined });

    const resetSource: DerivedDataSourcePolicySnapshot = {
      ...upstreamSource,
      lineageDepth: 0,
      ancestorResources: []
    };
    const resetBinding = evaluateRuntimeBinding(downstream.binding.target, [resetSource]);
    fixture.database.exec(`
      PRAGMA foreign_keys=OFF;
      DROP TRIGGER trg_ppk016_derived_source_update;
      DROP TRIGGER trg_ppk016_derived_binding_sealed_update;
    `);
    fixture.database.prepare(`
      UPDATE derived_data_policy_sources
      SET binding_hash=?,source_snapshot_json=?,source_snapshot_sha256=?,lineage_depth=?
      WHERE binding_hash=?
    `).run(
      resetBinding.bindingHash,
      canonicalPlatformPolicyJson(resetSource),
      runtimeDigest(resetSource),
      resetSource.lineageDepth,
      downstream.binding.bindingHash
    );
    fixture.database.prepare(`
      UPDATE derived_data_policy_bindings
      SET binding_hash=?,source_set_sha256=?,binding_json=?,lineage_depth=?
      WHERE binding_hash=?
    `).run(
      resetBinding.bindingHash,
      resetBinding.sourceSetHash,
      canonicalPlatformPolicyJson(resetBinding),
      resetBinding.lineageDepth,
      downstream.binding.bindingHash
    );
    fixture.database.exec('PRAGMA foreign_keys=ON');
    await expectRuntimeBindingReadRejected(fixture, resetBinding.bindingHash, RUNTIME_TARGET_B);
  });

  it('seal/değişmezlik/timestamp/source-JSON çitlerini ve bozuk kalıcı satırda fail-closed okumayı uygular', async () => {
    const fixture = await createInsertedRuntimeFixture();
    const { database, repository, binding } = fixture;
    const receiptRows = database.prepare(
      'SELECT * FROM platform_policy_transaction_receipts ORDER BY receipt_hash'
    ).all() as Array<Record<string, unknown>>;
    const bindingRow = database.prepare(
      'SELECT * FROM derived_data_policy_bindings WHERE binding_hash=?'
    ).get(binding.bindingHash) as Record<string, unknown>;
    const sourceRows = database.prepare(
      'SELECT * FROM derived_data_policy_sources WHERE binding_hash=? ORDER BY source_ordinal'
    ).all(binding.bindingHash) as Array<Record<string, unknown>>;

    expect(() => database.prepare(
      "UPDATE derived_data_policy_bindings SET retention_until=NULL WHERE binding_hash=?"
    ).run(binding.bindingHash)).toThrow(/sealed derived data policy binding is immutable/i);
    expect(() => database.prepare(
      'DELETE FROM derived_data_policy_bindings WHERE binding_hash=?'
    ).run(binding.bindingHash)).toThrow(/sealed derived data policy binding cannot be deleted/i);
    expect(() => database.prepare(`
      UPDATE derived_data_policy_sources SET authorized_at=authorized_at
      WHERE binding_hash=? AND source_ordinal=0
    `).run(binding.bindingHash)).toThrow(/derived data policy source is immutable/i);
    expect(() => database.prepare(
      'DELETE FROM derived_data_policy_sources WHERE binding_hash=? AND source_ordinal=0'
    ).run(binding.bindingHash)).toThrow(/derived data policy source cannot be deleted/i);

    const createdAtDatabase = makeRuntimeDatabase();
    for (const row of receiptRows) insertStoredRow(
      createdAtDatabase,
      'platform_policy_transaction_receipts',
      row
    );
    expect(() => insertStoredRow(
      createdAtDatabase,
      'derived_data_policy_bindings',
      bindingRow,
      { status: 'pending', sealed_at: null, created_at: '2026-08-11T12:00:01.000Z' }
    )).toThrow(/producer receipt/i);

    const incompleteDatabase = makeRuntimeDatabase();
    for (const row of receiptRows) insertStoredRow(
      incompleteDatabase,
      'platform_policy_transaction_receipts',
      row
    );
    insertStoredRow(
      incompleteDatabase,
      'derived_data_policy_bindings',
      bindingRow,
      { status: 'pending', sealed_at: null }
    );
    const sourceReceiptHash = String(sourceRows[0]!.policy_receipt_hash);
    for (const rejectedIssuedAt of [
      '2026-08-11T11:59:29.999Z',
      '2026-08-11T12:00:00.001Z'
    ]) {
      incompleteDatabase.prepare(
        'UPDATE platform_policy_transaction_receipts SET issued_at=? WHERE receipt_hash=?'
      ).run(rejectedIssuedAt, sourceReceiptHash);
      expect(() => insertStoredRow(
        incompleteDatabase,
        'derived_data_policy_sources',
        sourceRows[0]!,
        { authorized_at: rejectedIssuedAt }
      )).toThrow(/source requires a matching pending binding/i);
    }
    incompleteDatabase.prepare(
      'UPDATE platform_policy_transaction_receipts SET issued_at=? WHERE receipt_hash=?'
    ).run(RUNTIME_NOW, sourceReceiptHash);
    expect(() => insertStoredRow(
      incompleteDatabase,
      'derived_data_policy_sources',
      sourceRows[0]!,
      { source_snapshot_json: '{}' }
    )).toThrow(/source JSON does not match structural metadata/i);
    expect(() => insertStoredRow(
      incompleteDatabase,
      'derived_data_policy_sources',
      sourceRows[0]!,
      { authorized_at: '2026-08-11T12:00:01.000Z' }
    )).toThrow(/source receipt does not match/i);
    insertStoredRow(incompleteDatabase, 'derived_data_policy_sources', sourceRows[0]!);
    expect(() => incompleteDatabase.prepare(`
      UPDATE derived_data_policy_bindings SET status='sealed',sealed_at=? WHERE binding_hash=?
    `).run(RUNTIME_NOW, binding.bindingHash)).toThrow(/cannot seal without complete non-downgraded sources/i);
    expect(incompleteDatabase.prepare(
      'SELECT status FROM derived_data_policy_bindings WHERE binding_hash=?'
    ).get(binding.bindingHash)).toEqual({ status: 'pending' });

    database.exec('DROP TRIGGER trg_ppk016_derived_binding_sealed_update');
    database.prepare(
      'UPDATE derived_data_policy_bindings SET access_policy_sha256=? WHERE binding_hash=?'
    ).run('f'.repeat(64), binding.bindingHash);
    await withRuntimeAuthorization(database, RUNTIME_TARGET, (context) => {
      expect(repository.findByHash(context, binding.bindingHash)).toMatchObject({ ok: false });
    });
  });
});

describe('32-L PPK-016 deterministik canonical hash', () => {
  it('Unicode kimlik ve amaçlarda giriş sırası değişse de aynı source-set ve binding hashini üretir', () => {
    const sharedAccess = {
      allowedAccountIds: ['İ-hesap', 'z-hesap'],
      allowedApplicationIds: ['ocr-worker', 'ai-worker'] as const,
      allowedCapabilities: ['archive.read', 'archive.ocr'] as const,
      allowedActions: ['read', 'process'] as const,
      allowedPurposes: ['İşleme', 'zürafa']
    };
    const unicodeSourceA = source({
      resourceId: 'İzmir-kaynak',
      ...sharedAccess
    });
    const unicodeSourceB = source({
      resourceId: 'ışık-kaynak',
      contentSha256: HASH.contentB,
      receiptHash: HASH.receiptB,
      contextHash: HASH.contextB,
      requestHash: HASH.requestB,
      allowedAccountIds: [...sharedAccess.allowedAccountIds].reverse(),
      allowedApplicationIds: [...sharedAccess.allowedApplicationIds].reverse(),
      allowedCapabilities: [...sharedAccess.allowedCapabilities].reverse(),
      allowedActions: [...sharedAccess.allowedActions].reverse(),
      allowedPurposes: [...sharedAccess.allowedPurposes].reverse()
    });
    const unicodeTarget = target({
      resourceId: 'türetilmiş-İ',
      allowedAccountIds: [...sharedAccess.allowedAccountIds].reverse(),
      allowedApplicationIds: [...sharedAccess.allowedApplicationIds].reverse(),
      allowedCapabilities: [...sharedAccess.allowedCapabilities].reverse(),
      allowedActions: [...sharedAccess.allowedActions].reverse(),
      allowedPurposes: [...sharedAccess.allowedPurposes].reverse()
    });
    const policy = new DerivedDataInheritancePolicy();
    const first = policy.evaluate({ target: unicodeTarget, sources: [unicodeSourceA, unicodeSourceB] });
    const second = policy.evaluate({ target: unicodeTarget, sources: [unicodeSourceB, unicodeSourceA] });
    expect(first).toMatchObject({ allowed: true });
    expect(second).toMatchObject({ allowed: true });
    if (!first.allowed || !second.allowed) return;
    expect(second.binding.sourceSetHash).toBe(first.binding.sourceSetHash);
    expect(second.binding.bindingHash).toBe(first.binding.bindingHash);
    expect(second.binding.sources).toEqual(first.binding.sources);
  });
});
