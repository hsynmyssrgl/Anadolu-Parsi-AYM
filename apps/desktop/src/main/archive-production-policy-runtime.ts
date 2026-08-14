import type { ArchiveApplicationContext } from '@ppt/application';
import {
  ERROR_CODES,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Clock,
  type Result
} from '@ppt/core';
import {
  PlatformPolicyEnforcementError,
  createTypedPolicyEnforcementPoint,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyClusterFence,
  type PlatformPolicyConnectionAuthority,
  type PlatformPolicyIntent,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReplayReservation,
  type PlatformPolicyReplayStore,
  type PlatformPolicyReceiptSink,
  type PlatformPolicyTransactionContext,
  type PolicyAction,
  type PolicyGrant,
  type PolicyResource
} from '@ppt/platform-policy';
import type {
  AccountRepositoryPort,
  AccountRow,
  ArchiveItemRow,
  ArchiveRepositoryPort,
  ArchivePolicyResourceRepositoryPort,
  ObjectPermissionRepositoryPort,
  ObjectPermissionRow,
  PlatformPolicyArchiveOperationMetadata,
  PlatformPolicyTransactionRepositoryPort,
  PersonRecord,
  PersonRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor,
  TrustedDeviceRow,
  TrustedDeviceRepositoryPort
} from '@ppt/repository-contracts';
import type {
  ArchivePolicyCommittedTransactionInput,
  ArchivePolicyEnforcementPoint,
  ArchivePolicyEnforcementPointResolver,
  ArchivePolicyOperationResolution,
  ArchivePolicyOperationResultInput,
  ArchivePolicyTransactionRevalidationInput
} from './archive-application-adapter.js';
import type { FileDeviceIdentityProvider } from './device-identity.js';
import { authorizationRoleMatches } from '@ppt/security';

type DeviceIdentitySnapshot = ReturnType<FileDeviceIdentityProvider['snapshot']>;

export interface ArchiveProductionPolicyRuntimeDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly accountRepository: AccountRepositoryPort;
  readonly permissionRepository: ObjectPermissionRepositoryPort;
  readonly trustedDeviceRepository: TrustedDeviceRepositoryPort;
  readonly archiveRepository: ArchiveRepositoryPort & ArchivePolicyResourceRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly deviceIdentityProvider: Pick<FileDeviceIdentityProvider, 'snapshot'>;
  readonly authorizationProvider: PlatformPolicyAuthorizationProvider;
  readonly receiptSink: PlatformPolicyReceiptSink;
  readonly policyTransactionRepository: PlatformPolicyTransactionRepositoryPort;
  readonly clusterFence: PlatformPolicyClusterFence;
  readonly policyVersion: string;
  readonly clock: Clock;
}

interface AuthoritySnapshot {
  readonly authority: PlatformPolicyConnectionAuthority;
  readonly securityFingerprint: string;
}

interface ArchiveResourceSnapshot {
  readonly resource: PolicyResource;
  readonly stateFingerprint: string;
}

type ArchiveResourceIntent = Pick<PlatformPolicyIntent, 'action' | 'resourceType' | 'resourceId'>;

const ARCHIVE_POLICY_FENCE_NAME = 'archive-write';
const MAX_PROJECTION_DRAIN_ROUNDS = 20;
const PROJECTION_DRAIN_BATCH_SIZE = 500;
const REPLAY_PRUNING_BATCH_SIZE = 128;

const policyActions = new Set<PolicyAction>([
  'read',
  'create',
  'update',
  'delete',
  'share',
  'process',
  'record',
  'administer'
]);

const createResourceTypes = new Set([
  'archive_item',
  'archive_retention_policy',
  'archive_category'
]);

const nonEmpty = (value: unknown, max = 512): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;

const nonBlank = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const parsedTimestamp = (value: unknown): number => typeof value === 'string' ? Date.parse(value) : Number.NaN;

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const securityFingerprint = (
  account: AccountRow,
  person: PersonRecord,
  device: TrustedDeviceRow,
  archivePermissions: readonly ObjectPermissionRow[]
): string => stable({
  account: {
    id: account.id,
    role: account.role,
    status: account.status,
    personId: account.personId,
    startsAt: account.startsAt,
    endsAt: account.endsAt,
    securityEpoch: account.securityEpoch
  },
  person: {
    id: person.id,
    familyId: person.familyId,
    relationshipType: person.relationshipType,
    generation: person.generation,
    branch: person.branch,
    status: person.status
  },
  device: {
    id: device.id,
    accountId: device.accountId,
    deviceId: device.deviceId,
    fingerprint: device.fingerprint,
    publicKeyPem: device.publicKeyPem,
    trustedAt: device.trustedAt,
    lastSeenAt: device.lastSeenAt,
    securityEpoch: device.securityEpoch,
    revokedAt: device.revokedAt
  },
  archivePermissions: [...archivePermissions]
    .map((row) => ({
      id: row.id,
      subjectAccountId: row.subjectAccountId,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      actions: [...row.actions],
      effect: row.effect,
      purpose: row.purpose,
      familyBranchId: row.familyBranchId,
      ownershipBasisPoints: row.ownershipBasisPoints,
      denialReason: row.denialReason,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      createdAt: row.createdAt
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
});

const invalidAuthority = (
  context: ArchiveApplicationContext,
  message: string
): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category: 'security',
  correlationId: context.correlationId
}));

const repositoryContext = (
  context: ArchiveApplicationContext,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: context.actor.userId,
    roles: [context.actor.role],
    ...(context.actor.personId ? { personId: asPersonId(context.actor.personId) } : {})
  },
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt
});

const policyRepositoryContext = (
  context: ArchiveApplicationContext,
  transaction: TransactionContext,
  authorization: PlatformPolicyTransactionContext
): PolicyAuthorizedRepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: asUserId(authorization.subject.accountId),
    roles: authorization.subject.roles,
    ...(authorization.subject.personId
      ? { personId: asPersonId(authorization.subject.personId) }
      : {})
  },
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt,
  policyAuthorization: authorization
});

const projectionFailure = (
  context: ArchiveApplicationContext,
  message: string,
  options: { readonly businessTransactionCommitted: boolean; readonly cause?: unknown }
): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category: 'security',
  correlationId: context.correlationId,
  details: {
    enforcementCode: 'RECEIPT_PERSISTENCE_FAILED',
    businessTransactionCommitted: options.businessTransactionCommitted,
    durableProjectionPending: true,
    ...(options.cause === undefined
      ? {}
      : { cause: options.cause instanceof Error ? options.cause.message : String(options.cause) })
  }
}));

const readLiveFence = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies
): { readonly epoch: number; readonly writable: boolean } => {
  let fence: ReturnType<PlatformPolicyClusterFence>;
  try {
    fence = dependencies.clusterFence();
  } catch (error) {
    throw new PlatformPolicyEnforcementError(
      'CLUSTER_FENCE_CHANGED',
      'Archive production cluster fence could not be read',
      { cause: error }
    );
  }
  if (!fence || !Number.isSafeInteger(fence.epoch) || fence.epoch < 0 || typeof fence.writable !== 'boolean') {
    throw new PlatformPolicyEnforcementError(
      'CLUSTER_FENCE_CHANGED',
      'Archive production cluster fence is invalid'
    );
  }
  return Object.freeze({ epoch: fence.epoch, writable: fence.writable });
};

const synchronizeDatabaseFence = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext
): void => {
  const liveFence = readLiveFence(dependencies);
  const synchronizedAt = asIsoDateTime(dependencies.clock.now());
  const result = dependencies.transactionExecutor.execute(
    context.correlationId,
    (transaction) => dependencies.policyTransactionRepository.synchronizeFence(
      repositoryContext(context, transaction),
      {
        fenceName: ARCHIVE_POLICY_FENCE_NAME,
        epoch: liveFence.epoch,
        writable: liveFence.writable,
        synchronizedAt
      }
    )
  );
  if (
    !result.ok
    || result.value.fenceName !== ARCHIVE_POLICY_FENCE_NAME
    || result.value.epoch !== liveFence.epoch
    || result.value.writable !== liveFence.writable
  ) {
    throw new PlatformPolicyEnforcementError(
      'CLUSTER_FENCE_CHANGED',
      'Archive production cluster fence could not be monotonically synchronized to SQLite',
      { cause: result.ok ? undefined : result.error }
    );
  }
};

const createDurableReplayStore = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext
): PlatformPolicyReplayStore => Object.freeze({
  reserve(reservation: PlatformPolicyReplayReservation) {
    const result = dependencies.transactionExecutor.execute(
      context.correlationId,
      (transaction) => {
        const execution = repositoryContext(context, transaction);
        const pruned = dependencies.policyTransactionRepository.pruneExpiredUnusedReplayReservations(
          execution,
          { cutoffMs: reservation.reservedAtMs, limit: REPLAY_PRUNING_BATCH_SIZE }
        );
        if (!pruned.ok) return pruned;
        return dependencies.policyTransactionRepository.reserveReplayNonce(execution, reservation);
      }
    );
    if (!result.ok) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Archive production replay reservation could not be persisted',
        { cause: result.error }
      );
    }
    return result.value;
  }
});

const recordAuthorizedProductionTransaction = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  input: ArchivePolicyTransactionRevalidationInput
): Result<void, AppError> => {
  if (!input.authorization.fenceWritable) {
    return invalidAuthority(input.context, 'Archive policy mutation requires a writable database fence');
  }
  const recorded = dependencies.policyTransactionRepository.recordAuthorizedTransaction(
    policyRepositoryContext(input.context, input.transaction, input.authorization),
    {
      record: input.authorization.receiptRecord,
      fenceName: ARCHIVE_POLICY_FENCE_NAME,
      fenceEpoch: input.authorization.fenceEpoch,
      fenceWritable: true
    }
  );
  return recorded.ok ? ok(undefined) : recorded;
};

const archiveOperationIdentity = (input: ArchivePolicyTransactionRevalidationInput) => {
  const { context } = input;
  if (
    typeof context.operationId !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(context.operationId)
    || typeof context.operationFingerprint !== 'string'
    || !/^[0-9a-f]{64}$/u.test(context.operationFingerprint)
  ) return invalidAuthority(context, 'Archive mutation requires a valid caller-stable operation identity');
  return ok(Object.freeze({
    operationId: context.operationId,
    operationFingerprint: context.operationFingerprint,
    resourceFamilyId: String(context.familyId),
    actorAccountId: String(context.actor.userId),
    purpose: 'archive' as const
  }));
};

const resolveAuthorizedProductionOperation = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  input: ArchivePolicyTransactionRevalidationInput
): Result<ArchivePolicyOperationResolution, AppError> => {
  const identity = archiveOperationIdentity(input);
  if (!identity.ok) return identity;
  const resolved = dependencies.policyTransactionRepository.resolveArchiveOperation(
    policyRepositoryContext(input.context, input.transaction, input.authorization),
    identity.value
  );
  if (!resolved.ok) return resolved;
  return resolved.value.state === 'execute'
    ? ok(Object.freeze({ state: 'execute' as const }))
    : ok(Object.freeze({
        state: 'conflict' as const,
        resultHash: resolved.value.operation.resultHash,
        completedAt: resolved.value.operation.completedAt
      }));
};

const recordAuthorizedProductionOperationResult = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  input: ArchivePolicyOperationResultInput
): Result<void, AppError> => {
  const identity = archiveOperationIdentity(input);
  if (!identity.ok) return identity;
  const recorded = dependencies.policyTransactionRepository.recordArchiveOperationResult(
    policyRepositoryContext(input.context, input.transaction, input.authorization),
    { ...identity.value, resultHash: input.resultHash }
  );
  return recorded.ok ? ok(undefined) : recorded;
};

const drainPendingJournalProjections = async (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext,
  options: {
    readonly businessTransactionCommitted: boolean;
    readonly expectedAuthorization?: PlatformPolicyTransactionContext;
  }
): Promise<Result<void, AppError>> => {
  const ensureReceipt = dependencies.receiptSink.ensure;
  const verifyProjectionProof = dependencies.receiptSink.verifyProjectionProof;
  if (typeof ensureReceipt !== 'function' || typeof verifyProjectionProof !== 'function') {
    return projectionFailure(
      context,
      'Archive policy receipt projection proof boundary is unavailable; the durable pending record was retained.',
      { businessTransactionCommitted: options.businessTransactionCommitted }
    );
  }

  const anchored = dependencies.transactionExecutor.execute(
    context.correlationId,
    (transaction) => dependencies.policyTransactionRepository.readJournalAnchor(
      repositoryContext(context, transaction)
    )
  );
  if (!anchored.ok) {
    return projectionFailure(
      context,
      'Archive policy journal rollback anchor could not be loaded.',
      { businessTransactionCommitted: options.businessTransactionCommitted, cause: anchored.error }
    );
  }
  if (anchored.value) {
    let anchorValid = false;
    try {
      anchorValid = (await verifyProjectionProof.call(
        dependencies.receiptSink,
        anchored.value.proof
      )) === true;
    } catch (error) {
      return projectionFailure(
        context,
        'Archive policy journal rollback anchor verification failed.',
        { businessTransactionCommitted: options.businessTransactionCommitted, cause: error }
      );
    }
    if (!anchorValid) {
      return projectionFailure(
        context,
        'Archive policy journal no longer contains its SQLite-anchored complete head; authorization stopped.',
        { businessTransactionCommitted: options.businessTransactionCommitted }
      );
    }
  }

  for (let round = 0; round < MAX_PROJECTION_DRAIN_ROUNDS; round += 1) {
    const pending = dependencies.transactionExecutor.execute(
      context.correlationId,
      (transaction) => dependencies.policyTransactionRepository.listPendingJournalProjections(
        repositoryContext(context, transaction),
        PROJECTION_DRAIN_BATCH_SIZE
      )
    );
    if (!pending.ok) {
      return projectionFailure(
        context,
        'Archive policy pending receipt projections could not be loaded; committed data was not rolled back.',
        { businessTransactionCommitted: options.businessTransactionCommitted, cause: pending.error }
      );
    }
    if (pending.value.length === 0) break;

    for (const projection of pending.value) {
      let receiptVerified: boolean;
      try {
        receiptVerified = stable(projection.record.decision) === stable(projection.record.receipt.decision)
          && (await dependencies.authorizationProvider.verify(Object.freeze({
            request: projection.record.request,
            receipt: projection.record.receipt
          }))) === true;
      } catch (error) {
        return projectionFailure(
          context,
          'Archive policy pending receipt could not be cryptographically verified before journal projection.',
          { businessTransactionCommitted: options.businessTransactionCommitted, cause: error }
        );
      }
      if (!receiptVerified) {
        return projectionFailure(
          context,
          'Archive policy pending receipt failed cryptographic verification and remains durable and unprojected.',
          { businessTransactionCommitted: options.businessTransactionCommitted }
        );
      }
      let proof: PlatformPolicyJournalProjectionProof;
      try {
        proof = await ensureReceipt.call(dependencies.receiptSink, projection.record);
      } catch (error) {
        return projectionFailure(
          context,
          'Archive policy receipt journal projection failed; committed data was not rolled back and the durable projection remains pending.',
          { businessTransactionCommitted: options.businessTransactionCommitted, cause: error }
        );
      }
      let proofValid = false;
      try {
        proofValid = (await verifyProjectionProof.call(dependencies.receiptSink, proof)) === true;
      } catch (error) {
        return projectionFailure(
          context,
          'Archive policy receipt journal returned a proof that could not be verified.',
          { businessTransactionCommitted: options.businessTransactionCommitted, cause: error }
        );
      }
      if (!proofValid) {
        return projectionFailure(
          context,
          'Archive policy receipt journal returned an invalid projection proof; the durable row remains pending.',
          { businessTransactionCommitted: options.businessTransactionCommitted }
        );
      }
      const acknowledged = dependencies.transactionExecutor.execute(
        context.correlationId,
        (transaction) => dependencies.policyTransactionRepository.acknowledgeJournalProjection(
          repositoryContext(context, transaction),
          {
            receiptHash: projection.receiptHash,
            projectedAt: asIsoDateTime(dependencies.clock.now()),
            proof
          }
        )
      );
      if (!acknowledged.ok) {
        return projectionFailure(
          context,
          'Archive policy receipt projection acknowledgement failed; committed data was not rolled back.',
          { businessTransactionCommitted: options.businessTransactionCommitted, cause: acknowledged.error }
        );
      }
      // false is safe here: ensure() just proved the exact external record and
      // another projector may have acknowledged the same durable row first.
    }
  }

  const remaining = dependencies.transactionExecutor.execute(
    context.correlationId,
    (transaction) => dependencies.policyTransactionRepository.listPendingJournalProjections(
      repositoryContext(context, transaction),
      1
    )
  );
  if (!remaining.ok || remaining.value.length > 0) {
    return projectionFailure(
      context,
      'Archive policy receipt projection backlog remains durable and pending; no external complete-tail rollback is claimed.',
      { businessTransactionCommitted: options.businessTransactionCommitted, cause: remaining.ok ? undefined : remaining.error }
    );
  }

  if (options.expectedAuthorization) {
    const expected = options.expectedAuthorization;
    const receipt = dependencies.transactionExecutor.execute(
      context.correlationId,
      (transaction) => dependencies.policyTransactionRepository.findReceiptByNonce(
        repositoryContext(context, transaction),
        expected.receipt.nonce
      )
    );
    if (
      !receipt.ok
      || !receipt.value
      || stable(receipt.value.record) !== stable(expected.receiptRecord)
    ) {
      return projectionFailure(
        context,
        'Archive policy committed receipt could not be confirmed after journal projection.',
        { businessTransactionCommitted: true, cause: receipt.ok ? undefined : receipt.error }
      );
    }
  }
  return ok(undefined);
};

const accountIsActive = (
  account: AccountRow,
  context: ArchiveApplicationContext,
  occurredAt: string
): boolean => {
  const now = parsedTimestamp(occurredAt);
  const startsAt = parsedTimestamp(account.startsAt);
  const endsAt = account.endsAt === undefined ? undefined : parsedTimestamp(account.endsAt);
  return Number.isFinite(now)
    && Number.isFinite(startsAt)
    && (endsAt === undefined || Number.isFinite(endsAt))
    && account.id === context.actor.userId
    && account.status === 'active'
    && authorizationRoleMatches(account.role, context.actor.role)
    && nonEmpty(account.role, 128)
    && nonEmpty(account.personId, 256)
    && account.personId === context.actor.personId
    && Number.isSafeInteger(account.securityEpoch)
    && account.securityEpoch >= 0
    && startsAt <= now
    && (endsAt === undefined || endsAt > now);
};

const deviceIsTrusted = (
  device: TrustedDeviceRow,
  identity: DeviceIdentitySnapshot,
  account: AccountRow,
  occurredAt: string
): boolean => {
  const trustedAt = parsedTimestamp(device.trustedAt);
  const lastSeenAt = parsedTimestamp(device.lastSeenAt);
  const now = parsedTimestamp(occurredAt);
  return device.accountId === account.id
    && device.deviceId === identity.deviceId
    && device.fingerprint === identity.fingerprint
    && device.publicKeyPem === identity.publicKeyPem
    && device.securityEpoch === account.securityEpoch
    && device.revokedAt === undefined
    && Number.isFinite(trustedAt)
    && Number.isFinite(lastSeenAt)
    && Number.isFinite(now)
    && trustedAt <= lastSeenAt
    && lastSeenAt <= now;
};

const permissionIsValid = (
  row: ObjectPermissionRow,
  account: AccountRow,
  occurredAt: string
): boolean => {
  const now = parsedTimestamp(occurredAt);
  const startsAt = parsedTimestamp(row.startsAt);
  const endsAt = row.endsAt === undefined ? undefined : parsedTimestamp(row.endsAt);
  return nonEmpty(row.id, 256)
    && row.subjectAccountId === account.id
    && nonEmpty(row.resourceType, 128)
    && nonEmpty(row.resourceId, 256)
    && Array.isArray(row.actions)
    && row.actions.length > 0
    && row.actions.length <= policyActions.size
    && row.actions.every((action) => policyActions.has(action as PolicyAction))
    && new Set(row.actions).size === row.actions.length
    && (row.effect === 'allow' || row.effect === 'deny')
    && (row.ownershipBasisPoints === undefined || (row.effect === 'allow' && Number.isInteger(row.ownershipBasisPoints) && row.ownershipBasisPoints >= 1 && row.ownershipBasisPoints <= 10_000))
    && nonEmpty(row.purpose, 128)
    && row.familyBranchId === undefined
    && Number.isFinite(now)
    && Number.isFinite(startsAt)
    && startsAt <= now
    && (endsAt === undefined || (Number.isFinite(endsAt) && endsAt >= now));
};

const toPolicyGrant = (row: ObjectPermissionRow): PolicyGrant => Object.freeze({
  id: row.id,
  subjectAccountId: row.subjectAccountId,
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  actions: Object.freeze([...row.actions]) as readonly PolicyAction[],
  effect: row.effect,
  ...(row.ownershipBasisPoints === undefined ? {} : { ownershipBasisPoints: row.ownershipBasisPoints }),
  purposes: Object.freeze([row.purpose]),
  startsAt: row.startsAt,
  ...(row.endsAt ? { endsAt: row.endsAt } : {})
});

const authorityExpiry = (account: AccountRow, occurredAt: string): string | undefined => {
  const now = parsedTimestamp(occurredAt);
  const accountEndsAt = account.endsAt === undefined ? Number.POSITIVE_INFINITY : parsedTimestamp(account.endsAt);
  const expiresAt = Math.min(now + 30_000, accountEndsAt);
  return Number.isFinite(now) && Number.isFinite(expiresAt) && expiresAt > now
    ? new Date(expiresAt).toISOString()
    : undefined;
};

const loadAuthoritySnapshotInTransaction = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext,
  identity: DeviceIdentitySnapshot,
  transaction: TransactionContext
): Result<AuthoritySnapshot, AppError> => {
  const execution = repositoryContext(context, transaction);
  const accountResult = dependencies.accountRepository.findById(execution, context.actor.userId);
  if (!accountResult.ok) return accountResult;
  const account = accountResult.value;
  if (!account || !accountIsActive(account, context, execution.occurredAt)) {
    return invalidAuthority(context, 'Archive policy account, role or person membership is not active and exact');
  }

  const personResult = dependencies.personRepository.findById(execution, asPersonId(account.personId!));
  if (!personResult.ok) return personResult;
  const person = personResult.value;
  if (
    !person
    || person.id !== account.personId
    || person.familyId !== context.familyId
    || person.status !== 'active'
  ) {
    return invalidAuthority(context, 'Archive policy person membership does not match the active family');
  }

  const deviceResult = dependencies.trustedDeviceRepository.findActive(execution, account.id, identity.deviceId);
  if (!deviceResult.ok) return deviceResult;
  const device = deviceResult.value;
  if (!device || !deviceIsTrusted(device, identity, account, execution.occurredAt)) {
    return invalidAuthority(context, 'Archive policy device identity is not trusted for the active security epoch');
  }

  const permissionsResult = dependencies.permissionRepository.listActiveForSubject(
    execution,
    account.id,
    execution.occurredAt
  );
  if (!permissionsResult.ok) return permissionsResult;
  const archivePermissions = permissionsResult.value.filter((row) =>
    row.purpose === 'archive' && createResourceTypes.has(row.resourceType)
  );
  if (
    archivePermissions.length > 10_000
    || archivePermissions.some((row) => !permissionIsValid(row, account, execution.occurredAt))
  ) {
    return invalidAuthority(context, 'Archive policy permission snapshot contains invalid or unsupported grants');
  }

  const expiresAt = authorityExpiry(account, execution.occurredAt);
  if (!expiresAt) return invalidAuthority(context, 'Archive policy authority expiry could not be established');
  const grants = Object.freeze(archivePermissions.map(toPolicyGrant));
  return ok({
    authority: Object.freeze({
      policyVersion: dependencies.policyVersion,
      accountId: account.id,
      personId: person.id,
      deviceId: identity.deviceId,
      applicationId: 'windows-desktop',
      devicePublicKeyFingerprintSha256: device.fingerprint,
      deviceCertificateIssuedAt: device.trustedAt,
      deviceTrusted: true,
      membershipActive: true,
      roles: Object.freeze([account.role]),
      familyIds: Object.freeze([person.familyId]),
      online: true,
      grants,
      expiresAt
    }),
    securityFingerprint: securityFingerprint(account, person, device, archivePermissions)
  });
};

const loadAuthoritySnapshot = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext,
  identity: DeviceIdentitySnapshot
): Result<AuthoritySnapshot, AppError> => dependencies.transactionExecutor.execute<AuthoritySnapshot>(
  context.correlationId,
  (transaction) => loadAuthoritySnapshotInTransaction(dependencies, context, identity, transaction)
);

const ensureRuntimeConfiguration = (dependencies: ArchiveProductionPolicyRuntimeDependencies): void => {
  if (
    !dependencies
    || typeof dependencies.transactionExecutor?.execute !== 'function'
    || typeof dependencies.accountRepository?.findById !== 'function'
    || typeof dependencies.permissionRepository?.listActiveForSubject !== 'function'
    || typeof dependencies.trustedDeviceRepository?.findActive !== 'function'
    || typeof dependencies.archiveRepository?.findForPolicyResolution !== 'function'
    || typeof dependencies.personRepository?.findById !== 'function'
    || typeof dependencies.deviceIdentityProvider?.snapshot !== 'function'
    || typeof dependencies.authorizationProvider?.authorize !== 'function'
    || typeof dependencies.authorizationProvider?.verify !== 'function'
    || typeof dependencies.receiptSink?.append !== 'function'
    || typeof dependencies.receiptSink?.ensure !== 'function'
    || typeof dependencies.receiptSink?.verifyProjectionProof !== 'function'
    || typeof dependencies.policyTransactionRepository?.reserveReplayNonce !== 'function'
    || typeof dependencies.policyTransactionRepository?.synchronizeFence !== 'function'
    || typeof dependencies.policyTransactionRepository?.recordAuthorizedTransaction !== 'function'
    || typeof dependencies.policyTransactionRepository?.resolveArchiveOperation !== 'function'
    || typeof dependencies.policyTransactionRepository?.recordArchiveOperationResult !== 'function'
    || typeof dependencies.policyTransactionRepository?.findArchiveOperationMetadata !== 'function'
    || typeof dependencies.policyTransactionRepository?.listPendingJournalProjections !== 'function'
    || typeof dependencies.policyTransactionRepository?.acknowledgeJournalProjection !== 'function'
    || typeof dependencies.policyTransactionRepository?.readJournalAnchor !== 'function'
    || typeof dependencies.policyTransactionRepository?.findReceiptByNonce !== 'function'
    || typeof dependencies.clusterFence !== 'function'
    || typeof dependencies.clock?.now !== 'function'
    || !nonEmpty(dependencies.policyVersion, 128)
  ) {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Archive production policy runtime configuration is incomplete or invalid'
    );
  }
};

const sensitivityFor = (item: ArchiveItemRow): PolicyResource['sensitivity'] => {
  if (item.sensitivity === 'standard') return 'internal';
  if (item.sensitivity === 'personal') return 'personal';
  if (item.sensitivity === 'high') return 'highly_sensitive';
  throw new PlatformPolicyEnforcementError(
    'RESOURCE_RESOLUTION_FAILED',
    'Archive item sensitivity is not supported by the platform policy model'
  );
};

const findMatchingCommittedCreateOperation = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext,
  intent: ArchiveResourceIntent,
  execution: RepositoryExecutionContext
): Result<PlatformPolicyArchiveOperationMetadata | undefined, AppError> => {
  if (context.operationId === undefined) return ok(undefined);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(context.operationId)
    || typeof context.operationFingerprint !== 'string'
    || !/^[0-9a-f]{64}$/u.test(context.operationFingerprint)
  ) return invalidAuthority(context, 'Archive create retry operation identity is invalid');
  const lookup = Object.freeze({
    operationId: context.operationId,
    operationFingerprint: context.operationFingerprint,
    resourceFamilyId: String(context.familyId),
    actorAccountId: String(context.actor.userId),
    purpose: 'archive' as const,
    resourceType: intent.resourceType,
    resourceId: intent.resourceId,
    action: intent.action,
    capability: 'archive.write' as const
  });
  const found = dependencies.policyTransactionRepository.findArchiveOperationMetadata(execution, lookup);
  if (!found.ok || !found.value) return found;
  const operation = found.value;
  if (
    operation.operationFingerprint !== context.operationFingerprint
    || operation.resourceFamilyId !== context.familyId
    || operation.actorAccountId !== context.actor.userId
    || operation.purpose !== 'archive'
    || operation.resourceType !== intent.resourceType
    || operation.resourceId !== intent.resourceId
    || operation.action !== intent.action
    || operation.capability !== 'archive.write'
  ) return invalidAuthority(context, 'Archive create operation identity belongs to a different mutation');
  return ok(operation);
};

const loadArchiveResourceSnapshotInTransaction = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext,
  intent: ArchiveResourceIntent,
  transaction: TransactionContext
): Result<ArchiveResourceSnapshot, AppError> => {
  const execution = repositoryContext(context, transaction);
  if (
    intent.action === 'read'
    && intent.resourceType === 'archive_collection'
    && intent.resourceId === context.familyId
  ) {
    const items = dependencies.archiveRepository.listForPolicyResolution(execution);
    if (!items.ok) return items;
    const retentionPolicies = dependencies.archiveRepository.listRetentionPoliciesForPolicyResolution(execution);
    if (!retentionPolicies.ok) return retentionPolicies;
    const retentionStatuses = dependencies.archiveRepository.listRetentionStatusForPolicyResolution(execution);
    if (!retentionStatuses.ok) return retentionStatuses;
    const categories = dependencies.archiveRepository.listCategoriesForPolicyResolution(execution);
    if (!categories.ok) return categories;
    const classifications = dependencies.archiveRepository.listClassificationsForPolicyResolution(execution);
    if (!classifications.ok) return classifications;
    const resource = Object.freeze({
      type: 'archive_collection',
      id: String(context.familyId),
      familyId: context.familyId,
      ...(context.actor.personId ? { ownerPersonId: context.actor.personId } : {}),
      sensitivity: 'internal' as const
    });
    return ok(Object.freeze({
      resource,
      stateFingerprint: stable({
        items: items.value,
        retentionPolicies: retentionPolicies.value,
        retentionStatuses: retentionStatuses.value,
        categories: categories.value,
        classifications: classifications.value
      })
    }));
  }
  if (intent.action === 'create') {
    const committedOperation = findMatchingCommittedCreateOperation(
      dependencies,
      context,
      intent,
      execution
    );
    if (!committedOperation.ok) return committedOperation;
    let exists: Result<boolean, AppError>;
    if (intent.resourceType === 'archive_item') {
      const item = dependencies.archiveRepository.findForPolicyResolution(execution, intent.resourceId);
      exists = item.ok ? ok(item.value !== null) : item;
    } else if (intent.resourceType === 'archive_retention_policy') {
      const policies = dependencies.archiveRepository.listRetentionPoliciesForPolicyResolution(execution);
      exists = policies.ok
        ? ok(policies.value.some((row) => row.id === intent.resourceId))
        : policies;
    } else if (intent.resourceType === 'archive_category') {
      const categories = dependencies.archiveRepository.listCategoriesForPolicyResolution(execution);
      exists = categories.ok
        ? ok(categories.value.some((row) => row.id === intent.resourceId))
        : categories;
    } else {
      return invalidAuthority(context, 'Archive policy create resource type is unsupported');
    }
    if (!exists.ok) return exists;
    if (exists.value) {
      if (!committedOperation.value) {
        return invalidAuthority(context, 'Archive policy create resource already exists');
      }
      const resource = Object.freeze({
        type: intent.resourceType,
        id: intent.resourceId,
        familyId: context.familyId,
        ...(intent.resourceType === 'archive_item' && context.actor.personId
          ? { ownerPersonId: context.actor.personId }
          : {}),
        sensitivity: 'internal' as const
      });
      return ok(Object.freeze({
        resource,
        stateFingerprint: stable({
          state: 'completed-operation',
          operationId: committedOperation.value.operationId,
          operationFingerprint: committedOperation.value.operationFingerprint,
          resultHash: committedOperation.value.resultHash,
          completedAt: committedOperation.value.completedAt,
          resourceType: intent.resourceType,
          resourceId: intent.resourceId,
          familyId: context.familyId
        })
      }));
    }
    if (committedOperation.value) {
      return invalidAuthority(context, 'Archive create operation is committed but its resource is missing');
    }
    const resource = Object.freeze({
      type: intent.resourceType,
      id: intent.resourceId,
      familyId: context.familyId,
      ...(intent.resourceType === 'archive_item' && context.actor.personId
        ? { ownerPersonId: context.actor.personId }
        : {}),
      sensitivity: 'internal' as const
    });
    return ok(Object.freeze({
      resource,
      stateFingerprint: stable({
        state: 'absent',
        resourceType: intent.resourceType,
        resourceId: intent.resourceId,
        familyId: context.familyId
      })
    }));
  }

  if (
    intent.resourceType !== 'archive_item'
    || (intent.action !== 'read' && intent.action !== 'update' && intent.action !== 'delete' && intent.action !== 'record')
  ) {
    return invalidAuthority(context, 'Archive policy transaction resource is unsupported');
  }
  const item = dependencies.archiveRepository.findForPolicyResolution(execution, intent.resourceId);
  if (!item.ok) return item;
  if (!item.value || item.value.familyId !== context.familyId) {
    return invalidAuthority(context, 'Archive policy resource does not exist in the active family');
  }
  const versions = dependencies.archiveRepository.listVersionsForPolicyResolution(execution, intent.resourceId);
  if (!versions.ok) return versions;
  const retentionStatuses = dependencies.archiveRepository.listRetentionStatusForPolicyResolution(execution);
  if (!retentionStatuses.ok) return retentionStatuses;
  const retentionStatus = retentionStatuses.value.find((row) => row.itemId === intent.resourceId) ?? null;
  let retentionPolicy = null;
  if (retentionStatus?.policyId) {
    const retentionPolicies = dependencies.archiveRepository.listRetentionPoliciesForPolicyResolution(execution);
    if (!retentionPolicies.ok) return retentionPolicies;
    retentionPolicy = retentionPolicies.value.find((row) => row.id === retentionStatus.policyId) ?? null;
    if (!retentionPolicy) {
      return invalidAuthority(context, 'Archive policy linked retention policy could not be resolved');
    }
  }
  const classifications = dependencies.archiveRepository.listClassificationsForPolicyResolution(execution);
  if (!classifications.ok) return classifications;
  const resource = Object.freeze({
    type: 'archive_item',
    id: item.value.id,
    familyId: item.value.familyId,
    ...(item.value.ownerPersonId ? { ownerPersonId: item.value.ownerPersonId } : {}),
    sensitivity: sensitivityFor(item.value)
  });
  return ok(Object.freeze({
    resource,
    stateFingerprint: stable({
      item: item.value,
      versions: versions.value,
      retention: {
        status: retentionStatus,
        policy: retentionPolicy
      },
      classification: classifications.value.find((row) => row.itemId === intent.resourceId) ?? null
    })
  }));
};

const loadArchiveResourceSnapshot = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext,
  intent: ArchiveResourceIntent
): ArchiveResourceSnapshot => {
  const result = dependencies.transactionExecutor.execute<ArchiveResourceSnapshot>(
    context.correlationId,
    (transaction) => loadArchiveResourceSnapshotInTransaction(dependencies, context, intent, transaction)
  );
  if (!result.ok) {
    throw new PlatformPolicyEnforcementError(
      'RESOURCE_RESOLUTION_FAILED',
      `Archive policy resource snapshot could not be loaded: ${result.error.code}`,
      { cause: result.error }
    );
  }
  return result.value;
};

const resolveResource = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext,
  intent: PlatformPolicyIntent,
  authority: PlatformPolicyConnectionAuthority
): ArchiveResourceSnapshot => {
  if (
    authority.accountId !== context.actor.userId
    || authority.personId !== context.actor.personId
    || authority.roles.length !== 1
    || authority.roles[0] !== context.actor.role
    || authority.familyIds.length !== 1
    || authority.familyIds[0] !== context.familyId
  ) {
    throw new PlatformPolicyEnforcementError(
      'RESOURCE_RESOLUTION_FAILED',
      'Archive policy authority changed outside the resolved application context'
    );
  }
  if (
    (intent.action === 'create' && createResourceTypes.has(intent.resourceType))
    || (
      intent.resourceType === 'archive_item'
      && (intent.action === 'read' || intent.action === 'update' || intent.action === 'delete' || intent.action === 'record')
    )
    || (
      intent.resourceType === 'archive_collection'
      && intent.action === 'read'
      && intent.resourceId === context.familyId
    )
  ) {
    return loadArchiveResourceSnapshot(dependencies, context, intent);
  }
  throw new PlatformPolicyEnforcementError(
    'RESOURCE_RESOLUTION_FAILED',
    'Archive policy intent does not identify a supported production resource operation'
  );
};

const revalidateProductionTransaction = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies,
  context: ArchiveApplicationContext,
  identity: DeviceIdentitySnapshot,
  capturedAuthority: AuthoritySnapshot,
  capturedResource: ArchiveResourceSnapshot | undefined,
  input: ArchivePolicyTransactionRevalidationInput
): Result<void, AppError> => {
  if (
    input.context.actor.userId !== context.actor.userId
    || input.context.actor.personId !== context.actor.personId
    || !authorizationRoleMatches(input.context.actor.role, context.actor.role)
    || input.context.familyId !== context.familyId
    || input.context.correlationId !== context.correlationId
  ) {
    return invalidAuthority(context, 'Archive policy application context changed before the business transaction');
  }
  if (!capturedResource) {
    return invalidAuthority(context, 'Archive policy resource was not captured before receipt issuance');
  }

  const currentAuthority = loadAuthoritySnapshotInTransaction(
    dependencies,
    context,
    identity,
    input.transaction
  );
  if (!currentAuthority.ok) return currentAuthority;
  if (currentAuthority.value.securityFingerprint !== capturedAuthority.securityFingerprint) {
    return invalidAuthority(context, 'Archive policy authority changed after receipt issuance');
  }
  if (
    input.authorization.policyVersion !== currentAuthority.value.authority.policyVersion
    || input.authorization.subject.accountId !== currentAuthority.value.authority.accountId
    || input.authorization.subject.personId !== currentAuthority.value.authority.personId
    || input.authorization.subject.deviceId !== currentAuthority.value.authority.deviceId
    || input.authorization.subject.applicationId !== currentAuthority.value.authority.applicationId
    || stable(input.authorization.subject.roles) !== stable(currentAuthority.value.authority.roles)
    || stable(input.authorization.subject.familyIds) !== stable(currentAuthority.value.authority.familyIds)
  ) {
    return invalidAuthority(context, 'Archive policy receipt subject no longer matches the live authority');
  }

  const currentResource = loadArchiveResourceSnapshotInTransaction(
    dependencies,
    input.context,
    input.intent,
    input.transaction
  );
  if (!currentResource.ok) return currentResource;
  if (
    currentResource.value.stateFingerprint !== capturedResource.stateFingerprint
    || stable(currentResource.value.resource) !== stable(capturedResource.resource)
    || input.authorization.resourceType !== currentResource.value.resource.type
    || input.authorization.resourceId !== currentResource.value.resource.id
    || input.authorization.resourceFamilyId !== currentResource.value.resource.familyId
  ) {
    return invalidAuthority(context, 'Archive policy resource changed after receipt issuance');
  }
  return ok(undefined);
};

export const createArchiveProductionPolicyEnforcementPointResolver = (
  dependencies: ArchiveProductionPolicyRuntimeDependencies
): ArchivePolicyEnforcementPointResolver => {
  ensureRuntimeConfiguration(dependencies);
  return Object.freeze({
    async resolve(context: ArchiveApplicationContext): Promise<ArchivePolicyEnforcementPoint> {
      const recovered = await drainPendingJournalProjections(dependencies, context, {
        businessTransactionCommitted: false
      });
      if (!recovered.ok) {
        throw new PlatformPolicyEnforcementError(
          'RECEIPT_PERSISTENCE_FAILED',
          'Archive production policy receipt recovery must succeed before a new authorization can start',
          { cause: recovered.error }
        );
      }
      synchronizeDatabaseFence(dependencies, context);
      let identity: DeviceIdentitySnapshot;
      try {
        identity = dependencies.deviceIdentityProvider.snapshot();
      } catch (error) {
        throw new PlatformPolicyEnforcementError(
          'AUTHORITY_RESOLUTION_FAILED',
          'Archive policy device identity snapshot could not be loaded',
          { cause: error }
        );
      }
      if (
        !nonEmpty(identity.deviceId, 256)
        || !nonEmpty(identity.fingerprint, 512)
        || !nonBlank(identity.publicKeyPem, 16_384)
      ) {
        throw new PlatformPolicyEnforcementError(
          'AUTHORITY_INVALID',
          'Archive policy device identity snapshot is invalid'
        );
      }
      const snapshot = loadAuthoritySnapshot(dependencies, context, identity);
      if (!snapshot.ok) {
        throw new PlatformPolicyEnforcementError(
          'AUTHORITY_RESOLUTION_FAILED',
          `Archive production policy authority could not be loaded: ${snapshot.error.code}`,
          { cause: snapshot.error }
        );
      }
      let capturedResource: ArchiveResourceSnapshot | undefined;
      const enforcementPoint = createTypedPolicyEnforcementPoint({
        provider: dependencies.authorizationProvider,
        authorityResolver: { resolve: () => snapshot.value.authority },
        resourceResolver: {
          resolve: (intent, authority) => {
            capturedResource = resolveResource(dependencies, context, intent, authority);
            return capturedResource.resource;
          }
        },
        receiptSink: dependencies.receiptSink,
        replayStore: createDurableReplayStore(dependencies, context),
        deferAllowedReceiptPersistence: true,
        clock: () => dependencies.clock.now()
      });
      return Object.freeze(Object.assign(enforcementPoint, {
        requiresTransactionRevalidation: true as const,
        requiresDurableTransactionReceipt: true as const,
        requiresDurableOperationIdempotency: true as const,
        revalidateTransaction: (input: ArchivePolicyTransactionRevalidationInput): Result<void, AppError> =>
          revalidateProductionTransaction(
            dependencies,
            context,
            identity,
            snapshot.value,
            capturedResource,
            input
          ),
        recordAuthorizedTransaction: (
          input: ArchivePolicyTransactionRevalidationInput
        ): Result<void, AppError> => recordAuthorizedProductionTransaction(dependencies, input),
        resolveAuthorizedOperation: (
          input: ArchivePolicyTransactionRevalidationInput
        ): Result<ArchivePolicyOperationResolution, AppError> => resolveAuthorizedProductionOperation(dependencies, input),
        recordAuthorizedOperationResult: (
          input: ArchivePolicyOperationResultInput
        ): Result<void, AppError> => recordAuthorizedProductionOperationResult(dependencies, input),
        projectCommittedTransaction: (
          input: ArchivePolicyCommittedTransactionInput
        ): Promise<Result<void, AppError>> => drainPendingJournalProjections(
          dependencies,
          input.context,
          {
            businessTransactionCommitted: true,
            expectedAuthorization: input.authorization
          }
        )
      }));
    }
  });
};
