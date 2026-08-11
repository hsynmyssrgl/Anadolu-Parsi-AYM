import { ERROR_CODES, createAppError, err, ok, type AppError, type Result, type UserId } from '@ppt/core';
import type {
  AuthAccountRecord,
  AuthApplicationContext,
  AuthApplicationUnitOfWork,
  AuthWriteScope,
  TrustedDeviceRecord,
  WindowsHelloRegistrationRecord
} from '@ppt/application';
import type { TransactionExecutor } from '@ppt/repository-contracts';
import type { DeviceSecretProtector } from './device-secret-protector.js';
import { isProtectedMfaSecret, isValidTotpSecret, protectMfaSecret, unprotectMfaSecret } from './mfa-secret-protection.js';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  BootstrapRepositoryPort,
  ObjectPermissionRepositoryPort,
  TrustedDeviceRepositoryPort,
  WindowsHelloRegistrationRepositoryPort,
  AccountRow,
  RepositoryExecutionContext,
  TrustedDeviceRow,
  WindowsHelloRegistrationRow
} from '@ppt/repository-contracts';

export interface RepositoryBackedAuthApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly accountRepository: AccountRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly bootstrapRepository: BootstrapRepositoryPort;
  readonly objectPermissionRepository: ObjectPermissionRepositoryPort;
  readonly trustedDeviceRepository: TrustedDeviceRepositoryPort;
  readonly windowsHelloRegistrationRepository: WindowsHelloRegistrationRepositoryPort;
  readonly mfaSecretProtector?: DeviceSecretProtector;
}

const toApplicationAccount = (
  account: AccountRow,
  secrets: { readonly active?: string; readonly pending?: string }
): AuthAccountRecord => ({
  id: account.id,
  displayName: account.displayName,
  email: account.email,
  passwordRecord: account.passwordRecord,
  role: account.role as AuthAccountRecord['role'],
  status: account.status,
  startsAt: account.startsAt,
  ...(account.endsAt ? { endsAt: account.endsAt } : {}),
  failedLoginCount: account.failedLoginCount,
  securityEpoch: account.securityEpoch,
  ...(account.lockedUntil ? { lockedUntil: account.lockedUntil } : {}),
  ...(secrets.active ? { totpSecret: secrets.active } : {}),
  ...(account.recoveryCodes ? { recoveryCodes: account.recoveryCodes } : {}),
  ...(secrets.pending ? { pendingTotpSecret: secrets.pending } : {}),
  ...(account.pendingRecoveryCodes ? { pendingRecoveryCodes: account.pendingRecoveryCodes } : {})
});

const secretProtectionError = (
  context: RepositoryExecutionContext,
  message: string,
  reason: string
): AppError => createAppError({
  code: ERROR_CODES.CORE_UNEXPECTED,
  message,
  category: 'security',
  correlationId: context.correlationId,
  details: { reason }
});

const toApplicationDevice = (device: TrustedDeviceRow): TrustedDeviceRecord => ({
  id: device.id,
  accountId: device.accountId,
  deviceId: device.deviceId,
  displayName: device.displayName,
  fingerprint: device.fingerprint,
  publicKeyPem: device.publicKeyPem,
  trustedAt: device.trustedAt,
  lastSeenAt: device.lastSeenAt,
  securityEpoch: device.securityEpoch,
  ...(device.revokedAt ? { revokedAt: device.revokedAt } : {})
});

const toApplicationWindowsHelloRegistration = (
  registration: WindowsHelloRegistrationRow
): WindowsHelloRegistrationRecord => ({
  id: registration.id,
  accountId: registration.accountId,
  deviceId: registration.deviceId,
  deviceFingerprint: registration.deviceFingerprint,
  windowsPrincipalHash: registration.windowsPrincipalHash,
  displayName: registration.displayName,
  securityEpoch: registration.securityEpoch,
  enrolledAt: registration.enrolledAt,
  ...(registration.lastVerifiedAt ? { lastVerifiedAt: registration.lastVerifiedAt } : {}),
  ...(registration.revokedAt ? { revokedAt: registration.revokedAt } : {}),
  ...(registration.revocationReason ? { revocationReason: registration.revocationReason } : {})
});

class RepositoryBackedAuthWriteScope implements AuthWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedAuthApplicationDependencies,
    private readonly repositoryContext: RepositoryExecutionContext,
    public readonly occurredAt: AuthWriteScope['occurredAt']
  ) {}

  private decodeStoredSecret(
    storedValue: string,
    label: 'active' | 'pending'
  ): Result<{ readonly secret: string; readonly protectedValue?: string }, AppError> {
    const protector = this.dependencies.mfaSecretProtector;
    if (isProtectedMfaSecret(storedValue)) {
      if (!protector) {
        return err(secretProtectionError(this.repositoryContext, 'Şifreli iki aşamalı doğrulama sırrı açılamadı.', 'protector_missing'));
      }
      try {
        return ok({ secret: unprotectMfaSecret(protector, storedValue) });
      } catch {
        return err(secretProtectionError(this.repositoryContext, 'Şifreli iki aşamalı doğrulama sırrı açılamadı.', `${label}_decrypt_failed`));
      }
    }
    if (!isValidTotpSecret(storedValue)) {
      return err(secretProtectionError(this.repositoryContext, 'İki aşamalı doğrulama sırrı biçimi geçersiz.', `${label}_invalid_plaintext`));
    }
    if (protector?.isAvailable()) {
      try {
        return ok({ secret: storedValue, protectedValue: protectMfaSecret(protector, storedValue) });
      } catch {
        return err(secretProtectionError(this.repositoryContext, 'İki aşamalı doğrulama sırrı güvenli depolamaya taşınamadı.', `${label}_migration_protection_failed`));
      }
    }
    if (protector?.required) {
      return err(secretProtectionError(this.repositoryContext, 'İşletim sistemi iki aşamalı doğrulama sırrı koruması kullanılamıyor.', 'required_protector_unavailable'));
    }
    return ok({ secret: storedValue });
  }

  private hydrateAccount(account: AccountRow): Result<AuthAccountRecord, AppError> {
    const active = account.totpSecret ? this.decodeStoredSecret(account.totpSecret, 'active') : ok(undefined);
    if (!active.ok) return active;
    const pending = account.pendingTotpSecret ? this.decodeStoredSecret(account.pendingTotpSecret, 'pending') : ok(undefined);
    if (!pending.ok) return pending;
    const migration = {
      accountId: account.id,
      ...(account.totpSecret && active.value?.protectedValue
        ? { active: { expectedPlaintext: account.totpSecret, protectedValue: active.value.protectedValue } }
        : {}),
      ...(account.pendingTotpSecret && pending.value?.protectedValue
        ? { pending: { expectedPlaintext: account.pendingTotpSecret, protectedValue: pending.value.protectedValue } }
        : {})
    };
    if (migration.active || migration.pending) {
      const migrated = this.dependencies.accountRepository.protectLegacyTwoFactorSecrets(this.repositoryContext, migration);
      if (!migrated.ok) return migrated;
      if (!migrated.value) {
        return err(secretProtectionError(this.repositoryContext, 'İki aşamalı doğrulama sırrı eşzamanlı değişiklik nedeniyle taşınamadı.', 'legacy_migration_conflict'));
      }
    }
    return ok(toApplicationAccount(account, {
      ...(active.value?.secret ? { active: active.value.secret } : {}),
      ...(pending.value?.secret ? { pending: pending.value.secret } : {})
    }));
  }

  private protectNewSecret(secret: string): Result<string, AppError> {
    const protector = this.dependencies.mfaSecretProtector;
    if (protector?.isAvailable()) {
      try {
        return ok(protectMfaSecret(protector, secret));
      } catch {
        return err(secretProtectionError(this.repositoryContext, 'İki aşamalı doğrulama sırrı güvenli depolamaya yazılamadı.', 'new_secret_protection_failed'));
      }
    }
    if (protector?.required) {
      return err(secretProtectionError(this.repositoryContext, 'İşletim sistemi iki aşamalı doğrulama sırrı koruması kullanılamıyor.', 'required_protector_unavailable'));
    }
    return isValidTotpSecret(secret)
      ? ok(secret)
      : err(secretProtectionError(this.repositoryContext, 'İki aşamalı doğrulama sırrı biçimi geçersiz.', 'new_secret_invalid'));
  }

  public countAccounts(): ReturnType<AuthWriteScope['countAccounts']> { return this.dependencies.accountRepository.count(this.repositoryContext); }
  public listAccounts(): ReturnType<AuthWriteScope['listAccounts']> {
    const result = this.dependencies.accountRepository.list(this.repositoryContext);
    if (!result.ok) return result;
    const accounts: AuthAccountRecord[] = [];
    for (const row of result.value) {
      const hydrated = this.hydrateAccount(row);
      if (!hydrated.ok) return hydrated;
      accounts.push(hydrated.value);
    }
    return ok(accounts);
  }
  public findAccountByEmail(email: string): ReturnType<AuthWriteScope['findAccountByEmail']> {
    const result = this.dependencies.accountRepository.findByEmail(this.repositoryContext, email);
    if (!result.ok) return result;
    if (!result.value) return ok(null);
    return this.hydrateAccount(result.value);
  }
  public findAccountById(accountId: UserId): ReturnType<AuthWriteScope['findAccountById']> {
    const result = this.dependencies.accountRepository.findById(this.repositoryContext, accountId);
    if (!result.ok) return result;
    if (!result.value) return ok(null);
    return this.hydrateAccount(result.value);
  }
  public insertAccount(input: Parameters<AuthWriteScope['insertAccount']>[0]): ReturnType<AuthWriteScope['insertAccount']> { return this.dependencies.accountRepository.insert(this.repositoryContext, input); }
  public seedInitialAdminFamily(
    input: Parameters<AuthWriteScope['seedInitialAdminFamily']>[0]
  ): ReturnType<AuthWriteScope['seedInitialAdminFamily']> {
    return this.dependencies.bootstrapRepository.seedIfEmpty(this.repositoryContext, {
      family: { id: input.familyId, name: input.familyName },
      people: [{
        id: input.personId,
        displayName: input.personDisplayName,
        relationshipType: 'Aile yöneticisi',
        generation: 1,
        branch: 'Ana Dal'
      }],
      relations: [],
      events: []
    }, this.repositoryContext.occurredAt);
  }
  public linkInitialAdminMembership(
    input: Parameters<AuthWriteScope['linkInitialAdminMembership']>[0]
  ): ReturnType<AuthWriteScope['linkInitialAdminMembership']> {
    return this.dependencies.accountRepository.updateMembership(this.repositoryContext, {
      accountId: input.accountId,
      role: 'family_admin',
      status: 'active',
      personId: input.personId,
      startsAt: input.startsAt
    });
  }
  public recordLoginFailure(input: Parameters<AuthWriteScope['recordLoginFailure']>[0]): ReturnType<AuthWriteScope['recordLoginFailure']> { return this.dependencies.accountRepository.recordLoginFailure(this.repositoryContext, input); }
  public clearLoginFailures(accountId: UserId): ReturnType<AuthWriteScope['clearLoginFailures']> { return this.dependencies.accountRepository.clearLoginFailures(this.repositoryContext, accountId); }
  public advanceSecurityEpoch(accountId: UserId): ReturnType<AuthWriteScope['advanceSecurityEpoch']> { return this.dependencies.accountRepository.advanceSecurityEpoch(this.repositoryContext, accountId); }
  public updatePassword(accountId: UserId, passwordRecord: string): ReturnType<AuthWriteScope['updatePassword']> { return this.dependencies.accountRepository.updatePassword(this.repositoryContext, accountId, passwordRecord); }
  public savePendingTwoFactor(input: Parameters<AuthWriteScope['savePendingTwoFactor']>[0]): ReturnType<AuthWriteScope['savePendingTwoFactor']> {
    const protectedSecret = this.protectNewSecret(input.secret);
    if (!protectedSecret.ok) return protectedSecret;
    return this.dependencies.accountRepository.savePendingTwoFactor(this.repositoryContext, {
      ...input,
      secret: protectedSecret.value
    });
  }
  public enableTwoFactor(accountId: UserId): ReturnType<AuthWriteScope['enableTwoFactor']> { return this.dependencies.accountRepository.enableTwoFactor(this.repositoryContext, accountId); }
  public disableTwoFactor(accountId: UserId): ReturnType<AuthWriteScope['disableTwoFactor']> { return this.dependencies.accountRepository.disableTwoFactor(this.repositoryContext, accountId); }
  public updateRecoveryCodes(accountId: UserId, recoveryCodes: string): ReturnType<AuthWriteScope['updateRecoveryCodes']> { return this.dependencies.accountRepository.updateRecoveryCodes(this.repositoryContext, accountId, recoveryCodes); }
  public findTrustedDevice(accountId: UserId, deviceId: string): ReturnType<AuthWriteScope['findTrustedDevice']> {
    const result = this.dependencies.trustedDeviceRepository.findActive(this.repositoryContext, accountId, deviceId);
    return result.ok ? { ok: true, value: result.value ? toApplicationDevice(result.value) : null } : result;
  }
  public listTrustedDevices(accountId: UserId): ReturnType<AuthWriteScope['listTrustedDevices']> {
    const result = this.dependencies.trustedDeviceRepository.listByAccount(this.repositoryContext, accountId);
    return result.ok ? { ok: true, value: result.value.map(toApplicationDevice) } : result;
  }
  public upsertTrustedDevice(input: TrustedDeviceRecord): ReturnType<AuthWriteScope['upsertTrustedDevice']> { return this.dependencies.trustedDeviceRepository.upsert(this.repositoryContext, input); }
  public upsertInitialAdminArchivePermission(
    input: Parameters<AuthWriteScope['upsertInitialAdminArchivePermission']>[0]
  ): ReturnType<AuthWriteScope['upsertInitialAdminArchivePermission']> {
    return this.dependencies.objectPermissionRepository.upsert(this.repositoryContext, {
      id: input.id,
      subjectAccountId: input.subjectAccountId,
      resourceType: input.resourceType,
      resourceId: '*',
      actions: ['read', 'create', 'update', 'delete', 'record'],
      effect: 'allow',
      purpose: 'archive',
      startsAt: input.startsAt,
      createdAt: input.createdAt
    });
  }
  public touchTrustedDevice(accountId: UserId, deviceId: string, lastSeenAt: AuthWriteScope['occurredAt']): ReturnType<AuthWriteScope['touchTrustedDevice']> { return this.dependencies.trustedDeviceRepository.touch(this.repositoryContext, accountId, deviceId, lastSeenAt); }
  public revokeTrustedDevice(accountId: UserId, trustedDeviceId: string, revokedAt: AuthWriteScope['occurredAt']): ReturnType<AuthWriteScope['revokeTrustedDevice']> { return this.dependencies.trustedDeviceRepository.revoke(this.repositoryContext, accountId, trustedDeviceId, revokedAt); }
  public revokeAllTrustedDevices(accountId: UserId, revokedAt: AuthWriteScope['occurredAt']): ReturnType<AuthWriteScope['revokeAllTrustedDevices']> { return this.dependencies.trustedDeviceRepository.revokeAll(this.repositoryContext, accountId, revokedAt); }
  public findActiveWindowsHelloRegistration(
    accountId: UserId,
    deviceId: string
  ): ReturnType<AuthWriteScope['findActiveWindowsHelloRegistration']> {
    const result = this.dependencies.windowsHelloRegistrationRepository.findActive(
      this.repositoryContext,
      accountId,
      deviceId
    );
    return result.ok
      ? ok(result.value ? toApplicationWindowsHelloRegistration(result.value) : null)
      : result;
  }
  public insertWindowsHelloRegistration(
    input: WindowsHelloRegistrationRecord
  ): ReturnType<AuthWriteScope['insertWindowsHelloRegistration']> {
    return this.dependencies.windowsHelloRegistrationRepository.insert(this.repositoryContext, input);
  }
  public markWindowsHelloVerified(
    input: Parameters<AuthWriteScope['markWindowsHelloVerified']>[0]
  ): ReturnType<AuthWriteScope['markWindowsHelloVerified']> {
    return this.dependencies.windowsHelloRegistrationRepository.markVerified(this.repositoryContext, input);
  }
  public revokeActiveWindowsHelloRegistration(
    input: Parameters<AuthWriteScope['revokeActiveWindowsHelloRegistration']>[0]
  ): ReturnType<AuthWriteScope['revokeActiveWindowsHelloRegistration']> {
    return this.dependencies.windowsHelloRegistrationRepository.revokeActiveForDevice(
      this.repositoryContext,
      input
    );
  }
  public appendAudit(input: Parameters<AuthWriteScope['appendAudit']>[0]): ReturnType<AuthWriteScope['appendAudit']> { return this.dependencies.auditRepository.append(this.repositoryContext, input); }
}

export class RepositoryBackedAuthApplicationUnitOfWork implements AuthApplicationUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedAuthApplicationDependencies) {}
  public execute<TValue>(context: AuthApplicationContext, actorId: UserId, operation: (scope: AuthWriteScope) => Result<TValue, AppError>): Result<TValue, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repositoryContext: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: { userId: actorId, roles: ['authentication'] },
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      };
      return operation(new RepositoryBackedAuthWriteScope(this.dependencies, repositoryContext, transaction.occurredAt));
    });
  }
}
