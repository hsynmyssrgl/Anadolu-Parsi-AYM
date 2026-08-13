import {
  ERROR_CODES,
  asIsoDateTime,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  toOfflineCapabilityLeaseView,
  type PrivacyControlApplicationContext,
  type PrivacyControlQueryPort,
  type PrivacyControlSnapshot,
  type PrivacyControlUnitOfWork,
  type PrivacyControlWriteScope
} from '@ppt/application';
import type { AiConsentView, TrustedDeviceView } from '@ppt/domain';
import type { OfflineCapabilityLease } from '@ppt/platform-policy';
import {
  CentralAuthorizationService,
  type AuthorizationAction,
  type AuthorizationGrant
} from '@ppt/security';
import type {
  AccountRepositoryPort,
  AccountRow,
  AiConsentRepositoryPort,
  AuditRepositoryPort,
  ObjectPermissionRepositoryPort,
  ObjectPermissionRow,
  OfflineCapabilityLeaseRepositoryPort,
  OfflineCapabilityLeaseRow,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor,
  TrustedDeviceRepositoryPort,
  TrustedDeviceRow
} from '@ppt/repository-contracts';

export interface RepositoryBackedPrivacyControlDependencies {
  readonly transactionExecutor:TransactionExecutor;
  readonly accountRepository:AccountRepositoryPort;
  readonly permissionRepository:ObjectPermissionRepositoryPort;
  readonly trustedDeviceRepository:TrustedDeviceRepositoryPort;
  readonly offlineCapabilityLeaseRepository:OfflineCapabilityLeaseRepositoryPort;
  readonly consentRepository:AiConsentRepositoryPort;
  readonly auditRepository:AuditRepositoryPort;
  readonly currentDeviceId:()=>string;
}

const repositoryContext = (
  context:PrivacyControlApplicationContext,
  transaction:TransactionContext
):RepositoryExecutionContext => ({
  transaction:transaction.transaction,
  actor:{
    userId:context.actor.userId,
    roles:[context.actor.role],
    ...(context.actor.personId ? { personId:context.actor.personId } : {})
  },
  correlationId:context.correlationId,
  occurredAt:transaction.occurredAt
});

const activeAccount = (account:AccountRow,at:string):boolean => account.status === 'active'
  && Date.parse(account.startsAt) <= Date.parse(at)
  && (!account.endsAt || Date.parse(account.endsAt) >= Date.parse(at));

const grant = (row:ObjectPermissionRow):AuthorizationGrant => ({
  id:row.id,
  subjectAccountId:row.subjectAccountId,
  resourceType:row.resourceType,
  resourceId:row.resourceId,
  actions:row.actions as readonly AuthorizationAction[],
  effect:row.effect,
  purpose:row.purpose,
  ...(row.familyBranchId ? { familyBranchId:row.familyBranchId } : {}),
  ...(row.ownershipBasisPoints === undefined ? {} : { ownershipBasisPoints:row.ownershipBasisPoints }),
  ...(row.denialReason ? { denialReason:row.denialReason } : {}),
  startsAt:row.startsAt,
  ...(row.endsAt ? { endsAt:row.endsAt } : {})
});

const trustedDevice = (row:TrustedDeviceRow,currentDeviceId:string):TrustedDeviceView => ({
  id:row.id,
  deviceId:row.deviceId,
  displayName:row.displayName,
  fingerprint:row.fingerprint,
  trustedAt:row.trustedAt,
  lastSeenAt:row.lastSeenAt,
  securityEpoch:row.securityEpoch,
  current:row.deviceId === currentDeviceId,
  ...(row.revokedAt ? { revokedAt:row.revokedAt } : {})
});

const leaseRow = (lease:OfflineCapabilityLease):OfflineCapabilityLeaseRow => {
  const { revokedAt:_revokedAt, ...base } = lease;
  return ({
  ...base,
  subjectAccountId:asUserId(lease.subjectAccountId),
  issuedAt:asIsoDateTime(lease.issuedAt),
  notBefore:asIsoDateTime(lease.notBefore),
  expiresAt:asIsoDateTime(lease.expiresAt),
  ...(lease.revokedAt ? { revokedAt:asIsoDateTime(lease.revokedAt) } : {})
  });
};

const authorizationError = (context:PrivacyControlApplicationContext):AppError => createAppError({
  code:ERROR_CODES.AUTHORIZATION_DENIED,
  message:'Gizlilik ve kayıp cihaz kapatma merkezini yönetme yetkisi bulunmuyor.',
  category:'authorization',
  correlationId:context.correlationId
});

interface LoadedPrivacyControlState {
  readonly snapshot:PrivacyControlSnapshot;
  readonly account:AccountRow;
  readonly grants:readonly AuthorizationGrant[];
  readonly repository:RepositoryExecutionContext;
}

const load = (
  dependencies:RepositoryBackedPrivacyControlDependencies,
  context:PrivacyControlApplicationContext,
  transaction:TransactionContext
):Result<LoadedPrivacyControlState,AppError> => {
  const repository = repositoryContext(context,transaction);
  const account = dependencies.accountRepository.findById(repository,context.actor.userId);
  if (!account.ok) return account;
  if (!account.value) return err(authorizationError(context));
  const permissions = dependencies.permissionRepository.listActiveForSubject(repository,context.actor.userId,repository.occurredAt);
  if (!permissions.ok) return permissions;
  const devices = dependencies.trustedDeviceRepository.listByAccount(repository,context.actor.userId);
  if (!devices.ok) return devices;
  const leases = dependencies.offlineCapabilityLeaseRepository.listForFamily(repository,context.familyId);
  if (!leases.ok) return leases;
  const consents = dependencies.consentRepository.list(repository,context.actor.userId);
  if (!consents.ok) return consents;
  return ok({
    account:account.value,
    grants:permissions.value.map(grant),
    repository,
    snapshot:{
      account:{
        accountId:account.value.id,
        securityEpoch:account.value.securityEpoch,
        active:activeAccount(account.value,repository.occurredAt)
      },
      trustedDevices:devices.value.map((row) => trustedDevice(row,dependencies.currentDeviceId())),
      offlineLeases:leases.value
        .filter((row) => row.subjectAccountId === context.actor.userId)
        .map((row) => toOfflineCapabilityLeaseView(row,repository.occurredAt)),
      consents:consents.value,
      occurredAt:repository.occurredAt
    }
  });
};

const authorize = (
  context:PrivacyControlApplicationContext,
  loaded:LoadedPrivacyControlState
):Result<void,AppError> => {
  const decision = new CentralAuthorizationService().authorize({
    accountId:loaded.account.id,
    role:loaded.account.role as PrivacyControlApplicationContext['actor']['role'],
    action:'administer',
    resourceType:'privacy_control',
    resourceId:'*',
    purpose:'administration',
    occurredAt:loaded.repository.occurredAt,
    ...(loaded.account.personId ? { actorPersonId:loaded.account.personId } : {}),
    grants:loaded.grants
  });
  return decision.allowed ? ok(undefined) : err(authorizationError(context));
};

export class RepositoryBackedPrivacyControlQueryPort implements PrivacyControlQueryPort {
  public constructor(private readonly dependencies:RepositoryBackedPrivacyControlDependencies) {}
  public load(context:PrivacyControlApplicationContext):Result<PrivacyControlSnapshot,AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId,(transaction) => {
      const loaded = load(this.dependencies,context,transaction);
      if (!loaded.ok) return loaded;
      const allowed = authorize(context,loaded.value);
      return allowed.ok ? ok(loaded.value.snapshot) : allowed;
    });
  }
}

class RepositoryBackedPrivacyControlWriteScope implements PrivacyControlWriteScope {
  public readonly account:PrivacyControlWriteScope['account'];
  public readonly trustedDevices:PrivacyControlWriteScope['trustedDevices'];
  public readonly offlineLeases:PrivacyControlWriteScope['offlineLeases'];
  public readonly consents:PrivacyControlWriteScope['consents'];
  public readonly occurredAt:PrivacyControlWriteScope['occurredAt'];

  public constructor(
    private readonly dependencies:RepositoryBackedPrivacyControlDependencies,
    private readonly context:PrivacyControlApplicationContext,
    private readonly loaded:LoadedPrivacyControlState
  ) {
    this.account=loaded.snapshot.account;
    this.trustedDevices=loaded.snapshot.trustedDevices;
    this.offlineLeases=loaded.snapshot.offlineLeases;
    this.consents=loaded.snapshot.consents;
    this.occurredAt=loaded.snapshot.occurredAt;
  }

  public authorizeAdminister():Result<void,AppError> { return authorize(this.context,this.loaded); }
  public findConsentIdentity(purpose:string,resourceType:string,resourceId:string):Result<string|null,AppError> {
    return this.dependencies.consentRepository.findIdentity(
      this.loaded.repository,this.context.actor.userId,purpose,resourceType,resourceId
    );
  }
  public upsertConsent(row:AiConsentView):Result<void,AppError> {
    return this.dependencies.consentRepository.upsert(this.loaded.repository,row);
  }
  public advanceSecurityEpoch():Result<number,AppError> {
    return this.dependencies.accountRepository.advanceSecurityEpoch(this.loaded.repository,this.context.actor.userId);
  }
  public revokeAllTrustedDevices():Result<void,AppError> {
    return this.dependencies.trustedDeviceRepository.revokeAll(
      this.loaded.repository,this.context.actor.userId,this.occurredAt
    );
  }
  public revokeOfflineLease(lease:OfflineCapabilityLease):Result<boolean,AppError> {
    return this.dependencies.offlineCapabilityLeaseRepository.revoke(this.loaded.repository,leaseRow(lease));
  }
  public appendAudit(input:Parameters<PrivacyControlWriteScope['appendAudit']>[0]):Result<string,AppError> {
    return this.dependencies.auditRepository.append(this.loaded.repository,input);
  }
}

export class RepositoryBackedPrivacyControlUnitOfWork implements PrivacyControlUnitOfWork {
  public constructor(private readonly dependencies:RepositoryBackedPrivacyControlDependencies) {}
  public execute<T>(
    context:PrivacyControlApplicationContext,
    operation:(scope:PrivacyControlWriteScope)=>Result<T,AppError>
  ):Result<T,AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId,(transaction) => {
      const loaded = load(this.dependencies,context,transaction);
      if (!loaded.ok) return loaded;
      return operation(new RepositoryBackedPrivacyControlWriteScope(this.dependencies,context,loaded.value));
    });
  }
}
