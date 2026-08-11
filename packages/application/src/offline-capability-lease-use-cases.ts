import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type IsoDateTime,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  IssueOfflineCapabilityLeaseInput,
  OfflineCapabilityLeaseView,
  OfflineCapability
} from '@ppt/domain';
import {
  OFFLINE_CAPABILITY_LEASE_MAX_SECONDS,
  OFFLINE_CAPABILITY_LEASE_MIN_SECONDS,
  OfflineCapabilityLeasePolicy,
  createOfflineCapabilityLease,
  revokeOfflineCapabilityLease,
  type OfflineCapabilityLease,
  type OfflineCapabilityLeaseDecision
} from '@ppt/platform-policy';
import { CentralAuthorizationService } from '@ppt/security';
import type {
  AuthorizationAccountRecord,
  AuthorizationApplicationContext,
  AuthorizationQueryPort,
  AuthorizationUnitOfWork,
  AuthorizationWriteScope
} from './authorization-use-cases.js';

const invalid = (context: AuthorizationApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

const denied = (context: AuthorizationApplicationContext): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Çevrimdışı yetki kiralarını yönetme yetkiniz bulunmuyor.',
  category: 'authorization',
  correlationId: context.correlationId
});

const missing = (context: AuthorizationApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId: context.correlationId
});

const activeAccount = (account: AuthorizationAccountRecord, occurredAt: IsoDateTime): boolean => account.status === 'active'
  && Date.parse(account.startsAt) <= Date.parse(occurredAt)
  && (!account.endsAt || Date.parse(account.endsAt) >= Date.parse(occurredAt));

const requireAdministrator = (
  scope: AuthorizationWriteScope,
  actorId: UserId,
  context: AuthorizationApplicationContext,
  service: CentralAuthorizationService
): Result<AuthorizationAccountRecord, AppError> => {
  const account = scope.getAccount(actorId);
  if (!account.ok) return account;
  if (!account.value || !activeAccount(account.value, scope.occurredAt)) return err(denied(context));
  const decision = service.authorize({
    accountId: actorId,
    role: account.value.role,
    action: 'administer',
    resourceType: 'offline_capability_lease',
    resourceId: '*',
    occurredAt: scope.occurredAt,
    ...(account.value.personId ? { actorPersonId: account.value.personId } : {})
  });
  return decision.allowed ? ok(account.value) : err(denied(context));
};

export const toOfflineCapabilityLeaseView = (lease: OfflineCapabilityLease, occurredAt: IsoDateTime): OfflineCapabilityLeaseView => {
  const now = Date.parse(occurredAt);
  const state = lease.revokedAt ? 'revoked'
    : now < Date.parse(lease.notBefore) ? 'pending'
      : now >= Date.parse(lease.expiresAt) ? 'expired' : 'active';
  return Object.freeze({
    ...lease,
    capability: lease.capability as OfflineCapability,
    state,
    remainingSeconds: state === 'active' ? Math.max(0, Math.ceil((Date.parse(lease.expiresAt) - now) / 1000)) : 0
  });
};

export class ListOfflineCapabilityLeasesUseCase {
  public constructor(private readonly query: AuthorizationQueryPort, private readonly service = new CentralAuthorizationService()) {}
  public execute(input: {
    readonly context: AuthorizationApplicationContext; readonly actorId: UserId;
    readonly familyId: string; readonly occurredAt: IsoDateTime;
  }): Result<readonly OfflineCapabilityLeaseView[], AppError> {
    const actor = this.query.getAccount(input.actorId, input.context);
    if (!actor.ok) return actor;
    if (!actor.value || !activeAccount(actor.value, input.occurredAt)) return err(denied(input.context));
    const decision = this.service.authorize({
      accountId: input.actorId, role: actor.value.role, action: 'administer',
      resourceType: 'offline_capability_lease', resourceId: '*', occurredAt: input.occurredAt,
      ...(actor.value.personId ? { actorPersonId: actor.value.personId } : {})
    });
    if (!decision.allowed) return err(denied(input.context));
    const leases = this.query.listOfflineCapabilityLeases(input.context, input.familyId);
    return leases.ok ? ok(leases.value.map((lease) => toOfflineCapabilityLeaseView(lease, input.occurredAt))) : leases;
  }
}

export interface IssueOfflineCapabilityLeaseUseCaseInput {
  readonly context: AuthorizationApplicationContext;
  readonly actorId: UserId;
  readonly familyId: string;
  readonly deviceId: string;
  readonly command: IssueOfflineCapabilityLeaseInput;
  readonly identifiers: { readonly leaseId: string; readonly nonce: string };
  readonly binding: {
    readonly policyVersion: string;
    readonly policyPackageVersion: number;
    readonly policyPackageSha256: string;
    readonly capabilityManifestSha256: string;
  };
}

export class IssueOfflineCapabilityLeaseUseCase {
  public constructor(private readonly unitOfWork: AuthorizationUnitOfWork, private readonly service = new CentralAuthorizationService()) {}
  public execute(input: IssueOfflineCapabilityLeaseUseCaseInput): Result<OfflineCapabilityLeaseView, AppError> {
    if (!Number.isInteger(input.command.durationMinutes)
      || input.command.durationMinutes * 60 < OFFLINE_CAPABILITY_LEASE_MIN_SECONDS
      || input.command.durationMinutes * 60 > OFFLINE_CAPABILITY_LEASE_MAX_SECONDS) {
      return err(invalid(input.context, 'Çevrimdışı yetki kirası 1 dakika ile 24 saat arasında olmalıdır.'));
    }
    return this.unitOfWork.execute(input.context, input.actorId, (scope) => {
      const administrator = requireAdministrator(scope, input.actorId, input.context, this.service);
      if (!administrator.ok) return administrator;
      const subject = scope.getAccount(input.command.subjectAccountId as UserId);
      if (!subject.ok) return subject;
      if (!subject.value || !activeAccount(subject.value, scope.occurredAt)) return err(missing(input.context, 'Etkin hedef hesap bulunamadı.'));
      let lease: OfflineCapabilityLease;
      try {
        const issuedAt = scope.occurredAt;
        lease = createOfflineCapabilityLease({
          leaseId: input.identifiers.leaseId,
          familyId: input.familyId,
          subjectAccountId: input.command.subjectAccountId,
          deviceId: input.deviceId,
          capability: input.command.capability,
          issuedAt,
          notBefore: issuedAt,
          expiresAt: new Date(Date.parse(issuedAt) + input.command.durationMinutes * 60_000).toISOString(),
          policyVersion: input.binding.policyVersion,
          policyPackageVersion: input.binding.policyPackageVersion,
          policyPackageSha256: input.binding.policyPackageSha256,
          capabilityManifestSha256: input.binding.capabilityManifestSha256,
          nonce: input.identifiers.nonce
        });
      } catch {
        return err(invalid(input.context, 'Çevrimdışı yetki kirası bağlamı geçersizdir.'));
      }
      const inserted = scope.insertOfflineCapabilityLease(lease);
      return inserted.ok ? ok(toOfflineCapabilityLeaseView(lease, scope.occurredAt)) : inserted;
    });
  }
}

export class RevokeOfflineCapabilityLeaseUseCase {
  public constructor(private readonly unitOfWork: AuthorizationUnitOfWork, private readonly service = new CentralAuthorizationService()) {}
  public execute(input: {
    readonly context: AuthorizationApplicationContext; readonly actorId: UserId; readonly leaseId: string;
  }): Result<OfflineCapabilityLeaseView, AppError> {
    return this.unitOfWork.execute(input.context, input.actorId, (scope) => {
      const administrator = requireAdministrator(scope, input.actorId, input.context, this.service);
      if (!administrator.ok) return administrator;
      const found = scope.findOfflineCapabilityLease(input.leaseId);
      if (!found.ok) return found;
      if (!found.value) return err(missing(input.context, 'Çevrimdışı yetki kirası bulunamadı.'));
      if (found.value.revokedAt) return ok(toOfflineCapabilityLeaseView(found.value, scope.occurredAt));
      let revoked: OfflineCapabilityLease;
      try { revoked = revokeOfflineCapabilityLease(found.value, scope.occurredAt); }
      catch { return err(invalid(input.context, 'Çevrimdışı yetki kirası iptali geçersizdir.')); }
      const saved = scope.revokeOfflineCapabilityLease(revoked);
      return saved.ok ? ok(toOfflineCapabilityLeaseView(revoked, scope.occurredAt)) : saved;
    });
  }
}

export class EvaluateOfflineCapabilityLeaseUseCase {
  public constructor(private readonly query: AuthorizationQueryPort, private readonly policy = new OfflineCapabilityLeasePolicy()) {}
  public execute(input: {
    readonly context: AuthorizationApplicationContext; readonly familyId: string; readonly subjectAccountId: UserId;
    readonly deviceId: string; readonly capability: OfflineCapability; readonly occurredAt: IsoDateTime; readonly online: boolean;
    readonly policyPackageVersion: number; readonly policyPackageSha256: string; readonly capabilityManifestSha256: string;
  }): Result<OfflineCapabilityLeaseDecision, AppError> {
    const leases = this.query.listOfflineCapabilityLeases(input.context, input.familyId);
    if (!leases.ok) return leases;
    const lease = leases.value.find((candidate) => candidate.subjectAccountId === input.subjectAccountId
      && candidate.deviceId === input.deviceId && candidate.capability === input.capability && !candidate.revokedAt);
    if (!lease) return ok({ allowed: false, cacheLocked: true, reason: 'INVALID_LEASE' });
    return ok(this.policy.evaluate({ ...input, lease }));
  }
}
