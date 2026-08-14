import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  PrivacyOwnershipApplicationContext,
  PrivacyOwnershipPolicyIntent,
  PrivacyOwnershipUnitOfWork,
  PrivacyOwnershipWriteScope,
  TimelineApplicationContext,
  TimelinePolicyIntent
} from '@ppt/application';
import type { PermissionSimulationTarget, PrivacyOwnershipAggregateKey } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  AccountRepositoryPort,
  AiConsentRepositoryPort,
  AuditRepositoryPort,
  ObjectPermissionRepositoryPort,
  OfflineCapabilityLeaseRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  PrivacyOwnershipDataRightsRepositoryPort,
  TrustedDeviceRepositoryPort
} from '@ppt/repository-contracts';
import {
  CentralAuthorizationService,
  isAuthorizationRole,
  type AuthorizationPurpose
} from '@ppt/security';
import type { GovernedTimelinePolicyTransactionScope } from './timeline-application-adapter.js';

export interface PrivacyOwnershipPolicyTransactionRunner {
  execute<T>(
    context: TimelineApplicationContext,
    intent: TimelinePolicyIntent,
    operation: (scope: GovernedTimelinePolicyTransactionScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

export interface LocalAiMemoryDeletionPropagationPort {
  propagate(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: { readonly recordId: string; readonly derivedBindingHash: string }
  ): Result<{
    readonly locallyCompleted: true;
    readonly resourceGrantCleanupComplete: true;
    readonly processingDisabled: true;
    readonly sourcePreserved: true;
    readonly derivedBindingHash: string;
  }, AppError>;
}

export interface RepositoryBackedPrivacyOwnershipDependencies {
  readonly policyTransactionRunner: PrivacyOwnershipPolicyTransactionRunner;
  readonly privacyRepository: PrivacyOwnershipDataRightsRepositoryPort;
  readonly accountRepository: AccountRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly trustedDeviceRepository: TrustedDeviceRepositoryPort;
  readonly offlineCapabilityLeaseRepository: OfflineCapabilityLeaseRepositoryPort;
  readonly aiConsentRepository: AiConsentRepositoryPort;
  readonly objectPermissionRepository: ObjectPermissionRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly aiMemoryDeletionPropagation: LocalAiMemoryDeletionPropagationPort;
}

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const authorizationPurposes = new Set<AuthorizationPurpose>([
  'general', 'care', 'finance', 'health', 'archive', 'legacy', 'ai_processing', 'administration'
]);
const isAuthorizationPurpose = (value: string): value is AuthorizationPurpose =>
  authorizationPurposes.has(value as AuthorizationPurpose);

const applicationError = (
  context: PrivacyOwnershipApplicationContext,
  message: string
): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  category: 'security',
  message,
  correlationId: context.correlationId
});

const timelineContext = (context: PrivacyOwnershipApplicationContext): TimelineApplicationContext => ({
  familyId: context.familyId,
  actor: {
    userId: context.actor.userId,
    roles: [context.actor.role],
    ...(context.actor.personId ? { personId: context.actor.personId } : {})
  },
  correlationId: context.correlationId
});

const timelineIntent = (
  context: PrivacyOwnershipApplicationContext,
  intent: PrivacyOwnershipPolicyIntent
): Result<TimelinePolicyIntent, AppError> => {
  if (intent.action === 'administer') {
    return err(applicationError(context, 'Privacy ownership administer intent has no central timeline PEP action mapping'));
  }
  return ok({
    action: intent.action,
    capability: intent.capability,
    resourceType: intent.resourceType,
    resourceId: intent.resourceId,
    purpose: intent.purpose,
    ownerPersonId: intent.ownerPersonId,
    targetSensitivity: intent.sensitivity,
    ...(intent.action === 'create'
      ? { sourceResourceMode: 'replace' as const }
      : intent.action === 'update'
        ? { sourceResourceMode: 'preserve' as const }
        : {})
  });
};

const exactKey = (
  context: PrivacyOwnershipApplicationContext,
  repository: PolicyAuthorizedRepositoryExecutionContext
): Result<PrivacyOwnershipAggregateKey, AppError> => {
  const personId = context.actor.personId;
  if (!personId
    || repository.actor.userId !== context.actor.userId
    || repository.actor.personId !== personId
    || repository.policyAuthorization.subject.accountId !== context.actor.userId
    || repository.policyAuthorization.subject.personId !== personId
    || repository.policyAuthorization.resourceFamilyId !== context.familyId) {
    return err(applicationError(context, 'Privacy ownership governed transaction subject changed'));
  }
  return ok({ familyId: context.familyId, accountId: context.actor.userId, ownerPersonId: personId });
};

class RepositoryBackedPrivacyOwnershipWriteScope implements PrivacyOwnershipWriteScope {
  readonly occurredAt;
  readonly #key: PrivacyOwnershipAggregateKey;
  readonly #recordedRevocations = new Set<string>();
  #containmentApplied = false;

  public constructor(
    private readonly dependencies: RepositoryBackedPrivacyOwnershipDependencies,
    private readonly repository: PolicyAuthorizedRepositoryExecutionContext,
    private readonly applicationContext: PrivacyOwnershipApplicationContext,
    private readonly intent: PrivacyOwnershipPolicyIntent,
    key: PrivacyOwnershipAggregateKey
  ) {
    this.occurredAt = repository.occurredAt;
    this.#key = key;
  }

  public loadCenter(key: PrivacyOwnershipAggregateKey): ReturnType<PrivacyOwnershipWriteScope['loadCenter']> {
    const loaded = this.dependencies.privacyRepository.loadCenter(this.repository, key);
    if (!loaded.ok) return loaded;
    const currentDeviceId = this.repository.policyAuthorization.subject.deviceId;
    return ok({
      ...loaded.value,
      localDeviceActivity: loaded.value.localDeviceActivity.map((item) => ({
        ...item,
        currentDevice: item.trustStatus === 'trusted' && item.deviceId === currentDeviceId,
        locallyObservedSession: item.trustStatus === 'trusted' && item.deviceId === currentDeviceId
          ? 'current_session'
          : 'recently_seen'
      }))
    });
  }

  public findAiMemoryRecord(key: PrivacyOwnershipAggregateKey, recordId: string): ReturnType<PrivacyOwnershipWriteScope['findAiMemoryRecord']> {
    return this.dependencies.privacyRepository.findAiMemoryRecord(this.repository, key, recordId);
  }
  public saveAiMemoryRecord(row: Parameters<PrivacyOwnershipWriteScope['saveAiMemoryRecord']>[0], expectedRevision: number): ReturnType<PrivacyOwnershipWriteScope['saveAiMemoryRecord']> {
    return this.dependencies.privacyRepository.saveAiMemoryRecord(this.repository, row, expectedRevision);
  }
  public propagateAiMemoryDeletion(recordId: string, derivedBindingHash: string): ReturnType<PrivacyOwnershipWriteScope['propagateAiMemoryDeletion']> {
    const propagated = this.dependencies.aiMemoryDeletionPropagation.propagate(this.repository, { recordId, derivedBindingHash });
    if (!propagated.ok) return propagated;
    if (!propagated.value.locallyCompleted || !propagated.value.resourceGrantCleanupComplete
      || !propagated.value.processingDisabled || !propagated.value.sourcePreserved
      || propagated.value.derivedBindingHash !== derivedBindingHash) {
      return err(applicationError(this.applicationContext, 'AI memory source-deletion propagation proof is incomplete'));
    }
    return ok({ locallyCompleted: true });
  }
  public findRightsRequest(key: PrivacyOwnershipAggregateKey, requestId: string): ReturnType<PrivacyOwnershipWriteScope['findRightsRequest']> {
    return this.dependencies.privacyRepository.findRightsRequest(this.repository, key, requestId);
  }
  public insertRightsRequest(row: Parameters<PrivacyOwnershipWriteScope['insertRightsRequest']>[0]): ReturnType<PrivacyOwnershipWriteScope['insertRightsRequest']> {
    return this.dependencies.privacyRepository.insertRightsRequest(this.repository, row);
  }
  public saveRightsRequest(row: Parameters<PrivacyOwnershipWriteScope['saveRightsRequest']>[0], expectedRevision: number): ReturnType<PrivacyOwnershipWriteScope['saveRightsRequest']> {
    return this.dependencies.privacyRepository.saveRightsRequest(this.repository, row, expectedRevision);
  }
  public recordEncryptedExport(row: Parameters<PrivacyOwnershipWriteScope['recordEncryptedExport']>[0]): ReturnType<PrivacyOwnershipWriteScope['recordEncryptedExport']> {
    return this.dependencies.privacyRepository.recordEncryptedExport(this.repository, row);
  }
  public findIncident(key: PrivacyOwnershipAggregateKey, incidentId: string): ReturnType<PrivacyOwnershipWriteScope['findIncident']> {
    return this.dependencies.privacyRepository.findIncident(this.repository, key, incidentId);
  }
  public insertIncident(row: Parameters<PrivacyOwnershipWriteScope['insertIncident']>[0]): ReturnType<PrivacyOwnershipWriteScope['insertIncident']> {
    return this.dependencies.privacyRepository.insertIncident(this.repository, row);
  }
  public saveIncident(row: Parameters<PrivacyOwnershipWriteScope['saveIncident']>[0], expectedRevision: number): ReturnType<PrivacyOwnershipWriteScope['saveIncident']> {
    return this.dependencies.privacyRepository.saveIncident(this.repository, row, expectedRevision);
  }
  public findMutationByClientOperationId(key: PrivacyOwnershipAggregateKey, clientOperationId: string): ReturnType<PrivacyOwnershipWriteScope['findMutationByClientOperationId']> {
    return this.dependencies.privacyRepository.findMutationByClientOperationId(this.repository, key, clientOperationId);
  }
  public insertMutation(row: Parameters<PrivacyOwnershipWriteScope['insertMutation']>[0]): ReturnType<PrivacyOwnershipWriteScope['insertMutation']> {
    return this.dependencies.privacyRepository.insertMutation(this.repository, row);
  }

  public advanceSecurityEpochAndRevokeLocalSessions(accountId: UserId): ReturnType<PrivacyOwnershipWriteScope['advanceSecurityEpochAndRevokeLocalSessions']> {
    if (accountId !== this.#key.accountId) return err(applicationError(this.applicationContext, 'Incident account is outside the governed owner scope'));
    const contained = this.#containAllLocalAuthority(this.intent.resourceId, accountId);
    if (!contained.ok) return contained;
    const account = this.dependencies.accountRepository.findById(this.repository, accountId);
    return account.ok && account.value ? ok({ securityEpoch: account.value.securityEpoch })
      : err(applicationError(this.applicationContext, 'Contained account could not be reloaded'));
  }
  public revokeTrustedDevice(trustedDeviceId: string): ReturnType<PrivacyOwnershipWriteScope['revokeTrustedDevice']> {
    if (this.#revocationRecorded('trusted_device', trustedDeviceId)) return ok(undefined);
    const devices = this.dependencies.trustedDeviceRepository.listByAccount(this.repository, this.#key.accountId);
    if (!devices.ok) return devices;
    const device = devices.value.find((item) => item.id === trustedDeviceId);
    if (!device) return err(applicationError(this.applicationContext, 'Trusted device is outside the governed account'));
    const revoked = this.dependencies.trustedDeviceRepository.revoke(this.repository, this.#key.accountId, trustedDeviceId, this.occurredAt);
    if (!revoked.ok) return revoked;
    return this.#recordRevocation('trusted_device', trustedDeviceId, device.revokedAt ? 'already_revoked' : 'revoked');
  }
  public revokeOfflineCapability(leaseId: string): ReturnType<PrivacyOwnershipWriteScope['revokeOfflineCapability']> {
    if (this.#revocationRecorded('offline_lease', leaseId)) return ok(undefined);
    const found = this.dependencies.offlineCapabilityLeaseRepository.findById(this.repository, leaseId);
    if (!found.ok) return found;
    if (!found.value || found.value.familyId !== this.#key.familyId || found.value.subjectAccountId !== this.#key.accountId) {
      return err(applicationError(this.applicationContext, 'Offline lease is outside the governed account'));
    }
    const revoked = this.dependencies.offlineCapabilityLeaseRepository.revoke(this.repository, { ...found.value, revokedAt: this.occurredAt });
    if (!revoked.ok) return revoked;
    return this.#recordRevocation('offline_lease', leaseId, revoked.value ? 'revoked' : 'already_revoked');
  }
  public revokeConsent(consentId: string): ReturnType<PrivacyOwnershipWriteScope['revokeConsent']> {
    if (this.#revocationRecorded('consent', consentId)) return ok(undefined);
    const listed = this.dependencies.aiConsentRepository.list(this.repository, this.#key.accountId);
    if (!listed.ok) return listed;
    const consent = listed.value.find((item) => item.id === consentId);
    if (!consent) return err(applicationError(this.applicationContext, 'Consent is outside the governed account'));
    if (consent.status === 'granted') {
      const saved = this.dependencies.aiConsentRepository.upsert(this.repository, { ...consent, status: 'revoked', endsAt: this.occurredAt });
      if (!saved.ok) return saved;
    }
    return this.#recordRevocation('consent', consentId, consent.status === 'granted' ? 'revoked' : 'already_revoked');
  }
  public revokeCapability(capabilityId: string): ReturnType<PrivacyOwnershipWriteScope['revokeCapability']> {
    if (this.#revocationRecorded('capability', capabilityId)) return ok(undefined);
    const permissions = this.dependencies.objectPermissionRepository.listActiveForSubject(this.repository, this.#key.accountId, this.occurredAt);
    if (!permissions.ok) return permissions;
    const permission = permissions.value.find((item) => item.id === capabilityId);
    if (!permission) return err(applicationError(this.applicationContext, 'Capability permission is outside the governed account'));
    const removed = this.dependencies.objectPermissionRepository.delete(this.repository, permission.id);
    if (!removed.ok) return removed;
    return this.#recordRevocation('capability', capabilityId, removed.value ? 'revoked' : 'already_revoked');
  }
  public quarantineLocalDerivedData(resourceId: string): ReturnType<PrivacyOwnershipWriteScope['quarantineLocalDerivedData']> {
    if (!/^[0-9a-f]{64}$/u.test(resourceId))return err(applicationError(this.applicationContext,'Local quarantine requires an exact derived binding hash'));
    const inspected=this.dependencies.privacyRepository.inspectLocalDerivedArtifactForIncident(this.repository,this.#key,resourceId);
    if (!inspected.ok) return inspected;
    if (!inspected.value || !/^[0-9a-f]{64}$/u.test(inspected.value.integritySha256)) {
      return err(applicationError(this.applicationContext, 'Local quarantine integrity proof is invalid'));
    }
    return this.dependencies.privacyRepository.quarantineIncidentItem(this.repository, {
      id: `quarantine-${sha256(`${this.intent.resourceId}:derived_artifact:${resourceId}`).slice(0, 48)}`,
      incidentId: this.intent.resourceId,
      key: this.#key,
      targetKind: 'derived_artifact',
      targetFingerprint: sha256(resourceId),
      integritySha256: inspected.value.integritySha256,
      quarantinedAt: this.occurredAt
    });
  }

  public evaluatePermission(target: PermissionSimulationTarget): ReturnType<PrivacyOwnershipWriteScope['evaluatePermission']> {
    const account = this.dependencies.accountRepository.findById(this.repository,target.subjectAccountId);
    if(!account.ok)return account;
    if(!account.value || account.value.status!=='active' || !account.value.personId
      || !isAuthorizationRole(account.value.role) || !isAuthorizationPurpose(target.purpose)){
      return err(applicationError(this.applicationContext,'Permission simulation subject is not an active local family account'));
    }
    const person = this.dependencies.personRepository.findById(this.repository,asPersonId(account.value.personId));
    if(!person.ok)return person;
    if(!person.value || person.value.status!=='active' || person.value.familyId!==this.#key.familyId){
      return err(applicationError(this.applicationContext,'Permission simulation subject is outside the governed family'));
    }
    const permissions = this.dependencies.objectPermissionRepository.listActiveForSubject(
      this.repository,
      target.subjectAccountId,
      target.occurredAt
    );
    if (!permissions.ok) return permissions;
    const action = target.action === 'process' ? 'ai_process' : target.action;
    const decision = new CentralAuthorizationService().authorize({
      accountId: account.value.id,
      role: account.value.role,
      action,
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      occurredAt: target.occurredAt,
      purpose: target.purpose,
      actorPersonId: account.value.personId,
      ownerPersonId: this.#key.ownerPersonId,
      privacy: 'private',
      sensitiveDomain: 'privacy',
      grants: permissions.value
    });
    return ok({
      allowed: decision.allowed,
      reason: decision.reason,
      obligations: Object.freeze([
        ...(decision.matchedGrantId ? [`matched_grant:${decision.matchedGrantId}`] : []),
        ...(decision.matchedOwnershipBasisPoints === undefined
          ? [] : [`ownership_basis_points:${decision.matchedOwnershipBasisPoints}`])
      ])
    });
  }
  public appendAudit(input: Parameters<PrivacyOwnershipWriteScope['appendAudit']>[0]): ReturnType<PrivacyOwnershipWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
  public enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repository, event);
  }

  #recordRevocation(
    targetKind: 'session' | 'trusted_device' | 'capability' | 'offline_lease' | 'consent',
    targetId: string,
    outcome: 'revoked' | 'already_revoked'
  ): Result<void, AppError> {
    const targetFingerprint = sha256(targetId);
    const dedupeKey = `${targetKind}:${targetFingerprint}`;
    if (this.#recordedRevocations.has(dedupeKey)) return ok(undefined);
    const recorded = this.dependencies.privacyRepository.recordIncidentRevocation(this.repository, {
      id: `revocation-${sha256(`${this.intent.resourceId}:${dedupeKey}`).slice(0, 48)}`,
      incidentId: this.intent.resourceId,
      key: this.#key,
      targetKind,
      targetFingerprint,
      outcome,
      revokedAt: this.occurredAt
    });
    if (recorded.ok) this.#recordedRevocations.add(dedupeKey);
    return recorded;
  }

  #revocationRecorded(targetKind: 'trusted_device' | 'capability' | 'offline_lease' | 'consent', targetId: string): boolean {
    return this.#recordedRevocations.has(`${targetKind}:${sha256(targetId)}`);
  }

  #containAllLocalAuthority(incidentId: string, accountId: UserId): Result<void, AppError> {
    if (this.#containmentApplied) return ok(undefined);
    if (incidentId !== this.intent.resourceId || accountId !== this.#key.accountId) {
      return err(applicationError(this.applicationContext, 'Incident containment identity changed'));
    }
    const devices = this.dependencies.trustedDeviceRepository.listByAccount(this.repository, accountId);
    if (!devices.ok) return devices;
    const leases = this.dependencies.offlineCapabilityLeaseRepository.listForFamily(this.repository, this.#key.familyId);
    if (!leases.ok) return leases;
    const consents = this.dependencies.aiConsentRepository.list(this.repository, accountId);
    if (!consents.ok) return consents;
    const permissions = this.dependencies.objectPermissionRepository.listActiveForSubject(this.repository, accountId, this.occurredAt);
    if (!permissions.ok) return permissions;
    const advanced = this.dependencies.accountRepository.advanceSecurityEpoch(this.repository, accountId);
    if (!advanced.ok) return advanced;
    let recorded = this.#recordRevocation('session', accountId, 'revoked');
    if (!recorded.ok) return recorded;
    const revokedDevices = this.dependencies.trustedDeviceRepository.revokeAll(this.repository, accountId, this.occurredAt);
    if (!revokedDevices.ok) return revokedDevices;
    for (const device of devices.value) {
      recorded = this.#recordRevocation('trusted_device', device.id, device.revokedAt ? 'already_revoked' : 'revoked');
      if (!recorded.ok) return recorded;
    }
    for (const lease of leases.value.filter((item) => item.subjectAccountId === accountId)) {
      const revoked = this.dependencies.offlineCapabilityLeaseRepository.revoke(this.repository, { ...lease, revokedAt: this.occurredAt });
      if (!revoked.ok) return revoked;
      recorded = this.#recordRevocation('offline_lease', lease.leaseId, revoked.value ? 'revoked' : 'already_revoked');
      if (!recorded.ok) return recorded;
    }
    for (const consent of consents.value) {
      if (consent.status === 'granted') {
        const saved = this.dependencies.aiConsentRepository.upsert(this.repository, { ...consent, status: 'revoked', endsAt: this.occurredAt });
        if (!saved.ok) return saved;
      }
      recorded = this.#recordRevocation('consent', consent.id, consent.status === 'granted' ? 'revoked' : 'already_revoked');
      if (!recorded.ok) return recorded;
    }
    for (const permission of permissions.value) {
      const removed = this.dependencies.objectPermissionRepository.delete(this.repository, permission.id);
      if (!removed.ok) return removed;
      recorded = this.#recordRevocation('capability', permission.id, removed.value ? 'revoked' : 'already_revoked');
      if (!recorded.ok) return recorded;
    }
    this.#containmentApplied = true;
    return ok(undefined);
  }
}

export class RepositoryBackedPrivacyOwnershipDataRightsUnitOfWork implements PrivacyOwnershipUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedPrivacyOwnershipDependencies) {}

  public async execute<T>(
    context: PrivacyOwnershipApplicationContext,
    intent: PrivacyOwnershipPolicyIntent,
    operation: (scope: PrivacyOwnershipWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    const mappedIntent = timelineIntent(context, intent);
    if (!mappedIntent.ok) return mappedIntent;
    return this.dependencies.policyTransactionRunner.execute(
      timelineContext(context),
      mappedIntent.value,
      (governed) => {
        const key = exactKey(context, governed.repository);
        if (!key.ok) return key;
        return operation(new RepositoryBackedPrivacyOwnershipWriteScope(
          this.dependencies,
          governed.repository,
          context,
          intent,
          key.value
        ));
      }
    );
  }
}
