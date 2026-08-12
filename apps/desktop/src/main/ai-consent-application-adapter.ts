import { ERROR_CODES, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  SENSITIVE_DATA_PROFILE_RESOURCE_TYPE,
  buildSensitiveDataProfiles,
  buildSensitiveExportPreview,
  type AiConsentApplicationContext,
  type AiConsentQueryPort,
  type AiConsentUnitOfWork,
  type AiConsentWriteScope,
  type SensitiveDataAuthorizationPort
} from '@ppt/application';
import type {
  AccountRepositoryPort,
  AccountRow,
  AiConsentRepositoryPort,
  AuditRepositoryPort,
  ObjectPermissionRepositoryPort,
  ObjectPermissionRow,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { CentralAuthorizationService, type AuthorizationAction, type AuthorizationGrant } from '@ppt/security';

export interface RepositoryBackedAiConsentDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly consentRepository: AiConsentRepositoryPort;
  readonly accountRepository: AccountRepositoryPort;
  readonly permissionRepository: ObjectPermissionRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
}

const repositoryContext = (
  context: AiConsentApplicationContext,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: context.actor.userId,
    roles: [context.actor.role],
    ...(context.actor.personId ? { personId: context.actor.personId as never } : {})
  },
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt
});

const isActiveAccount = (account: AccountRow, at: string): boolean =>
  account.status === 'active'
  && Date.parse(account.startsAt) <= Date.parse(at)
  && (!account.endsAt || Date.parse(account.endsAt) >= Date.parse(at));

const toGrant = (row: ObjectPermissionRow): AuthorizationGrant => ({
  id: row.id,
  subjectAccountId: row.subjectAccountId,
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  actions: row.actions as readonly AuthorizationAction[],
  effect: row.effect,
  purpose: row.purpose,
  ...(row.familyBranchId ? { familyBranchId: row.familyBranchId } : {}),
  ...(row.ownershipBasisPoints === undefined ? {} : { ownershipBasisPoints: row.ownershipBasisPoints }),
  ...(row.denialReason ? { denialReason: row.denialReason } : {}),
  startsAt: row.startsAt,
  ...(row.endsAt ? { endsAt: row.endsAt } : {})
});

const loadActor = (
  dependencies: RepositoryBackedAiConsentDependencies,
  context: AiConsentApplicationContext,
  repository: RepositoryExecutionContext
): Result<{ account: AccountRow; grants: readonly AuthorizationGrant[] }, AppError> => {
  const account = dependencies.accountRepository.findById(repository, context.actor.userId);
  if (!account.ok) return account;
  if (!account.value || !isActiveAccount(account.value, repository.occurredAt)) {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'AI izinleri için etkin üyelik gereklidir.',
      category: 'authorization',
      correlationId: context.correlationId
    }));
  }
  const grants = dependencies.permissionRepository.listActiveForSubject(
    repository,
    context.actor.userId,
    repository.occurredAt
  );
  return grants.ok
    ? { ok: true, value: { account: account.value, grants: grants.value.map(toGrant) } }
    : grants;
};

export class RepositoryBackedSensitiveDataAuthorizationPort implements SensitiveDataAuthorizationPort {
  readonly #authorization = new CentralAuthorizationService();

  public constructor(private readonly dependencies: RepositoryBackedAiConsentDependencies) {}

  public authorize(context: AiConsentApplicationContext): Result<void, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, transaction);
      const actor = loadActor(this.dependencies, context, repository);
      if (!actor.ok) return actor;
      const decision = this.#authorization.authorize({
        accountId: actor.value.account.id,
        role: actor.value.account.role as AiConsentApplicationContext['actor']['role'],
        action: 'administer',
        resourceType: SENSITIVE_DATA_PROFILE_RESOURCE_TYPE,
        resourceId: '*',
        purpose: 'administration',
        occurredAt: repository.occurredAt,
        ...(actor.value.account.personId ? { actorPersonId: actor.value.account.personId } : {}),
        grants: actor.value.grants
      });
      return decision.allowed
        ? ok(undefined)
        : err(createAppError({
          code: ERROR_CODES.AUTHORIZATION_DENIED,
          message: 'Hassas veri izinlerini yönetme yetkisi bulunmuyor.',
          category: 'authorization',
          correlationId: context.correlationId
        }));
    });
  }
}

export class RepositoryBackedAiConsentQueryPort implements AiConsentQueryPort {
  readonly #authorization = new CentralAuthorizationService();

  public constructor(private readonly dependencies: RepositoryBackedAiConsentDependencies) {}

  public list(context: AiConsentApplicationContext): ReturnType<AiConsentQueryPort['list']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, transaction);
      const actor = loadActor(this.dependencies, context, repository);
      if (!actor.ok) return actor;
      return this.dependencies.consentRepository.list(repository, context.actor.userId);
    });
  }

  public preview(
    context: AiConsentApplicationContext,
    purpose: Parameters<AiConsentQueryPort['preview']>[1]
  ): ReturnType<AiConsentQueryPort['preview']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, transaction);
      const actor = loadActor(this.dependencies, context, repository);
      if (!actor.ok) return actor;
      const consents = this.dependencies.consentRepository.listActive(
        repository,
        context.actor.userId,
        purpose,
        repository.occurredAt
      );
      if (!consents.ok) return consents;
      const blocked = this.dependencies.consentRepository.countRevoked(repository, context.actor.userId, purpose);
      if (!blocked.ok) return blocked;
      const allowedResources: Array<{ resourceType: string; resourceId: string; title: string }> = [];
      for (const consent of consents.value.filter((candidate) => candidate.status === 'granted')) {
        const resources = this.dependencies.consentRepository.listAllowedResources(
          repository,
          consent.resourceType,
          consent.resourceId
        );
        if (!resources.ok) return resources;
        for (const item of resources.value) {
          const allowed = this.#authorization.authorize({
            accountId: actor.value.account.id,
            role: actor.value.account.role as AiConsentApplicationContext['actor']['role'],
            action: 'read',
            resourceType: item.resourceType,
            resourceId: item.resourceId,
            occurredAt: repository.occurredAt,
            ...(actor.value.account.personId ? { actorPersonId: actor.value.account.personId } : {}),
            grants: actor.value.grants
          }).allowed;
          if (allowed) allowedResources.push(item);
        }
      }
      return {
        ok: true,
        value: {
          purpose,
          allowedResources: [...new Map(allowedResources.map((item) => [`${item.resourceType}:${item.resourceId}`, item])).values()],
          blockedCount: blocked.value,
          generatedAt: repository.occurredAt
        }
      };
    });
  }

  public listSensitiveProfiles(
    context: AiConsentApplicationContext
  ): ReturnType<AiConsentQueryPort['listSensitiveProfiles']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, transaction);
      const actor = loadActor(this.dependencies, context, repository);
      if (!actor.ok) return actor;
      const consents = this.dependencies.consentRepository.list(repository, context.actor.userId);
      return consents.ok
        ? { ok: true, value: buildSensitiveDataProfiles(consents.value, repository.occurredAt) }
        : consents;
    });
  }

  public previewSensitiveExport(
    context: AiConsentApplicationContext,
    input: Parameters<AiConsentQueryPort['previewSensitiveExport']>[1],
    previewId: string
  ): ReturnType<AiConsentQueryPort['previewSensitiveExport']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, transaction);
      const actor = loadActor(this.dependencies, context, repository);
      if (!actor.ok) return actor;
      const consents = this.dependencies.consentRepository.list(repository, context.actor.userId);
      if (!consents.ok) return consents;
      const inventory = this.dependencies.consentRepository.listSensitiveDataInventory(repository, repository.occurredAt);
      if (!inventory.ok) return inventory;
      return {
        ok: true,
        value: buildSensitiveExportPreview({
          consents: consents.value,
          inventory: inventory.value,
          request: input,
          previewId,
          generatedAt: repository.occurredAt
        })
      };
    });
  }
}

class RepositoryBackedAiConsentWriteScope implements AiConsentWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedAiConsentDependencies,
    private readonly repository: RepositoryExecutionContext,
    public readonly occurredAt: AiConsentWriteScope['occurredAt']
  ) {}

  public findIdentity(accountId: string, purpose: string, resourceType: string, resourceId: string) {
    return this.dependencies.consentRepository.findIdentity(this.repository, accountId, purpose, resourceType, resourceId);
  }

  public upsert(row: Parameters<AiConsentWriteScope['upsert']>[0]) {
    return this.dependencies.consentRepository.upsert(this.repository, row);
  }

  public appendAudit(input: Parameters<AiConsentWriteScope['appendAudit']>[0]) {
    return this.dependencies.auditRepository.append(this.repository, input);
  }
}

export class RepositoryBackedAiConsentUnitOfWork implements AiConsentUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedAiConsentDependencies) {}

  public execute<T>(
    context: AiConsentApplicationContext,
    operation: (scope: AiConsentWriteScope) => Result<T, AppError>
  ): Result<T, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, transaction);
      const actor = loadActor(this.dependencies, context, repository);
      if (!actor.ok) return actor;
      return operation(new RepositoryBackedAiConsentWriteScope(
        this.dependencies,
        repository,
        transaction.occurredAt
      ));
    });
  }
}
