import {
  ERROR_CODES,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  assessPassword,
  type AuthStateView,
  type ChangePasswordInput,
  type DisableTwoFactorInput,
  type EnableTwoFactorInput,
  type FamilyRole,
  type LoginInput,
  type LocalProfileView,
  type ReauthorizeCurrentDeviceInput,
  type SetupAdminInput,
  type TrustedDeviceView,
  type TrustCurrentDeviceInput,
  type TwoFactorSetupView
} from '@ppt/domain';
import { createAccountSecurityEpochRotationPlan, isSessionSecurityEpochCurrent, isTrustedDeviceSecurityEpochCurrent } from './security-epoch.js';

export interface AuthAccountRecord {
  readonly id: UserId;
  readonly displayName: string;
  readonly email: string;
  readonly passwordRecord: string;
  readonly role: FamilyRole;
  readonly status: string;
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly failedLoginCount: number;
  readonly securityEpoch: number;
  readonly lockedUntil?: IsoDateTime;
  readonly totpSecret?: string;
  readonly recoveryCodes?: string;
  readonly pendingTotpSecret?: string;
  readonly pendingRecoveryCodes?: string;
}

export interface TrustedDeviceRecord {
  readonly id: string;
  readonly accountId: UserId;
  readonly deviceId: string;
  readonly displayName: string;
  readonly fingerprint: string;
  readonly publicKeyPem: string;
  readonly trustedAt: IsoDateTime;
  readonly lastSeenAt: IsoDateTime;
  readonly securityEpoch: number;
  readonly revokedAt?: IsoDateTime;
}

export const INITIAL_ADMIN_ARCHIVE_RESOURCE_TYPES = [
  'archive_item',
  'archive_retention_policy',
  'archive_category'
] as const;

export type InitialAdminArchiveResourceType = typeof INITIAL_ADMIN_ARCHIVE_RESOURCE_TYPES[number];

export interface InitialAdminArchivePermissionRecord {
  readonly id: string;
  readonly subjectAccountId: UserId;
  readonly resourceType: InitialAdminArchiveResourceType;
  readonly startsAt: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface InitialAdminFamilyRecord {
  readonly familyId: FamilyId;
  readonly familyName: string;
  readonly personId: PersonId;
  readonly personDisplayName: string;
}

export type WindowsHelloRegistrationRevocationReason =
  | 'manual'
  | 'reenrolled'
  | 'device_changed'
  | 'principal_changed'
  | 'security_epoch_changed';

export interface WindowsHelloRegistrationRecord {
  readonly id: string;
  readonly accountId: UserId;
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly windowsPrincipalHash: string;
  readonly displayName: string;
  readonly securityEpoch: number;
  readonly enrolledAt: IsoDateTime;
  readonly lastVerifiedAt?: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
  readonly revocationReason?: WindowsHelloRegistrationRevocationReason;
}

export interface DeviceProof {
  readonly deviceId: string;
  readonly challenge: string;
  readonly signatureBase64: string;
}

export interface CurrentDeviceContext {
  readonly deviceId: string;
  readonly displayName: string;
  readonly fingerprint: string;
  readonly publicKeyPem: string;
  readonly proof: DeviceProof;
}

export interface AuthApplicationContext {
  readonly correlationId: CorrelationId;
}

export interface AuthWriteScope {
  readonly occurredAt: IsoDateTime;
  countAccounts(): Result<number, AppError>;
  listAccounts(): Result<readonly AuthAccountRecord[], AppError>;
  findAccountByEmail(email: string): Result<AuthAccountRecord | null, AppError>;
  findAccountById(accountId: UserId): Result<AuthAccountRecord | null, AppError>;
  insertAccount(input: {
    readonly id: UserId;
    readonly displayName: string;
    readonly email: string;
    readonly passwordRecord: string;
    readonly role: FamilyRole;
    readonly status: string;
    readonly startsAt: IsoDateTime;
    readonly createdAt: IsoDateTime;
  }): Result<void, AppError>;
  seedInitialAdminFamily(input: InitialAdminFamilyRecord): Result<boolean, AppError>;
  linkInitialAdminMembership(input: {
    readonly accountId: UserId;
    readonly personId: PersonId;
    readonly startsAt: IsoDateTime;
  }): Result<boolean, AppError>;
  recordLoginFailure(input: {
    readonly accountId: UserId;
    readonly failedLoginCount: number;
    readonly lockedUntil?: IsoDateTime;
  }): Result<void, AppError>;
  clearLoginFailures(accountId: UserId): Result<void, AppError>;
  advanceSecurityEpoch(accountId: UserId): Result<number, AppError>;
  updatePassword(accountId: UserId, passwordRecord: string): Result<void, AppError>;
  savePendingTwoFactor(input: { readonly accountId: UserId; readonly secret: string; readonly recoveryCodes: string }): Result<void, AppError>;
  enableTwoFactor(accountId: UserId): Result<void, AppError>;
  disableTwoFactor(accountId: UserId): Result<void, AppError>;
  updateRecoveryCodes(accountId: UserId, recoveryCodes: string): Result<void, AppError>;
  findTrustedDevice(accountId: UserId, deviceId: string): Result<TrustedDeviceRecord | null, AppError>;
  listTrustedDevices(accountId: UserId): Result<readonly TrustedDeviceRecord[], AppError>;
  upsertTrustedDevice(input: TrustedDeviceRecord): Result<void, AppError>;
  upsertInitialAdminArchivePermission(input: InitialAdminArchivePermissionRecord): Result<void, AppError>;
  touchTrustedDevice(accountId: UserId, deviceId: string, lastSeenAt: IsoDateTime): Result<void, AppError>;
  revokeTrustedDevice(accountId: UserId, trustedDeviceId: string, revokedAt: IsoDateTime): Result<void, AppError>;
  revokeAllTrustedDevices(accountId: UserId, revokedAt: IsoDateTime): Result<void, AppError>;
  findActiveWindowsHelloRegistration(
    accountId: UserId,
    deviceId: string
  ): Result<WindowsHelloRegistrationRecord | null, AppError>;
  insertWindowsHelloRegistration(input: WindowsHelloRegistrationRecord): Result<void, AppError>;
  markWindowsHelloVerified(input: {
    readonly registrationId: string;
    readonly accountId: UserId;
    readonly deviceId: string;
    readonly deviceFingerprint: string;
    readonly windowsPrincipalHash: string;
    readonly securityEpoch: number;
    readonly verifiedAt: IsoDateTime;
  }): Result<boolean, AppError>;
  revokeActiveWindowsHelloRegistration(input: {
    readonly registrationId: string;
    readonly accountId: UserId;
    readonly deviceId: string;
    readonly revokedAt: IsoDateTime;
    readonly reason: WindowsHelloRegistrationRevocationReason;
  }): Result<number, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
}

export interface AuthApplicationUnitOfWork {
  execute<TValue>(
    context: AuthApplicationContext,
    actorId: UserId,
    operation: (scope: AuthWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError>;
}

export interface PasswordService {
  hash(password: string): string;
  verify(password: string, serializedRecord: string): boolean;
}

export interface SecondFactorVerification {
  readonly valid: boolean;
  readonly method?: 'totp' | 'recovery';
  readonly remainingRecoveryCodes?: string;
}

export interface SecondFactorSetupMaterial {
  readonly secret: string;
  readonly recoveryCodes: readonly string[];
  readonly serializedRecoveryCodeHashes: string;
  readonly otpauthUri: string;
}

export interface SecondFactorService {
  createSetup(accountEmail: string): SecondFactorSetupMaterial;
  verify(secret: string, recoveryCodes: string | undefined, code: string, occurredAt: IsoDateTime): SecondFactorVerification;
  verifyTotp(secret: string, code: string, occurredAt: IsoDateTime): boolean;
}

export interface DeviceProofVerifier {
  verify(publicKeyPem: string, proof: DeviceProof): boolean;
}

export interface AuthSessionSnapshot {
  readonly active: boolean;
  readonly status: 'signed_out' | 'active' | 'warning' | 'locked';
  readonly accountId?: string;
  readonly expiresAt?: IsoDateTime;
  readonly warningAt?: IsoDateTime;
  readonly lockedAt?: IsoDateTime;
  readonly lockReason?: 'idle_timeout' | 'manual';
  readonly idleTimeoutMinutes: number;
  readonly warningBeforeSeconds: number;
  readonly secondsRemaining: number;
  readonly securityEpoch?: number;
}

export interface AuthSessionPort {
  start(accountId: UserId, securityEpoch?: number): void;
  clear(): void;
  currentAccountId(options?: { readonly touch?: boolean }): UserId | undefined;
  snapshot(): AuthSessionSnapshot;
  recordActivity(): AuthSessionSnapshot;
  lock(reason?: 'idle_timeout' | 'manual'): AuthSessionSnapshot;
}

export interface AuthIdentifiers {
  readonly accountId: UserId;
  readonly familyId: FamilyId;
  readonly personId: PersonId;
  readonly auditId: string;
  readonly familyAuditId: string;
  readonly membershipAuditId: string;
  readonly trustedDeviceId: string;
  readonly trustedDeviceAuditId: string;
  readonly archivePermissionIds: Readonly<Record<InitialAdminArchiveResourceType, string>>;
  readonly archivePermissionAuditIds: Readonly<Record<InitialAdminArchiveResourceType, string>>;
}

const validationError = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId
});

const authenticationError = (correlationId: CorrelationId, message = 'Profil veya parola hatalı.'): AppError => createAppError({
  code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
  message,
  category: 'authentication',
  correlationId
});

const secondFactorError = (correlationId: CorrelationId, required: boolean): AppError => createAppError({
  code: required ? ERROR_CODES.AUTH_SECOND_FACTOR_REQUIRED : ERROR_CODES.AUTH_SECOND_FACTOR_INVALID,
  message: required ? 'İki aşamalı doğrulama kodu gereklidir.' : 'İki aşamalı doğrulama kodu geçersiz.',
  category: 'authentication',
  correlationId
});

const authorizationError = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.AUTHENTICATION_REQUIRED,
  message,
  category: 'authentication',
  correlationId
});

const conflictError = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT,
  message,
  category: 'conflict',
  correlationId
});

const unexpectedError = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_UNEXPECTED,
  message,
  category: 'unexpected',
  correlationId
});

const notFoundError = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId
});

const profileInitials = (displayName: string): string => displayName
  .split(/\s+/u)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toLocaleUpperCase('tr-TR') ?? '')
  .join('');
const activeAt = (account: AuthAccountRecord, now: IsoDateTime): boolean => account.status === 'active'
  && Date.parse(account.startsAt) <= Date.parse(now)
  && (!account.endsAt || Date.parse(account.endsAt) >= Date.parse(now));
const parseRecoveryCodes = (value: string | undefined): readonly string[] => {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};
const validatePasswordPolicy = (password: string, correlationId: CorrelationId): Result<void, AppError> => {
  const assessment = assessPassword(password, 12);
  return assessment.valid ? ok(undefined) : err(validationError(correlationId, 'Parola en az 12 karakter, büyük harf, küçük harf, rakam ve simge içermelidir.'));
};
const requireSession = (session: AuthSessionPort, correlationId: CorrelationId): Result<UserId, AppError> => {
  const accountId = session.currentAccountId();
  return accountId ? ok(accountId) : err(authorizationError(correlationId, 'Bu işlem için oturum açılmalıdır.'));
};
const requireCurrentSessionEpoch = (session: AuthSessionPort, account: AuthAccountRecord, correlationId: CorrelationId): Result<void, AppError> => {
  const snapshot = session.snapshot();
  if (!snapshot.active || snapshot.accountId !== account.id || snapshot.securityEpoch === undefined || !isSessionSecurityEpochCurrent(account.securityEpoch, snapshot.securityEpoch)) {
    session.clear();
    return err(authorizationError(correlationId, 'Oturum güvenlik dönemi geçersiz. Lütfen yeniden giriş yapın.'));
  }
  return ok(undefined);
};

export class GetAuthStateUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly session: AuthSessionPort) {}
  public execute(context: AuthApplicationContext, currentDevice?: CurrentDeviceContext): Result<AuthStateView, AppError> {
    const session = this.session.snapshot();
    const actorId = session.accountId ? asUserId(session.accountId) : asUserId('anonymous-auth-state');
    return this.unitOfWork.execute<AuthStateView>(context, actorId, (scope) => {
      const count = scope.countAccounts();
      if (!count.ok) return count;
      const accounts = scope.listAccounts();
      if (!accounts.ok) return accounts;
      const profiles: LocalProfileView[] = accounts.value
        .filter((account) => activeAt(account, scope.occurredAt))
        .map((account) => ({
          id: account.id,
          displayName: account.displayName,
          role: account.role,
          initials: profileInitials(account.displayName)
        }));
      if (!session.active || !session.accountId) return ok({ initialized: count.value > 0, authenticated: false, profiles, ...(currentDevice ? { currentDeviceId: currentDevice.deviceId } : {}) });
      const account = scope.findAccountById(asUserId(session.accountId));
      if (!account.ok) return account;
      if (!account.value || !activeAt(account.value, scope.occurredAt)) {
        this.session.clear();
        return ok({ initialized: count.value > 0, authenticated: false, profiles, ...(currentDevice ? { currentDeviceId: currentDevice.deviceId } : {}) });
      }
      const epoch = requireCurrentSessionEpoch(this.session, account.value, context.correlationId);
      if (!epoch.ok) return ok({ initialized: count.value > 0, authenticated: false, profiles, ...(currentDevice ? { currentDeviceId: currentDevice.deviceId } : {}) });
      let trustedDevice = false;
      if (currentDevice) {
        const trusted = scope.findTrustedDevice(account.value.id, currentDevice.deviceId);
        if (!trusted.ok) return trusted;
        trustedDevice = Boolean(trusted.value && !trusted.value.revokedAt && trusted.value.fingerprint === currentDevice.fingerprint && isTrustedDeviceSecurityEpochCurrent(account.value.securityEpoch, trusted.value.securityEpoch));
      }
      return ok({
        initialized: true,
        authenticated: true,
        displayName: account.value.displayName,
        twoFactorEnabled: Boolean(account.value.totpSecret),
        role: account.value.role,
        securityEpoch: account.value.securityEpoch,
        ...(session.securityEpoch === undefined ? {} : { sessionSecurityEpoch: session.securityEpoch }),
        deviceReauthorizationRequired: account.value.securityEpoch > 0 && Boolean(account.value.totpSecret) && !trustedDevice,
        recoveryCodesRemaining: parseRecoveryCodes(account.value.recoveryCodes).length,
        ...(session.expiresAt ? { sessionExpiresAt: session.expiresAt } : {}),
        ...(currentDevice ? { currentDeviceId: currentDevice.deviceId, trustedDevice } : {})
      });
    });
  }
}

export class SetupAdminUseCase {
  public constructor(
    private readonly unitOfWork: AuthApplicationUnitOfWork,
    private readonly passwordService: PasswordService,
    private readonly deviceProofVerifier: DeviceProofVerifier,
    private readonly session: AuthSessionPort
  ) {}
  public execute(input: {
    readonly context: AuthApplicationContext;
    readonly command: SetupAdminInput;
    readonly identifiers: AuthIdentifiers;
    readonly currentDevice: CurrentDeviceContext;
  }): Result<UserId, AppError> {
    const displayName = input.command.displayName.trim();
    if (displayName.length < 2 || displayName.length > 120) return err(validationError(input.context.correlationId, 'Ad soyad 2 ile 120 karakter arasında olmalıdır.'));
    const familyName = input.command.familyName?.trim() || 'Ailem';
    if (familyName.length < 2 || familyName.length > 120) return err(validationError(input.context.correlationId, 'Aile adı 2 ile 120 karakter arasında olmalıdır.'));
    const passwordPolicy = validatePasswordPolicy(input.command.password, input.context.correlationId);
    if (!passwordPolicy.ok) return passwordPolicy;
    const expectedDeviceChallenge = `setup-admin:${input.context.correlationId}`;
    const deviceProofValid = input.currentDevice.deviceId.length > 0
      && input.currentDevice.proof.deviceId === input.currentDevice.deviceId
      && input.currentDevice.proof.challenge === expectedDeviceChallenge
      && /^[a-f0-9]{64}$/u.test(input.currentDevice.fingerprint)
      && input.currentDevice.publicKeyPem.trim().length > 0
      && this.deviceProofVerifier.verify(input.currentDevice.publicKeyPem, input.currentDevice.proof);
    if (!deviceProofValid) {
      return err(createAppError({
        code: ERROR_CODES.AUTH_DEVICE_NOT_TRUSTED,
        message: 'Ä°lk yÃ¶netici kurulumu iÃ§in yerel cihaz kimliÄŸi kanÄ±tlanamadÄ±.',
        category: 'security',
        correlationId: input.context.correlationId
      }));
    }
    let passwordRecord: string;
    try { passwordRecord = this.passwordService.hash(input.command.password); }
    catch { return err(validationError(input.context.correlationId, 'Parola güvenlik politikasını karşılamıyor.')); }
    const result = this.unitOfWork.execute(input.context, input.identifiers.accountId, (scope) => {
      const count = scope.countAccounts();
      if (!count.ok) return count;
      if (count.value > 0) return err(conflictError(input.context.correlationId, 'Yönetici hesabı zaten oluşturulmuş.'));
      const legacyEmail = input.command.email?.trim().toLowerCase();
      if (legacyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(legacyEmail)) return err(validationError(input.context.correlationId, 'Geçerli yerel kimlik gereklidir.'));
      const localIdentity = legacyEmail || `${input.identifiers.accountId}@local.pardus`;
      const seededFamily = scope.seedInitialAdminFamily({
        familyId: input.identifiers.familyId,
        familyName,
        personId: input.identifiers.personId,
        personDisplayName: displayName
      });
      if (!seededFamily.ok) return seededFamily;
      if (!seededFamily.value) {
        return err(conflictError(input.context.correlationId, 'Başlangıç aile verisi zaten oluşturulmuş.'));
      }
      const familyAudit = scope.appendAudit({
        id: input.identifiers.familyAuditId,
        action: 'database.seeded',
        resourceType: 'family',
        resourceId: input.identifiers.familyId,
        occurredAt: scope.occurredAt,
        actorId: input.identifiers.accountId
      });
      if (!familyAudit.ok) return familyAudit;
      const inserted = scope.insertAccount({ id: input.identifiers.accountId, displayName, email: localIdentity, passwordRecord, role: 'family_admin', status: 'active', startsAt: scope.occurredAt, createdAt: scope.occurredAt });
      if (!inserted.ok) return inserted;
      const accountAudit = scope.appendAudit({ id: input.identifiers.auditId, action: 'account.created', resourceType: 'account', resourceId: input.identifiers.accountId, occurredAt: scope.occurredAt, actorId: input.identifiers.accountId });
      if (!accountAudit.ok) return accountAudit;
      const membership = scope.linkInitialAdminMembership({
        accountId: input.identifiers.accountId,
        personId: input.identifiers.personId,
        startsAt: scope.occurredAt
      });
      if (!membership.ok) return membership;
      if (!membership.value) {
        return err(unexpectedError(input.context.correlationId, 'Yönetici hesabı aile profiline bağlanamadı.'));
      }
      const membershipAudit = scope.appendAudit({
        id: input.identifiers.membershipAuditId,
        action: 'account.initial_family_membership_created',
        resourceType: 'account',
        resourceId: input.identifiers.accountId,
        occurredAt: scope.occurredAt,
        actorId: input.identifiers.accountId
      });
      if (!membershipAudit.ok) return membershipAudit;
      const trustedDevice = scope.upsertTrustedDevice({
        id: input.identifiers.trustedDeviceId,
        accountId: input.identifiers.accountId,
        deviceId: input.currentDevice.deviceId,
        displayName: input.currentDevice.displayName,
        fingerprint: input.currentDevice.fingerprint,
        publicKeyPem: input.currentDevice.publicKeyPem,
        trustedAt: scope.occurredAt,
        lastSeenAt: scope.occurredAt,
        securityEpoch: 0
      });
      if (!trustedDevice.ok) return trustedDevice;
      const deviceAudit = scope.appendAudit({
        id: input.identifiers.trustedDeviceAuditId,
        action: 'device.initially_trusted',
        resourceType: 'trusted_device',
        resourceId: input.identifiers.trustedDeviceId,
        occurredAt: scope.occurredAt,
        actorId: input.identifiers.accountId
      });
      if (!deviceAudit.ok) return deviceAudit;
      for (const resourceType of INITIAL_ADMIN_ARCHIVE_RESOURCE_TYPES) {
        const permission = scope.upsertInitialAdminArchivePermission({
          id: input.identifiers.archivePermissionIds[resourceType],
          subjectAccountId: input.identifiers.accountId,
          resourceType,
          startsAt: scope.occurredAt,
          createdAt: scope.occurredAt
        });
        if (!permission.ok) return permission;
        const permissionAudit = scope.appendAudit({
          id: input.identifiers.archivePermissionAuditIds[resourceType],
          action: 'object_permission.initial_archive_grant_created',
          resourceType: 'object_permission',
          resourceId: input.identifiers.archivePermissionIds[resourceType],
          occurredAt: scope.occurredAt,
          actorId: input.identifiers.accountId
        });
        if (!permissionAudit.ok) return permissionAudit;
      }
      return ok(input.identifiers.accountId);
    });
    if (result.ok) this.session.start(result.value, 0);
    return result;
  }
}

export class LoginUseCase {
  public constructor(
    private readonly unitOfWork: AuthApplicationUnitOfWork,
    private readonly passwordService: PasswordService,
    private readonly secondFactorService: SecondFactorService,
    private readonly deviceProofVerifier: DeviceProofVerifier,
    private readonly session: AuthSessionPort,
    private readonly policy: { readonly maximumFailedAttempts: number; readonly lockMinutes: number }
  ) {}
  public execute(input: { readonly context: AuthApplicationContext; readonly command: LoginInput; readonly auditId: string; readonly recoveryAuditId: string; readonly currentDevice?: CurrentDeviceContext }): Result<UserId, AppError> {
    const accountIdValue = input.command.accountId?.trim();
    const legacyEmail = input.command.email?.trim().toLowerCase();
    if ((!accountIdValue && !legacyEmail) || input.command.password.length === 0) return err(authenticationError(input.context.correlationId));
    const anonymous = asUserId('anonymous-login');
    const result = this.unitOfWork.execute<{ readonly kind: 'authenticated'; readonly accountId: UserId; readonly securityEpoch: number } | { readonly kind: 'invalid' }>(input.context, anonymous, (scope) => {
      const found = accountIdValue ? scope.findAccountById(asUserId(accountIdValue)) : scope.findAccountByEmail(legacyEmail!);
      if (!found.ok) return found;
      const account = found.value;
      if (!account) return err(authenticationError(input.context.correlationId));
      if (account.lockedUntil && Date.parse(account.lockedUntil) > Date.parse(scope.occurredAt)) return err(createAppError({ code: ERROR_CODES.AUTH_ACCOUNT_LOCKED, message: 'Hesap geçici olarak kilitli.', category: 'authentication', correlationId: input.context.correlationId, details: { lockedUntil: account.lockedUntil } }));
      if (!activeAt(account, scope.occurredAt)) return err(authenticationError(input.context.correlationId, 'Hesap etkin değil.'));
      if (!this.passwordService.verify(input.command.password, account.passwordRecord)) {
        const nextFailed = account.failedLoginCount + 1;
        const shouldLock = nextFailed >= this.policy.maximumFailedAttempts;
        const lockedUntil = shouldLock ? new Date(Date.parse(scope.occurredAt) + this.policy.lockMinutes * 60_000).toISOString() as IsoDateTime : undefined;
        const updated = scope.recordLoginFailure({ accountId: account.id, failedLoginCount: shouldLock ? 0 : nextFailed, ...(lockedUntil ? { lockedUntil } : {}) });
        if (!updated.ok) return updated;
        const audit = scope.appendAudit({ id: input.auditId, action: shouldLock ? 'account.locked' : 'session.login_failed', resourceType: 'account', resourceId: account.id, occurredAt: scope.occurredAt, actorId: account.id });
        return audit.ok ? ok({ kind: 'invalid' as const }) : audit;
      }
      let trusted = false;
      if (account.totpSecret && input.currentDevice) {
        const record = scope.findTrustedDevice(account.id, input.currentDevice.deviceId);
        if (!record.ok) return record;
        trusted = Boolean(record.value && !record.value.revokedAt && record.value.fingerprint === input.currentDevice.fingerprint && isTrustedDeviceSecurityEpochCurrent(account.securityEpoch, record.value.securityEpoch) && this.deviceProofVerifier.verify(record.value.publicKeyPem, input.currentDevice.proof));
        if (trusted) {
          const touched = scope.touchTrustedDevice(account.id, input.currentDevice.deviceId, scope.occurredAt);
          if (!touched.ok) return touched;
        }
      }
      if (account.totpSecret && !trusted) {
        const code = input.command.secondFactorCode?.trim();
        if (!code) return err(secondFactorError(input.context.correlationId, true));
        const verification = this.secondFactorService.verify(account.totpSecret, account.recoveryCodes, code, scope.occurredAt);
        if (!verification.valid) return err(secondFactorError(input.context.correlationId, false));
        if (verification.method === 'recovery' && verification.remainingRecoveryCodes !== undefined) {
          const updated = scope.updateRecoveryCodes(account.id, verification.remainingRecoveryCodes);
          if (!updated.ok) return updated;
          const recoveryAudit = scope.appendAudit({ id: input.recoveryAuditId, action: 'account.recovery_code_used', resourceType: 'account', resourceId: account.id, occurredAt: scope.occurredAt, actorId: account.id });
          if (!recoveryAudit.ok) return recoveryAudit;
        }
      }
      const cleared = scope.clearLoginFailures(account.id);
      if (!cleared.ok) return cleared;
      const audit = scope.appendAudit({ id: input.auditId, action: trusted ? 'session.started_trusted_device' : 'session.started', resourceType: 'account', resourceId: account.id, occurredAt: scope.occurredAt, actorId: account.id });
      return audit.ok ? ok({ kind: 'authenticated' as const, accountId: account.id, securityEpoch: account.securityEpoch }) : audit;
    });
    if (!result.ok) return result;
    if (result.value.kind === 'invalid') return err(authenticationError(input.context.correlationId));
    this.session.start(result.value.accountId, result.value.securityEpoch);
    return ok(result.value.accountId);
  }
}

export class LogoutUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly session: AuthSessionPort) {}
  public execute(context: AuthApplicationContext, auditId: string): Result<void, AppError> {
    const accountId = this.session.currentAccountId({ touch: false });
    if (!accountId) { this.session.clear(); return ok(undefined); }
    const result = this.unitOfWork.execute(context, accountId, (scope) => {
      const audit = scope.appendAudit({ id: auditId, action: 'session.ended', resourceType: 'account', resourceId: accountId, occurredAt: scope.occurredAt, actorId: accountId });
      return audit.ok ? ok(undefined) : audit;
    });
    this.session.clear();
    return result;
  }
}

export class ChangePasswordUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly passwordService: PasswordService, private readonly session: AuthSessionPort) {}
  public execute(input: { readonly context: AuthApplicationContext; readonly command: ChangePasswordInput; readonly auditId: string }): Result<void, AppError> {
    const required = requireSession(this.session, input.context.correlationId);
    if (!required.ok) return required;
    const passwordPolicy = validatePasswordPolicy(input.command.newPassword, input.context.correlationId);
    if (!passwordPolicy.ok) return passwordPolicy;
    if (input.command.currentPassword === input.command.newPassword) return err(validationError(input.context.correlationId, 'Yeni parola mevcut paroladan farklı olmalıdır.'));
    let nextRecord: string;
    try { nextRecord = this.passwordService.hash(input.command.newPassword); }
    catch { return err(validationError(input.context.correlationId, 'Yeni parola güvenlik politikasını karşılamıyor.')); }
    return this.unitOfWork.execute(input.context, required.value, (scope) => {
      const account = scope.findAccountById(required.value);
      if (!account.ok) return account;
      const epoch = account.value ? requireCurrentSessionEpoch(this.session, account.value, input.context.correlationId) : undefined;
      if (epoch && !epoch.ok) return epoch;
      if (!account.value || !this.passwordService.verify(input.command.currentPassword, account.value.passwordRecord)) return err(authenticationError(input.context.correlationId, 'Mevcut parola hatalı.'));
      const updated = scope.updatePassword(required.value, nextRecord);
      if (!updated.ok) return updated;
      const audit = scope.appendAudit({ id: input.auditId, action: 'account.password_changed', resourceType: 'account', resourceId: required.value, occurredAt: scope.occurredAt, actorId: required.value });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}

export class BeginTwoFactorSetupUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly secondFactorService: SecondFactorService, private readonly session: AuthSessionPort) {}
  public execute(context: AuthApplicationContext, auditId: string): Result<TwoFactorSetupView, AppError> {
    const required = requireSession(this.session, context.correlationId);
    if (!required.ok) return required;
    return this.unitOfWork.execute(context, required.value, (scope) => {
      const account = scope.findAccountById(required.value);
      if (!account.ok) return account;
      if (!account.value) return err(notFoundError(context.correlationId, 'Hesap bulunamadı.'));
      const epoch = requireCurrentSessionEpoch(this.session, account.value, context.correlationId);
      if (!epoch.ok) return epoch;
      const setup = this.secondFactorService.createSetup(account.value.email);
      const saved = scope.savePendingTwoFactor({ accountId: required.value, secret: setup.secret, recoveryCodes: setup.serializedRecoveryCodeHashes });
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({ id: auditId, action: 'account.two_factor_setup_started', resourceType: 'account', resourceId: required.value, occurredAt: scope.occurredAt, actorId: required.value });
      return audit.ok ? ok({ secret: setup.secret, otpauthUri: setup.otpauthUri, recoveryCodes: [...setup.recoveryCodes] }) : audit;
    });
  }
}

export class EnableTwoFactorUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly secondFactorService: SecondFactorService, private readonly session: AuthSessionPort) {}
  public execute(context: AuthApplicationContext, command: EnableTwoFactorInput, auditId: string): Result<void, AppError> {
    const required = requireSession(this.session, context.correlationId);
    if (!required.ok) return required;
    return this.unitOfWork.execute(context, required.value, (scope) => {
      const account = scope.findAccountById(required.value);
      if (!account.ok) return account;
      if (account.value) { const epoch = requireCurrentSessionEpoch(this.session, account.value, context.correlationId); if (!epoch.ok) return epoch; }
      if (!account.value?.pendingTotpSecret || !account.value.pendingRecoveryCodes) return err(conflictError(context.correlationId, 'Bekleyen iki aşamalı doğrulama kurulumu bulunamadı.'));
      if (!this.secondFactorService.verifyTotp(account.value.pendingTotpSecret, command.code, scope.occurredAt)) return err(secondFactorError(context.correlationId, false));
      const enabled = scope.enableTwoFactor(required.value);
      if (!enabled.ok) return enabled;
      const revoked = scope.revokeAllTrustedDevices(required.value, scope.occurredAt);
      if (!revoked.ok) return revoked;
      const audit = scope.appendAudit({ id: auditId, action: 'account.two_factor_enabled', resourceType: 'account', resourceId: required.value, occurredAt: scope.occurredAt, actorId: required.value });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}

export class DisableTwoFactorUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly passwordService: PasswordService, private readonly secondFactorService: SecondFactorService, private readonly session: AuthSessionPort) {}
  public execute(context: AuthApplicationContext, command: DisableTwoFactorInput, auditId: string): Result<void, AppError> {
    const required = requireSession(this.session, context.correlationId);
    if (!required.ok) return required;
    return this.unitOfWork.execute(context, required.value, (scope) => {
      const account = scope.findAccountById(required.value);
      if (!account.ok) return account;
      const epoch = account.value ? requireCurrentSessionEpoch(this.session, account.value, context.correlationId) : undefined;
      if (epoch && !epoch.ok) return epoch;
      if (!account.value || !this.passwordService.verify(command.password, account.value.passwordRecord)) return err(authenticationError(context.correlationId, 'Parola hatalı.'));
      if (account.value.totpSecret) {
        const verification = this.secondFactorService.verify(account.value.totpSecret, account.value.recoveryCodes, command.code, scope.occurredAt);
        if (!verification.valid) return err(secondFactorError(context.correlationId, false));
      }
      const disabled = scope.disableTwoFactor(required.value);
      if (!disabled.ok) return disabled;
      const revoked = scope.revokeAllTrustedDevices(required.value, scope.occurredAt);
      if (!revoked.ok) return revoked;
      const audit = scope.appendAudit({ id: auditId, action: 'account.two_factor_disabled', resourceType: 'account', resourceId: required.value, occurredAt: scope.occurredAt, actorId: required.value });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}

export class TrustCurrentDeviceUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly passwordService: PasswordService, private readonly secondFactorService: SecondFactorService, private readonly deviceProofVerifier: DeviceProofVerifier, private readonly session: AuthSessionPort) {}
  public execute(input: { readonly context: AuthApplicationContext; readonly command: TrustCurrentDeviceInput; readonly currentDevice: CurrentDeviceContext; readonly trustedDeviceId: string; readonly auditId: string; readonly recoveryAuditId: string }): Result<void, AppError> {
    const required = requireSession(this.session, input.context.correlationId);
    if (!required.ok) return required;
    return this.unitOfWork.execute(input.context, required.value, (scope) => {
      const account = scope.findAccountById(required.value);
      if (!account.ok) return account;
      const epoch = account.value ? requireCurrentSessionEpoch(this.session, account.value, input.context.correlationId) : undefined;
      if (epoch && !epoch.ok) return epoch;
      if (!account.value || !this.passwordService.verify(input.command.password, account.value.passwordRecord)) return err(authenticationError(input.context.correlationId, 'Parola hatalı.'));
      if (!account.value.totpSecret) return err(conflictError(input.context.correlationId, 'Güvenilir cihaz kaydı için iki aşamalı doğrulama etkin olmalıdır.'));
      if (!this.deviceProofVerifier.verify(input.currentDevice.publicKeyPem, input.currentDevice.proof)) return err(createAppError({ code: ERROR_CODES.AUTH_DEVICE_NOT_TRUSTED, message: 'Cihaz kimliği kanıtlanamadı.', category: 'security', correlationId: input.context.correlationId }));
      const verification = this.secondFactorService.verify(account.value.totpSecret, account.value.recoveryCodes, input.command.code, scope.occurredAt);
      if (!verification.valid) return err(secondFactorError(input.context.correlationId, false));
      if (verification.method === 'recovery' && verification.remainingRecoveryCodes !== undefined) {
        const updated = scope.updateRecoveryCodes(required.value, verification.remainingRecoveryCodes);
        if (!updated.ok) return updated;
        const recoveryAudit = scope.appendAudit({ id: input.recoveryAuditId, action: 'account.recovery_code_used', resourceType: 'account', resourceId: required.value, occurredAt: scope.occurredAt, actorId: required.value });
        if (!recoveryAudit.ok) return recoveryAudit;
      }
      const saved = scope.upsertTrustedDevice({ id: input.trustedDeviceId, accountId: required.value, deviceId: input.currentDevice.deviceId, displayName: input.command.displayName?.trim() || input.currentDevice.displayName, fingerprint: input.currentDevice.fingerprint, publicKeyPem: input.currentDevice.publicKeyPem, trustedAt: scope.occurredAt, lastSeenAt: scope.occurredAt, securityEpoch: account.value.securityEpoch });
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({ id: input.auditId, action: 'device.trusted', resourceType: 'trusted_device', resourceId: input.trustedDeviceId, occurredAt: scope.occurredAt, actorId: required.value });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}

export interface ReauthorizeCurrentDeviceAfterRecoveryResult {
  readonly accountId: UserId;
  readonly securityEpoch: number;
  readonly trustedDeviceId: string;
  readonly auditId: string;
  readonly occurredAt: IsoDateTime;
}

export class ReauthorizeCurrentDeviceAfterRecoveryUseCase {
  public constructor(
    private readonly unitOfWork: AuthApplicationUnitOfWork,
    private readonly passwordService: PasswordService,
    private readonly secondFactorService: SecondFactorService,
    private readonly deviceProofVerifier: DeviceProofVerifier,
    private readonly session: AuthSessionPort
  ) {}

  public execute(input: {
    readonly context: AuthApplicationContext;
    readonly command: ReauthorizeCurrentDeviceInput;
    readonly currentDevice: CurrentDeviceContext;
    readonly trustedDeviceId: string;
    readonly auditId: string;
    readonly recoveryAuditId: string;
  }): Result<ReauthorizeCurrentDeviceAfterRecoveryResult, AppError> {
    const required = requireSession(this.session, input.context.correlationId);
    if (!required.ok) return required;
    if (input.command.confirmation !== 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR') {
      return err(validationError(input.context.correlationId, 'Cihaz yeniden yetkilendirme onayı eşleşmiyor.'));
    }
    return this.unitOfWork.execute(input.context, required.value, (scope) => {
      const account = scope.findAccountById(required.value);
      if (!account.ok) return account;
      if (!account.value) return err(notFoundError(input.context.correlationId, 'Hesap bulunamadı.'));
      const epoch = requireCurrentSessionEpoch(this.session, account.value, input.context.correlationId);
      if (!epoch.ok) return epoch;
      if (account.value.securityEpoch < 1) {
        return err(conflictError(input.context.correlationId, 'Bu hesap için kurtarma sonrası cihaz yeniden yetkilendirmesi gerekmiyor.'));
      }
      const existing = scope.findTrustedDevice(required.value, input.currentDevice.deviceId);
      if (!existing.ok) return existing;
      if (existing.value && !existing.value.revokedAt && existing.value.fingerprint === input.currentDevice.fingerprint && isTrustedDeviceSecurityEpochCurrent(account.value.securityEpoch, existing.value.securityEpoch)) {
        return err(conflictError(input.context.correlationId, 'Bu cihaz güncel güvenlik döneminde zaten yetkilidir.'));
      }
      if (!this.passwordService.verify(input.command.password, account.value.passwordRecord)) {
        return err(authenticationError(input.context.correlationId, 'Parola hatalı.'));
      }
      if (!account.value.totpSecret) {
        return err(conflictError(input.context.correlationId, 'Kurtarma sonrası cihaz yeniden yetkilendirmesi için iki aşamalı doğrulama etkin olmalıdır.'));
      }
      if (!this.deviceProofVerifier.verify(input.currentDevice.publicKeyPem, input.currentDevice.proof)) {
        return err(createAppError({ code: ERROR_CODES.AUTH_DEVICE_NOT_TRUSTED, message: 'Cihaz kimliği kanıtlanamadı.', category: 'security', correlationId: input.context.correlationId }));
      }
      const verification = this.secondFactorService.verify(account.value.totpSecret, account.value.recoveryCodes, input.command.code, scope.occurredAt);
      if (!verification.valid) return err(secondFactorError(input.context.correlationId, false));
      if (verification.method === 'recovery' && verification.remainingRecoveryCodes !== undefined) {
        const updated = scope.updateRecoveryCodes(required.value, verification.remainingRecoveryCodes);
        if (!updated.ok) return updated;
        const recoveryAudit = scope.appendAudit({ id: input.recoveryAuditId, action: 'account.recovery_code_used', resourceType: 'account', resourceId: required.value, occurredAt: scope.occurredAt, actorId: required.value });
        if (!recoveryAudit.ok) return recoveryAudit;
      }
      const saved = scope.upsertTrustedDevice({
        id: input.trustedDeviceId,
        accountId: required.value,
        deviceId: input.currentDevice.deviceId,
        displayName: input.command.displayName?.trim() || input.currentDevice.displayName,
        fingerprint: input.currentDevice.fingerprint,
        publicKeyPem: input.currentDevice.publicKeyPem,
        trustedAt: scope.occurredAt,
        lastSeenAt: scope.occurredAt,
        securityEpoch: account.value.securityEpoch
      });
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.auditId,
        action: 'device.reauthorized_after_security_epoch_rotation',
        resourceType: 'trusted_device',
        resourceId: input.trustedDeviceId,
        occurredAt: scope.occurredAt,
        actorId: required.value
      });
      return audit.ok ? ok({
        accountId: required.value,
        securityEpoch: account.value.securityEpoch,
        trustedDeviceId: input.trustedDeviceId,
        auditId: input.auditId,
        occurredAt: scope.occurredAt
      }) : audit;
    });
  }
}

export interface RotateAccountSecurityEpochAfterRecoveryResult {
  readonly previousSecurityEpoch: number;
  readonly securityEpoch: number;
  readonly revokedTrustedDeviceCount: number;
}

export class RotateAccountSecurityEpochAfterRecoveryUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly session: AuthSessionPort) {}

  public execute(context: AuthApplicationContext, auditId: string): Result<RotateAccountSecurityEpochAfterRecoveryResult, AppError> {
    const required = requireSession(this.session, context.correlationId);
    if (!required.ok) return required;
    return this.unitOfWork.execute(context, required.value, (scope) => {
      const account = scope.findAccountById(required.value);
      if (!account.ok) return account;
      if (!account.value) return err(notFoundError(context.correlationId, 'Hesap bulunamadı.'));
      const epoch = requireCurrentSessionEpoch(this.session, account.value, context.correlationId);
      if (!epoch.ok) return epoch;
      const devices = scope.listTrustedDevices(required.value);
      if (!devices.ok) return devices;
      const rotationPlan = createAccountSecurityEpochRotationPlan(
        account.value.securityEpoch,
        devices.value.filter((device) => !device.revokedAt).length
      );
      const advanced = scope.advanceSecurityEpoch(required.value);
      if (!advanced.ok) return advanced;
      if (advanced.value !== rotationPlan.securityEpoch) {
        return err(conflictError(context.correlationId, 'Hesap güvenlik dönemi eşzamanlı değişiklik nedeniyle doğrulanamadı.'));
      }
      const revoked = scope.revokeAllTrustedDevices(required.value, scope.occurredAt);
      if (!revoked.ok) return revoked;
      const audit = scope.appendAudit({
        id: auditId,
        action: 'account.security_epoch_advanced_after_maintenance_recovery',
        resourceType: 'account',
        resourceId: required.value,
        occurredAt: scope.occurredAt,
        actorId: required.value
      });
      return audit.ok
        ? ok({
            ...rotationPlan,
            securityEpoch: advanced.value
          })
        : audit;
    });
  }
}

export class ListTrustedDevicesUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly session: AuthSessionPort) {}
  public execute(context: AuthApplicationContext, currentDeviceId: string): Result<readonly TrustedDeviceView[], AppError> {
    const required = requireSession(this.session, context.correlationId);
    if (!required.ok) return required;
    return this.unitOfWork.execute(context, required.value, (scope) => {
      const account = scope.findAccountById(required.value);
      if (!account.ok) return account;
      if (!account.value) return err(notFoundError(context.correlationId, 'Hesap bulunamadı.'));
      const epoch = requireCurrentSessionEpoch(this.session, account.value, context.correlationId);
      if (!epoch.ok) return epoch;
      const devices = scope.listTrustedDevices(required.value);
      return devices.ok ? ok(devices.value.map((device) => ({ id: device.id, deviceId: device.deviceId, displayName: device.displayName, fingerprint: device.fingerprint, trustedAt: device.trustedAt, lastSeenAt: device.lastSeenAt, securityEpoch: device.securityEpoch, current: device.deviceId === currentDeviceId, ...(device.revokedAt ? { revokedAt: device.revokedAt } : {}) }))) : devices;
    });
  }
}

export class RevokeTrustedDeviceUseCase {
  public constructor(private readonly unitOfWork: AuthApplicationUnitOfWork, private readonly session: AuthSessionPort) {}
  public execute(context: AuthApplicationContext, trustedDeviceId: string, auditId: string): Result<void, AppError> {
    const required = requireSession(this.session, context.correlationId);
    if (!required.ok) return required;
    return this.unitOfWork.execute(context, required.value, (scope) => {
      const account = scope.findAccountById(required.value);
      if (!account.ok) return account;
      if (!account.value) return err(notFoundError(context.correlationId, 'Hesap bulunamadı.'));
      const epoch = requireCurrentSessionEpoch(this.session, account.value, context.correlationId);
      if (!epoch.ok) return epoch;
      const devices = scope.listTrustedDevices(required.value);
      if (!devices.ok) return devices;
      if (!devices.value.some((device) => device.id === trustedDeviceId)) return err(notFoundError(context.correlationId, 'Güvenilir cihaz bulunamadı.'));
      const revoked = scope.revokeTrustedDevice(required.value, trustedDeviceId, scope.occurredAt);
      if (!revoked.ok) return revoked;
      const audit = scope.appendAudit({ id: auditId, action: 'device.trust_revoked', resourceType: 'trusted_device', resourceId: trustedDeviceId, occurredAt: scope.occurredAt, actorId: required.value });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}
