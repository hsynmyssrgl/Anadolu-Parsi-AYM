import type { HealthApplicationContext, HealthPolicyIntent } from '@ppt/application';
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
  HealthPolicyResourceRepositoryPort,
  HealthRecordRow,
  ObjectPermissionRepositoryPort,
  ObjectPermissionRow,
  PersonRecord,
  PersonRepositoryPort,
  PlatformPolicyTransactionRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor,
  TrustedDeviceRepositoryPort,
  TrustedDeviceRow
} from '@ppt/repository-contracts';
import type {
  HealthPolicyCommittedTransactionInput,
  HealthPolicyEnforcementPoint,
  HealthPolicyEnforcementPointResolver,
  HealthPolicyTransactionRevalidationInput
} from './health-application-adapter.js';
import type { FileDeviceIdentityProvider } from './device-identity.js';
import { authorizationRoleMatches } from '@ppt/security';

type DeviceIdentitySnapshot = ReturnType<FileDeviceIdentityProvider['snapshot']>;

export interface HealthProductionPolicyRuntimeDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly accountRepository: AccountRepositoryPort;
  readonly permissionRepository: ObjectPermissionRepositoryPort;
  readonly trustedDeviceRepository: TrustedDeviceRepositoryPort;
  readonly healthPolicyResourceRepository: HealthPolicyResourceRepositoryPort;
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

interface HealthResourceSnapshot {
  readonly resource: PolicyResource;
  readonly stateFingerprint: string;
}

const HEALTH_POLICY_FENCE_NAME = 'health-write';
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
const healthResourceTypes = new Set<HealthPolicyIntent['resourceType']>([
  'health_record',
  'medication_plan',
  'family_health_history',
  'health_care_center'
]);

const nonEmpty = (value: unknown, max = 512): value is string =>
  typeof value === 'string'
  && value.trim() === value
  && value.length > 0
  && value.length <= max;

const nonBlank = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const parsedTimestamp = (value: unknown): number =>
  typeof value === 'string' ? Date.parse(value) : Number.NaN;

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const invalidAuthority = (
  context: HealthApplicationContext,
  message: string
): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category: 'security',
  correlationId: context.correlationId
}));

const repositoryContext = (
  context: HealthApplicationContext,
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
  context: HealthApplicationContext,
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
  context: HealthApplicationContext,
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
  dependencies: HealthProductionPolicyRuntimeDependencies
): { readonly epoch: number; readonly writable: boolean } => {
  let fence: ReturnType<PlatformPolicyClusterFence>;
  try {
    fence = dependencies.clusterFence();
  } catch (error) {
    throw new PlatformPolicyEnforcementError(
      'CLUSTER_FENCE_CHANGED',
      'Health production cluster fence could not be read',
      { cause: error }
    );
  }
  if (!fence || !Number.isSafeInteger(fence.epoch) || fence.epoch < 0 || typeof fence.writable !== 'boolean') {
    throw new PlatformPolicyEnforcementError(
      'CLUSTER_FENCE_CHANGED',
      'Health production cluster fence is invalid'
    );
  }
  return Object.freeze({ epoch: fence.epoch, writable: fence.writable });
};

const synchronizeDatabaseFence = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  context: HealthApplicationContext
): void => {
  const liveFence = readLiveFence(dependencies);
  const synchronizedAt = asIsoDateTime(dependencies.clock.now());
  const result = dependencies.transactionExecutor.execute(
    context.correlationId,
    (transaction) => dependencies.policyTransactionRepository.synchronizeFence(
      repositoryContext(context, transaction),
      {
        fenceName: HEALTH_POLICY_FENCE_NAME,
        epoch: liveFence.epoch,
        writable: liveFence.writable,
        synchronizedAt
      }
    )
  );
  if (
    !result.ok
    || result.value.fenceName !== HEALTH_POLICY_FENCE_NAME
    || result.value.epoch !== liveFence.epoch
    || result.value.writable !== liveFence.writable
  ) {
    throw new PlatformPolicyEnforcementError(
      'CLUSTER_FENCE_CHANGED',
      'Health production cluster fence could not be monotonically synchronized to SQLite',
      { cause: result.ok ? undefined : result.error }
    );
  }
};

const createDurableReplayStore = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  context: HealthApplicationContext
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
        'Health production replay reservation could not be persisted',
        { cause: result.error }
      );
    }
    return result.value;
  }
});

const recordAuthorizedProductionTransaction = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  input: HealthPolicyTransactionRevalidationInput
): Result<void, AppError> => {
  if (!input.authorization.fenceWritable) {
    return invalidAuthority(input.context, 'Health policy operation requires a writable database fence');
  }
  const recorded = dependencies.policyTransactionRepository.recordAuthorizedTransaction(
    policyRepositoryContext(input.context, input.transaction, input.authorization),
    {
      record: input.authorization.receiptRecord,
      fenceName: HEALTH_POLICY_FENCE_NAME,
      fenceEpoch: input.authorization.fenceEpoch,
      fenceWritable: true
    }
  );
  return recorded.ok ? ok(undefined) : recorded;
};

const drainPendingJournalProjections = async (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  context: HealthApplicationContext,
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
      'Health policy receipt projection proof boundary is unavailable; the durable pending record was retained.',
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
      'Health policy journal rollback anchor could not be loaded.',
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
        'Health policy journal rollback anchor verification failed.',
        { businessTransactionCommitted: options.businessTransactionCommitted, cause: error }
      );
    }
    if (!anchorValid) {
      return projectionFailure(
        context,
        'Health policy journal no longer contains its SQLite-anchored complete head; authorization stopped.',
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
        'Health policy pending receipt projections could not be loaded.',
        { businessTransactionCommitted: options.businessTransactionCommitted, cause: pending.error }
      );
    }
    if (pending.value.length === 0) break;

    for (const projection of pending.value) {
      let receiptVerified = false;
      try {
        receiptVerified = stable(projection.record.decision) === stable(projection.record.receipt.decision)
          && (await dependencies.authorizationProvider.verify(Object.freeze({
            request: projection.record.request,
            receipt: projection.record.receipt
          }))) === true;
      } catch (error) {
        return projectionFailure(
          context,
          'Health policy pending receipt could not be cryptographically verified.',
          { businessTransactionCommitted: options.businessTransactionCommitted, cause: error }
        );
      }
      if (!receiptVerified) {
        return projectionFailure(
          context,
          'Health policy pending receipt failed cryptographic verification and remains durable.',
          { businessTransactionCommitted: options.businessTransactionCommitted }
        );
      }

      let proof: PlatformPolicyJournalProjectionProof;
      try {
        proof = await ensureReceipt.call(dependencies.receiptSink, projection.record);
      } catch (error) {
        return projectionFailure(
          context,
          'Health policy receipt journal projection failed; the durable projection remains pending.',
          { businessTransactionCommitted: options.businessTransactionCommitted, cause: error }
        );
      }
      let proofValid = false;
      try {
        proofValid = (await verifyProjectionProof.call(dependencies.receiptSink, proof)) === true;
      } catch (error) {
        return projectionFailure(
          context,
          'Health policy receipt journal returned a proof that could not be verified.',
          { businessTransactionCommitted: options.businessTransactionCommitted, cause: error }
        );
      }
      if (!proofValid) {
        return projectionFailure(
          context,
          'Health policy receipt journal returned an invalid projection proof.',
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
          'Health policy receipt projection acknowledgement failed.',
          { businessTransactionCommitted: options.businessTransactionCommitted, cause: acknowledged.error }
        );
      }
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
      'Health policy receipt projection backlog remains durable and pending.',
      {
        businessTransactionCommitted: options.businessTransactionCommitted,
        cause: remaining.ok ? undefined : remaining.error
      }
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
    if (!receipt.ok || !receipt.value || stable(receipt.value.record) !== stable(expected.receiptRecord)) {
      return projectionFailure(
        context,
        'Health policy committed receipt could not be confirmed after journal projection.',
        { businessTransactionCommitted: true, cause: receipt.ok ? undefined : receipt.error }
      );
    }
  }
  return ok(undefined);
};

const accountIsActive = (
  account: AccountRow,
  context: HealthApplicationContext,
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
    && healthResourceTypes.has(row.resourceType as HealthPolicyIntent['resourceType'])
    && nonEmpty(row.resourceId, 256)
    && Array.isArray(row.actions)
    && row.actions.length > 0
    && row.actions.length <= policyActions.size
    && row.actions.every((action) => policyActions.has(action as PolicyAction))
    && new Set(row.actions).size === row.actions.length
    && (row.effect === 'allow' || row.effect === 'deny')
    && (row.ownershipBasisPoints === undefined || (row.effect === 'allow' && Number.isInteger(row.ownershipBasisPoints) && row.ownershipBasisPoints >= 1 && row.ownershipBasisPoints <= 10_000))
    && (row.purpose === 'health' || row.purpose === 'care' || row.purpose === 'general')
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
  ...(row.purpose === 'general' ? {} : { purposes: Object.freeze([row.purpose]) }),
  startsAt: row.startsAt,
  ...(row.endsAt ? { endsAt: row.endsAt } : {})
});

const authorityExpiry = (account: AccountRow, occurredAt: string): string | undefined => {
  const now = parsedTimestamp(occurredAt);
  const accountEndsAt = account.endsAt === undefined
    ? Number.POSITIVE_INFINITY
    : parsedTimestamp(account.endsAt);
  const expiresAt = Math.min(now + 30_000, accountEndsAt);
  return Number.isFinite(now) && Number.isFinite(expiresAt) && expiresAt > now
    ? new Date(expiresAt).toISOString()
    : undefined;
};

const securityFingerprint = (
  account: AccountRow,
  person: PersonRecord,
  device: TrustedDeviceRow,
  healthPermissions: readonly ObjectPermissionRow[]
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
  healthPermissions: [...healthPermissions]
    .map((row) => ({
      id: row.id,
      subjectAccountId: row.subjectAccountId,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      actions: [...row.actions],
      effect: row.effect,
      purpose: row.purpose,
      ownershipBasisPoints: row.ownershipBasisPoints,
      denialReason: row.denialReason,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      createdAt: row.createdAt
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
});

const loadAuthoritySnapshotInTransaction = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  context: HealthApplicationContext,
  identity: DeviceIdentitySnapshot,
  transaction: TransactionContext
): Result<AuthoritySnapshot, AppError> => {
  const execution = repositoryContext(context, transaction);
  const accountResult = dependencies.accountRepository.findById(execution, context.actor.userId);
  if (!accountResult.ok) return accountResult;
  const account = accountResult.value;
  if (!account || !accountIsActive(account, context, execution.occurredAt)) {
    return invalidAuthority(context, 'Health policy account, role or person membership is not active and exact');
  }

  const personResult = dependencies.personRepository.findById(execution, asPersonId(account.personId!));
  if (!personResult.ok) return personResult;
  const person = personResult.value;
  if (!person || person.id !== account.personId || person.familyId !== context.familyId || person.status !== 'active') {
    return invalidAuthority(context, 'Health policy person membership does not match the active family');
  }

  const deviceResult = dependencies.trustedDeviceRepository.findActive(execution, account.id, identity.deviceId);
  if (!deviceResult.ok) return deviceResult;
  const device = deviceResult.value;
  if (!device || !deviceIsTrusted(device, identity, account, execution.occurredAt)) {
    return invalidAuthority(context, 'Health policy device identity is not trusted for the active security epoch');
  }

  const permissionsResult = dependencies.permissionRepository.listActiveForSubject(
    execution,
    account.id,
    execution.occurredAt
  );
  if (!permissionsResult.ok) return permissionsResult;
  const healthPermissions = permissionsResult.value.filter((row) =>
    healthResourceTypes.has(row.resourceType as HealthPolicyIntent['resourceType'])
    && (row.purpose === 'health' || row.purpose === 'care' || row.purpose === 'general')
  );
  if (
    healthPermissions.length > 10_000
    || healthPermissions.some((row) => !permissionIsValid(row, account, execution.occurredAt))
  ) return invalidAuthority(context, 'Health policy permission snapshot contains invalid grants');

  const expiresAt = authorityExpiry(account, execution.occurredAt);
  if (!expiresAt) return invalidAuthority(context, 'Health policy authority expiry could not be established');
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
      grants: Object.freeze(healthPermissions.map(toPolicyGrant)),
      expiresAt
    }),
    securityFingerprint: securityFingerprint(account, person, device, healthPermissions)
  });
};

const loadAuthoritySnapshot = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  context: HealthApplicationContext,
  identity: DeviceIdentitySnapshot
): Result<AuthoritySnapshot, AppError> => dependencies.transactionExecutor.execute<AuthoritySnapshot>(
  context.correlationId,
  (transaction) => loadAuthoritySnapshotInTransaction(dependencies, context, identity, transaction)
);

const sensitivityFor = (privacy: HealthRecordRow['privacy']): PolicyResource['sensitivity'] => {
  if (privacy === 'private') return 'highly_sensitive';
  if (privacy === 'selected_members') return 'sensitive';
  if (privacy === 'family') return 'personal';
  throw new PlatformPolicyEnforcementError(
    'RESOURCE_RESOLUTION_FAILED',
    'Health record privacy is not supported by the platform policy model'
  );
};

interface HealthPolicyResourceState {
  readonly familyId: HealthApplicationContext['familyId'];
  readonly ownerPersonId: NonNullable<HealthPolicyIntent['ownerPersonId']>;
  readonly privacy: NonNullable<HealthPolicyIntent['privacy']>;
  readonly stateFingerprint: string;
}

const findHealthResourceForPolicyResolution = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  execution: RepositoryExecutionContext,
  resourceType: HealthPolicyIntent['resourceType'],
  resourceId: string
): Result<HealthPolicyResourceState | null, AppError> => {
  if (resourceType === 'health_record') {
    const found = dependencies.healthPolicyResourceRepository.findHealthRecordForPolicyResolution(
      execution,
      resourceId
    );
    if (!found.ok) return found;
    return ok(found.value
      ? Object.freeze({
          familyId: found.value.familyId,
          ownerPersonId: found.value.ownerPersonId,
          privacy: found.value.privacy,
          stateFingerprint: stable(found.value)
        })
      : null);
  }
  if (resourceType === 'medication_plan') {
    const found = dependencies.healthPolicyResourceRepository.findMedicationPlanForPolicyResolution(
      execution,
      resourceId
    );
    if (!found.ok) return found;
    return ok(found.value
      ? Object.freeze({
          familyId: found.value.familyId,
          ownerPersonId: found.value.ownerPersonId,
          privacy: found.value.privacy,
          stateFingerprint: stable(found.value)
        })
      : null);
  }
  if (resourceType === 'family_health_history') {
    const found = dependencies.healthPolicyResourceRepository.findFamilyHealthHistoryForPolicyResolution(
      execution,
      resourceId
    );
    if (!found.ok) return found;
    return ok(found.value
      ? Object.freeze({
          familyId: found.value.familyId,
          ownerPersonId: found.value.relatedPersonId,
          privacy: found.value.privacy,
          stateFingerprint: stable(found.value)
        })
      : null);
  }
  if (resourceType === 'health_care_center') {
    const found = dependencies.healthPolicyResourceRepository.findHealthCareCenterForPolicyResolution(
      execution,
      resourceId
    );
    if (!found.ok) return found;
    return ok(found.value
      ? Object.freeze({
          familyId: found.value.familyId,
          ownerPersonId: found.value.ownerPersonId,
          privacy: 'private' as const,
          stateFingerprint: found.value.stateFingerprint
        })
      : null);
  }
  throw new PlatformPolicyEnforcementError(
    'RESOURCE_RESOLUTION_FAILED',
    'Health policy resource type is not supported'
  );
};

const loadHealthResourceSnapshotInTransaction = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  context: HealthApplicationContext,
  requestedIntent: HealthPolicyIntent,
  transaction: TransactionContext
): Result<HealthResourceSnapshot, AppError> => {
  const execution = repositoryContext(context, transaction);
  if (requestedIntent.resourceType === 'health_care_center') {
    if (
      requestedIntent.purpose !== 'care'
      || !nonEmpty(requestedIntent.resourceId, 256)
      || requestedIntent.resourceId === '*'
      || !requestedIntent.ownerPersonId
      || requestedIntent.privacy !== 'private'
      || requestedIntent.resourceId !== `health-care-center:${requestedIntent.ownerPersonId}`
      || (requestedIntent.action !== 'read' && requestedIntent.action !== 'update')
      || requestedIntent.capability !== (requestedIntent.action === 'read' ? 'health.read' : 'health.write')
    ) return invalidAuthority(context, 'Health care center policy intent is not exact');
    const existing = findHealthResourceForPolicyResolution(
      dependencies,
      execution,
      requestedIntent.resourceType,
      requestedIntent.resourceId
    );
    if (!existing.ok) return existing;
    if (existing.value && (
      existing.value.familyId !== context.familyId
      || existing.value.ownerPersonId !== requestedIntent.ownerPersonId
      || existing.value.privacy !== 'private'
    )) return invalidAuthority(context, 'Health care center policy metadata changed');
    const owner = dependencies.personRepository.findById(execution, requestedIntent.ownerPersonId);
    if (!owner.ok) return owner;
    if (!owner.value || owner.value.familyId !== context.familyId || owner.value.status !== 'active') {
      return invalidAuthority(context, 'Health care center owner does not exist in the active family');
    }
    const resource = Object.freeze({
      type: 'health_care_center',
      id: requestedIntent.resourceId,
      familyId: context.familyId,
      ownerPersonId: requestedIntent.ownerPersonId,
      sensitivity: 'highly_sensitive' as const
    });
    return ok(Object.freeze({
      resource,
      stateFingerprint: existing.value?.stateFingerprint ?? stable({
        state: 'absent',
        resourceType: 'health_care_center',
        resourceId: requestedIntent.resourceId,
        familyId: context.familyId,
        ownerPersonId: requestedIntent.ownerPersonId
      })
    }));
  }
  if (
    !healthResourceTypes.has(requestedIntent.resourceType)
    || requestedIntent.purpose !== 'health'
    || !nonEmpty(requestedIntent.resourceId, 256)
    || (
      requestedIntent.action === 'read'
        ? requestedIntent.capability !== 'health.read' || requestedIntent.resourceId !== '*'
        : requestedIntent.capability !== 'health.write' || requestedIntent.resourceId === '*'
    )
  ) return invalidAuthority(context, 'Health policy intent is not a supported exact operation');
  if (requestedIntent.action === 'read' && requestedIntent.resourceId === '*') {
    if (!context.actor.personId) return invalidAuthority(context, 'Health collection read requires an exact person identity');
    const resource = Object.freeze({
      type: requestedIntent.resourceType,
      id: '*',
      familyId: context.familyId,
      ownerPersonId: context.actor.personId,
      sensitivity: 'highly_sensitive' as const
    });
    return ok(Object.freeze({
      resource,
      stateFingerprint: stable({
        scope: 'health_collection',
        resourceType: requestedIntent.resourceType,
        familyId: context.familyId,
        actorPersonId: context.actor.personId
      })
    }));
  }

  if (requestedIntent.action === 'create') {
    if (!requestedIntent.ownerPersonId || !requestedIntent.privacy) {
      return invalidAuthority(context, 'Health create policy metadata is incomplete');
    }
    const existing = findHealthResourceForPolicyResolution(
      dependencies,
      execution,
      requestedIntent.resourceType,
      requestedIntent.resourceId
    );
    if (!existing.ok) return existing;
    if (existing.value) return invalidAuthority(context, 'Health policy create resource already exists');
    const owner = dependencies.personRepository.findById(execution, requestedIntent.ownerPersonId);
    if (!owner.ok) return owner;
    if (!owner.value || owner.value.familyId !== context.familyId || owner.value.status !== 'active') {
      return invalidAuthority(context, 'Health policy owner does not exist in the active family');
    }
    const resource = Object.freeze({
      type: requestedIntent.resourceType,
      id: requestedIntent.resourceId,
      familyId: context.familyId,
      ownerPersonId: requestedIntent.ownerPersonId,
      sensitivity: sensitivityFor(requestedIntent.privacy)
    });
    return ok(Object.freeze({
      resource,
      stateFingerprint: stable({
        state: 'absent',
        owner: owner.value,
        privacy: requestedIntent.privacy,
        resourceType: requestedIntent.resourceType,
        resourceId: requestedIntent.resourceId,
        familyId: context.familyId
      })
    }));
  }

  return invalidAuthority(context, 'Health policy intent does not identify a supported operation');
};

const loadHealthResourceSnapshot = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  context: HealthApplicationContext,
  requestedIntent: HealthPolicyIntent
): HealthResourceSnapshot => {
  const result = dependencies.transactionExecutor.execute<HealthResourceSnapshot>(
    context.correlationId,
    (transaction) => loadHealthResourceSnapshotInTransaction(
      dependencies,
      context,
      requestedIntent,
      transaction
    )
  );
  if (!result.ok) {
    throw new PlatformPolicyEnforcementError(
      'RESOURCE_RESOLUTION_FAILED',
      `Health policy resource snapshot could not be loaded: ${result.error.code}`,
      { cause: result.error }
    );
  }
  return result.value;
};

const resolveResource = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  context: HealthApplicationContext,
  requestedIntent: HealthPolicyIntent,
  intent: PlatformPolicyIntent,
  authority: PlatformPolicyConnectionAuthority
): HealthResourceSnapshot => {
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
      'Health policy authority changed outside the resolved application context'
    );
  }
  if (
    intent.action !== requestedIntent.action
    || intent.capability !== requestedIntent.capability
    || intent.resourceType !== requestedIntent.resourceType
    || intent.resourceId !== requestedIntent.resourceId
    || intent.purpose !== requestedIntent.purpose
  ) {
    throw new PlatformPolicyEnforcementError(
      'RESOURCE_RESOLUTION_FAILED',
      'Health policy intent changed before resource resolution'
    );
  }
  return loadHealthResourceSnapshot(dependencies, context, requestedIntent);
};

const revalidateProductionTransaction = (
  dependencies: HealthProductionPolicyRuntimeDependencies,
  context: HealthApplicationContext,
  requestedIntent: HealthPolicyIntent,
  identity: DeviceIdentitySnapshot,
  capturedAuthority: AuthoritySnapshot,
  capturedResource: HealthResourceSnapshot | undefined,
  input: HealthPolicyTransactionRevalidationInput
): Result<void, AppError> => {
  if (
    input.context.actor.userId !== context.actor.userId
    || input.context.actor.personId !== context.actor.personId
    || !authorizationRoleMatches(input.context.actor.role, context.actor.role)
    || input.context.familyId !== context.familyId
    || input.context.correlationId !== context.correlationId
    || stable(input.intent) !== stable(requestedIntent)
  ) return invalidAuthority(context, 'Health policy application context changed before the business transaction');
  if (!capturedResource) return invalidAuthority(context, 'Health policy resource was not captured before receipt issuance');

  const currentAuthority = loadAuthoritySnapshotInTransaction(
    dependencies,
    context,
    identity,
    input.transaction
  );
  if (!currentAuthority.ok) return currentAuthority;
  if (currentAuthority.value.securityFingerprint !== capturedAuthority.securityFingerprint) {
    return invalidAuthority(context, 'Health policy authority changed after receipt issuance');
  }
  if (
    input.authorization.policyVersion !== currentAuthority.value.authority.policyVersion
    || input.authorization.subject.accountId !== currentAuthority.value.authority.accountId
    || input.authorization.subject.personId !== currentAuthority.value.authority.personId
    || input.authorization.subject.deviceId !== currentAuthority.value.authority.deviceId
    || input.authorization.subject.applicationId !== currentAuthority.value.authority.applicationId
    || stable(input.authorization.subject.roles) !== stable(currentAuthority.value.authority.roles)
    || stable(input.authorization.subject.familyIds) !== stable(currentAuthority.value.authority.familyIds)
  ) return invalidAuthority(context, 'Health policy receipt subject no longer matches the live authority');

  const currentResource = loadHealthResourceSnapshotInTransaction(
    dependencies,
    context,
    requestedIntent,
    input.transaction
  );
  if (!currentResource.ok) return currentResource;
  if (
    currentResource.value.stateFingerprint !== capturedResource.stateFingerprint
    || stable(currentResource.value.resource) !== stable(capturedResource.resource)
    || input.authorization.resourceType !== currentResource.value.resource.type
    || input.authorization.resourceId !== currentResource.value.resource.id
    || input.authorization.resourceFamilyId !== currentResource.value.resource.familyId
  ) return invalidAuthority(context, 'Health policy resource changed after receipt issuance');
  return ok(undefined);
};

const ensureRuntimeConfiguration = (dependencies: HealthProductionPolicyRuntimeDependencies): void => {
  if (
    !dependencies
    || typeof dependencies.transactionExecutor?.execute !== 'function'
    || typeof dependencies.accountRepository?.findById !== 'function'
    || typeof dependencies.permissionRepository?.listActiveForSubject !== 'function'
    || typeof dependencies.trustedDeviceRepository?.findActive !== 'function'
    || typeof dependencies.healthPolicyResourceRepository?.findHealthRecordForPolicyResolution !== 'function'
    || typeof dependencies.healthPolicyResourceRepository?.findMedicationPlanForPolicyResolution !== 'function'
    || typeof dependencies.healthPolicyResourceRepository?.findFamilyHealthHistoryForPolicyResolution !== 'function'
    || typeof dependencies.healthPolicyResourceRepository?.findHealthCareCenterForPolicyResolution !== 'function'
    || typeof dependencies.personRepository?.findById !== 'function'
    || typeof dependencies.deviceIdentityProvider?.snapshot !== 'function'
    || typeof dependencies.authorizationProvider?.authorize !== 'function'
    || typeof dependencies.authorizationProvider?.verify !== 'function'
    || typeof dependencies.receiptSink?.append !== 'function'
    || typeof dependencies.receiptSink?.ensure !== 'function'
    || typeof dependencies.receiptSink?.verifyProjectionProof !== 'function'
    || typeof dependencies.policyTransactionRepository?.pruneExpiredUnusedReplayReservations !== 'function'
    || typeof dependencies.policyTransactionRepository?.reserveReplayNonce !== 'function'
    || typeof dependencies.policyTransactionRepository?.synchronizeFence !== 'function'
    || typeof dependencies.policyTransactionRepository?.recordAuthorizedTransaction !== 'function'
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
      'Health production policy runtime configuration is incomplete or invalid'
    );
  }
};

export const createHealthProductionPolicyEnforcementPointResolver = (
  dependencies: HealthProductionPolicyRuntimeDependencies
): HealthPolicyEnforcementPointResolver => {
  ensureRuntimeConfiguration(dependencies);
  return Object.freeze({
    async resolve(
      context: HealthApplicationContext,
      requestedIntent: HealthPolicyIntent
    ): Promise<HealthPolicyEnforcementPoint> {
      const recovered = await drainPendingJournalProjections(dependencies, context, {
        businessTransactionCommitted: false
      });
      if (!recovered.ok) {
        throw new PlatformPolicyEnforcementError(
          'RECEIPT_PERSISTENCE_FAILED',
          'Health production policy receipt recovery must succeed before authorization',
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
          'Health policy device identity snapshot could not be loaded',
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
          'Health policy device identity snapshot is invalid'
        );
      }
      const snapshot = loadAuthoritySnapshot(dependencies, context, identity);
      if (!snapshot.ok) {
        throw new PlatformPolicyEnforcementError(
          'AUTHORITY_RESOLUTION_FAILED',
          `Health production policy authority could not be loaded: ${snapshot.error.code}`,
          { cause: snapshot.error }
        );
      }

      let capturedResource: HealthResourceSnapshot | undefined;
      const enforcementPoint = createTypedPolicyEnforcementPoint({
        provider: dependencies.authorizationProvider,
        authorityResolver: { resolve: () => snapshot.value.authority },
        resourceResolver: {
          resolve: (intent, authority) => {
            capturedResource = resolveResource(
              dependencies,
              context,
              requestedIntent,
              intent,
              authority
            );
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
        revalidateTransaction: (
          input: HealthPolicyTransactionRevalidationInput
        ): Result<void, AppError> => revalidateProductionTransaction(
          dependencies,
          context,
          requestedIntent,
          identity,
          snapshot.value,
          capturedResource,
          input
        ),
        recordAuthorizedTransaction: (
          input: HealthPolicyTransactionRevalidationInput
        ): Result<void, AppError> => recordAuthorizedProductionTransaction(dependencies, input),
        projectCommittedTransaction: (
          input: HealthPolicyCommittedTransactionInput
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
